use objc2::ffi::{class_getName, class_getSuperclass, class_replaceMethod, object_getClass};
use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
use objc2::{class, msg_send, sel};
use std::ffi::CStr;
use std::sync::Mutex;

const FULL_SCREEN_STYLE_MASK: usize = 1 << 14;
const ESCAPE_KEY_CODE: u16 = 53;
const KEY_DOWN_EVENT_TYPE: usize = 10;
const KVO_CLASS_PREFIX: &str = "NSKVONotifying_";
const GUARDED_METHODS: usize = 3;

type SenderFn = unsafe extern "C-unwind" fn(&AnyObject, Sel, *mut AnyObject);
type EventFn = unsafe extern "C-unwind" fn(&AnyObject, Sel, &AnyObject);

static ORIGINALS: Mutex<Vec<(usize, Sel, usize)>> = Mutex::new(Vec::new());

fn is_full_screen(style_mask: usize) -> bool {
    style_mask & FULL_SCREEN_STYLE_MASK != 0
}

fn swallows_key_down(style_mask: usize, key_code: u16) -> bool {
    key_code == ESCAPE_KEY_CODE && is_full_screen(style_mask)
}

fn blocks_toggle(style_mask: usize, event_type: usize, key_code: u16) -> bool {
    event_type == KEY_DOWN_EVENT_TYPE && swallows_key_down(style_mask, key_code)
}

fn is_kvo_shim(class_name: &str) -> bool {
    class_name.starts_with(KVO_CLASS_PREFIX)
}

unsafe fn class_name(cls: *const AnyClass) -> String {
    CStr::from_ptr(class_getName(cls))
        .to_string_lossy()
        .into_owned()
}

