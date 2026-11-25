#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

use std::time::Duration;

use base64::Engine;
use tauri::{Runtime, Webview};

use super::pick::PickRect;
use super::reason::{self, SNAPSHOT_UNAVAILABLE};
use crate::util::MessageError;

pub(crate) const MAX_SNAPSHOT_BYTES: usize = 5 * 1024 * 1024;
const SNAPSHOT_WAIT: Duration = Duration::from_secs(3);

pub(crate) fn clamped_rect(rect: PickRect, viewport: (f64, f64)) -> Option<PickRect> {
    if !rect.is_drawable() {
        return None;
    }
    let (width, height) = viewport;
    let left = rect.x.max(0.0);
    let top = rect.y.max(0.0);
    let right = (rect.x + rect.width).min(width);
    let bottom = (rect.y + rect.height).min(height);
    if right - left < 1.0 || bottom - top < 1.0 {
        return None;
    }
    Some(PickRect {
        x: left.floor(),
        y: top.floor(),
        width: (right - left).ceil(),
        height: (bottom - top).ceil(),
    })
}

pub(crate) fn png_text_of(bytes: Option<Vec<u8>>) -> Option<String> {
    let bytes = bytes?;
    if bytes.is_empty() || bytes.len() > MAX_SNAPSHOT_BYTES {
        return None;
    }
    Some(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[cfg(target_os = "macos")]
mod native {
    use std::sync::mpsc::SyncSender;

    use block2::RcBlock;
    use objc2::encode::{Encode, Encoding};
    use objc2::rc::Retained;
    use objc2::runtime::{AnyObject, Bool};
    use objc2::{class, msg_send};

    use super::super::pick::PickRect;

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
        let png: *mut AnyObject = unsafe {
            msg_send![rep, representationUsingType: PNG_FILE_TYPE, properties: properties]
        };
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

    pub(super) fn viewport_of(platform: &tauri::webview::PlatformWebview) -> (f64, f64) {
        let view = platform.inner().cast::<AnyObject>();
        if view.is_null() {
            return (0.0, 0.0);
        }
        let bounds: Rect = unsafe { msg_send![view, bounds] };
        (bounds.size.width, bounds.size.height)
    }

    pub(super) fn take(
        platform: tauri::webview::PlatformWebview,
        rect: PickRect,
        sender: SyncSender<Option<Vec<u8>>>,
    ) {
        let view = platform.inner().cast::<AnyObject>();
        if view.is_null() {
            let _ = sender.send(None);
            return;
        }
        let Some(rect) = super::clamped_rect(rect, viewport_of(&platform)) else {
            let _ = sender.send(None);
            return;
        };
        let config: Option<Retained<AnyObject>> =
            unsafe { msg_send![class!(WKSnapshotConfiguration), new] };
        let Some(config) = config else {
            let _ = sender.send(None);
            return;
        };
        let frame = Rect {
            origin: Point {
                x: rect.x,
                y: rect.y,
            },
            size: Size {
                width: rect.width,
                height: rect.height,
            },
        };
        let _: () = unsafe { msg_send![&*config, setRect: frame] };
        let _: () = unsafe { msg_send![&*config, setAfterScreenUpdates: Bool::YES] };
        let handler = RcBlock::new(move |image: *mut AnyObject, _error: *mut AnyObject| {
            let _ = sender.try_send(png_of(image));
        });
        let _: () = unsafe {
            msg_send![view, takeSnapshotWithConfiguration: &*config, completionHandler: &*handler]
        };
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn snapshot_element<R: Runtime>(
    webview: &Webview<R>,
    rect: PickRect,
) -> Result<Option<String>, MessageError> {
    if std::any::TypeId::of::<R>() != std::any::TypeId::of::<tauri::Wry>() {
        return Ok(None);
    }
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    webview
        .with_webview(move |platform| native::take(platform, rect, sender))
        .map_err(|_| reason::failed(SNAPSHOT_UNAVAILABLE))?;
    Ok(png_text_of(
        receiver.recv_timeout(SNAPSHOT_WAIT).ok().flatten(),
    ))
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn snapshot_element<R: Runtime>(
    _webview: &Webview<R>,
    _rect: PickRect,
) -> Result<Option<String>, MessageError> {
    let _ = (SNAPSHOT_WAIT, SNAPSHOT_UNAVAILABLE);
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rect(x: f64, y: f64, width: f64, height: f64) -> PickRect {
        PickRect {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn keeps_a_rect_inside_the_view_on_whole_points() {
        assert_eq!(
            clamped_rect(rect(8.0, 99.5, 101.0, 34.0), (800.0, 600.0)),
            Some(rect(8.0, 99.0, 101.0, 34.0))
        );
    }

    #[test]
    fn cuts_a_rect_to_the_part_on_screen() {
        assert_eq!(
            clamped_rect(rect(-20.0, 580.0, 100.0, 100.0), (800.0, 600.0)),
            Some(rect(0.0, 580.0, 80.0, 20.0))
        );
    }

    #[test]
    fn refuses_a_rect_off_screen_or_empty() {
        assert_eq!(
            clamped_rect(rect(900.0, 10.0, 50.0, 50.0), (800.0, 600.0)),
            None
        );
        assert_eq!(
            clamped_rect(rect(10.0, 10.0, 0.0, 50.0), (800.0, 600.0)),
            None
        );
        assert_eq!(
            clamped_rect(rect(f64::NAN, 10.0, 5.0, 5.0), (800.0, 600.0)),
            None
        );
    }

    #[test]
    fn drops_an_empty_or_oversized_image() {
        assert_eq!(png_text_of(None), None);
        assert_eq!(png_text_of(Some(Vec::new())), None);
        assert_eq!(png_text_of(Some(vec![0; MAX_SNAPSHOT_BYTES + 1])), None);
        assert_eq!(
            png_text_of(Some(vec![137, 80, 78, 71])),
            Some("iVBORw==".to_string())
        );
    }
}
