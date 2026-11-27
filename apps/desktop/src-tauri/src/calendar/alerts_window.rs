use tauri::{AppHandle, LogicalSize, Manager, Monitor, WebviewUrl, WebviewWindowBuilder};

use super::error::CalendarError;

pub(crate) const CHIP_LABEL: &str = "call-chip";
pub(crate) const CHIP_WIDTH: f64 = 384.0;
const CHIP_TOP_INSET: f64 = 44.0;
const MIN_HEIGHT: f64 = 48.0;
const MAX_HEIGHT: f64 = 480.0;

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct Screen {
    pub x: f64,
    pub y: f64,
    pub width: f64,
}

pub(crate) fn chip_origin(screen: Screen) -> (f64, f64) {
    let left = screen.x + ((screen.width - CHIP_WIDTH) / 2.0).max(0.0);
    (left.round(), (screen.y + CHIP_TOP_INSET).round())
}

pub(crate) fn chip_height(height: f64) -> f64 {
    if !height.is_finite() {
        return MIN_HEIGHT;
    }
    height.clamp(MIN_HEIGHT, MAX_HEIGHT).round()
}

fn screen_of(monitor: &Monitor) -> Screen {
    let scale = match monitor.scale_factor() {
        factor if factor > 0.0 => factor,
        _ => 1.0,
    };
    Screen {
        x: f64::from(monitor.position().x) / scale,
        y: f64::from(monitor.position().y) / scale,
        width: f64::from(monitor.size().width) / scale,
    }
}

fn active_screen(app: &AppHandle) -> Option<Screen> {
    let under_pointer = app
        .cursor_position()
        .ok()
        .and_then(|point| app.monitor_from_point(point.x, point.y).ok().flatten());
    under_pointer
        .or_else(|| app.primary_monitor().ok().flatten())
        .map(|monitor| screen_of(&monitor))
}

fn failed(error: tauri::Error) -> CalendarError {
    CalendarError::Failed(error.to_string())
}

pub(crate) fn show_chip(app: &AppHandle, height: f64) -> Result<bool, CalendarError> {
    if app.get_window(CHIP_LABEL).is_some() {
        return Ok(false);
    }
    let (x, y) = active_screen(app)
        .map(chip_origin)
        .unwrap_or((0.0, CHIP_TOP_INSET));
    WebviewWindowBuilder::new(app, CHIP_LABEL, WebviewUrl::App("index.html".into()))
        .title("Goodboy call")
        .inner_size(CHIP_WIDTH, chip_height(height))
        .position(x, y)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .shadow(true)
        .focused(false)
        .accept_first_mouse(true)
        .visible(false)
        .build()
        .map_err(failed)?;
    Ok(true)
}

pub(crate) fn resize_chip(app: &AppHandle, height: f64) -> Result<(), CalendarError> {
    let Some(window) = app.get_window(CHIP_LABEL) else {
        return Ok(());
    };
    window
        .set_size(LogicalSize::new(CHIP_WIDTH, chip_height(height)))
        .map_err(failed)?;
    window.show().map_err(failed)
}

pub(crate) fn hide_chip(app: &AppHandle) -> Result<(), CalendarError> {
    let Some(window) = app.get_window(CHIP_LABEL) else {
        return Ok(());
    };
    window.destroy().map_err(failed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_chip_sits_top_center_of_the_screen() {
        let origin = chip_origin(Screen {
            x: 0.0,
            y: 0.0,
            width: 1440.0,
        });
        assert_eq!(origin, (528.0, 44.0));
    }

    #[test]
    fn the_chip_follows_a_screen_to_the_left_of_the_main_one() {
        let origin = chip_origin(Screen {
            x: -1920.0,
            y: -120.0,
            width: 1920.0,
        });
        assert_eq!(origin, (-1152.0, -76.0));
    }

    #[test]
    fn the_chip_stays_on_a_screen_narrower_than_itself() {
        let origin = chip_origin(Screen {
            x: 100.0,
            y: 0.0,
            width: 300.0,
        });
        assert_eq!(origin.0, 100.0);
    }

    #[test]
    fn the_height_stays_between_one_row_and_a_short_list() {
        assert_eq!(chip_height(20.0), 48.0);
        assert_eq!(chip_height(132.4), 132.0);
        assert_eq!(chip_height(2_000.0), 480.0);
        assert_eq!(chip_height(f64::NAN), 48.0);
    }
}
