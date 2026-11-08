use crate::util::MessageError;

pub(crate) const BROWSER_CALLER: &str = "browser-caller";
pub(crate) const NOT_WEB_ADDRESS: &str = "not-web-address";
pub(crate) const INVALID_ADDRESS: &str = "invalid-address";
pub(crate) const TAB_GONE: &str = "tab-gone";
pub(crate) const WINDOW_GONE: &str = "window-gone";
pub(crate) const OTHER_WINDOW: &str = "other-window";

pub(crate) fn refused(code: &str) -> MessageError {
    MessageError::Refused(code.to_string())
}

pub(crate) fn failed(code: &str) -> MessageError {
    MessageError::Failed(code.to_string())
}
