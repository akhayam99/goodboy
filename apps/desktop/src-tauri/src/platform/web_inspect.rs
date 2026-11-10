#[cfg(target_os = "macos")]
pub(crate) fn is_inspect_supported() -> bool {
    use objc2::runtime::AnyClass;
    use objc2::sel;
    AnyClass::get(c"WKWebView")
        .and_then(|class| class.instance_method(sel!(setInspectable:)))
        .is_some()
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn is_inspect_supported() -> bool {
    false
}

#[cfg(target_os = "macos")]
pub(crate) fn make_live_wk_web_view_inspectable(platform: tauri::webview::PlatformWebview) {
    use objc2::msg_send;
    use objc2::runtime::{AnyObject, Bool};
    let view = platform.inner().cast::<AnyObject>();
    let _: () = unsafe { msg_send![view, setInspectable: Bool::YES] };
}
