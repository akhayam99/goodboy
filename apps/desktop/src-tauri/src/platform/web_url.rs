use std::time::Duration;

use tauri::{Runtime, Url, Webview};

const READ_WAIT: Duration = Duration::from_millis(500);

#[cfg(target_os = "macos")]
fn read_wk_web_view_url(platform: tauri::webview::PlatformWebview) -> Option<String> {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    use std::ffi::{c_char, CStr};
    let view = platform.inner().cast::<AnyObject>();
    if view.is_null() {
        return None;
    }
    let url: *mut AnyObject = unsafe { msg_send![view, URL] };
    if url.is_null() {
        return None;
    }
    let absolute: *mut AnyObject = unsafe { msg_send![url, absoluteString] };
    if absolute.is_null() {
        return None;
    }
    let bytes: *const c_char = unsafe { msg_send![absolute, UTF8String] };
    if bytes.is_null() {
        return None;
    }
    let text = unsafe { CStr::from_ptr(bytes) };
    text.to_str().ok().map(str::to_owned)
}

#[cfg(target_os = "macos")]
pub(crate) fn live_url_of<R: Runtime>(webview: &Webview<R>) -> Option<Url> {
    if std::any::TypeId::of::<R>() != std::any::TypeId::of::<tauri::Wry>() {
        return webview.url().ok();
    }
    let (sender, receiver) = std::sync::mpsc::sync_channel::<Option<String>>(1);
    let asked = webview.with_webview(move |platform| {
        let _ = sender.send(read_wk_web_view_url(platform));
    });
    if asked.is_err() {
        return None;
    }
    let text = receiver.recv_timeout(READ_WAIT).ok().flatten()?;
    Url::parse(&text).ok()
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn live_url_of<R: Runtime>(webview: &Webview<R>) -> Option<Url> {
    let _ = READ_WAIT;
    webview.url().ok()
}
