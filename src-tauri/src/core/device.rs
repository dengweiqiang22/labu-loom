use rdev::{Event, EventType, listen};
use serde::Serialize;
use serde_json::{Value, json};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime, command};

use super::listener::{ListenerSource, ListenerState, emit_listener_failure};

const MOUSE_FRAME_INTERVAL: Duration = Duration::from_millis(16);

#[derive(Clone, Copy)]
struct CursorPoint {
    x: f64,
    y: f64,
}

struct MouseMoveBuffer {
    latest: Mutex<Option<CursorPoint>>,
}

impl MouseMoveBuffer {
    const fn new() -> Self {
        Self {
            latest: Mutex::new(None),
        }
    }

    fn replace(&self, cursor_point: CursorPoint) {
        *self
            .latest
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(cursor_point);
    }

    fn take(&self) -> Option<CursorPoint> {
        self.latest
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .take()
    }

    fn clear(&self) {
        let _ = self.take();
    }
}

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
static MOUSE_MOVE_BUFFER: MouseMoveBuffer = MouseMoveBuffer::new();

fn device_events_enabled() -> bool {
    DEVICE_EVENTS_ENABLED.load(Ordering::SeqCst)
}

#[command]
pub fn set_device_listening_enabled(enabled: bool) {
    DEVICE_EVENTS_ENABLED.store(enabled, Ordering::SeqCst);

    if !enabled {
        MOUSE_MOVE_BUFFER.clear();
    }
}

fn start_mouse_move_emitter<R: Runtime>(
    app_handle: AppHandle<R>,
    run: Arc<AtomicBool>,
) -> Result<(), String> {
    thread::Builder::new()
        .name("labu-loom-mouse-move-emitter".into())
        .spawn(move || {
            while run.load(Ordering::SeqCst) {
                thread::sleep(MOUSE_FRAME_INTERVAL);

                if !device_events_enabled() {
                    MOUSE_MOVE_BUFFER.clear();

                    continue;
                }

                let Some(cursor_point) = MOUSE_MOVE_BUFFER.take() else {
                    continue;
                };

                let _ = app_handle.emit(
                    "device-changed",
                    DeviceEvent {
                        kind: DeviceEventKind::MouseMove,
                        value: json!({ "x": cursor_point.x, "y": cursor_point.y }),
                    },
                );
            }

            MOUSE_MOVE_BUFFER.clear();
        })
        .map(|_| ())
        .map_err(|error| format!("Failed to start mouse move emitter thread: {error}"))
}

#[command]
pub fn start_device_listening<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), String> {
    if !LISTENER_STATE.try_start() {
        return Ok(());
    }

    let run = Arc::new(AtomicBool::new(true));

    if let Err(error) = start_mouse_move_emitter(app_handle.clone(), Arc::clone(&run)) {
        LISTENER_STATE.stop();

        return Err(error);
    }

    let listener_run = Arc::clone(&run);

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
                    EventType::MouseMove { x, y } => {
                        MOUSE_MOVE_BUFFER.replace(CursorPoint { x, y });

                        return;
                    }
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

            listener_run.store(false, Ordering::SeqCst);
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
            run.store(false, Ordering::SeqCst);
            LISTENER_STATE.stop();

            format!("Failed to start device listener thread: {error}")
        })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        CursorPoint, MouseMoveBuffer, device_events_enabled, set_device_listening_enabled,
    };

    #[test]
    fn device_events_can_be_disabled_and_reenabled() {
        set_device_listening_enabled(false);
        assert!(!device_events_enabled());

        set_device_listening_enabled(true);
        assert!(device_events_enabled());
    }

    #[test]
    fn mouse_move_buffer_keeps_only_the_latest_position() {
        let buffer = MouseMoveBuffer::new();

        for index in 0..1_000 {
            buffer.replace(CursorPoint {
                x: f64::from(index),
                y: f64::from(index * 2),
            });
        }

        let latest = buffer.take().expect("latest cursor position should exist");

        assert_eq!(latest.x, 999.0);
        assert_eq!(latest.y, 1_998.0);
        assert!(buffer.take().is_none());
    }

    #[test]
    fn mouse_move_buffer_can_be_cleared_without_emitting() {
        let buffer = MouseMoveBuffer::new();

        buffer.replace(CursorPoint { x: 12.0, y: 34.0 });
        buffer.clear();

        assert!(buffer.take().is_none());
    }
}
