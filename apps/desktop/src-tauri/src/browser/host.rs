use serde::{Deserialize, Serialize};
use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::{
    AppHandle, Emitter, EventTarget, LogicalPosition, LogicalSize, Manager, Position, Rect,
    Runtime, Size, Url, Webview, WebviewBuilder, WebviewUrl, Window,
};

use super::guard::{self, AppOrigins};
use super::reason::{self, NOT_WEB_ADDRESS, TAB_GONE, TOO_MANY_POPUPS, WINDOW_GONE};
use super::registry::{BrowserRegistry, NewTab, PopupSeat, SeatRefusal, TabFacts};
use crate::platform::web_history::HistoryStep;
use crate::util::{now_ms, uuid_v4, MessageError};

const MIN_SIDE: f64 = 1.0;

pub(crate) const MAX_HIDDEN_POPUPS: usize = 4;
pub(crate) const TAB_OPENED_EVENT: &str = "browser://tab-opened";

#[cfg(not(target_os = "macos"))]
const BACK_SCRIPT: &str = "history.back()";
#[cfg(not(target_os = "macos"))]
const FORWARD_SCRIPT: &str = "history.forward()";

#[derive(Clone, Copy, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabBounds {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
}

impl TabBounds {
    fn position(&self) -> Position {
        LogicalPosition::new(self.x, self.y).into()
    }

    fn size(&self) -> Size {
        LogicalSize::new(self.width.max(MIN_SIDE), self.height.max(MIN_SIDE)).into()
    }

    pub(crate) fn rect(&self) -> Rect {
        Rect {
            position: self.position(),
            size: self.size(),
        }
    }
}

pub(crate) struct OpenTab<'a> {
    pub(crate) session_id: &'a str,
    pub(crate) url: Url,
    pub(crate) position: Position,
    pub(crate) size: Size,
    pub(crate) is_shown: bool,
    pub(crate) opener_id: Option<&'a str>,
}

impl<'a> OpenTab<'a> {
    pub(crate) fn at(session_id: &'a str, url: Url, bounds: TabBounds, is_shown: bool) -> Self {
        Self {
            session_id,
            url,
            position: bounds.position(),
            size: bounds.size(),
            is_shown,
            opener_id: None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabCloseFailure {
    pub(crate) tab_id: String,
    pub(crate) reason: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionClosed {
    pub(crate) closed: usize,
    pub(crate) failed: Vec<TabCloseFailure>,
}

fn failed(error: tauri::Error) -> MessageError {
    MessageError::Failed(error.to_string())
}

pub(crate) fn open_tab<R: Runtime>(
    window: &Window<R>,
    tab: OpenTab<'_>,
) -> Result<TabFacts, MessageError> {
    let app = window.app_handle().clone();
    let origins = AppOrigins::of_app(&app);
    if !guard::may_open(&tab.url, &origins) {
        return Err(reason::refused(NOT_WEB_ADDRESS));
    }
    let id = uuid_v4();
    let builder = builder_for(&app, &id, &tab.url, origins);
    let webview = window
        .add_child(builder, tab.position, tab.size)
        .map_err(failed)?;
    if !tab.is_shown {
        if let Err(error) = webview.hide() {
            let _ = webview.close();
            return Err(failed(error));
        }
    }
    Ok(app.state::<BrowserRegistry>().insert(NewTab {
        id: &id,
        session_id: tab.session_id,
        window_label: window.label(),
        url: tab.url.as_str(),
        is_shown: tab.is_shown,
        opener_id: tab.opener_id,
        now_ms: now_ms(),
    }))
}

fn builder_for<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    url: &Url,
    origins: AppOrigins,
) -> WebviewBuilder<R> {
    let navigation_origins = origins.clone();
    let popup_app = app.clone();
    let popup_opener = id.to_string();
    let load_tab = id.to_string();
    let title_tab = id.to_string();
    WebviewBuilder::new(guard::label_of(id), WebviewUrl::External(url.clone()))
        .on_navigation(move |target| guard::may_navigate(target, &navigation_origins))
        .on_new_window(move |target, _features| {
            if let Some(target) = guard::popup_target(&target, &origins) {
                open_popup(&popup_app, &popup_opener, target);
            }
            NewWindowResponse::Deny
        })
        .on_download(|_webview, _event| false)
        .on_page_load(move |webview, payload| {
            if payload.event() != PageLoadEvent::Finished {
                return;
            }
            let registry = webview.app_handle().state::<BrowserRegistry>();
            registry.set_url(&load_tab, payload.url().as_str());
        })
        .on_document_title_changed(move |webview, title| {
            let registry = webview.app_handle().state::<BrowserRegistry>();
            registry.set_title(&title_tab, &title);
        })
}

fn open_popup<R: Runtime>(app: &AppHandle<R>, opener_id: &str, url: Url) {
    let seat = match reserve_popup(app, opener_id) {
        Ok(seat) => seat,
        Err(error) => {
            log::warn!("[browser] popup_refused reason={error}");
            return;
        }
    };
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = fill_popup(&app, &seat, url) {
            log::warn!("[browser] popup_open_failed reason={error}");
        }
    });
}

pub(crate) fn reserve_popup<R: Runtime>(
    app: &AppHandle<R>,
    opener_id: &str,
) -> Result<PopupSeat, MessageError> {
    app.state::<BrowserRegistry>()
        .reserve_popup(opener_id, MAX_HIDDEN_POPUPS)
        .map_err(|refusal| match refusal {
            SeatRefusal::OpenerGone => reason::failed(TAB_GONE),
            SeatRefusal::Full => reason::refused(TOO_MANY_POPUPS),
        })
}

pub(crate) fn fill_popup<R: Runtime>(
    app: &AppHandle<R>,
    seat: &PopupSeat,
    url: Url,
) -> Result<TabFacts, MessageError> {
    let opened = open_beside(app, seat, url);
    app.state::<BrowserRegistry>().release_popup(seat);
    let facts = opened?;
    let _ = app.emit_to(
        EventTarget::webview_window(&seat.window_label),
        TAB_OPENED_EVENT,
        &facts,
    );
    Ok(facts)
}

fn open_beside<R: Runtime>(
    app: &AppHandle<R>,
    seat: &PopupSeat,
    url: Url,
) -> Result<TabFacts, MessageError> {
    let window = app
        .get_window(&seat.window_label)
        .ok_or_else(|| reason::failed(WINDOW_GONE))?;
    let bounds = webview_of(app, &seat.opener_id)?.bounds().map_err(failed)?;
    open_tab(
        &window,
        OpenTab {
            session_id: &seat.session_id,
            url,
            position: bounds.position,
            size: bounds.size,
            is_shown: false,
            opener_id: Some(&seat.opener_id),
        },
    )
}

pub(crate) fn webview_of<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: &str,
) -> Result<Webview<R>, MessageError> {
    app.get_webview(&guard::label_of(tab_id))
        .ok_or_else(|| reason::failed(TAB_GONE))
}

