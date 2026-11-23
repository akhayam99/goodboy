use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, Window};

use crate::util::lock_or_recover;

pub(crate) const FREEZE_AFTER: Duration = Duration::from_secs(30);
const TICK: Duration = Duration::from_secs(2);
const SUSPEND_GAP: Duration = Duration::from_secs(6);
const WALL_DRIFT: Duration = Duration::from_secs(5);
const MAX_LABEL: usize = 64;
const MAX_SESSION_ID: usize = 128;
pub(crate) const DESK_HOLDER_EVENT: &str = "desk-holder";

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

    pub(crate) fn is_frozen(&self, label: &str) -> bool {
        lock_or_recover(&self.0)
            .get(label)
            .is_some_and(|beat| beat.noted)
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

#[derive(Default, Clone)]
pub struct DeskHolders(Arc<Mutex<HashMap<String, String>>>);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeskHold {
    pub session_id: String,
    pub holder: Option<String>,
}

fn hold_of(session_id: &str, holder: Option<&str>) -> DeskHold {
    DeskHold {
        session_id: session_id.to_string(),
        holder: holder.map(str::to_string),
    }
}

impl DeskHolders {
    pub(crate) fn holder(&self, session_id: &str, is_live: impl Fn(&str) -> bool) -> DeskHold {
        let mut holders = lock_or_recover(&self.0);
        holders.retain(|_, label| is_live(label));
        hold_of(session_id, holders.get(session_id).map(String::as_str))
    }

    pub(crate) fn hold(
        &self,
        session_id: &str,
        label: &str,
        is_taken: bool,
        is_live: impl Fn(&str) -> bool,
    ) -> (DeskHold, Vec<DeskHold>) {
        let mut holders = lock_or_recover(&self.0);
        holders.retain(|_, held_by| is_live(held_by));
        if let Some(current) = holders.get(session_id) {
            if current != label && !is_taken {
                return (hold_of(session_id, Some(current)), Vec::new());
            }
        }
        let mut changes: Vec<DeskHold> = holders
            .iter()
            .filter(|(session, held_by)| *held_by == label && session.as_str() != session_id)
            .map(|(session, _)| hold_of(session, None))
            .collect();
        holders.retain(|session, held_by| held_by != label || session == session_id);
        let previous = holders.insert(session_id.to_string(), label.to_string());
        if previous.as_deref() != Some(label) {
            changes.push(hold_of(session_id, Some(label)));
        }
        (hold_of(session_id, Some(label)), changes)
    }

    pub(crate) fn release(&self, session_id: &str, label: &str) -> Option<DeskHold> {
        let mut holders = lock_or_recover(&self.0);
        if holders.get(session_id).map(String::as_str) != Some(label) {
            return None;
        }
        holders.remove(session_id);
        Some(hold_of(session_id, None))
    }
}

fn checked_session_id(session_id: &str) -> Result<&str, String> {
    if session_id.is_empty() || session_id.len() > MAX_SESSION_ID {
        return Err("the session id is not valid".to_string());
    }
    Ok(session_id)
}

fn is_live_window(app: &AppHandle, beats: &Heartbeats, label: &str) -> bool {
    window_state(app, label) != WindowState::Gone && !beats.is_frozen(label)
}

fn window_state(app: &AppHandle, label: &str) -> WindowState {
    let Some(window) = app.get_window(label) else {
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

#[tauri::command]
pub async fn desk_holder(
    app: AppHandle,
    beats: State<'_, Heartbeats>,
    holders: State<'_, DeskHolders>,
    session_id: String,
) -> Result<DeskHold, String> {
    let session_id = checked_session_id(&session_id)?;
    Ok(holders.holder(session_id, |label| is_live_window(&app, &beats, label)))
}

#[tauri::command]
pub async fn desk_hold(
    app: AppHandle,
    window: Window,
    beats: State<'_, Heartbeats>,
    holders: State<'_, DeskHolders>,
    session_id: String,
    is_taken: bool,
) -> Result<DeskHold, String> {
    let session_id = checked_session_id(&session_id)?;
    let (hold, changes) = holders.hold(session_id, window.label(), is_taken, |label| {
        is_live_window(&app, &beats, label)
    });
    for change in changes {
        let _ = app.emit(DESK_HOLDER_EVENT, change);
    }
    Ok(hold)
}

#[tauri::command]
pub async fn desk_release(
    app: AppHandle,
    window: Window,
    holders: State<'_, DeskHolders>,
    session_id: String,
) -> Result<(), String> {
    let session_id = checked_session_id(&session_id)?;
    if let Some(change) = holders.release(session_id, window.label()) {
        let _ = app.emit(DESK_HOLDER_EVENT, change);
    }
    Ok(())
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

    fn every_window_lives(_label: &str) -> bool {
        true
    }

    #[test]
    fn the_first_window_to_hold_a_desk_keeps_it() {
        let holders = DeskHolders::default();

        let (first, changes) = holders.hold("s1", "main", false, every_window_lives);
        let (second, none) = holders.hold("s1", "win-2", false, every_window_lives);

        assert_eq!(first, hold_of("s1", Some("main")));
        assert_eq!(changes, vec![hold_of("s1", Some("main"))]);
        assert_eq!(second, hold_of("s1", Some("main")));
        assert!(none.is_empty());
    }

    #[test]
    fn bring_it_here_takes_the_desk_and_says_so() {
        let holders = DeskHolders::default();
        holders.hold("s1", "main", false, every_window_lives);

        let (taken, changes) = holders.hold("s1", "win-2", true, every_window_lives);

        assert_eq!(taken, hold_of("s1", Some("win-2")));
        assert_eq!(changes, vec![hold_of("s1", Some("win-2"))]);
        assert_eq!(
            holders.holder("s1", every_window_lives),
            hold_of("s1", Some("win-2"))
        );
    }

    #[test]
    fn a_closed_or_frozen_window_frees_the_desk() {
        let holders = DeskHolders::default();
        holders.hold("s1", "main", false, every_window_lives);

        let read = holders.holder("s1", |label| label != "main");
        let (taken, _) = holders.hold("s1", "win-2", false, every_window_lives);

        assert_eq!(read, hold_of("s1", None));
        assert_eq!(taken, hold_of("s1", Some("win-2")));
    }

    #[test]
    fn a_window_holds_one_desk_at_a_time() {
        let holders = DeskHolders::default();
        holders.hold("s1", "main", false, every_window_lives);

        let (_, changes) = holders.hold("s2", "main", false, every_window_lives);

        assert_eq!(
            changes,
            vec![hold_of("s1", None), hold_of("s2", Some("main"))]
        );
        assert_eq!(
            holders.holder("s1", every_window_lives),
            hold_of("s1", None)
        );
    }

    #[test]
    fn only_the_holder_releases_the_desk() {
        let holders = DeskHolders::default();
        holders.hold("s1", "main", false, every_window_lives);

        assert_eq!(holders.release("s1", "win-2"), None);
        assert_eq!(holders.release("s1", "main"), Some(hold_of("s1", None)));
        assert_eq!(holders.release("s1", "main"), None);
    }

    #[test]
    fn a_frozen_beat_reads_as_frozen() {
        let beats = Heartbeats::default();
        let start = Instant::now();
        beats.beat("main", true, start);

        assert!(!beats.is_frozen("main"));
        beats.find_frozen(start + Duration::from_secs(31), showing);
        assert!(beats.is_frozen("main"));
        assert!(!beats.is_frozen("win-2"));
    }

    #[test]
    fn a_session_id_out_of_bounds_is_refused() {
        assert!(checked_session_id("").is_err());
        assert!(checked_session_id(&"s".repeat(MAX_SESSION_ID + 1)).is_err());
        assert_eq!(checked_session_id("s1"), Ok("s1"));
    }

    #[test]
    fn a_label_is_capped() {
        let beats = Heartbeats::default();
        beats.beat(&"w".repeat(500), true, Instant::now());

        let kept: Vec<usize> = lock_or_recover(&beats.0).keys().map(String::len).collect();

        assert_eq!(kept, vec![MAX_LABEL]);
    }
}