unsafe fn original_imp(this: &AnyObject, cmd: Sel) -> Option<Imp> {
    let originals = ORIGINALS.lock().ok()?;
    let mut cls = object_getClass(this as *const AnyObject);
    while !cls.is_null() {
        let found = originals
            .iter()
            .find(|(c, s, _)| *c == cls as usize && *s == cmd);
        if let Some((_, _, imp)) = found {
            return Some(std::mem::transmute::<usize, Imp>(*imp));
        }
        cls = class_getSuperclass(cls);
    }
    None
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

unsafe extern "C-unwind" fn cancel_operation(this: &AnyObject, cmd: Sel, sender: *mut AnyObject) {
    let style_mask: usize = msg_send![this, styleMask];
    if is_full_screen(style_mask) {
        return;
    }
    match original_imp(this, cmd) {
        Some(imp) => std::mem::transmute::<Imp, SenderFn>(imp)(this, cmd, sender),
        None => {
            let _: () = msg_send![super(this, class!(NSWindow)), cancelOperation: sender];
        }
    }
}

unsafe extern "C-unwind" fn key_down(this: &AnyObject, cmd: Sel, event: &AnyObject) {
    let style_mask: usize = msg_send![this, styleMask];
    let key_code: u16 = msg_send![event, keyCode];
    if swallows_key_down(style_mask, key_code) {
        return;
    }
    match original_imp(this, cmd) {
        Some(imp) => std::mem::transmute::<Imp, EventFn>(imp)(this, cmd, event),
        None => {
            let _: () = msg_send![super(this, class!(NSWindow)), keyDown: event];
        }
    }
}

unsafe extern "C-unwind" fn toggle_full_screen(this: &AnyObject, cmd: Sel, sender: *mut AnyObject) {
    let style_mask: usize = msg_send![this, styleMask];
    if current_event_blocks_toggle(style_mask) {
        return;
    }
    match original_imp(this, cmd) {
        Some(imp) => std::mem::transmute::<Imp, SenderFn>(imp)(this, cmd, sender),
        None => {
            let _: () = msg_send![super(this, class!(NSWindow)), toggleFullScreen: sender];
        }
    }
}

unsafe fn guard_method(cls: *mut AnyClass, name: Sel, imp: Imp) -> bool {
    let current = (*cls)
        .instance_method(name)
        .map(|method| method.implementation());
    if current.is_some_and(|current| current as usize == imp as usize) {
        return false;
    }
    let previous = class_replaceMethod(cls, name, imp, c"v@:@".as_ptr());
    if let (Some(previous), Ok(mut originals)) = (previous, ORIGINALS.lock()) {
        originals.push((cls as usize, name, previous as usize));
    }
    true
}

unsafe fn install_on_class(cls: *mut AnyClass) -> usize {
    let cancel = std::mem::transmute::<SenderFn, Imp>(cancel_operation);
    let key = std::mem::transmute::<EventFn, Imp>(key_down);
    let toggle = std::mem::transmute::<SenderFn, Imp>(toggle_full_screen);
    [
        guard_method(cls, sel!(cancelOperation:), cancel),
        guard_method(cls, sel!(keyDown:), key),
        guard_method(cls, sel!(toggleFullScreen:), toggle),
    ]
    .into_iter()
    .filter(|guarded| *guarded)
    .count()
}

unsafe fn window_class(ns_window: *const AnyObject) -> *mut AnyClass {
    let mut cls = object_getClass(ns_window);
    while !cls.is_null() && is_kvo_shim(&class_name(cls)) {
        cls = class_getSuperclass(cls);
    }
    cls as *mut AnyClass
}

pub fn install(window: &tauri::WebviewWindow) {
    let Ok(ns_window) = window.ns_window() else {
        return;
    };
    unsafe {
        let cls = window_class(ns_window as *const AnyObject);
        if cls.is_null() || std::ptr::eq(cls, class!(NSWindow)) {
            log::warn!("[goodboy] full screen esc guard skipped: window class is not a subclass");
            return;
        }
        let name = class_name(cls);
        let guarded = install_on_class(cls);
        log::info!(
            "[goodboy] full screen esc guard on {name}: {guarded} of {GUARDED_METHODS} methods"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use objc2::runtime::ClassBuilder;

    unsafe extern "C-unwind" fn preexisting(_this: &AnyObject, _cmd: Sel, _sender: *mut AnyObject) {
    }

    fn implementation(cls: *mut AnyClass, name: Sel) -> Option<usize> {
        let cls_ref: &AnyClass = unsafe { &*cls };
        cls_ref
            .instance_method(name)
            .map(|method| method.implementation() as usize)
    }

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
    fn kvo_shim_classes_are_recognised() {
        assert!(is_kvo_shim("NSKVONotifying_TaoWindow"));
        assert!(!is_kvo_shim("TaoWindow"));
    }

    #[test]
    fn install_guards_every_method_of_a_window_subclass_once() {
        let builder = ClassBuilder::new(c"GoodboyEscGuardTestWindow", class!(NSWindow))
            .expect("test class name is unique");
        let cls = builder.register() as *const AnyClass as *mut AnyClass;
        unsafe {
            assert_eq!(install_on_class(cls), GUARDED_METHODS);
            assert_eq!(install_on_class(cls), 0);
        }
        for name in [
            sel!(cancelOperation:),
            sel!(keyDown:),
            sel!(toggleFullScreen:),
        ] {
            assert!(implementation(cls, name).is_some());
        }
    }

    #[test]
    fn install_overrides_methods_the_class_already_implements() {
        let builder = ClassBuilder::new(c"GoodboyEscGuardPreexistingWindow", class!(NSWindow))
            .expect("test class name is unique");
        let cls = builder.register() as *const AnyClass as *mut AnyClass;
        unsafe {
            let imp = std::mem::transmute::<SenderFn, Imp>(preexisting);
            for name in [sel!(cancelOperation:), sel!(toggleFullScreen:)] {
                assert!(objc2::ffi::class_addMethod(cls, name, imp, c"v@:@".as_ptr()).as_bool());
            }
        }
        let before_cancel = implementation(cls, sel!(cancelOperation:)).unwrap();
        let before_toggle = implementation(cls, sel!(toggleFullScreen:)).unwrap();
        assert_eq!(before_cancel, preexisting as SenderFn as usize);
        unsafe {
            assert_eq!(install_on_class(cls), GUARDED_METHODS);
        }
        let after_cancel = implementation(cls, sel!(cancelOperation:)).unwrap();
        let after_toggle = implementation(cls, sel!(toggleFullScreen:)).unwrap();
        assert_ne!(after_cancel, before_cancel);
        assert_ne!(after_toggle, before_toggle);
        assert_eq!(after_cancel, cancel_operation as SenderFn as usize);
        let originals = ORIGINALS.lock().unwrap();
        assert!(originals
            .iter()
            .any(|(c, _, imp)| *c == cls as usize && *imp == before_cancel));
        assert!(originals
            .iter()
            .any(|(c, _, imp)| *c == cls as usize && *imp == before_toggle));
    }
}
