use std::sync::{Arc, RwLock};

use tokio::sync::Notify;

#[derive(Clone, Default)]
pub struct LiveSelection {
    names: Arc<RwLock<Option<Vec<String>>>>,
    wake: Arc<Notify>,
}

impl LiveSelection {
    pub fn new(names: Option<Vec<String>>) -> Self {
        Self {
            names: Arc::new(RwLock::new(names)),
            wake: Arc::new(Notify::new()),
        }
    }

    pub fn set(&self, names: Option<Vec<String>>) {
        if let Ok(mut held) = self.names.write() {
            *held = names;
        }
        self.wake.notify_one();
    }

    pub fn get(&self) -> Option<Vec<String>> {
        self.names.read().map(|held| held.clone()).unwrap_or(None)
    }

    pub async fn changed(&self) {
        self.wake.notified().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn a_new_choice_is_read_back_and_wakes_the_watcher() {
        let selection = LiveSelection::new(Some(vec!["en0".into()]));
        assert_eq!(selection.get(), Some(vec!["en0".to_string()]));

        selection.set(Some(vec!["utun4".into()]));

        selection.changed().await;
        assert_eq!(selection.get(), Some(vec!["utun4".to_string()]));
    }
}
