use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::util::lock_or_recover;

#[cfg(target_os = "macos")]
pub(crate) const WATCH_SCRIPT: &str = include_str!("passkey.js");

pub(crate) type OnAsk = Arc<dyn Fn() + Send + Sync>;

struct Watched {
    tab_id: String,
    on_ask: OnAsk,
}

#[derive(Default)]
pub(crate) struct PasskeyWatch {
    by_handler: Mutex<HashMap<usize, Watched>>,
}

impl PasskeyWatch {
    pub(crate) fn watch(&self, handler: usize, tab_id: &str, on_ask: OnAsk) {
        let mut watched = lock_or_recover(&self.by_handler);
        watched.retain(|_, entry| entry.tab_id != tab_id);
        watched.insert(
            handler,
            Watched {
                tab_id: tab_id.to_string(),
                on_ask,
            },
        );
    }

    pub(crate) fn ask(&self, handler: usize) -> bool {
        let on_ask = lock_or_recover(&self.by_handler)
            .get(&handler)
            .map(|entry| Arc::clone(&entry.on_ask));
        let Some(on_ask) = on_ask else {
            return false;
        };
        on_ask();
        true
    }

    pub(crate) fn forget(&self, tab_id: &str) {
        lock_or_recover(&self.by_handler).retain(|_, entry| entry.tab_id != tab_id);
    }
}

#[cfg(target_os = "macos")]
pub(crate) static WATCHES: std::sync::LazyLock<PasskeyWatch> =
    std::sync::LazyLock::new(PasskeyWatch::default);

#[cfg(target_os = "macos")]
pub(crate) fn watch_wk_web_view(
    platform: tauri::webview::PlatformWebview,
    tab_id: &str,
    on_ask: OnAsk,
) {
    let added = crate::platform::passkey_handler::add_to_live_wk_web_view(platform, ask_from);
    let Some(handler) = added else {
        return;
    };
    WATCHES.watch(handler, tab_id, on_ask);
}

#[cfg(target_os = "macos")]
fn ask_from(handler: usize) {
    WATCHES.ask(handler);
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicUsize, Ordering};

    use super::*;

    fn counter(calls: &Arc<AtomicUsize>) -> OnAsk {
        let calls = Arc::clone(calls);
        Arc::new(move || {
            calls.fetch_add(1, Ordering::SeqCst);
        })
    }

    #[test]
    fn an_ask_reaches_the_tab_its_handler_watches() {
        let watch = PasskeyWatch::default();
        let first = Arc::new(AtomicUsize::new(0));
        let second = Arc::new(AtomicUsize::new(0));
        watch.watch(1, "a", counter(&first));
        watch.watch(2, "b", counter(&second));
        assert!(watch.ask(1));
        assert_eq!(first.load(Ordering::SeqCst), 1);
        assert_eq!(second.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn an_ask_from_an_unknown_handler_does_nothing() {
        let watch = PasskeyWatch::default();
        let calls = Arc::new(AtomicUsize::new(0));
        watch.watch(1, "a", counter(&calls));
        assert!(!watch.ask(9));
        assert_eq!(calls.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn a_respawned_tab_keeps_only_its_new_handler() {
        let watch = PasskeyWatch::default();
        let old = Arc::new(AtomicUsize::new(0));
        let new = Arc::new(AtomicUsize::new(0));
        watch.watch(1, "a", counter(&old));
        watch.watch(2, "a", counter(&new));
        assert!(!watch.ask(1));
        assert!(watch.ask(2));
        assert_eq!(old.load(Ordering::SeqCst), 0);
        assert_eq!(new.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn a_reused_handler_address_belongs_to_the_newest_tab() {
        let watch = PasskeyWatch::default();
        let old = Arc::new(AtomicUsize::new(0));
        let new = Arc::new(AtomicUsize::new(0));
        watch.watch(1, "a", counter(&old));
        watch.watch(1, "b", counter(&new));
        assert!(watch.ask(1));
        assert_eq!(old.load(Ordering::SeqCst), 0);
        assert_eq!(new.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn a_closed_tab_is_forgotten() {
        let watch = PasskeyWatch::default();
        let calls = Arc::new(AtomicUsize::new(0));
        watch.watch(1, "a", counter(&calls));
        watch.forget("a");
        assert!(!watch.ask(1));
        assert_eq!(calls.load(Ordering::SeqCst), 0);
    }
}
