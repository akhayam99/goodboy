use std::ffi::CStr;
use std::sync::OnceLock;

use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject, ClassBuilder, Sel};
use objc2::{class, msg_send, sel};

const HANDLER_NAME: &CStr = c"goodboyPasskey";
const HANDLER_CLASS: &CStr = c"GoodboyPasskeyHandler";

type ReceiveFn = unsafe extern "C-unwind" fn(*mut AnyObject, Sel, *mut AnyObject, *mut AnyObject);

static ON_MESSAGE: OnceLock<fn(usize)> = OnceLock::new();

unsafe extern "C-unwind" fn did_receive(
    this: *mut AnyObject,
    _cmd: Sel,
    _controller: *mut AnyObject,
    _message: *mut AnyObject,
) {
    if let Some(on_message) = ON_MESSAGE.get() {
        on_message(this as usize);
    }
}

fn handler_class() -> Option<&'static AnyClass> {
    static CLASS: OnceLock<Option<&'static AnyClass>> = OnceLock::new();
    *CLASS.get_or_init(|| {
        let Some(mut builder) = ClassBuilder::new(HANDLER_CLASS, class!(NSObject)) else {
            return AnyClass::get(HANDLER_CLASS);
        };
        let receive: ReceiveFn = did_receive;
        unsafe {
            builder.add_method(
                sel!(userContentController:didReceiveScriptMessage:),
                receive,
            );
        }
        Some(builder.register())
    })
}

pub(crate) fn add_to_live_wk_web_view(
    platform: tauri::webview::PlatformWebview,
    on_message: fn(usize),
) -> Option<usize> {
    let _ = ON_MESSAGE.set(on_message);
    let Some(handler_class) = handler_class() else {
        log::warn!("[browser] passkey_watch_skipped reason=no-handler-class");
        return None;
    };
    unsafe {
        let view = platform.inner().cast::<AnyObject>();
        let configuration: *mut AnyObject = msg_send![view, configuration];
        let controller: *mut AnyObject = msg_send![configuration, userContentController];
        if controller.is_null() {
            log::warn!("[browser] passkey_watch_skipped reason=no-content-controller");
            return None;
        }
        let name: *mut AnyObject = msg_send![
            class!(NSString),
            stringWithUTF8String: HANDLER_NAME.as_ptr()
        ];
        let handler: Retained<AnyObject> = msg_send![handler_class, new];
        let _: () = msg_send![controller, removeScriptMessageHandlerForName: name];
        let _: () = msg_send![controller, addScriptMessageHandler: &*handler, name: name];
        Some(Retained::as_ptr(&handler) as usize)
    }
}
