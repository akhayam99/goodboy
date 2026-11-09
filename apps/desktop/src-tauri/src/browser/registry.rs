use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;

use crate::util::lock_or_recover;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabFacts {
    pub(crate) id: String,
    pub(crate) session_id: String,
    pub(crate) url: String,
    pub(crate) title: String,
    pub(crate) is_shown: bool,
    pub(crate) hidden_since_ms: Option<i64>,
    pub(crate) opener_id: Option<String>,
}

#[derive(Clone, Debug)]
struct Tab {
    facts: TabFacts,
    window_label: String,
    opened: u64,
}

impl Tab {
    fn is_hidden_popup_of(&self, session_id: &str, window_label: &str) -> bool {
        self.facts.session_id == session_id
            && self.window_label == window_label
            && self.facts.opener_id.is_some()
            && !self.facts.is_shown
    }
}

#[derive(Default)]
struct Tabs {
    by_id: HashMap<String, Tab>,
    next_opened: u64,
    pending_popups: HashMap<(String, String), usize>,
    closings: HashMap<(String, String), u64>,
}

impl Tabs {
    fn generation(&self, session_id: &str, window_label: &str) -> u64 {
        self.closings
            .get(&(session_id.to_string(), window_label.to_string()))
            .copied()
            .unwrap_or_default()
    }
}

#[derive(Default)]
pub(crate) struct BrowserRegistry {
    tabs: Mutex<Tabs>,
}

pub(crate) struct NewTab<'a> {
    pub(crate) id: &'a str,
    pub(crate) session_id: &'a str,
    pub(crate) window_label: &'a str,
    pub(crate) url: &'a str,
    pub(crate) is_shown: bool,
    pub(crate) opener_id: Option<&'a str>,
    pub(crate) now_ms: i64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct PopupSeat {
    pub(crate) opener_id: String,
    pub(crate) session_id: String,
    pub(crate) window_label: String,
    pub(crate) generation: u64,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum SeatRefusal {
    OpenerGone,
    Full,
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
            generation: tabs.generation(&opener.facts.session_id, &opener.window_label),
        };
        let hidden = tabs
            .by_id
            .values()
            .filter(|tab| tab.is_hidden_popup_of(&seat.session_id, &seat.window_label))
            .count();
        let pending = tabs.pending_popups.entry(seat_key(&seat)).or_default();
        if hidden + *pending >= limit {
            return Err(SeatRefusal::Full);
        }
        *pending += 1;
        Ok(seat)
    }

    pub(crate) fn release_popup(&self, seat: &PopupSeat) {
        let mut tabs = lock_or_recover(&self.tabs);
        let key = seat_key(seat);
        let Some(pending) = tabs.pending_popups.get_mut(&key) else {
            return;
        };
        *pending = pending.saturating_sub(1);
        if *pending == 0 {
            tabs.pending_popups.remove(&key);
        }
    }

    pub(crate) fn generation(&self, session_id: &str, window_label: &str) -> u64 {
        lock_or_recover(&self.tabs).generation(session_id, window_label)
    }

    pub(crate) fn close_session(&self, session_id: &str, window_label: &str) -> Vec<String> {
        {
            let mut tabs = lock_or_recover(&self.tabs);
            let key = (session_id.to_string(), window_label.to_string());
            *tabs.closings.entry(key).or_default() += 1;
        }
        self.ids_of_session(session_id, window_label)
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
            is_shown: tab.is_shown,
            hidden_since_ms: hidden_since(tab.is_shown, tab.now_ms),
            opener_id: tab.opener_id.map(str::to_string),
        };
        tabs.by_id.insert(
            tab.id.to_string(),
            Tab {
                facts: facts.clone(),
                window_label: tab.window_label.to_string(),
                opened,
            },
        );
        facts
    }

    #[cfg(test)]
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

    pub(crate) fn move_to_window(
        &self,
        id: &str,
        window_label: &str,
        now_ms: i64,
    ) -> Option<TabFacts> {
        let mut tabs = lock_or_recover(&self.tabs);
        let tab = tabs.by_id.get_mut(id)?;
        tab.window_label = window_label.to_string();
        if tab.facts.is_shown {
            tab.facts.is_shown = false;
            tab.facts.hidden_since_ms = hidden_since(false, now_ms);
        }
        Some(tab.facts.clone())
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
            if facts.is_shown == is_shown {
                return;
            }
            facts.is_shown = is_shown;
            facts.hidden_since_ms = hidden_since(is_shown, now_ms);
        })
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

fn seat_key(seat: &PopupSeat) -> (String, String) {
    (seat.session_id.clone(), seat.window_label.clone())
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

    use super::*;
    use crate::util::wire_shape::assert_wire_value;

    fn open(registry: &BrowserRegistry, id: &str, session_id: &str, is_shown: bool) -> TabFacts {
        registry.insert(NewTab {
            id,
            session_id,
            window_label: "main",
            url: "http://localhost:5173/",
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
            url: "about:blank",
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
            url: "https://example.com/",
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
    fn remembers_the_window_that_owns_a_tab() {
        let registry = BrowserRegistry::default();
        open_in(&registry, "a", "win-2");
        assert_eq!(registry.window_of("a").as_deref(), Some("win-2"));
        assert_eq!(registry.window_of("gone"), None);
    }

    #[test]
    fn moves_a_tab_to_another_window_hidden_with_its_id_and_address() {
        let registry = BrowserRegistry::default();
        open(&registry, "a", "harborline", true);
        let moved = registry
            .move_to_window("a", "win-2", 4_000)
            .expect("tab exists");
        assert_eq!(moved.id, "a");
        assert_eq!(moved.url, "http://localhost:5173/");
        assert!(!moved.is_shown);
        assert_eq!(moved.hidden_since_ms, Some(4_000));
        assert_eq!(registry.window_of("a").as_deref(), Some("win-2"));
        assert!(registry.ids_of_session("harborline", "main").is_empty());
        assert_eq!(registry.ids_of_session("harborline", "win-2"), vec!["a"]);
        assert_eq!(registry.move_to_window("gone", "win-2", 4_000), None);
    }

    #[test]
    fn counts_hidden_popups_in_the_window_that_holds_them() {
        let registry = BrowserRegistry::default();
        open(&registry, "opener", "harborline", true);
        let seat = registry.reserve_popup("opener", 1).expect("seat");
        popup(&registry, "p1", &seat);
        assert_eq!(registry.reserve_popup("opener", 1), Err(SeatRefusal::Full));
        registry.move_to_window("p1", "win-2", 5_000);
        assert!(registry.reserve_popup("opener", 1).is_ok());
        open_in(&registry, "other", "win-2");
        assert_eq!(registry.reserve_popup("other", 1), Err(SeatRefusal::Full));
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

    #[test]
    fn wire_shape_tab_facts() {
        assert_wire_value(
            &TabFacts {
                id: "a".to_string(),
                session_id: "harborline".to_string(),
                url: "https://example.com/".to_string(),
                title: "Example Domain".to_string(),
                is_shown: false,
                hidden_since_ms: Some(3_000),
                opener_id: Some("b".to_string()),
            },
            json!({
                "id": "a",
                "sessionId": "harborline",
                "url": "https://example.com/",
                "title": "Example Domain",
                "isShown": false,
                "hiddenSinceMs": 3000,
                "openerId": "b",
            }),
        );
    }
}
