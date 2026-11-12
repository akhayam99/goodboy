use serde::Serialize;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Emitter, EventTarget, Manager, Runtime};

use super::registry::BrowserRegistry;
use super::visit_rows;

pub(crate) const TAB_LOAD_EVENT: &str = "browser://tab-load";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum LoadPhase {
    Started,
    Finished,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabLoad {
    pub(crate) tab_id: String,
    pub(crate) phase: LoadPhase,
    pub(crate) url: String,
}

pub(crate) fn phase_of(event: PageLoadEvent) -> LoadPhase {
    match event {
        PageLoadEvent::Started => LoadPhase::Started,
        PageLoadEvent::Finished => LoadPhase::Finished,
    }
}

pub(crate) fn report_load<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: &str,
    phase: LoadPhase,
    url: &str,
) {
    let registry = app.state::<BrowserRegistry>();
    if phase == LoadPhase::Started {
        registry.set_passkey_blocked(tab_id, false);
    }
    if phase == LoadPhase::Finished {
        if let Some(facts) = registry.set_url(tab_id, url) {
            visit_rows::save_visit(app, &facts.session_id, url, &facts.title);
        }
    }
    let Some(window_label) = registry.window_of(tab_id) else {
        return;
    };
    let _ = app.emit_to(
        EventTarget::webview_window(&window_label),
        TAB_LOAD_EVENT,
        &TabLoad {
            tab_id: tab_id.to_string(),
            phase,
            url: url.to_string(),
        },
    );
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::util::wire_shape::assert_wire_value;

    #[test]
    fn wire_shape_tab_load() {
        assert_wire_value(
            &TabLoad {
                tab_id: "0f1e".to_string(),
                phase: LoadPhase::Started,
                url: "http://localhost:5173/checkout".to_string(),
            },
            json!({
                "tabId": "0f1e",
                "phase": "started",
                "url": "http://localhost:5173/checkout",
            }),
        );
    }

    #[test]
    fn maps_each_page_load_event_to_a_phase() {
        assert_eq!(phase_of(PageLoadEvent::Started), LoadPhase::Started);
        assert_eq!(phase_of(PageLoadEvent::Finished), LoadPhase::Finished);
    }
}
