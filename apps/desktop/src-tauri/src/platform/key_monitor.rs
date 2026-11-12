const KEY_DOWN_MASK: u64 = 1 << 10;

pub(crate) struct KeyDown {
    pub(crate) key_code: u16,
    pub(crate) flags: usize,
    event: *mut objc2::runtime::AnyObject,
}

impl KeyDown {
    pub(crate) fn focused_identifier(&self, is_wanted: impl Fn(&str) -> bool) -> Option<String> {
        use objc2::runtime::{AnyObject, Bool};
        use objc2::{class, msg_send};
        let window: *mut AnyObject = unsafe { msg_send![self.event, window] };
        if window.is_null() {
            return None;
        }
        let mut view: *mut AnyObject = unsafe { msg_send![window, firstResponder] };
        while !view.is_null() {
            let is_view: Bool = unsafe { msg_send![view, isKindOfClass: class!(NSView)] };
            if !is_view.as_bool() {
                return None;
            }
            if let Some(identifier) = identifier_of(view) {
                if is_wanted(&identifier) {
                    return Some(identifier);
                }
            }
            view = unsafe { msg_send![view, superview] };
        }
        None
    }
}

fn identifier_of(view: *mut objc2::runtime::AnyObject) -> Option<String> {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    let identifier: *mut AnyObject = unsafe { msg_send![view, identifier] };
    if identifier.is_null() {
        return None;
    }
    let text: *const std::ffi::c_char = unsafe { msg_send![identifier, UTF8String] };
    if text.is_null() {
        return None;
    }
    unsafe { std::ffi::CStr::from_ptr(text) }
        .to_str()
        .ok()
        .map(String::from)
}

pub(crate) fn mark_live_view(platform: tauri::webview::PlatformWebview, identifier: &str) {
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send};
    let Ok(text) = std::ffi::CString::new(identifier) else {
        return;
    };
    let view = platform.inner().cast::<AnyObject>();
    let name: *mut AnyObject =
        unsafe { msg_send![class!(NSString), stringWithUTF8String: text.as_ptr()] };
    if name.is_null() {
        return;
    }
    let _: () = unsafe { msg_send![view, setIdentifier: name] };
}

pub(crate) fn install(on_key: impl Fn(&KeyDown) -> bool + 'static) {
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send};
    use std::ptr::NonNull;
    let handler = RcBlock::new(move |event: NonNull<AnyObject>| -> *mut AnyObject {
        let raw = event.as_ptr();
        let key_code: u16 = unsafe { msg_send![raw, keyCode] };
        let flags: usize = unsafe { msg_send![raw, modifierFlags] };
        let key = KeyDown {
            key_code,
            flags,
            event: raw,
        };
        if on_key(&key) {
            return std::ptr::null_mut();
        }
        raw
    });
    let monitor: Option<Retained<AnyObject>> = unsafe {
        msg_send![
            class!(NSEvent),
            addLocalMonitorForEventsMatchingMask: KEY_DOWN_MASK,
            handler: &*handler
        ]
    };
    std::mem::forget(monitor);
}
