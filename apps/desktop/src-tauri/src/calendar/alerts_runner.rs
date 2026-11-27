use std::sync::{Arc, Condvar, Mutex};

use tauri::{AppHandle, Emitter};

use super::alerts::{wait_until, AlertBook, ArmedCall};
use crate::util::now_ms;

pub(crate) const ALERT_EVENT: &str = "calendar-alert";
const MAIN_WINDOW: &str = "main";

#[derive(Default, Clone)]
pub(crate) struct CallAlerts {
    inner: Arc<(Mutex<AlertBook>, Condvar)>,
}

impl CallAlerts {
    fn with_book<T>(&self, work: impl FnOnce(&mut AlertBook) -> T) -> T {
        let (lock, wake) = &*self.inner;
        let mut book = lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let result = work(&mut book);
        wake.notify_all();
        result
    }

    pub(crate) fn arm(&self, calls: Vec<ArmedCall>) -> usize {
        self.with_book(|book| book.arm(calls))
    }

    pub(crate) fn snooze(&self, event_id: &str, at: i64) -> bool {
        self.with_book(|book| book.snooze(event_id, at))
    }
}

pub(crate) fn start(app: AppHandle, alerts: CallAlerts) {
    std::thread::spawn(move || {
        let (lock, wake) = &*alerts.inner;
        let mut book = lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        loop {
            let now = now_ms();
            for alert in book.due(now) {
                if let Err(error) = app.emit_to(MAIN_WINDOW, ALERT_EVENT, &alert) {
                    log::warn!("[calendar] alert_not_sent reason={error}");
                }
            }
            let wait = wait_until(book.next_at(now), now);
            book = match wake.wait_timeout(book, wait) {
                Ok((guard, _)) => guard,
                Err(poisoned) => poisoned.into_inner().0,
            };
        }
    });
}