#[cfg(target_os = "macos")]
pub(crate) fn step_history<R: Runtime>(
    webview: &Webview<R>,
    step: HistoryStep,
) -> Result<(), MessageError> {
    webview
        .with_webview(move |platform| {
            crate::platform::web_history::step_live_wk_web_view(platform, step)
        })
        .map_err(failed)
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn step_history<R: Runtime>(
    webview: &Webview<R>,
    step: HistoryStep,
) -> Result<(), MessageError> {
    let script = match step {
        HistoryStep::Back => BACK_SCRIPT,
        HistoryStep::Forward => FORWARD_SCRIPT,
    };
    webview.eval(script).map_err(failed)
}

pub(crate) fn close_tab<R: Runtime>(app: &AppHandle<R>, tab_id: &str) -> Result<(), MessageError> {
    if let Some(webview) = app.get_webview(&guard::label_of(tab_id)) {
        webview.close().map_err(failed)?;
    }
    app.state::<BrowserRegistry>().remove(tab_id);
    Ok(())
}

pub(crate) fn close_each(
    ids: &[String],
    mut close: impl FnMut(&str) -> Result<(), MessageError>,
) -> SessionClosed {
    let mut result = SessionClosed::default();
    for id in ids {
        match close(id) {
            Ok(()) => result.closed += 1,
            Err(error) => result.failed.push(TabCloseFailure {
                tab_id: id.clone(),
                reason: error.to_string(),
            }),
        }
    }
    result
}

pub(crate) fn close_session<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &str,
    window_label: &str,
) -> SessionClosed {
    let ids = app
        .state::<BrowserRegistry>()
        .ids_of_session(session_id, window_label);
    close_each(&ids, |id| close_tab(app, id))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::util::wire_shape::assert_wire_value;

    #[test]
    fn wire_shape_session_closed() {
        assert_wire_value(
            &SessionClosed {
                closed: 2,
                failed: vec![TabCloseFailure {
                    tab_id: "0f1e".to_string(),
                    reason: "tab-gone".to_string(),
                }],
            },
            json!({
                "closed": 2,
                "failed": [{ "tabId": "0f1e", "reason": "tab-gone" }],
            }),
        );
    }
}
