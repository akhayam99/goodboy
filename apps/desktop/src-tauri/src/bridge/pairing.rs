use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tokio::sync::oneshot;

pub const CONFIRM_WINDOW: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PendingPairing {
    pub id: String,
    pub name: String,
    pub code: String,
    pub asked_at: String,
}

pub fn code_of(handshake_hash: &[u8]) -> String {
    let mut head = [0u8; 4];
    for (slot, byte) in head.iter_mut().zip(handshake_hash.iter()) {
        *slot = *byte;
    }
    let digits = u32::from_be_bytes(head) % 1_000_000;
    format!("{:03} {:03}", digits / 1000, digits % 1000)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verdict {
    Allowed,
    Denied,
    Expired,
    Busy,
}

type Notify = Box<dyn Fn(&PendingPairing) + Send + Sync>;

struct Waiting {
    pending: PendingPairing,
    answer: oneshot::Sender<bool>,
}

pub struct PairingHold {
    window: Duration,
    auto: Option<bool>,
    notify: Option<Notify>,
    waiting: Mutex<Option<Waiting>>,
}

fn random_id() -> String {
    use rand::Rng;
    let mut bytes = [0u8; 8];
    rand::rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

impl PairingHold {
    pub fn new(notify: Notify) -> Self {
        Self {
            window: CONFIRM_WINDOW,
            auto: None,
            notify: Some(notify),
            waiting: Mutex::new(None),
        }
    }

    #[cfg(test)]
    pub fn answering(allow: bool) -> Self {
        Self {
            window: CONFIRM_WINDOW,
            auto: Some(allow),
            notify: None,
            waiting: Mutex::new(None),
        }
    }

    #[cfg(test)]
    pub fn with_window(window: Duration) -> Self {
        Self {
            window,
            auto: None,
            notify: None,
            waiting: Mutex::new(None),
        }
    }

    pub fn pending(&self) -> Option<PendingPairing> {
        self.waiting
            .lock()
            .ok()?
            .as_ref()
            .map(|waiting| waiting.pending.clone())
    }

    pub fn cancel(&self) {
        let Ok(mut guard) = self.waiting.lock() else {
            return;
        };
        if let Some(waiting) = guard.take() {
            let _ = waiting.answer.send(false);
        }
    }

    pub fn decide(&self, id: &str, allow: bool) -> bool {
        let Ok(mut guard) = self.waiting.lock() else {
            return false;
        };
        if guard
            .as_ref()
            .is_none_or(|waiting| waiting.pending.id != id)
        {
            return false;
        }
        let Some(waiting) = guard.take() else {
            return false;
        };
        waiting.answer.send(allow).is_ok()
    }

    pub async fn request(&self, name: &str, code: &str) -> Verdict {
        if let Some(allow) = self.auto {
            return match allow {
                true => Verdict::Allowed,
                false => Verdict::Denied,
            };
        }
        let (answer, heard) = oneshot::channel();
        let pending = PendingPairing {
            id: random_id(),
            name: name.to_string(),
            code: code.to_string(),
            asked_at: crate::util::iso_now_whole_seconds(),
        };
        {
            let Ok(mut guard) = self.waiting.lock() else {
                return Verdict::Busy;
            };
            if guard.is_some() {
                return Verdict::Busy;
            }
            *guard = Some(Waiting {
                pending: pending.clone(),
                answer,
            });
        }
        if let Some(notify) = &self.notify {
            notify(&pending);
        }
        let outcome = tokio::time::timeout(self.window, heard).await;
        match outcome {
            Ok(Ok(true)) => Verdict::Allowed,
            Ok(Ok(false)) => Verdict::Denied,
            _ => {
                self.forget(&pending.id);
                Verdict::Expired
            }
        }
    }

    fn forget(&self, id: &str) {
        let Ok(mut guard) = self.waiting.lock() else {
            return;
        };
        if guard
            .as_ref()
            .is_some_and(|waiting| waiting.pending.id == id)
        {
            *guard = None;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[test]
    fn the_code_is_six_digits_from_the_first_four_bytes_of_the_handshake_hash() {
        let mut hash = [0u8; 32];
        hash[..4].copy_from_slice(&482_913u32.to_be_bytes());

        assert_eq!(code_of(&hash), "482 913");
        assert_eq!(code_of(&[0u8; 32]), "000 000");
        assert_eq!(code_of(&[0xFF; 32]), "967 295");
        assert_eq!(code_of(&[1, 2]), "908 288");
    }

    #[tokio::test]
    async fn a_cancel_ends_the_wait_as_a_denial() {
        let hold = Arc::new(PairingHold::with_window(Duration::from_secs(5)));
        let asking = {
            let hold = hold.clone();
            tokio::spawn(async move { hold.request("Harborline iPhone", "111 222").await })
        };
        while hold.pending().is_none() {
            tokio::task::yield_now().await;
        }

        hold.cancel();

        assert_eq!(asking.await.unwrap(), Verdict::Denied);
    }

    #[tokio::test]
    async fn a_request_waits_until_the_user_allows_it() {
        let hold = Arc::new(PairingHold::with_window(Duration::from_secs(5)));
        let asking = {
            let hold = hold.clone();
            tokio::spawn(async move { hold.request("Harborline iPhone", "482 913").await })
        };
        let pending = loop {
            if let Some(pending) = hold.pending() {
                break pending;
            }
            tokio::task::yield_now().await;
        };
        assert_eq!(pending.name, "Harborline iPhone");
        assert!(!asking.is_finished());

        assert!(hold.decide(&pending.id, true));

        assert_eq!(asking.await.unwrap(), Verdict::Allowed);
        assert!(hold.pending().is_none());
    }

    #[tokio::test]
    async fn deny_and_a_stale_id_are_told_apart() {
        let hold = Arc::new(PairingHold::with_window(Duration::from_secs(5)));
        let asking = {
            let hold = hold.clone();
            tokio::spawn(async move { hold.request("Northwind iPhone", "482 913").await })
        };
        let pending = loop {
            if let Some(pending) = hold.pending() {
                break pending;
            }
            tokio::task::yield_now().await;
        };

        assert!(!hold.decide("not-the-id", true));
        assert!(hold.pending().is_some());
        assert!(hold.decide(&pending.id, false));

        assert_eq!(asking.await.unwrap(), Verdict::Denied);
    }

    #[tokio::test]
    async fn no_answer_expires_and_frees_the_slot() {
        let hold = PairingHold::with_window(Duration::from_millis(30));

        assert_eq!(
            hold.request("Acme iPhone", "482 913").await,
            Verdict::Expired
        );

        assert!(hold.pending().is_none());
        assert_eq!(
            hold.request("Acme iPhone", "482 913").await,
            Verdict::Expired
        );
    }

    #[tokio::test]
    async fn a_second_request_while_one_waits_is_busy() {
        let hold = Arc::new(PairingHold::with_window(Duration::from_secs(5)));
        let first = {
            let hold = hold.clone();
            tokio::spawn(async move { hold.request("Harborline iPhone", "482 913").await })
        };
        let pending = loop {
            if let Some(pending) = hold.pending() {
                break pending;
            }
            tokio::task::yield_now().await;
        };

        assert_eq!(
            hold.request("Cascadia iPhone", "482 913").await,
            Verdict::Busy
        );

        hold.decide(&pending.id, true);
        assert_eq!(first.await.unwrap(), Verdict::Allowed);
    }

    #[tokio::test]
    async fn the_notifier_hears_each_request() {
        let heard = Arc::new(Mutex::new(Vec::<String>::new()));
        let sink = heard.clone();
        let mut hold = PairingHold::new(Box::new(move |pending| {
            sink.lock().unwrap().push(pending.name.clone());
        }));
        hold.window = Duration::from_millis(20);

        hold.request("Harborline iPhone", "482 913").await;

        assert_eq!(*heard.lock().unwrap(), ["Harborline iPhone"]);
    }
}
