#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum HistoryStep {
    Back,
    Forward,
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
