use rdev::{Event, EventType, listen};
use serde::Serialize;
use serde_json::{Value, json};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use tauri::{AppHandle, Emitter, Runtime, command};

use super::listener::{ListenerSource, ListenerState, emit_listener_failure};

#[derive(Debug, Clone, Serialize)]
pub enum DeviceEventKind {
    MousePress,
    MouseRelease,
    MouseMove,
    KeyboardPress,
    KeyboardRelease,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeviceEvent {
    kind: DeviceEventKind,
    value: Value,
}

static LISTENER_STATE: ListenerState = ListenerState::new();
static DEVICE_EVENTS_ENABLED: AtomicBool = AtomicBool::new(true);

fn device_events_enabled() -> bool {
    DEVICE_EVENTS_ENABLED.load(Ordering::SeqCst)
}

#[command]
pub fn set_device_listening_enabled(enabled: bool) {
    DEVICE_EVENTS_ENABLED.store(enabled, Ordering::SeqCst);
}

#[command]
pub fn start_device_listening<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), String> {
    if !LISTENER_STATE.try_start() {
        return Ok(());
    }

    thread::Builder::new()
        .name("labu-loom-device-listener".into())
        .spawn(move || {
            let listener_guard = LISTENER_STATE.guard();
            let listener_app_handle = app_handle.clone();
            let result = listen(move |event: Event| {
                if !device_events_enabled() {
                    return;
                }

                let device_event = match event.event_type {
                    EventType::ButtonPress(button) => DeviceEvent {
                        kind: DeviceEventKind::MousePress,
                        value: json!(format!("{:?}", button)),
                    },
                    EventType::ButtonRelease(button) => DeviceEvent {
                        kind: DeviceEventKind::MouseRelease,
                        value: json!(format!("{:?}", button)),
                    },
                    EventType::MouseMove { x, y } => DeviceEvent {
                        kind: DeviceEventKind::MouseMove,
                        value: json!({ "x": x, "y": y }),
                    },
                    EventType::KeyPress(key) => DeviceEvent {
                        kind: DeviceEventKind::KeyboardPress,
                        value: json!(format!("{:?}", key)),
                    },
                    EventType::KeyRelease(key) => DeviceEvent {
                        kind: DeviceEventKind::KeyboardRelease,
                        value: json!(format!("{:?}", key)),
                    },
                    _ => return,
                };

                let _ = listener_app_handle.emit("device-changed", device_event);
            });

            drop(listener_guard);

            if let Err(error) = result {
                emit_listener_failure(
                    &app_handle,
                    ListenerSource::Device,
                    format!("Failed to listen for device events: {error:?}"),
                );
            }
        })
        .map_err(|error| {
            LISTENER_STATE.stop();

            format!("Failed to start device listener thread: {error}")
        })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{device_events_enabled, set_device_listening_enabled};

    #[test]
    fn device_events_can_be_disabled_and_reenabled() {
        set_device_listening_enabled(false);
        assert!(!device_events_enabled());

        set_device_listening_enabled(true);
        assert!(device_events_enabled());
    }
}
