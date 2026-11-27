use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

use super::alerts::ArmedCall;
use super::alerts_runner::CallAlerts;
use super::alerts_window::{hide_chip, resize_chip, show_chip, CHIP_LABEL};
use super::error::CalendarError;

pub(crate) const CHIP_VIEW_EVENT: &str = "calendar-chip-view";
pub(crate) const CHIP_ACTION_EVENT: &str = "calendar-chip-action";
const MAIN_WINDOW: &str = "main";
const MAX_VIEW_BYTES: usize = 64 * 1024;

#[derive(Default)]
pub(crate) struct ChipView(Mutex<Option<Value>>);

impl ChipView {
    fn set(&self, view: Option<Value>) {
        *self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = view;
    }

    fn get(&self) -> Option<Value> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub(crate) enum ChipAction {
    Join,
    Snooze,
    Hide,
    Return,
    Open {
        #[serde(rename = "rowKey")]
        row_key: String,
    },
}

pub(crate) fn checked_view(view: Value) -> Result<Value, CalendarError> {
    if !view.is_object() {
        return Err(CalendarError::Refused(
            "the call chip view is not an object".to_string(),
        ));
    }
    if view.to_string().len() > MAX_VIEW_BYTES {
        return Err(CalendarError::Refused(
            "the call chip view is too large".to_string(),
        ));
    }
    Ok(view)
}

fn failed(error: tauri::Error) -> CalendarError {
    CalendarError::Failed(error.to_string())
}

#[tauri::command]
pub async fn calendar_alerts_arm(
    alerts: State<'_, CallAlerts>,
    calls: Vec<ArmedCall>,
) -> Result<usize, CalendarError> {
    Ok(alerts.arm(calls))
}

#[tauri::command]
pub async fn calendar_alerts_snooze(
    alerts: State<'_, CallAlerts>,
    event_id: String,
    at: i64,
) -> Result<bool, CalendarError> {
    Ok(alerts.snooze(&event_id, at))
}

#[tauri::command]
pub async fn calendar_chip_show(
    app: AppHandle,
    chip: State<'_, ChipView>,
    view: Value,
    height: f64,
) -> Result<(), CalendarError> {
    let view = checked_view(view)?;
    chip.set(Some(view.clone()));
    if show_chip(&app, height)? {
        return Ok(());
    }
    app.emit_to(CHIP_LABEL, CHIP_VIEW_EVENT, view)
        .map_err(failed)
}

#[tauri::command]
pub async fn calendar_chip_hide(
    app: AppHandle,
    chip: State<'_, ChipView>,
) -> Result<(), CalendarError> {
    chip.set(None);
    hide_chip(&app)
}

#[tauri::command]
pub async fn calendar_chip_view(chip: State<'_, ChipView>) -> Result<Option<Value>, CalendarError> {
    Ok(chip.get())
}

#[tauri::command]
pub async fn calendar_chip_resize(app: AppHandle, height: f64) -> Result<(), CalendarError> {
    resize_chip(&app, height)
}

#[tauri::command]
pub async fn calendar_chip_act(app: AppHandle, action: ChipAction) -> Result<(), CalendarError> {
    app.emit_to(MAIN_WINDOW, CHIP_ACTION_EVENT, action)
        .map_err(failed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_chip_action_reads_its_kind() {
        for (wire, action) in [
            (json!({ "kind": "join" }), ChipAction::Join),
            (json!({ "kind": "snooze" }), ChipAction::Snooze),
            (json!({ "kind": "hide" }), ChipAction::Hide),
            (json!({ "kind": "return" }), ChipAction::Return),
            (
                json!({ "kind": "open", "rowKey": "session-1" }),
                ChipAction::Open {
                    row_key: "session-1".to_string(),
                },
            ),
        ] {
            assert_eq!(
                serde_json::from_value::<ChipAction>(wire.clone()).unwrap(),
                action
            );
            assert_eq!(serde_json::to_value(&action).unwrap(), wire);
        }
    }

    #[test]
    fn a_chip_action_refuses_an_unknown_kind() {
        assert!(serde_json::from_value::<ChipAction>(json!({ "kind": "merge" })).is_err());
        assert!(serde_json::from_value::<ChipAction>(json!({ "kind": "open" })).is_err());
    }

    #[test]
    fn a_view_is_an_object_of_bounded_size() {
        assert!(checked_view(json!({ "kind": "soon" })).is_ok());
        assert!(matches!(
            checked_view(json!("soon")),
            Err(CalendarError::Refused(_))
        ));
        let large = json!({ "title": "a".repeat(MAX_VIEW_BYTES) });
        assert!(matches!(
            checked_view(large),
            Err(CalendarError::Refused(_))
        ));
    }

    #[test]
    fn the_chip_view_keeps_only_the_latest() {
        let chip = ChipView::default();
        assert_eq!(chip.get(), None);
        chip.set(Some(json!({ "kind": "soon" })));
        chip.set(Some(json!({ "kind": "in-call" })));
        assert_eq!(chip.get(), Some(json!({ "kind": "in-call" })));
        chip.set(None);
        assert_eq!(chip.get(), None);
    }
}
