use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Manager, State, Window};

use crate::util::lock_or_recover;

pub(crate) const FREEZE_AFTER: Duration = Duration::from_secs(30);
const TICK: Duration = Duration::from_secs(2);
const SUSPEND_GAP: Duration = Duration::from_secs(6);
const WALL_DRIFT: Duration = Duration::from_secs(5);
const MAX_LABEL: usize = 64;

#[derive(Debug, Clone, Copy)]
struct Beat {
    last: Instant,
    is_visible: bool,
    noted: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Frozen {
    pub(crate) label: String,
    pub(crate) silent_for: Duration,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum WindowState {
    Gone,
    Hidden,
    Showing,
}

#[derive(Default, Clone)]
pub struct Heartbeats(Arc<Mutex<HashMap<String, Beat>>>);

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HeartbeatReply {
    pub has_resumed: bool,
}

impl Heartbeats {
    pub(crate) fn beat(&self, label: &str, is_visible: bool, now: Instant) -> HeartbeatReply {
        let mut beats = lock_or_recover(&self.0);
        let key: String = label.chars().take(MAX_LABEL).collect();
        let beat = beats.entry(key).or_insert(Beat {
            last: now,
            is_visible,
            noted: false,
        });
        let has_resumed = beat.noted;
        *beat = Beat {
            last: now,
            is_visible,
            noted: false,
        };
        HeartbeatReply { has_resumed }
    }

    pub(crate) fn rebase_all(&self, now: Instant) {
        for beat in lock_or_recover(&self.0).values_mut() {
            beat.last = now;
        }
    }

    pub(crate) fn find_frozen(
        &self,
        now: Instant,
        window_state: impl Fn(&str) -> WindowState,
    ) -> Vec<Frozen> {
        let mut beats = lock_or_recover(&self.0);
        let mut frozen = Vec::new();
        beats.retain(|label, beat| match window_state(label) {
            WindowState::Gone => false,
            WindowState::Hidden => {
                beat.last = now;
                true
            }
            WindowState::Showing => {
                let silent_for = now.saturating_duration_since(beat.last);
                if beat.is_visible && !beat.noted && silent_for >= FREEZE_AFTER {
                    beat.noted = true;
                    frozen.push(Frozen {
                        label: label.clone(),
                        silent_for,
                    });
                }
                true
            }
        });
        frozen
    }
}

pub(crate) fn was_suspended(monotonic_gap: Duration, wall_gap: Duration) -> bool {
    monotonic_gap >= SUSPEND_GAP || wall_gap > monotonic_gap + WALL_DRIFT
}

fn window_state(app: &AppHandle, label: &str) -> WindowState {
    let Some(window) = app.get_webview_window(label) else {
        return WindowState::Gone;
    };
    let is_showing = window.is_visible().unwrap_or(true) && !window.is_minimized().unwrap_or(false);
    if is_showing {
        return WindowState::Showing;
    }
    WindowState::Hidden
}

pub fn start(app: AppHandle, beats: Heartbeats) {
    std::thread::spawn(move || {
        let mut last_tick = Instant::now();
        let mut last_wall = crate::util::system_now();
        loop {
            std::thread::sleep(TICK);
            let now = Instant::now();
            let wall = crate::util::system_now();
            let wall_gap = wall.duration_since(last_wall).unwrap_or_default();
            let was_asleep = was_suspended(now.saturating_duration_since(last_tick), wall_gap);
            last_tick = now;
            last_wall = wall;
            if was_asleep {
                beats.rebase_all(now);
                continue;
            }
            for frozen in beats.find_frozen(now, |label| window_state(&app, label)) {
                crate::last_crash::note_freeze(&frozen.label, frozen.silent_for);
            }
        }
    });
}

#[tauri::command]
pub async fn window_heartbeat(
    window: Window,
    state: State<'_, Heartbeats>,
    is_visible: bool,
) -> Result<HeartbeatReply, String> {
    Ok(state.beat(window.label(), is_visible, Instant::now()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn showing(_label: &str) -> WindowState {
        WindowState::Showing
    }

    #[test]
    fn a_visible_window_silent_past_the_limit_is_noted_once() {
        let beats = Heartbeats::default();
        let start = Instant::now();
        beats.beat("main", true, start);

        assert!(beats
            .find_frozen(start + Duration::from_secs(29), showing)
            .is_empty());
        let frozen = beats.find_frozen(start + Duration::from_secs(31), showing);
        let again = beats.find_frozen(start + Duration::from_secs(60), showing);

        assert_eq!(
            frozen,
            vec![Frozen {
                label: "main".to_string(),
                silent_for: Duration::from_secs(31),
            }]
        );
        assert!(again.is_empty());
    }

    #[test]
    fn a_beat_after_a_freeze_says_it_resumed_once() {
        let beats = Heartbeats::default();
        let start = Instant::now();
        beats.beat("main", true, start);
        beats.find_frozen(start + Duration::from_secs(40), showing);

        let first = beats.beat("main", true, start + Duration::from_secs(45));
        let second = beats.beat("main", true, start + Duration::from_secs(50));

        assert!(first.has_resumed);
        assert!(!second.has_resumed);
    }

    #[test]
    fn a_window_that_said_it_is_hidden_is_not_a_freeze() {
        let beats = Heartbeats::default();
        let start = Instant::now();
        beats.beat("main", false, start);

        assert!(beats
            .find_frozen(start + Duration::from_secs(300), showing)
            .is_empty());
    }

    #[test]
    fn a_window_the_system_hid_or_minimized_is_not_a_freeze_and_gets_a_fresh_start() {
        let beats = Heartbeats::default();
        let start = Instant::now();
        beats.beat("main", true, start);

        let hidden = beats.find_frozen(start + Duration::from_secs(300), |_| WindowState::Hidden);
        let shown = beats.find_frozen(start + Duration::from_secs(310), showing);

        assert!(hidden.is_empty());
        assert!(shown.is_empty());
    }

    #[test]
    fn a_closed_window_is_forgotten_and_never_noted() {
        let beats = Heartbeats::default();
        let start = Instant::now();
        beats.beat("win-2", true, start);

        let gone = beats.find_frozen(start + Duration::from_secs(300), |_| WindowState::Gone);
        let later = beats.find_frozen(start + Duration::from_secs(600), showing);

        assert!(gone.is_empty());
        assert!(later.is_empty());
    }

    #[test]
    fn the_sleep_of_the_machine_is_not_a_freeze() {
        let beats = Heartbeats::default();
        let start = Instant::now();
        beats.beat("main", true, start);

        assert!(was_suspended(
            Duration::from_secs(600),
            Duration::from_secs(600)
        ));
        beats.rebase_all(start + Duration::from_secs(600));
        let after_sleep = beats.find_frozen(start + Duration::from_secs(602), showing);

        assert!(after_sleep.is_empty());
    }

    #[test]
    fn a_wall_clock_jump_without_monotonic_time_reads_as_a_sleep() {
        assert!(was_suspended(
            Duration::from_secs(2),
            Duration::from_secs(900)
        ));
        assert!(!was_suspended(
            Duration::from_secs(2),
            Duration::from_secs(2)
        ));
        assert!(!was_suspended(
            Duration::from_secs(3),
            Duration::from_secs(4)
        ));
    }

    #[test]
    fn each_window_has_its_own_clock() {
        let beats = Heartbeats::default();
        let start = Instant::now();
        beats.beat("main", true, start);
        beats.beat("win-2", true, start + Duration::from_secs(25));

        let frozen = beats.find_frozen(start + Duration::from_secs(40), showing);

        assert_eq!(frozen.len(), 1);
        assert_eq!(frozen[0].label, "main");
    }

    #[test]
    fn a_label_is_capped() {
        let beats = Heartbeats::default();
        beats.beat(&"w".repeat(500), true, Instant::now());

        let kept: Vec<usize> = lock_or_recover(&beats.0).keys().map(String::len).collect();

        assert_eq!(kept, vec![MAX_LABEL]);
    }
}
