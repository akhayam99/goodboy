use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum HistoryStep {
    Back,
    Forward,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HistoryState {
    pub(crate) can_go_back: bool,
    pub(crate) can_go_forward: bool,
}

#[cfg(target_os = "macos")]
pub(crate) fn step_live_wk_web_view(platform: tauri::webview::PlatformWebview, step: HistoryStep) {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    let view = platform.inner().cast::<AnyObject>();
    let _: *mut AnyObject = match step {
        HistoryStep::Back => unsafe { msg_send![view, goBack] },
        HistoryStep::Forward => unsafe { msg_send![view, goForward] },
    };
}

#[cfg(target_os = "macos")]
pub(crate) fn read_live_wk_web_view(platform: tauri::webview::PlatformWebview) -> HistoryState {
    use objc2::msg_send;
    use objc2::runtime::{AnyObject, Bool};
    let view = platform.inner().cast::<AnyObject>();
    let can_go_back: Bool = unsafe { msg_send![view, canGoBack] };
    let can_go_forward: Bool = unsafe { msg_send![view, canGoForward] };
    HistoryState {
        can_go_back: can_go_back.as_bool(),
        can_go_forward: can_go_forward.as_bool(),
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn stop_live_wk_web_view(platform: tauri::webview::PlatformWebview) {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    let view = platform.inner().cast::<AnyObject>();
    let _: () = unsafe { msg_send![view, stopLoading] };
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::util::wire_shape::assert_wire_value;

    #[test]
    fn wire_shape_history_state() {
        assert_wire_value(
            &HistoryState {
                can_go_back: true,
                can_go_forward: false,
            },
            json!({ "canGoBack": true, "canGoForward": false }),
        );
    }
}
