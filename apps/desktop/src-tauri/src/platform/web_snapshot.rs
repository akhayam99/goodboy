use std::sync::mpsc::SyncSender;

use block2::RcBlock;
use objc2::encode::{Encode, Encoding};
use objc2::rc::Retained;
use objc2::runtime::{AnyObject, Bool};
use objc2::{class, msg_send};

const PNG_FILE_TYPE: usize = 4;

#[repr(C)]
#[derive(Clone, Copy)]
struct Point {
    x: f64,
    y: f64,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct Size {
    width: f64,
    height: f64,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct Rect {
    origin: Point,
    size: Size,
}

unsafe impl Encode for Point {
    const ENCODING: Encoding = Encoding::Struct("CGPoint", &[f64::ENCODING, f64::ENCODING]);
}

unsafe impl Encode for Size {
    const ENCODING: Encoding = Encoding::Struct("CGSize", &[f64::ENCODING, f64::ENCODING]);
}

unsafe impl Encode for Rect {
    const ENCODING: Encoding = Encoding::Struct("CGRect", &[Point::ENCODING, Size::ENCODING]);
}

pub(crate) struct SnapshotFrame {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
}

fn png_of(image: *mut AnyObject) -> Option<Vec<u8>> {
    if image.is_null() {
        return None;
    }
    let tiff: *mut AnyObject = unsafe { msg_send![image, TIFFRepresentation] };
    if tiff.is_null() {
        return None;
    }
    let rep: *mut AnyObject =
        unsafe { msg_send![class!(NSBitmapImageRep), imageRepWithData: tiff] };
    if rep.is_null() {
        return None;
    }
    let properties: *mut AnyObject = unsafe { msg_send![class!(NSDictionary), dictionary] };
    let png: *mut AnyObject =
        unsafe { msg_send![rep, representationUsingType: PNG_FILE_TYPE, properties: properties] };
    if png.is_null() {
        return None;
    }
    let length: usize = unsafe { msg_send![png, length] };
    let bytes: *const u8 = unsafe { msg_send![png, bytes] };
    if bytes.is_null() || length == 0 {
        return None;
    }
    Some(unsafe { std::slice::from_raw_parts(bytes, length) }.to_vec())
}

pub(crate) fn viewport_of(platform: &tauri::webview::PlatformWebview) -> (f64, f64) {
    let view = platform.inner().cast::<AnyObject>();
    if view.is_null() {
        return (0.0, 0.0);
    }
    let bounds: Rect = unsafe { msg_send![view, bounds] };
    (bounds.size.width, bounds.size.height)
}

pub(crate) fn take_png(
    platform: tauri::webview::PlatformWebview,
    frame: SnapshotFrame,
    sender: SyncSender<Option<Vec<u8>>>,
) {
    let view = platform.inner().cast::<AnyObject>();
    if view.is_null() {
        let _ = sender.send(None);
        return;
    }
    let config: Option<Retained<AnyObject>> =
        unsafe { msg_send![class!(WKSnapshotConfiguration), new] };
    let Some(config) = config else {
        let _ = sender.send(None);
        return;
    };
    let rect = Rect {
        origin: Point {
            x: frame.x,
            y: frame.y,
        },
        size: Size {
            width: frame.width,
            height: frame.height,
        },
    };
    let _: () = unsafe { msg_send![&*config, setRect: rect] };
    let _: () = unsafe { msg_send![&*config, setAfterScreenUpdates: Bool::YES] };
    let handler = RcBlock::new(move |image: *mut AnyObject, _error: *mut AnyObject| {
        let _ = sender.try_send(png_of(image));
    });
    let _: () = unsafe {
        msg_send![view, takeSnapshotWithConfiguration: &*config, completionHandler: &*handler]
    };
}
