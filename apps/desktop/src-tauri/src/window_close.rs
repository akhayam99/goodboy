use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, State, Window};

use crate::util::lock_or_recover;

pub(crate) const CLOSE_FALLBACK: Duration = Duration::from_secs(2);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Request {
    at: Instant,
    is_claimed: bool,
}

#[derive(Default, Clone)]
pub struct CloseClaims(Arc<Mutex<HashMap<String, Request>>>);

impl CloseClaims {
    pub(crate) fn request(&self, label: &str, at: Instant) {
        lock_or_recover(&self.0).insert(
            label.to_string(),
            Request {
                at,
                is_claimed: false,
            },
        );
    }

    pub(crate) fn claim(&self, label: &str) {
        if let Some(request) = lock_or_recover(&self.0).get_mut(label) {
            request.is_claimed = true;
        }
    }

    pub(crate) fn forget(&self, label: &str) {
        lock_or_recover(&self.0).remove(label);
    }

    pub(crate) fn is_unclaimed(&self, label: &str, at: Instant) -> bool {
        lock_or_recover(&self.0)
            .get(label)
            .is_some_and(|request| request.at == at && !request.is_claimed)
    }
}

pub fn arm(app: &AppHandle, label: &str) {
    let claims = app.state::<CloseClaims>().inner().clone();
    let at = Instant::now();
    claims.request(label, at);
    let app = app.clone();
    let label = label.to_string();
    std::thread::spawn(move || {
        std::thread::sleep(CLOSE_FALLBACK);
        if !claims.is_unclaimed(&label, at) {
            return;
        }
        let Some(window) = app.get_webview_window(&label) else {
            return;
        };
        log::warn!("[window] close_fallback label={label}");
        if let Err(error) = window.destroy() {
            log::warn!("[window] close_fallback_failed label={label} error={error}");
        }
    });
}

#[cfg(target_os = "macos")]
pub fn reveal_main(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if let Err(error) = window.show() {
        log::warn!("[window] reveal_main_failed error={error}");
        return;
    }
    if let Err(error) = window.set_focus() {
        log::warn!("[window] focus_main_failed error={error}");
    }
}

#[tauri::command]
pub fn window_close_claim(window: Window, claims: State<'_, CloseClaims>) {
    claims.claim(window.label());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_close_nobody_answered_is_due_for_the_fallback() {
        let claims = CloseClaims::default();
        let at = Instant::now();
        claims.request("win-harborline", at);

        assert!(claims.is_unclaimed("win-harborline", at));
    }

    #[test]
    fn a_close_the_page_answered_is_left_to_the_page() {
        let claims = CloseClaims::default();
        let at = Instant::now();
        claims.request("win-harborline", at);
        claims.claim("win-harborline");

        assert!(!claims.is_unclaimed("win-harborline", at));
    }

    #[test]
    fn a_second_close_request_retires_the_first_fallback() {
        let claims = CloseClaims::default();
        let first = Instant::now();
        claims.request("win-harborline", first);
        let second = first + Duration::from_millis(500);
        claims.request("win-harborline", second);

        assert!(!claims.is_unclaimed("win-harborline", first));
        assert!(claims.is_unclaimed("win-harborline", second));
    }

    #[test]
    fn a_destroyed_window_has_no_fallback_left() {
        let claims = CloseClaims::default();
        let at = Instant::now();
        claims.request("win-northwind", at);
        claims.forget("win-northwind");

        assert!(!claims.is_unclaimed("win-northwind", at));
    }

    #[test]
    fn a_claim_for_another_window_does_not_answer_this_one() {
        let claims = CloseClaims::default();
        let at = Instant::now();
        claims.request("main", at);
        claims.claim("win-northwind");

        assert!(claims.is_unclaimed("main", at));
    }

    #[test]
    fn the_fallback_waits_two_seconds() {
        assert_eq!(CLOSE_FALLBACK, Duration::from_secs(2));
    }
}
