use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
use objc2::{class, msg_send, sel};

const FULL_SCREEN_STYLE_MASK: usize = 1 << 14;
const ESCAPE_KEY_CODE: u16 = 53;

fn is_full_screen(style_mask: usize) -> bool {
    style_mask & FULL_SCREEN_STYLE_MASK != 0
}

fn swallows_key_down(style_mask: usize, key_code: u16) -> bool {
    key_code == ESCAPE_KEY_CODE && is_full_screen(style_mask)
}

unsafe extern "C-unwind" fn cancel_operation(this: &AnyObject, _cmd: Sel, sender: *mut AnyObject) {
    let style_mask: usize = msg_send![this, styleMask];
    if is_full_screen(style_mask) {
        return;
    }
    let _: () = msg_send![super(this, class!(NSWindow)), cancelOperation: sender];
}

unsafe extern "C-unwind" fn key_down(this: &AnyObject, _cmd: Sel, event: &AnyObject) {
    let style_mask: usize = msg_send![this, styleMask];
    let key_code: u16 = msg_send![event, keyCode];
    if swallows_key_down(style_mask, key_code) {
        return;
    }
    let _: () = msg_send![super(this, class!(NSWindow)), keyDown: event];
}

unsafe fn add_method(cls: *mut AnyClass, name: Sel, imp: Imp) {
    let _ = objc2::ffi::class_addMethod(cls, name, imp, c"v@:@".as_ptr());
}

pub fn install(window: &tauri::WebviewWindow) {
    let Ok(ns_window) = window.ns_window() else {
        return;
    };
    unsafe {
        let cls = objc2::ffi::object_getClass(ns_window as *const AnyObject) as *mut AnyClass;
        if cls.is_null() || std::ptr::eq(cls, class!(NSWindow)) {
            return;
        }
        let cancel: unsafe extern "C-unwind" fn(&AnyObject, Sel, *mut AnyObject) = cancel_operation;
        let key: unsafe extern "C-unwind" fn(&AnyObject, Sel, &AnyObject) = key_down;
        add_method(
            cls,
            sel!(cancelOperation:),
            std::mem::transmute::<_, Imp>(cancel),
        );
        add_method(cls, sel!(keyDown:), std::mem::transmute::<_, Imp>(key));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_screen_bit_is_detected() {
        assert!(is_full_screen(FULL_SCREEN_STYLE_MASK | 0b1111));
        assert!(!is_full_screen(0b1111));
    }

    #[test]
    fn escape_is_swallowed_only_in_full_screen() {
        assert!(swallows_key_down(FULL_SCREEN_STYLE_MASK, ESCAPE_KEY_CODE));
        assert!(!swallows_key_down(0, ESCAPE_KEY_CODE));
    }

    #[test]
    fn other_keys_pass_through_in_full_screen() {
        assert!(!swallows_key_down(FULL_SCREEN_STYLE_MASK, 3));
        assert!(!swallows_key_down(FULL_SCREEN_STYLE_MASK, 36));
    }
}
