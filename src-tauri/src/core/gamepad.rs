use gilrs::{EventType, Gilrs};
use serde::Serialize;
use std::sync::Mutex;
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime, command};

use super::listener::{ListenerSource, ListenerState, emit_listener_failure};

const IDLE_POLL_INTERVAL: Duration = Duration::from_millis(8);

static LISTENER_STATE: ListenerState = ListenerState::new();
static LISTENER_THREAD: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize)]
pub enum GamepadEventKind {
    ButtonChanged,
    AxisChanged,
}

#[derive(Debug, Clone, Serialize)]
pub struct GamepadEvent {
    kind: GamepadEventKind,
    name: String,
    value: f32,
}

#[command]
pub fn start_gamepad_listing<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), String> {
    let mut listener_thread = LISTENER_THREAD
        .lock()
        .map_err(|_| "Gamepad listener thread lock is poisoned".to_string())?;

    if LISTENER_STATE.is_running() {
        return Ok(());
    }

    if let Some(thread) = listener_thread.take() {
        if thread.join().is_err() {
            let message = "Previous gamepad listener thread panicked".to_string();

            emit_listener_failure(&app_handle, ListenerSource::Gamepad, message.clone());

            return Err(message);
        }
    }

    let mut gilrs = Gilrs::new().map_err(|err| err.to_string())?;

    if !LISTENER_STATE.try_start() {
        return Ok(());
    }

    let thread = thread::Builder::new()
        .name("labu-loom-gamepad-listener".into())
        .spawn(move || {
            let _listener_guard = LISTENER_STATE.guard();

            while LISTENER_STATE.is_running() {
                let mut received_event = false;

                while let Some(event) = gilrs.next_event() {
                    received_event = true;

                    let gamepad_event = match event.event {
                        EventType::ButtonChanged(button, value, ..) => GamepadEvent {
                            kind: GamepadEventKind::ButtonChanged,
                            name: format!("{:?}", button),
                            value,
                        },
                        EventType::AxisChanged(axis, value, ..) => GamepadEvent {
                            kind: GamepadEventKind::AxisChanged,
                            name: format!("{:?}", axis),
                            value,
                        },
                        _ => continue,
                    };

                    let _ = app_handle.emit("gamepad-changed", gamepad_event);

                    if !LISTENER_STATE.is_running() {
                        break;
                    }
                }

                if !received_event {
                    thread::sleep(IDLE_POLL_INTERVAL);
                }
            }
        })
        .map_err(|error| {
            LISTENER_STATE.stop();

            format!("Failed to start gamepad listener thread: {error}")
        })?;

    *listener_thread = Some(thread);

    Ok(())
}

#[command]
pub fn stop_gamepad_listing() -> Result<(), String> {
    let thread = {
        let mut listener_thread = LISTENER_THREAD
            .lock()
            .map_err(|_| "Gamepad listener thread lock is poisoned".to_string())?;

        LISTENER_STATE.stop();

        listener_thread.take()
    };

    if let Some(thread) = thread {
        thread
            .join()
            .map_err(|_| "Gamepad listener thread panicked".to_string())?;
    }

    Ok(())
}
