use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct Entry {
    since: String,
    open: usize,
}

#[derive(Clone, Default)]
pub struct LiveSet {
    inner: Arc<Mutex<HashMap<String, Entry>>>,
}

pub struct LiveGuard {
    set: LiveSet,
    key: String,
}

impl LiveSet {
    pub fn enter(&self, key: &str, now: String) -> LiveGuard {
        let mut map = self.inner.lock().expect("live set lock");
        let entry = map.entry(key.to_string()).or_default();
        if entry.open == 0 {
            entry.since = now;
        }
        entry.open += 1;
        LiveGuard {
            set: self.clone(),
            key: key.to_string(),
        }
    }

    pub fn since(&self, key: &str) -> Option<String> {
        let map = self.inner.lock().expect("live set lock");
        map.get(key)
            .filter(|entry| entry.open > 0)
            .map(|entry| entry.since.clone())
    }
}

impl Drop for LiveGuard {
    fn drop(&mut self) {
        let mut map = self.set.inner.lock().expect("live set lock");
        let Some(entry) = map.get_mut(&self.key) else {
            return;
        };
        entry.open = entry.open.saturating_sub(1);
        if entry.open == 0 {
            map.remove(&self.key);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_phone_is_live_while_a_connection_is_open() {
        let set = LiveSet::default();
        assert_eq!(set.since("a"), None);
        let first = set.enter("a", "2026-11-27T09:12:00.000Z".into());
        assert_eq!(set.since("a").as_deref(), Some("2026-11-27T09:12:00.000Z"));
        drop(first);
        assert_eq!(set.since("a"), None);
    }

    #[test]
    fn a_second_connection_keeps_the_first_since() {
        let set = LiveSet::default();
        let first = set.enter("a", "2026-11-27T09:12:00.000Z".into());
        let second = set.enter("a", "2026-11-27T09:30:00.000Z".into());
        assert_eq!(set.since("a").as_deref(), Some("2026-11-27T09:12:00.000Z"));
        drop(first);
        assert_eq!(set.since("a").as_deref(), Some("2026-11-27T09:12:00.000Z"));
        drop(second);
        assert_eq!(set.since("a"), None);
    }
}
