use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
use objc2::{class, msg_send, sel};

const FULL_SCREEN_STYLE_MASK: usize = 1 << 14;
const ESCAPE_KEY_CODE: u16 = 53;
const KEY_DOWN_EVENT_TYPE: usize = 10;

type SenderFn = unsafe extern "C-unwind" fn(&AnyObject, Sel, *mut AnyObject);
type EventFn = unsafe extern "C-unwind" fn(&AnyObject, Sel, &AnyObject);

fn is_full_screen(style_mask: usize) -> bool {
    style_mask & FULL_SCREEN_STYLE_MASK != 0
}

fn swallows_key_down(style_mask: usize, key_code: u16) -> bool {
    key_code == ESCAPE_KEY_CODE && is_full_screen(style_mask)
}

fn blocks_toggle(style_mask: usize, event_type: usize, key_code: u16) -> bool {
    event_type == KEY_DOWN_EVENT_TYPE && swallows_key_down(style_mask, key_code)
}

unsafe fn current_event_blocks_toggle(style_mask: usize) -> bool {
    let app: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
    if app.is_null() {
        return false;
    }
    let event: *mut AnyObject = msg_send![app, currentEvent];
    if event.is_null() {
        return false;
    }
    let event_type: usize = msg_send![event, type];
    if event_type != KEY_DOWN_EVENT_TYPE {
        return false;
    }
    let key_code: u16 = msg_send![event, keyCode];
    blocks_toggle(style_mask, event_type, key_code)
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

unsafe extern "C-unwind" fn toggle_full_screen(
    this: &AnyObject,
    _cmd: Sel,
    sender: *mut AnyObject,
) {
    let style_mask: usize = msg_send![this, styleMask];
    if current_event_blocks_toggle(style_mask) {
        return;
    }
    let _: () = msg_send![super(this, class!(NSWindow)), toggleFullScreen: sender];
}

unsafe fn add_method(cls: *mut AnyClass, name: Sel, imp: Imp) -> bool {
    objc2::ffi::class_addMethod(cls, name, imp, c"v@:@".as_ptr()).as_bool()
}

unsafe fn install_on_class(cls: *mut AnyClass) -> usize {
    let cancel = std::mem::transmute::<SenderFn, Imp>(cancel_operation);
    let key = std::mem::transmute::<EventFn, Imp>(key_down);
    let toggle = std::mem::transmute::<SenderFn, Imp>(toggle_full_screen);
    [
        add_method(cls, sel!(cancelOperation:), cancel),
        add_method(cls, sel!(keyDown:), key),
        add_method(cls, sel!(toggleFullScreen:), toggle),
    ]
    .into_iter()
    .filter(|added| *added)
    .count()
}

pub fn install(window: &tauri::WebviewWindow) {
    let Ok(ns_window) = window.ns_window() else {
        return;
    };
    unsafe {
        let cls = objc2::ffi::object_getClass(ns_window as *const AnyObject) as *mut AnyClass;
        if cls.is_null() || std::ptr::eq(cls, class!(NSWindow)) {
            eprintln!("[goodboy] full screen esc guard skipped: window class is not a subclass");
            return;
        }
        let added = install_on_class(cls);
        if added < 3 {
            eprintln!("[goodboy] full screen esc guard installed {added} of 3 methods");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use objc2::runtime::ClassBuilder;

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

    #[test]
    fn toggle_is_blocked_only_for_an_escape_key_down_in_full_screen() {
        assert!(blocks_toggle(
            FULL_SCREEN_STYLE_MASK,
            KEY_DOWN_EVENT_TYPE,
            ESCAPE_KEY_CODE
        ));
        assert!(!blocks_toggle(0, KEY_DOWN_EVENT_TYPE, ESCAPE_KEY_CODE));
        assert!(!blocks_toggle(FULL_SCREEN_STYLE_MASK, 1, ESCAPE_KEY_CODE));
        assert!(!blocks_toggle(
            FULL_SCREEN_STYLE_MASK,
            KEY_DOWN_EVENT_TYPE,
            3
        ));
    }

    #[test]
    fn install_adds_every_method_to_a_window_subclass_once() {
        let builder = ClassBuilder::new(c"GoodboyEscGuardTestWindow", class!(NSWindow))
            .expect("test class name is unique");
        let cls = builder.register() as *const AnyClass as *mut AnyClass;
        unsafe {
            assert_eq!(install_on_class(cls), 3);
            assert_eq!(install_on_class(cls), 0);
        }
        let cls_ref: &AnyClass = unsafe { &*cls };
        assert!(cls_ref.instance_method(sel!(cancelOperation:)).is_some());
        assert!(cls_ref.instance_method(sel!(keyDown:)).is_some());
        assert!(cls_ref.instance_method(sel!(toggleFullScreen:)).is_some());
    }
}
