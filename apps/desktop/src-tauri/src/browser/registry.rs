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
}

#[derive(Clone, Debug)]
struct Tab {
    facts: TabFacts,
    window_label: String,
    opened: u64,
}

#[derive(Default)]
struct Tabs {
    by_id: HashMap<String, Tab>,
    next_opened: u64,
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
    pub(crate) now_ms: i64,
}

impl BrowserRegistry {
    pub(crate) fn insert(&self, tab: NewTab<'_>) -> TabFacts {
        let mut tabs = lock_or_recover(&self.tabs);
        let opened = tabs.next_opened;
        tabs.next_opened += 1;
        let facts = TabFacts {
            id: tab.id.to_string(),
            session_id: tab.session_id.to_string(),
            url: tab.url.to_string(),
            title: String::new(),
            is_shown: tab.is_shown,
            hidden_since_ms: hidden_since(tab.is_shown, tab.now_ms),
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

    pub(crate) fn remove(&self, id: &str) -> Option<TabFacts> {
        lock_or_recover(&self.tabs)
            .by_id
            .remove(id)
            .map(|tab| tab.facts)
    }

    pub(crate) fn list(&self, session_id: &str) -> Vec<TabFacts> {
        let tabs = lock_or_recover(&self.tabs);
        let mut found: Vec<&Tab> = tabs
            .by_id
            .values()
            .filter(|tab| tab.facts.session_id == session_id)
            .collect();
        found.sort_by_key(|tab| tab.opened);
        found.into_iter().map(|tab| tab.facts.clone()).collect()
    }

    pub(crate) fn remove_window(&self, window_label: &str) -> usize {
        let mut tabs = lock_or_recover(&self.tabs);
        let before = tabs.by_id.len();
        tabs.by_id.retain(|_, tab| tab.window_label != window_label);
        before - tabs.by_id.len()
    }

    pub(crate) fn ids_of_session(&self, session_id: &str) -> Vec<String> {
        self.list(session_id)
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
            now_ms: 1_000,
        })
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
        assert_eq!(registry.ids_of_session("harborline"), vec!["c", "a", "d"]);
        assert_eq!(registry.ids_of_session("northwind"), vec!["b"]);
        assert!(registry.ids_of_session("cascadia").is_empty());
    }

    #[test]
    fn remembers_the_window_that_owns_a_tab() {
        let registry = BrowserRegistry::default();
        registry.insert(NewTab {
            id: "a",
            session_id: "harborline",
            window_label: "win-2",
            url: "about:blank",
            is_shown: true,
            now_ms: 0,
        });
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
        registry.insert(NewTab {
            id: "b",
            session_id: "harborline",
            window_label: "win-2",
            url: "about:blank",
            is_shown: true,
            now_ms: 0,
        });
        assert_eq!(registry.remove_window("win-2"), 1);
        assert_eq!(registry.ids_of_session("harborline"), vec!["a"]);
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
            },
            json!({
                "id": "a",
                "sessionId": "harborline",
                "url": "https://example.com/",
                "title": "Example Domain",
                "isShown": false,
                "hiddenSinceMs": 3000,
            }),
        );
    }
}
