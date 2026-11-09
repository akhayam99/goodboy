use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, MutexGuard};

use serde::Serialize;
use tauri::Rect;

use super::profile::ProfileId;
use crate::util::lock_or_recover;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum TabState {
    Live,
    Asleep,
    Closed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabFacts {
    pub(crate) id: String,
    pub(crate) session_id: String,
    pub(crate) url: String,
    pub(crate) title: String,
    pub(crate) state: TabState,
    pub(crate) is_shown: bool,
    pub(crate) hidden_since_ms: Option<i64>,
    pub(crate) opener_id: Option<String>,
}

#[derive(Clone, Debug)]
struct Tab {
    facts: TabFacts,
    window_label: String,
    profile: ProfileId,
    rect: Rect,
    opened: u64,
}

impl Tab {
    fn is_hidden_popup_of(&self, session_id: &str) -> bool {
        self.facts.session_id == session_id
            && self.facts.opener_id.is_some()
            && !self.facts.is_shown
            && !self.is_closed()
    }

    fn is_closed(&self) -> bool {
        self.facts.state == TabState::Closed
    }
}

#[derive(Default)]
struct Tabs {
    by_id: HashMap<String, Tab>,
    next_opened: u64,
    pending_popups: HashMap<String, usize>,
    closings: HashMap<(String, String), u64>,
    clearing: HashSet<ProfileId>,
}

impl Tabs {
    fn generation(&self, session_id: &str, window_label: &str) -> u64 {
        self.closings
            .get(&(session_id.to_string(), window_label.to_string()))
            .copied()
            .unwrap_or_default()
    }

    fn ids_of(&self, session_id: &str) -> Vec<String> {
        let mut found: Vec<&Tab> = self
            .by_id
            .values()
            .filter(|tab| tab.facts.session_id == session_id)
            .collect();
        found.sort_by_key(|tab| tab.opened);
        found.into_iter().map(|tab| tab.facts.id.clone()).collect()
    }
}

#[derive(Default)]
pub(crate) struct BrowserRegistry {
    tabs: Mutex<Tabs>,
    gate: Mutex<()>,
}

pub(crate) struct NewTab<'a> {
    pub(crate) id: &'a str,
    pub(crate) session_id: &'a str,
    pub(crate) window_label: &'a str,
    pub(crate) profile: ProfileId,
    pub(crate) url: &'a str,
    pub(crate) rect: Rect,
    pub(crate) is_shown: bool,
    pub(crate) opener_id: Option<&'a str>,
    pub(crate) now_ms: i64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct PopupSeat {
    pub(crate) opener_id: String,
    pub(crate) session_id: String,
    pub(crate) window_label: String,
    pub(crate) profile: ProfileId,
    pub(crate) generation: u64,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum SeatRefusal {
    OpenerGone,
    Full,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum ClearRefusal {
    Live,
    Clearing,
}

impl BrowserRegistry {
    pub(crate) fn reserve_popup(
        &self,
        opener_id: &str,
        limit: usize,
    ) -> Result<PopupSeat, SeatRefusal> {
        let mut tabs = lock_or_recover(&self.tabs);
        let opener = tabs.by_id.get(opener_id).ok_or(SeatRefusal::OpenerGone)?;
        let seat = PopupSeat {
            opener_id: opener_id.to_string(),
            session_id: opener.facts.session_id.clone(),
            window_label: opener.window_label.clone(),
            profile: opener.profile,
            generation: tabs.generation(&opener.facts.session_id, &opener.window_label),
        };
        let hidden = tabs
            .by_id
            .values()
            .filter(|tab| tab.is_hidden_popup_of(&seat.session_id))
            .count();
        let pending = tabs
            .pending_popups
            .entry(seat.session_id.clone())
            .or_default();
        if hidden + *pending >= limit {
            return Err(SeatRefusal::Full);
        }
        *pending += 1;
        Ok(seat)
    }

    pub(crate) fn release_popup(&self, seat: &PopupSeat) {
        let mut tabs = lock_or_recover(&self.tabs);
        let Some(pending) = tabs.pending_popups.get_mut(&seat.session_id) else {
            return;
        };
        *pending = pending.saturating_sub(1);
        if *pending == 0 {
            tabs.pending_popups.remove(&seat.session_id);
        }
    }

    pub(crate) fn generation(&self, session_id: &str, window_label: &str) -> u64 {
        lock_or_recover(&self.tabs).generation(session_id, window_label)
    }

    pub(crate) fn close_session(&self, session_id: &str, window_labels: &[String]) -> Vec<String> {
        let mut tabs = lock_or_recover(&self.tabs);
        let mut labels: Vec<String> = window_labels.to_vec();
        labels.extend(
            tabs.by_id
                .values()
                .filter(|tab| tab.facts.session_id == session_id)
                .map(|tab| tab.window_label.clone()),
        );
        labels.sort();
        labels.dedup();
        for label in labels {
            *tabs
                .closings
                .entry((session_id.to_string(), label))
                .or_default() += 1;
        }
        tabs.ids_of(session_id)
    }

    pub(crate) fn session_tab_ids(&self, session_id: &str) -> Vec<String> {
        lock_or_recover(&self.tabs).ids_of(session_id)
    }

    pub(crate) fn insert_in_generation(
        &self,
        tab: NewTab<'_>,
        generation: u64,
    ) -> Option<TabFacts> {
        let mut tabs = lock_or_recover(&self.tabs);
        if tabs.generation(tab.session_id, tab.window_label) != generation {
            return None;
        }
        if tab
            .opener_id
            .is_some_and(|opener| !tabs.by_id.contains_key(opener))
        {
            return None;
        }
        Some(Self::insert_locked(&mut tabs, tab))
    }

    #[cfg(test)]
    pub(crate) fn insert(&self, tab: NewTab<'_>) -> TabFacts {
        let mut tabs = lock_or_recover(&self.tabs);
        Self::insert_locked(&mut tabs, tab)
    }

    fn insert_locked(tabs: &mut Tabs, tab: NewTab<'_>) -> TabFacts {
        let opened = tabs.next_opened;
        tabs.next_opened += 1;
        let facts = TabFacts {
            id: tab.id.to_string(),
            session_id: tab.session_id.to_string(),
            url: tab.url.to_string(),
            title: String::new(),
            state: state_of_shown(tab.is_shown),
            is_shown: tab.is_shown,
            hidden_since_ms: hidden_since(tab.is_shown, tab.now_ms),
            opener_id: tab.opener_id.map(str::to_string),
        };
        tabs.by_id.insert(
            tab.id.to_string(),
            Tab {
                facts: facts.clone(),
                window_label: tab.window_label.to_string(),
                profile: tab.profile,
                rect: tab.rect,
                opened,
            },
        );
        facts
    }

    pub(crate) fn facts(&self, id: &str) -> Option<TabFacts> {
        lock_or_recover(&self.tabs)
            .by_id
            .get(id)
            .map(|tab| tab.facts.clone())
    }

    pub(crate) fn window_of(&self, id: &str) -> Option<String> {
        lock_or_recover(&self.tabs)
            .by_id
            .get(id)
            .map(|tab| tab.window_label.clone())
    }

    pub(crate) fn profile_of(&self, id: &str) -> Option<ProfileId> {
        lock_or_recover(&self.tabs)
            .by_id
            .get(id)
            .map(|tab| tab.profile)
    }

    pub(crate) fn open_outside(&self, profile: &ProfileId) -> Vec<String> {
        let tabs = lock_or_recover(&self.tabs);
        let mut found: Vec<&Tab> = tabs
            .by_id
            .values()
            .filter(|tab| tab.profile != *profile && !tab.is_closed())
            .collect();
        found.sort_by_key(|tab| tab.opened);
        found.into_iter().map(|tab| tab.facts.id.clone()).collect()
    }

    pub(crate) fn is_clearing(&self, profile: &ProfileId) -> bool {
        lock_or_recover(&self.tabs).clearing.contains(profile)
    }

    pub(crate) fn begin_clear(&self, profile: &ProfileId) -> Result<(), ClearRefusal> {
        let mut tabs = lock_or_recover(&self.tabs);
        if tabs.clearing.contains(profile) {
            return Err(ClearRefusal::Clearing);
        }
        if tabs
            .by_id
            .values()
            .any(|tab| tab.profile == *profile && !tab.is_closed())
        {
            return Err(ClearRefusal::Live);
        }
        tabs.clearing.insert(*profile);
        Ok(())
    }

    pub(crate) fn end_clear(&self, profile: &ProfileId) {
        lock_or_recover(&self.tabs).clearing.remove(profile);
    }

    pub(crate) fn mark_switched(&self, id: &str, now_ms: i64) -> Option<TabFacts> {
        let mut tabs = lock_or_recover(&self.tabs);
        let tab = tabs.by_id.get_mut(id)?;
        if tab.is_closed() {
            return None;
        }
        let before = tab.facts.clone();
        tab.facts.state = TabState::Closed;
        tab.facts.is_shown = false;
        tab.facts.hidden_since_ms = Some(now_ms);
        Some(before)
    }

    pub(crate) fn restore(&self, before: TabFacts) {
        let mut tabs = lock_or_recover(&self.tabs);
        if let Some(tab) = tabs.by_id.get_mut(&before.id) {
            tab.facts = before;
        }
    }

    pub(crate) fn remove(&self, id: &str) -> Option<TabFacts> {
        lock_or_recover(&self.tabs)
            .by_id
            .remove(id)
            .map(|tab| tab.facts)
    }

    pub(crate) fn list(&self, session_id: &str, window_label: &str) -> Vec<TabFacts> {
        let tabs = lock_or_recover(&self.tabs);
        let mut found: Vec<&Tab> = tabs
            .by_id
            .values()
            .filter(|tab| tab.facts.session_id == session_id && tab.window_label == window_label)
            .collect();
        found.sort_by_key(|tab| tab.opened);
        found.into_iter().map(|tab| tab.facts.clone()).collect()
    }

    pub(crate) fn remove_window(&self, window_label: &str) -> usize {
        let mut tabs = lock_or_recover(&self.tabs);
        let before = tabs.by_id.len();
        tabs.by_id.retain(|_, tab| tab.window_label != window_label);
        tabs.closings
            .retain(|(_, window), _| window != window_label);
        before - tabs.by_id.len()
    }

    pub(crate) fn session_ids(&self) -> Vec<String> {
        let tabs = lock_or_recover(&self.tabs);
        let mut ids: Vec<String> = tabs
            .by_id
            .values()
            .map(|tab| tab.facts.session_id.clone())
            .collect();
        ids.sort();
        ids.dedup();
        ids
    }

    #[cfg(test)]
    pub(crate) fn ids_of_session(&self, session_id: &str, window_label: &str) -> Vec<String> {
        self.list(session_id, window_label)
            .into_iter()
            .map(|facts| facts.id)
            .collect()
    }

    #[cfg(test)]
    pub(crate) fn is_empty(&self) -> bool {
        lock_or_recover(&self.tabs).by_id.is_empty()
    }

    pub(crate) fn set_shown(&self, id: &str, is_shown: bool, now_ms: i64) -> Option<TabFacts> {
        self.update(id, |facts| {
            if facts.state == TabState::Closed || facts.is_shown == is_shown {
                return;
            }
            facts.is_shown = is_shown;
            facts.state = state_of_shown(is_shown);
            facts.hidden_since_ms = hidden_since(is_shown, now_ms);
        })
    }

    pub(crate) fn gate(&self) -> MutexGuard<'_, ()> {
        lock_or_recover(&self.gate)
    }

    pub(crate) fn state_of(&self, id: &str) -> Option<TabState> {
        lock_or_recover(&self.tabs)
            .by_id
            .get(id)
            .map(|tab| tab.facts.state)
    }

    pub(crate) fn rect_of(&self, id: &str) -> Option<Rect> {
        lock_or_recover(&self.tabs)
            .by_id
            .get(id)
            .map(|tab| tab.rect)
    }

    pub(crate) fn set_rect(&self, id: &str, rect: Rect) -> Option<TabFacts> {
        let mut tabs = lock_or_recover(&self.tabs);
        let tab = tabs.by_id.get_mut(id)?;
        tab.rect = rect;
        Some(tab.facts.clone())
    }

    pub(crate) fn expired(&self, now_ms: i64, limit_ms: i64) -> Vec<String> {
        let tabs = lock_or_recover(&self.tabs);
        let mut found: Vec<&Tab> = tabs
            .by_id
            .values()
            .filter(|tab| {
                tab.facts.state == TabState::Asleep
                    && tab
                        .facts
                        .hidden_since_ms
                        .is_some_and(|since| now_ms.saturating_sub(since) >= limit_ms)
            })
            .collect();
        found.sort_by_key(|tab| (tab.facts.hidden_since_ms, tab.opened));
        found.into_iter().map(|tab| tab.facts.id.clone()).collect()
    }

    pub(crate) fn over_cap(&self, window_label: &str, limit: usize) -> Vec<String> {
        let tabs = lock_or_recover(&self.tabs);
        let in_window = || {
            tabs.by_id
                .values()
                .filter(|tab| tab.window_label == window_label && !tab.is_closed())
        };
        let excess = in_window().count().saturating_sub(limit);
        let mut hidden: Vec<&Tab> = in_window().filter(|tab| !tab.facts.is_shown).collect();
        hidden.sort_by_key(|tab| (tab.facts.hidden_since_ms, tab.opened));
        hidden
            .into_iter()
            .take(excess)
            .map(|tab| tab.facts.id.clone())
            .collect()
    }

    pub(crate) fn mark_closed(&self, id: &str) -> Option<TabFacts> {
        let mut tabs = lock_or_recover(&self.tabs);
        let tab = tabs.by_id.get_mut(id)?;
        if tab.facts.is_shown || tab.is_closed() {
            return None;
        }
        tab.facts.state = TabState::Closed;
        Some(tab.facts.clone())
    }

    pub(crate) fn reopen_asleep(&self, id: &str) -> Option<TabFacts> {
        let mut tabs = lock_or_recover(&self.tabs);
        let tab = tabs.by_id.get_mut(id)?;
        if tab.facts.is_shown || !tab.is_closed() {
            return None;
        }
        tab.facts.state = TabState::Asleep;
        Some(tab.facts.clone())
    }

    pub(crate) fn revive(&self, id: &str, is_shown: bool, now_ms: i64) -> Option<TabFacts> {
        let mut tabs = lock_or_recover(&self.tabs);
        let tab = tabs.by_id.get_mut(id)?;
        if !tab.is_closed() {
            return None;
        }
        tab.facts.state = state_of_shown(is_shown);
        tab.facts.is_shown = is_shown;
        tab.facts.hidden_since_ms = hidden_since(is_shown, now_ms);
        Some(tab.facts.clone())
    }

    pub(crate) fn set_url(&self, id: &str, url: &str) -> Option<TabFacts> {
        self.update(id, |facts| facts.url = url.to_string())
    }

    pub(crate) fn set_title(&self, id: &str, title: &str) -> Option<TabFacts> {
        self.update(id, |facts| facts.title = title.to_string())
    }

    fn update(&self, id: &str, change: impl FnOnce(&mut TabFacts)) -> Option<TabFacts> {
        let mut tabs = lock_or_recover(&self.tabs);
        let tab = tabs.by_id.get_mut(id)?;
        change(&mut tab.facts);
        Some(tab.facts.clone())
    }
}

fn state_of_shown(is_shown: bool) -> TabState {
    match is_shown {
        true => TabState::Live,
        false => TabState::Asleep,
    }
}

fn hidden_since(is_shown: bool, now_ms: i64) -> Option<i64> {
    match is_shown {
        true => None,
        false => Some(now_ms),
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use tauri::{LogicalPosition, LogicalSize};

    use super::*;
    use crate::util::wire_shape::assert_wire_value;

    const LIMIT_MS: i64 = 600_000;

    fn rect() -> Rect {
        Rect {
            position: LogicalPosition::new(0.0, 0.0).into(),
            size: LogicalSize::new(100.0, 100.0).into(),
        }
    }

    fn profile() -> ProfileId {
        ProfileId::of_workspace("harborline").expect("workspace id is valid")
    }

    fn open(registry: &BrowserRegistry, id: &str, session_id: &str, is_shown: bool) -> TabFacts {
        registry.insert(NewTab {
            id,
            session_id,
            window_label: "main",
            profile: profile(),
            url: "http://localhost:5173/",
            rect: rect(),
            is_shown,
            opener_id: None,
            now_ms: 1_000,
        })
    }

    fn open_in(registry: &BrowserRegistry, id: &str, window_label: &str) -> TabFacts {
        registry.insert(NewTab {
            id,
            session_id: "harborline",
            window_label,
            profile: profile(),
            url: "about:blank",
            rect: rect(),
            is_shown: true,
            opener_id: None,
            now_ms: 0,
        })
    }

    fn popup(registry: &BrowserRegistry, id: &str, seat: &PopupSeat) -> TabFacts {
        let facts = registry.insert(NewTab {
            id,
            session_id: &seat.session_id,
            window_label: &seat.window_label,
            profile: seat.profile,
            url: "https://example.com/",
            rect: rect(),
            is_shown: false,
            opener_id: Some(&seat.opener_id),
            now_ms: 2_000,
        });
        registry.release_popup(seat);
        facts
    }

    #[test]
    fn starts_empty() {
        assert!(BrowserRegistry::default().is_empty());
    }

    #[test]
    fn puts_back_a_shown_tab_whose_switch_close_failed() {
        let registry = BrowserRegistry::default();
        let shown = open(&registry, "a", "harborline", true);
        let before = registry.mark_switched("a", 5_000).expect("was open");
        assert_eq!(before, shown);
        let closed = registry.facts("a").expect("still listed");
        assert_eq!(closed.state, TabState::Closed);
        assert!(!closed.is_shown);
        assert_eq!(registry.mark_switched("a", 6_000), None);
        registry.restore(before);
        assert_eq!(registry.facts("a"), Some(shown));
    }

    #[test]
    fn lists_the_open_tabs_outside_a_profile_in_opening_order() {
        let registry = BrowserRegistry::default();
        let acme = ProfileId::of_workspace("acme").expect("workspace id is valid");
        open(&registry, "b", "harborline", true);
        open(&registry, "a", "harborline", false);
        open(&registry, "closed", "harborline", false);
        registry.mark_closed("closed");
        assert_eq!(registry.open_outside(&acme), vec!["b", "a"]);
        assert!(registry.open_outside(&profile()).is_empty());
    }

    #[test]
    fn clears_only_a_profile_with_no_open_tab_and_one_clear_at_a_time() {
        let registry = BrowserRegistry::default();
        open(&registry, "a", "harborline", false);
        assert_eq!(registry.begin_clear(&profile()), Err(ClearRefusal::Live));
        registry.mark_closed("a");
        assert_eq!(registry.begin_clear(&profile()), Ok(()));
        assert!(registry.is_clearing(&profile()));
        assert_eq!(
            registry.begin_clear(&profile()),
            Err(ClearRefusal::Clearing)
        );
        registry.end_clear(&profile());
        assert!(!registry.is_clearing(&profile()));
    }

    #[test]
    fn lists_a_session_s_tabs_in_the_order_they_opened() {
        let registry = BrowserRegistry::default();
        open(&registry, "c", "harborline", true);
        open(&registry, "a", "harborline", false);
        open(&registry, "b", "northwind", true);
        open(&registry, "d", "harborline", false);
        assert_eq!(
            registry.ids_of_session("harborline", "main"),
            vec!["c", "a", "d"]
        );
        assert_eq!(registry.ids_of_session("northwind", "main"), vec!["b"]);
        assert!(registry.ids_of_session("cascadia", "main").is_empty());
    }

    #[test]
    fn lists_only_the_tabs_of_the_window_that_asks() {
        let registry = BrowserRegistry::default();
        open_in(&registry, "a", "main");
        open_in(&registry, "b", "win-2");
        assert_eq!(registry.ids_of_session("harborline", "main"), vec!["a"]);
        assert_eq!(registry.ids_of_session("harborline", "win-2"), vec!["b"]);
        assert!(registry.list("harborline", "win-3").is_empty());
    }

    #[test]
    fn seats_popups_up_to_the_limit_and_counts_seats_still_opening() {
        let registry = BrowserRegistry::default();
        open(&registry, "opener", "harborline", true);
        let first = registry.reserve_popup("opener", 2).expect("first seat");
        assert_eq!(first.session_id, "harborline");
        assert_eq!(first.window_label, "main");
        let second = registry.reserve_popup("opener", 2).expect("second seat");
        assert_eq!(registry.reserve_popup("opener", 2), Err(SeatRefusal::Full));
        popup(&registry, "p1", &first);
        popup(&registry, "p2", &second);
        assert_eq!(registry.reserve_popup("opener", 2), Err(SeatRefusal::Full));
        assert_eq!(
            registry.facts("p1").and_then(|facts| facts.opener_id),
            Some("opener".to_string())
        );
    }

    #[test]
    fn frees_a_seat_when_a_popup_is_shown_closed_or_never_opened() {
        let registry = BrowserRegistry::default();
        open(&registry, "opener", "harborline", true);
        let seat = registry.reserve_popup("opener", 1).expect("seat");
        registry.release_popup(&seat);
        let seat = registry
            .reserve_popup("opener", 1)
            .expect("seat after a failed open");
        popup(&registry, "p1", &seat);
        assert_eq!(registry.reserve_popup("opener", 1), Err(SeatRefusal::Full));
        registry.set_shown("p1", true, 3_000);
        let seat = registry
            .reserve_popup("opener", 1)
            .expect("seat after show");
        popup(&registry, "p2", &seat);
        registry.remove("p2");
        assert!(registry.reserve_popup("opener", 1).is_ok());
    }

    #[test]
    fn frees_the_seats_of_popups_the_sweep_or_the_cap_closed() {
        let registry = BrowserRegistry::default();
        open(&registry, "opener", "harborline", true);
        for id in ["p1", "p2", "p3", "p4"] {
            let seat = registry.reserve_popup("opener", 4).expect("seat");
            popup(&registry, id, &seat);
        }
        assert_eq!(registry.reserve_popup("opener", 4), Err(SeatRefusal::Full));
        for id in ["p1", "p2", "p3", "p4"] {
            registry.mark_closed(id);
        }
        let seat = registry
            .reserve_popup("opener", 4)
            .expect("seat once the popups are closed");
        popup(&registry, "p5", &seat);
        assert_eq!(registry.state_of("p5"), Some(TabState::Asleep));
        assert_eq!(registry.state_of("p1"), Some(TabState::Closed));
    }

    #[test]
    fn counts_popups_per_session_and_refuses_a_gone_opener() {
        let registry = BrowserRegistry::default();
        open(&registry, "opener", "harborline", true);
        open(&registry, "other", "northwind", true);
        let seat = registry.reserve_popup("opener", 1).expect("seat");
        popup(&registry, "p1", &seat);
        assert!(registry.reserve_popup("other", 1).is_ok());
        assert_eq!(
            registry.reserve_popup("gone", 1),
            Err(SeatRefusal::OpenerGone)
        );
    }

    #[test]
    fn refuses_a_popup_whose_opener_closed_before_it_was_inserted() {
        let registry = BrowserRegistry::default();
        open(&registry, "opener", "harborline", true);
        let seat = registry.reserve_popup("opener", 1).expect("seat");
        registry.remove("opener");
        let inserted = registry.insert_in_generation(
            NewTab {
                id: "p1",
                session_id: &seat.session_id,
                profile: seat.profile,
                window_label: &seat.window_label,
                url: "https://example.com/",
                is_shown: false,
                opener_id: Some(&seat.opener_id),
                now_ms: 2_000,
                rect: rect(),
            },
            seat.generation,
        );
        assert!(inserted.is_none());
        assert!(registry.is_empty());
    }

    #[test]
    fn closes_a_session_in_every_window_and_marks_each_one_closing() {
        let registry = BrowserRegistry::default();
        open(&registry, "a", "harborline", true);
        open_in(&registry, "b", "win-2");
        open(&registry, "c", "northwind", true);
        let windows = vec!["main".to_string(), "win-2".to_string(), "win-3".to_string()];
        let ids = registry.close_session("harborline", &windows);
        assert_eq!(ids, vec!["a", "b"]);
        assert_eq!(registry.session_tab_ids("harborline"), vec!["a", "b"]);
        for label in ["main", "win-2", "win-3"] {
            assert_eq!(registry.generation("harborline", label), 1);
        }
        assert_eq!(registry.generation("northwind", "main"), 0);
    }

    #[test]
    fn remembers_the_window_that_owns_a_tab() {
        let registry = BrowserRegistry::default();
        open_in(&registry, "a", "win-2");
        assert_eq!(registry.window_of("a").as_deref(), Some("win-2"));
        assert_eq!(registry.window_of("gone"), None);
    }

    #[test]
    fn stamps_when_a_tab_was_hidden_and_clears_it_when_shown() {
        let registry = BrowserRegistry::default();
        assert_eq!(
            open(&registry, "a", "harborline", false).hidden_since_ms,
            Some(1_000)
        );
        let shown = registry.set_shown("a", true, 2_000).expect("tab exists");
        assert_eq!(shown.hidden_since_ms, None);
        let hidden = registry.set_shown("a", false, 3_000).expect("tab exists");
        assert_eq!(hidden.hidden_since_ms, Some(3_000));
        let again = registry.set_shown("a", false, 9_000).expect("tab exists");
        assert_eq!(again.hidden_since_ms, Some(3_000));
    }

    #[test]
    fn keeps_the_address_and_title_the_page_reported() {
        let registry = BrowserRegistry::default();
        open(&registry, "a", "harborline", true);
        registry.set_url("a", "https://example.com/");
        registry.set_title("a", "Example Domain");
        let facts = registry.facts("a").expect("tab exists");
        assert_eq!(facts.url, "https://example.com/");
        assert_eq!(facts.title, "Example Domain");
        assert_eq!(registry.set_title("gone", "x"), None);
    }

    #[test]
    fn forgets_a_removed_tab() {
        let registry = BrowserRegistry::default();
        open(&registry, "a", "harborline", true);
        assert_eq!(
            registry.remove("a").map(|facts| facts.id),
            Some("a".to_string())
        );
        assert_eq!(registry.remove("a"), None);
        assert!(registry.is_empty());
    }

    #[test]
    fn forgets_the_tabs_of_a_closed_window_only() {
        let registry = BrowserRegistry::default();
        open(&registry, "a", "harborline", true);
        open_in(&registry, "b", "win-2");
        assert_eq!(registry.remove_window("win-2"), 1);
        assert_eq!(registry.ids_of_session("harborline", "main"), vec!["a"]);
        assert!(registry.ids_of_session("harborline", "win-2").is_empty());
    }

    fn hide_at(registry: &BrowserRegistry, id: &str, now_ms: i64) {
        registry.set_shown(id, false, now_ms);
    }

    #[test]
    fn follows_shown_and_hidden_as_live_and_asleep() {
        let registry = BrowserRegistry::default();
        assert_eq!(
            open(&registry, "a", "harborline", true).state,
            TabState::Live
        );
        assert_eq!(
            open(&registry, "b", "harborline", false).state,
            TabState::Asleep
        );
        hide_at(&registry, "a", 2_000);
        assert_eq!(registry.state_of("a"), Some(TabState::Asleep));
        registry.set_shown("a", true, 3_000);
        assert_eq!(registry.state_of("a"), Some(TabState::Live));
        assert_eq!(registry.state_of("gone"), None);
    }

    #[test]
    fn expires_only_asleep_tabs_hidden_for_the_limit_oldest_first() {
        let registry = BrowserRegistry::default();
        open(&registry, "shown", "harborline", true);
        open(&registry, "late", "harborline", true);
        open(&registry, "early", "harborline", true);
        hide_at(&registry, "late", 5_000);
        hide_at(&registry, "early", 1_000);
        assert!(registry.expired(1_000 + LIMIT_MS - 1, LIMIT_MS).is_empty());
        assert_eq!(registry.expired(1_000 + LIMIT_MS, LIMIT_MS), vec!["early"]);
        assert_eq!(
            registry.expired(5_000 + LIMIT_MS, LIMIT_MS),
            vec!["early", "late"]
        );
        assert!(!registry
            .expired(i64::MAX, LIMIT_MS)
            .contains(&"shown".to_string()));
    }

    #[test]
    fn skips_a_closed_tab_when_expiring() {
        let registry = BrowserRegistry::default();
        open(&registry, "a", "harborline", false);
        registry.mark_closed("a");
        assert!(registry.expired(i64::MAX, LIMIT_MS).is_empty());
    }

    #[test]
    fn restarts_the_sleep_timer_each_time_a_tab_is_hidden() {
        let registry = BrowserRegistry::default();
        open(&registry, "a", "harborline", true);
        hide_at(&registry, "a", 1_000);
        registry.set_shown("a", true, 400_000);
        hide_at(&registry, "a", 500_000);
        assert!(registry.expired(1_000 + LIMIT_MS, LIMIT_MS).is_empty());
        assert_eq!(registry.expired(500_000 + LIMIT_MS, LIMIT_MS), vec!["a"]);
    }

    #[test]
    fn names_the_least_recently_shown_hidden_tabs_over_the_cap() {
        let registry = BrowserRegistry::default();
        for id in ["a", "b", "c", "d", "e", "f"] {
            open(&registry, id, "harborline", true);
        }
        hide_at(&registry, "c", 1_000);
        hide_at(&registry, "a", 2_000);
        hide_at(&registry, "e", 3_000);
        assert_eq!(registry.over_cap("main", 4), vec!["c", "a"]);
        assert_eq!(registry.over_cap("main", 5), vec!["c"]);
        assert!(registry.over_cap("main", 6).is_empty());
    }

    #[test]
    fn never_names_a_shown_tab_over_the_cap() {
        let registry = BrowserRegistry::default();
        for id in ["a", "b", "c"] {
            open(&registry, id, "harborline", true);
        }
        hide_at(&registry, "b", 1_000);
        assert_eq!(registry.over_cap("main", 0), vec!["b"]);
    }

    #[test]
    fn counts_the_cap_per_window_and_skips_closed_tabs() {
        let registry = BrowserRegistry::default();
        open(&registry, "a", "harborline", false);
        open(&registry, "b", "harborline", false);
        open_in(&registry, "other", "win-2");
        assert_eq!(registry.over_cap("main", 1), vec!["a"]);
        assert!(registry.over_cap("win-2", 1).is_empty());
        registry.mark_closed("a");
        assert!(registry.over_cap("main", 1).is_empty());
    }

    #[test]
    fn refuses_to_close_a_shown_tab() {
        let registry = BrowserRegistry::default();
        open(&registry, "a", "harborline", true);
        assert_eq!(registry.mark_closed("a"), None);
        assert_eq!(registry.state_of("a"), Some(TabState::Live));
    }

    #[test]
    fn keeps_the_address_and_title_of_a_closed_tab_and_revives_it_under_the_same_id() {
        let registry = BrowserRegistry::default();
        open(&registry, "a", "harborline", false);
        registry.set_url("a", "https://example.com/docs");
        registry.set_title("a", "Docs");
        let closed = registry.mark_closed("a").expect("tab exists");
        assert_eq!(closed.state, TabState::Closed);
        assert_eq!(closed.url, "https://example.com/docs");
        assert_eq!(closed.title, "Docs");
        assert_eq!(registry.ids_of_session("harborline", "main"), vec!["a"]);
        let revived = registry.revive("a", true, 9_000).expect("tab is closed");
        assert_eq!(revived.id, "a");
        assert_eq!(revived.state, TabState::Live);
        assert_eq!(revived.hidden_since_ms, None);
        assert_eq!(revived.url, "https://example.com/docs");
        assert_eq!(registry.revive("a", true, 9_500), None);
    }

    #[test]
    fn rolls_a_tab_back_to_asleep_when_its_webview_would_not_close() {
        let registry = BrowserRegistry::default();
        open(&registry, "a", "harborline", false);
        open(&registry, "b", "harborline", true);
        assert!(registry.mark_closed("a").is_some());
        assert_eq!(registry.mark_closed("a"), None);
        let back = registry.reopen_asleep("a").expect("tab is closed");
        assert_eq!(back.state, TabState::Asleep);
        assert_eq!(back.hidden_since_ms, Some(1_000));
        assert_eq!(registry.expired(1_000 + LIMIT_MS, LIMIT_MS), vec!["a"]);
        assert_eq!(registry.reopen_asleep("a"), None);
        assert_eq!(registry.reopen_asleep("b"), None);
        assert_eq!(registry.reopen_asleep("gone"), None);
    }

    #[test]
    fn leaves_a_closed_tab_closed_when_it_is_shown_or_hidden() {
        let registry = BrowserRegistry::default();
        open(&registry, "a", "harborline", false);
        registry.mark_closed("a");
        let shown = registry.set_shown("a", true, 2_000).expect("tab exists");
        assert_eq!(shown.state, TabState::Closed);
        assert!(!shown.is_shown);
    }

    #[test]
    fn remembers_the_last_place_of_a_tab() {
        let registry = BrowserRegistry::default();
        open(&registry, "a", "harborline", true);
        let moved = Rect {
            position: LogicalPosition::new(10.0, 20.0).into(),
            size: LogicalSize::new(300.0, 400.0).into(),
        };
        registry.set_rect("a", moved);
        assert_eq!(
            format!("{:?}", registry.rect_of("a")),
            format!("{:?}", Some(moved))
        );
        assert!(registry.rect_of("gone").is_none());
    }

    #[test]
    fn wire_shape_tab_facts() {
        assert_wire_value(
            &TabFacts {
                id: "a".to_string(),
                session_id: "harborline".to_string(),
                url: "https://example.com/".to_string(),
                title: "Example Domain".to_string(),
                state: TabState::Asleep,
                is_shown: false,
                hidden_since_ms: Some(3_000),
                opener_id: Some("b".to_string()),
            },
            json!({
                "id": "a",
                "sessionId": "harborline",
                "url": "https://example.com/",
                "title": "Example Domain",
                "state": "asleep",
                "isShown": false,
                "hiddenSinceMs": 3000,
                "openerId": "b",
            }),
        );
    }
}
