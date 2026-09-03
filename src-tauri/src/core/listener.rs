use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Runtime};

const LISTENER_FAILED_EVENT: &str = "input-listener-failed";

pub struct ListenerState {
    running: AtomicBool,
}

impl ListenerState {
    pub const fn new() -> Self {
        Self {
            running: AtomicBool::new(false),
        }
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    pub fn try_start(&self) -> bool {
        self.running
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
    }

    pub fn stop(&self) -> bool {
        self.running.swap(false, Ordering::SeqCst)
    }

    pub fn guard(&self) -> ListenerRunGuard<'_> {
        ListenerRunGuard { state: self }
    }
}

pub struct ListenerRunGuard<'a> {
    state: &'a ListenerState,
}

impl Drop for ListenerRunGuard<'_> {
    fn drop(&mut self) {
        self.state.stop();
    }
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ListenerSource {
    Device,
    Gamepad,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ListenerFailure {
    source: ListenerSource,
    message: String,
}

pub fn emit_listener_failure<R: Runtime>(
    app_handle: &AppHandle<R>,
    source: ListenerSource,
    message: String,
) {
    let _ = app_handle.emit(LISTENER_FAILED_EVENT, ListenerFailure { source, message });
}

#[cfg(test)]
mod tests {
    use super::ListenerState;

    #[test]
    fn listener_state_rejects_duplicate_start_and_can_restart() {
        let state = ListenerState::new();

        assert!(state.try_start());
        assert!(state.is_running());
        assert!(!state.try_start());

        assert!(state.stop());
        assert!(!state.is_running());
        assert!(!state.stop());

        assert!(state.try_start());
    }

    #[test]
    fn listener_guard_resets_state_when_a_run_ends() {
        let state = ListenerState::new();

        assert!(state.try_start());

        {
            let _guard = state.guard();
            assert!(state.is_running());
        }

        assert!(!state.is_running());
        assert!(state.try_start());
    }
}
