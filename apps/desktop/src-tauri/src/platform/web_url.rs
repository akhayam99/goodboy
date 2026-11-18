use std::time::Duration;

use tauri::{Runtime, Url, Webview};

const READ_WAIT: Duration = Duration::from_millis(500);

#[cfg(target_os = "macos")]
fn read_wk_web_view_url(platform: tauri::webview::PlatformWebview) -> Option<String> {
    read_view_url(platform.inner().cast::<objc2::runtime::AnyObject>())
}

#[cfg(target_os = "macos")]
fn read_view_url(view: *mut objc2::runtime::AnyObject) -> Option<String> {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    use std::ffi::{c_char, CStr};
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

#[cfg(all(test, target_os = "macos"))]
mod tests {
    #[test]
    fn reads_no_address_from_a_view_that_is_gone() {
        assert_eq!(super::read_view_url(std::ptr::null_mut()), None);
    }
}

#[cfg(test)]
mod guard {
    use std::path::Path;

    const RAW_READS: [&str; 2] = ["webview.url()", ")?.url()"];

    fn raw_reads_in(dir: &Path, found: &mut Vec<String>) {
        let Ok(entries) = std::fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                raw_reads_in(&path, found);
                continue;
            }
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !name.ends_with(".rs") || name == "tests.rs" || name == "web_url.rs" {
                continue;
            }
            let text = std::fs::read_to_string(&path).unwrap_or_default();
            for (index, line) in text.lines().enumerate() {
                if RAW_READS.iter().any(|raw| line.contains(raw)) {
                    found.push(format!("{}:{}", path.display(), index + 1));
                }
            }
        }
    }

    #[test]
    fn no_tab_reads_its_address_through_the_panicking_getter() {
        let mut found = Vec::new();
        raw_reads_in(
            &Path::new(env!("CARGO_MANIFEST_DIR")).join("src"),
            &mut found,
        );
        assert!(found.is_empty(), "use live_url_of instead: {found:?}");
    }
}
