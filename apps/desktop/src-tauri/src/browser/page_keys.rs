#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, EventTarget, Manager, Runtime};

use super::guard::LABEL_PREFIX;
use super::registry::BrowserRegistry;
use crate::util::lock_or_recover;

pub(crate) const PAGE_KEY_EVENT: &str = "browser://page-key";

pub(crate) const MAX_PAGE_KEYS: usize = 32;

const PAGE_OWNED: &[&str] = &[
    "cmd+KeyA",
    "cmd+KeyC",
    "cmd+KeyV",
    "cmd+KeyX",
    "cmd+KeyZ",
    "cmd+shift+KeyZ",
    "cmd+KeyQ",
    "cmd+KeyH",
    "cmd+KeyM",
];

const SHIFT_FLAG: usize = 1 << 17;
const CONTROL_FLAG: usize = 1 << 18;
const OPTION_FLAG: usize = 1 << 19;
const COMMAND_FLAG: usize = 1 << 20;

const KEY_CODES: &[(u16, &str)] = &[
    (0x00, "KeyA"),
    (0x01, "KeyS"),
    (0x02, "KeyD"),
    (0x03, "KeyF"),
    (0x04, "KeyH"),
    (0x05, "KeyG"),
    (0x06, "KeyZ"),
    (0x07, "KeyX"),
    (0x08, "KeyC"),
    (0x09, "KeyV"),
    (0x0B, "KeyB"),
    (0x0C, "KeyQ"),
    (0x0D, "KeyW"),
    (0x0E, "KeyE"),
    (0x0F, "KeyR"),
    (0x10, "KeyY"),
    (0x11, "KeyT"),
    (0x12, "Digit1"),
    (0x13, "Digit2"),
    (0x14, "Digit3"),
    (0x15, "Digit4"),
    (0x16, "Digit6"),
    (0x17, "Digit5"),
    (0x18, "Equal"),
    (0x19, "Digit9"),
    (0x1A, "Digit7"),
    (0x1B, "Minus"),
    (0x1C, "Digit8"),
    (0x1D, "Digit0"),
    (0x1E, "BracketRight"),
    (0x1F, "KeyO"),
    (0x20, "KeyU"),
    (0x21, "BracketLeft"),
    (0x22, "KeyI"),
    (0x23, "KeyP"),
    (0x25, "KeyL"),
    (0x26, "KeyJ"),
    (0x27, "Quote"),
    (0x28, "KeyK"),
    (0x29, "Semicolon"),
    (0x2A, "Backslash"),
    (0x2B, "Comma"),
    (0x2C, "Slash"),
    (0x2D, "KeyN"),
    (0x2E, "KeyM"),
    (0x2F, "Period"),
    (0x32, "Backquote"),
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct PageChord {
    pub(crate) combo: String,
    code: String,
    has_shift: bool,
    has_alt: bool,
    has_ctrl: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PageKey {
    pub(crate) tab_id: String,
    pub(crate) combo: String,
}

#[derive(Default)]
pub(crate) struct PageKeys {
    chords: Mutex<Vec<PageChord>>,
}

impl PageKeys {
    pub(crate) fn replace(&self, combos: &[String]) -> usize {
        let chords: Vec<PageChord> = combos
            .iter()
            .filter_map(|combo| parse_combo(combo))
            .take(MAX_PAGE_KEYS)
            .collect();
        let count = chords.len();
        *lock_or_recover(&self.chords) = chords;
        count
    }

    pub(crate) fn combo_for(&self, key_code: u16, flags: usize) -> Option<String> {
        let code = code_of_key(key_code)?;
        if flags & COMMAND_FLAG == 0 {
            return None;
        }
        lock_or_recover(&self.chords)
            .iter()
            .find(|chord| {
                chord.code == code
                    && chord.has_shift == (flags & SHIFT_FLAG != 0)
                    && chord.has_alt == (flags & OPTION_FLAG != 0)
                    && chord.has_ctrl == (flags & CONTROL_FLAG != 0)
            })
            .map(|chord| chord.combo.clone())
    }
}

pub(crate) fn code_of_key(key_code: u16) -> Option<&'static str> {
    KEY_CODES
        .iter()
        .find(|(known, _)| *known == key_code)
        .map(|(_, code)| *code)
}

pub(crate) fn parse_combo(combo: &str) -> Option<PageChord> {
    if PAGE_OWNED.contains(&combo) {
        return None;
    }
    let parts: Vec<&str> = combo.split('+').collect();
    let (code, modifiers) = parts.split_last()?;
    if !KEY_CODES.iter().any(|(_, known)| known == code) {
        return None;
    }
    if !modifiers.contains(&"cmd") {
        return None;
    }
    if modifiers
        .iter()
        .any(|part| !matches!(*part, "cmd" | "shift" | "alt" | "ctrl"))
    {
        return None;
    }
    Some(PageChord {
        combo: combo.to_string(),
        code: (*code).to_string(),
        has_shift: modifiers.contains(&"shift"),
        has_alt: modifiers.contains(&"alt"),
        has_ctrl: modifiers.contains(&"ctrl"),
    })
}

pub(crate) fn route_page_key<R: Runtime>(app: &AppHandle<R>, tab_label: &str, combo: &str) -> bool {
    let Some(tab_id) = tab_label.strip_prefix(LABEL_PREFIX) else {
        return false;
    };
    let Some(window_label) = app.state::<BrowserRegistry>().window_of(tab_id) else {
        return false;
    };
    let key = PageKey {
        tab_id: tab_id.to_string(),
        combo: combo.to_string(),
    };
    if app
        .emit_to(
            EventTarget::webview_window(&window_label),
            PAGE_KEY_EVENT,
            &key,
        )
        .is_err()
    {
        return false;
    }
    if let Some(chrome) = app.get_webview(&window_label) {
        let _ = chrome.set_focus();
    }
    true
}

#[cfg(target_os = "macos")]
pub(crate) fn start<R: Runtime>(app: AppHandle<R>) {
    crate::platform::key_monitor::install(move |key| {
        let Some(combo) = app.state::<PageKeys>().combo_for(key.key_code, key.flags) else {
            return false;
        };
        let Some(label) = key.focused_identifier(super::guard::is_browser_label) else {
            return false;
        };
        route_page_key(&app, &label, &combo)
    });
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn start<R: Runtime>(_app: AppHandle<R>) {}

#[cfg(target_os = "macos")]
pub(crate) fn mark_tab_view<R: Runtime>(webview: &tauri::Webview<R>) {
    let label = webview.label().to_string();
    if let Err(error) = webview.with_webview(move |platform| {
        crate::platform::key_monitor::mark_live_view(platform, &label)
    }) {
        log::warn!("[browser] page_keys_mark_failed reason={error}");
    }
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn mark_tab_view<R: Runtime>(_webview: &tauri::Webview<R>) {}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::util::wire_shape::assert_wire_value;

    fn keys(combos: &[&str]) -> PageKeys {
        let keys = PageKeys::default();
        keys.replace(
            &combos
                .iter()
                .map(|combo| combo.to_string())
                .collect::<Vec<_>>(),
        );
        keys
    }

    #[test]
    fn wire_shape_page_key() {
        assert_wire_value(
            &PageKey {
                tab_id: "0f1e".to_string(),
                combo: "cmd+KeyW".to_string(),
            },
            json!({ "tabId": "0f1e", "combo": "cmd+KeyW" }),
        );
    }

    #[test]
    fn maps_the_key_codes_of_the_browser_chords() {
        assert_eq!(code_of_key(0x25), Some("KeyL"));
        assert_eq!(code_of_key(0x11), Some("KeyT"));
        assert_eq!(code_of_key(0x0D), Some("KeyW"));
        assert_eq!(code_of_key(0x03), Some("KeyF"));
        assert_eq!(code_of_key(0x28), Some("KeyK"));
        assert_eq!(code_of_key(0x0F), Some("KeyR"));
        assert_eq!(code_of_key(0x02), Some("KeyD"));
        assert_eq!(code_of_key(0x21), Some("BracketLeft"));
        assert_eq!(code_of_key(0x1E), Some("BracketRight"));
        assert_eq!(code_of_key(0x7A), None);
    }

    #[test]
    fn takes_only_chords_that_hold_command() {
        assert!(parse_combo("cmd+KeyL").is_some());
        assert!(parse_combo("cmd+shift+BracketLeft").is_some());
        assert!(parse_combo("KeyL").is_none());
        assert!(parse_combo("ctrl+shift+KeyL").is_none());
        assert!(parse_combo("cmd+hyper+KeyL").is_none());
        assert!(parse_combo("cmd+F13").is_none());
        assert!(parse_combo("").is_none());
    }

    #[test]
    fn never_takes_the_editing_chords_from_the_page() {
        for combo in [
            "cmd+KeyC",
            "cmd+KeyV",
            "cmd+KeyX",
            "cmd+KeyA",
            "cmd+KeyZ",
            "cmd+shift+KeyZ",
        ] {
            assert!(parse_combo(combo).is_none(), "{combo}");
        }
    }

    #[test]
    fn matches_the_exact_modifiers_of_a_chord() {
        let keys = keys(&["cmd+KeyT", "cmd+shift+KeyT", "cmd+KeyW"]);
        assert_eq!(
            keys.combo_for(0x11, COMMAND_FLAG),
            Some("cmd+KeyT".to_string())
        );
        assert_eq!(
            keys.combo_for(0x11, COMMAND_FLAG | SHIFT_FLAG),
            Some("cmd+shift+KeyT".to_string())
        );
        assert_eq!(keys.combo_for(0x0D, COMMAND_FLAG | OPTION_FLAG), None);
        assert_eq!(keys.combo_for(0x0D, COMMAND_FLAG | CONTROL_FLAG), None);
        assert_eq!(keys.combo_for(0x0D, SHIFT_FLAG), None);
        assert_eq!(keys.combo_for(0x0D, 0), None);
    }

    #[test]
    fn ignores_the_device_bits_of_the_modifier_flags() {
        let keys = keys(&["cmd+KeyW"]);
        assert_eq!(
            keys.combo_for(0x0D, COMMAND_FLAG | 0x0000_0108),
            Some("cmd+KeyW".to_string())
        );
    }

    #[test]
    fn replaces_the_whole_list_and_skips_a_bad_combo() {
        let keys = keys(&["cmd+KeyW", "KeyQ", "cmd+KeyC"]);
        assert_eq!(
            keys.combo_for(0x0D, COMMAND_FLAG),
            Some("cmd+KeyW".to_string())
        );
        assert_eq!(keys.replace(&["cmd+KeyL".to_string()]), 1);
        assert_eq!(keys.combo_for(0x0D, COMMAND_FLAG), None);
        assert_eq!(
            keys.combo_for(0x25, COMMAND_FLAG),
            Some("cmd+KeyL".to_string())
        );
    }

    #[test]
    fn keeps_at_most_the_cap_of_chords() {
        let combos: Vec<String> = KEY_CODES
            .iter()
            .flat_map(|(_, code)| [format!("cmd+{code}"), format!("cmd+shift+{code}")])
            .collect();
        assert_eq!(PageKeys::default().replace(&combos), MAX_PAGE_KEYS);
    }

    #[test]
    fn starts_with_no_chord_so_the_page_keeps_every_key_until_the_app_says() {
        assert_eq!(PageKeys::default().combo_for(0x0D, COMMAND_FLAG), None);
    }
}
