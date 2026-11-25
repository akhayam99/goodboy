#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

use std::time::Duration;

use base64::Engine;
use tauri::{Runtime, Webview};

use super::pick::PickRect;
use super::reason::SNAPSHOT_UNAVAILABLE;
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
fn take(
    platform: tauri::webview::PlatformWebview,
    rect: PickRect,
    sender: std::sync::mpsc::SyncSender<Option<Vec<u8>>>,
) {
    use crate::platform::web_snapshot::{take_png, viewport_of, SnapshotFrame};
    let Some(rect) = clamped_rect(rect, viewport_of(&platform)) else {
        let _ = sender.send(None);
        return;
    };
    let frame = SnapshotFrame {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
    };
    take_png(platform, frame, sender);
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
        .with_webview(move |platform| take(platform, rect, sender))
        .map_err(|_| super::reason::failed(SNAPSHOT_UNAVAILABLE))?;
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
