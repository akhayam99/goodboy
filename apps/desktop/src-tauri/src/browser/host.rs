use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde::Deserialize;
use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::{
    AppHandle, LogicalPosition, LogicalSize, Manager, Position, Rect, Runtime, Size, Url, Webview,
    WebviewBuilder, WebviewUrl, Window,
};

use super::guard::{self, AppOrigins};
use super::registry::{BrowserRegistry, NewTab, TabFacts};
use crate::util::{now_ms, uuid_v4, MessageError};

const MIN_SIDE: f64 = 1.0;

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
}

impl<'a> OpenTab<'a> {
    pub(crate) fn at(session_id: &'a str, url: Url, bounds: TabBounds, is_shown: bool) -> Self {
        Self {
            session_id,
            url,
            position: bounds.position(),
            size: bounds.size(),
            is_shown,
        }
    }
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
        return Err(MessageError::Refused(
            "the browser opens only http and https addresses".to_string(),
        ));
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
        now_ms: now_ms(),
    }))
}

fn builder_for<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    url: &Url,
    origins: AppOrigins,
) -> WebviewBuilder<R> {
    let is_initial = Arc::new(AtomicBool::new(true));
    let navigation_origins = origins.clone();
    let popup_app = app.clone();
    let popup_opener = id.to_string();
    let load_tab = id.to_string();
    let title_tab = id.to_string();
    WebviewBuilder::new(guard::label_of(id), WebviewUrl::External(url.clone()))
        .on_navigation(move |target| {
            let was_initial = is_initial.swap(false, Ordering::SeqCst);
            guard::may_navigate(target, &navigation_origins, was_initial)
        })
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
    let app = app.clone();
    let opener_id = opener_id.to_string();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = open_beside(&app, &opener_id, url) {
            log::warn!("[browser] a popup could not open as a tab: {error}");
        }
    });
}

fn open_beside<R: Runtime>(
    app: &AppHandle<R>,
    opener_id: &str,
    url: Url,
) -> Result<TabFacts, MessageError> {
    let registry = app.state::<BrowserRegistry>();
    let opener = registry
        .facts(opener_id)
        .ok_or_else(|| MessageError::Failed("the opening tab is gone".to_string()))?;
    let window_label = registry
        .window_of(opener_id)
        .ok_or_else(|| MessageError::Failed("the opening tab is gone".to_string()))?;
    let window = app
        .get_window(&window_label)
        .ok_or_else(|| MessageError::Failed("the opening window is gone".to_string()))?;
    let bounds = webview_of(app, opener_id)?.bounds().map_err(failed)?;
    open_tab(
        &window,
        OpenTab {
            session_id: &opener.session_id,
            url,
            position: bounds.position,
            size: bounds.size,
            is_shown: false,
        },
    )
}

pub(crate) fn webview_of<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: &str,
) -> Result<Webview<R>, MessageError> {
    app.get_webview(&guard::label_of(tab_id))
        .ok_or_else(|| MessageError::Failed("the tab is gone".to_string()))
}

pub(crate) fn close_tab<R: Runtime>(app: &AppHandle<R>, tab_id: &str) -> Result<(), MessageError> {
    if let Some(webview) = app.get_webview(&guard::label_of(tab_id)) {
        webview.close().map_err(failed)?;
    }
    app.state::<BrowserRegistry>().remove(tab_id);
    Ok(())
}

pub(crate) fn close_session<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &str,
) -> Result<usize, MessageError> {
    let ids = app.state::<BrowserRegistry>().ids_of_session(session_id);
    for id in &ids {
        close_tab(app, id)?;
    }
    Ok(ids.len())
}
