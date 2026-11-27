use serde::Serialize;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Emitter, EventTarget, Manager, Runtime};

use super::guard;
use super::registry::BrowserRegistry;
use super::site_data;
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

pub(crate) fn trail_host_of(url: &str) -> Option<String> {
    let parsed = guard::parse_address(url)?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return None;
    }
    Some(site_data::host_key(&guard::host_of(&parsed))).filter(|host| !host.is_empty())
}

pub(crate) fn remember_load(registry: &BrowserRegistry, tab_id: &str, url: &str) {
    if let Some(host) = trail_host_of(url) {
        registry.remember_host(tab_id, &host);
    }
}

pub(crate) fn report_load<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: &str,
    phase: LoadPhase,
    url: &str,
) {
    let registry = app.state::<BrowserRegistry>();
    remember_load(&registry, tab_id, url);
    if phase == LoadPhase::Started {
        registry.mark_navigated(tab_id);
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
    fn keeps_the_host_of_a_web_page_only() {
        assert_eq!(
            trail_host_of("http://localhost:5005/login").as_deref(),
            Some("localhost")
        );
        assert_eq!(
            trail_host_of("https://Login.Cascadia-ID.com./authorize").as_deref(),
            Some("login.cascadia-id.com")
        );
        assert_eq!(trail_host_of("http://[::1]:8080/").as_deref(), Some("::1"));
        for address in [
            "about:blank",
            "file:///work/harborline/plan.html",
            "",
            "nope",
        ] {
            assert_eq!(trail_host_of(address), None, "{address}");
        }
    }

    #[test]
    fn every_page_load_phase_feeds_the_tab_trail() {
        let source = include_str!("load.rs");
        let start = source
            .find("pub(crate) fn report_load")
            .expect("report_load");
        let body = &source[start..start + source[start..].find("\n}\n").expect("end")];
        let remembered = body
            .find("remember_load(&registry, tab_id, url)")
            .expect("records every phase");
        let started = body
            .find("if phase == LoadPhase::Started")
            .expect("started");
        assert!(remembered < started, "{body}");
        let host = include_str!("host.rs");
        let navigation = host.find(".on_navigation(").expect("on_navigation");
        let next = host[navigation..]
            .find(".on_new_window(")
            .expect("next hook");
        assert!(
            !host[navigation..navigation + next].contains("remember"),
            "iframe navigations never reach the trail"
        );
    }

    #[test]
    fn maps_each_page_load_event_to_a_phase() {
        assert_eq!(phase_of(PageLoadEvent::Started), LoadPhase::Started);
        assert_eq!(phase_of(PageLoadEvent::Finished), LoadPhase::Finished);
    }
}
