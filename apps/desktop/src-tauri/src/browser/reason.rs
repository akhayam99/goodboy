use crate::util::MessageError;

pub(crate) const BROWSER_CALLER: &str = "browser-caller";
pub(crate) const NOT_WEB_ADDRESS: &str = "not-web-address";
pub(crate) const INVALID_ADDRESS: &str = "invalid-address";
pub(crate) const TAB_GONE: &str = "tab-gone";
pub(crate) const TAB_CLOSED: &str = "tab-closed";
pub(crate) const WINDOW_GONE: &str = "window-gone";
pub(crate) const OTHER_WINDOW: &str = "other-window";
pub(crate) const TOO_MANY_POPUPS: &str = "too-many-popups";
pub(crate) const SESSION_CLOSING: &str = "session-closing";
pub(crate) const INVALID_WORKSPACE: &str = "invalid-workspace";
pub(crate) const PROFILE_BUSY: &str = "profile-busy";
pub(crate) const PROFILE_LIVE: &str = "profile-live";
pub(crate) const PROFILE_SHARED: &str = "profile-shared";
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) const PROFILE_UNAVAILABLE: &str = "profile-unavailable";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub(crate) const HISTORY_UNAVAILABLE: &str = "history-unavailable";
pub(crate) const FIND_UNAVAILABLE: &str = "find-unavailable";
pub(crate) const NEEDLE_TOO_LONG: &str = "needle-too-long";
pub(crate) const UNSUPPORTED_PLATFORM: &str = "unsupported-platform";
pub(crate) const TAB_ROW_GONE: &str = "tab-row-gone";
pub(crate) const TAB_ROW_OWNER: &str = "tab-row-owner";
pub(crate) const TAB_ROWS_CHANGED: &str = "tab-rows-changed";
pub(crate) const TAB_ROWS_FAILED: &str = "tab-rows-failed";
pub(crate) const VISITS_FAILED: &str = "visits-failed";

pub(crate) fn refused(code: &str) -> MessageError {
    MessageError::Refused(code.to_string())
}

pub(crate) fn failed(code: &str) -> MessageError {
    MessageError::Failed(code.to_string())
}
