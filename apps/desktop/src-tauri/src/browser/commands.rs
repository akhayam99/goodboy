use serde::Deserialize;
use tauri::{Manager, Runtime, Webview};

use super::guard::{self, AppOrigins};
use super::host::{self, OpenTab, SessionClosed, TabBounds};
use super::reason::{
    self, BROWSER_CALLER, INVALID_ADDRESS, NOT_WEB_ADDRESS, OTHER_WINDOW, TAB_GONE,
};
use super::registry::{BrowserRegistry, TabFacts};
use crate::platform::web_history::HistoryStep;
use crate::util::{now_ms, MessageError};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabOpenArgs {
    session_id: String,
    url: String,
    bounds: TabBounds,
    is_shown: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabPlaceArgs {
    tab_id: String,
    bounds: TabBounds,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabMoveArgs {
    tab_id: String,
    window_label: String,
    bounds: TabBounds,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabNavigateArgs {
    tab_id: String,
    url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabArgs {
    tab_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionArgs {
    session_id: String,
}

fn refuse_browser_caller<R: Runtime>(caller: &Webview<R>) -> Result<(), MessageError> {
    if guard::is_browser_label(caller.label()) {
        return Err(reason::refused(BROWSER_CALLER));
    }
    Ok(())
}

pub(super) fn owned_tab<R: Runtime>(
    caller: &Webview<R>,
    tab_id: &str,
) -> Result<Webview<R>, MessageError> {
    refuse_browser_caller(caller)?;
    let app = caller.app_handle();
    let owner = app
        .state::<BrowserRegistry>()
        .window_of(tab_id)
        .ok_or_else(|| reason::failed(TAB_GONE))?;
    if owner != caller.window().label() {
        return Err(reason::refused(OTHER_WINDOW));
    }
    host::webview_of(app, tab_id)
}

fn web_address<R: Runtime>(caller: &Webview<R>, address: &str) -> Result<tauri::Url, MessageError> {
    let origins = AppOrigins::of_app(caller.app_handle());
    guard::parse_address(address)
        .filter(|url| guard::is_web_address(url, &origins))
        .ok_or_else(|| reason::refused(NOT_WEB_ADDRESS))
}

fn failed(error: tauri::Error) -> MessageError {
    MessageError::Failed(error.to_string())
}

#[tauri::command]
pub async fn browser_tab_open(
    webview: Webview,
    args: TabOpenArgs,
) -> Result<TabFacts, MessageError> {
    refuse_browser_caller(&webview)?;
    let url = guard::parse_address(&args.url).ok_or_else(|| reason::refused(INVALID_ADDRESS))?;
    host::open_tab(
        &webview.window(),
        OpenTab::at(&args.session_id, url, args.bounds, args.is_shown),
    )
}

#[tauri::command]
pub async fn browser_tab_place(webview: Webview, args: TabPlaceArgs) -> Result<(), MessageError> {
    owned_tab(&webview, &args.tab_id)?
        .set_bounds(args.bounds.rect())
        .map_err(failed)
}

#[tauri::command]
pub async fn browser_tab_show(webview: Webview, args: TabArgs) -> Result<TabFacts, MessageError> {
    owned_tab(&webview, &args.tab_id)?.show().map_err(failed)?;
    webview
        .state::<BrowserRegistry>()
        .set_shown(&args.tab_id, true, now_ms())
        .ok_or_else(|| reason::failed(TAB_GONE))
}

#[tauri::command]
pub async fn browser_tab_hide(webview: Webview, args: TabArgs) -> Result<TabFacts, MessageError> {
    owned_tab(&webview, &args.tab_id)?.hide().map_err(failed)?;
    webview
        .state::<BrowserRegistry>()
        .set_shown(&args.tab_id, false, now_ms())
        .ok_or_else(|| reason::failed(TAB_GONE))
}

#[tauri::command]
pub async fn browser_tab_navigate(
    webview: Webview,
    args: TabNavigateArgs,
) -> Result<(), MessageError> {
    let tab = owned_tab(&webview, &args.tab_id)?;
    let url = web_address(&webview, &args.url)?;
    tab.navigate(url).map_err(failed)
}

#[tauri::command]
pub async fn browser_tab_reload(webview: Webview, args: TabArgs) -> Result<(), MessageError> {
    owned_tab(&webview, &args.tab_id)?.reload().map_err(failed)
}

#[tauri::command]
pub async fn browser_tab_back(webview: Webview, args: TabArgs) -> Result<(), MessageError> {
    host::step_history(&owned_tab(&webview, &args.tab_id)?, HistoryStep::Back)
}

#[tauri::command]
pub async fn browser_tab_forward(webview: Webview, args: TabArgs) -> Result<(), MessageError> {
    host::step_history(&owned_tab(&webview, &args.tab_id)?, HistoryStep::Forward)
}

#[tauri::command]
pub async fn browser_tab_close(webview: Webview, args: TabArgs) -> Result<(), MessageError> {
    owned_tab(&webview, &args.tab_id)?;
    host::close_tab(webview.app_handle(), &args.tab_id)
}

#[tauri::command]
pub async fn browser_tab_list(
    webview: Webview,
    args: SessionArgs,
) -> Result<Vec<TabFacts>, MessageError> {
    list_session(&webview, &args.session_id)
}

#[tauri::command]
pub async fn browser_tab_move(
    webview: Webview,
    args: TabMoveArgs,
) -> Result<TabFacts, MessageError> {
    move_to_window(&webview, &args.tab_id, &args.window_label, args.bounds)
}

#[tauri::command]
pub async fn browser_session_close(
    webview: Webview,
    args: SessionArgs,
) -> Result<SessionClosed, MessageError> {
    close_session(&webview, &args.session_id)
}

pub(super) fn list_session<R: Runtime>(
    caller: &Webview<R>,
    session_id: &str,
) -> Result<Vec<TabFacts>, MessageError> {
    refuse_browser_caller(caller)?;
    let tabs = caller
        .state::<BrowserRegistry>()
        .list(session_id, caller.window().label());
    Ok(host::refresh_urls(caller.app_handle(), tabs))
}

pub(super) fn move_to_window<R: Runtime>(
    caller: &Webview<R>,
    tab_id: &str,
    window_label: &str,
    bounds: TabBounds,
) -> Result<TabFacts, MessageError> {
    let tab = owned_tab(caller, tab_id)?;
    host::move_tab(&tab, tab_id, window_label, bounds)
}

pub(super) fn close_session<R: Runtime>(
    caller: &Webview<R>,
    session_id: &str,
) -> Result<SessionClosed, MessageError> {
    refuse_browser_caller(caller)?;
    Ok(host::close_session(
        caller.app_handle(),
        session_id,
        caller.window().label(),
    ))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::util::wire_shape::assert_wire_reads;

    #[test]
    fn wire_shape_tab_open_args() {
        assert_wire_reads::<TabOpenArgs>(json!({
            "sessionId": "harborline",
            "url": "http://localhost:5173/",
            "bounds": { "x": 963.5, "y": 36.5, "width": 477.5, "height": 864.5 },
            "isShown": true,
        }));
    }

    #[test]
    fn wire_shape_tab_place_args() {
        assert_wire_reads::<TabPlaceArgs>(json!({
            "tabId": "0f1e",
            "bounds": { "x": 247.5, "y": 36.5, "width": 1193.5, "height": 864.5 },
        }));
    }

    #[test]
    fn wire_shape_tab_move_args() {
        assert_wire_reads::<TabMoveArgs>(json!({
            "tabId": "0f1e",
            "windowLabel": "win-2",
            "bounds": { "x": 247.5, "y": 36.5, "width": 1193.5, "height": 864.5 },
        }));
    }

    #[test]
    fn wire_shape_tab_navigate_args() {
        assert_wire_reads::<TabNavigateArgs>(json!({
            "tabId": "0f1e",
            "url": "https://example.com/",
        }));
    }

    #[test]
    fn wire_shape_tab_args() {
        assert_wire_reads::<TabArgs>(json!({ "tabId": "0f1e" }));
    }

    #[test]
    fn wire_shape_session_args() {
        assert_wire_reads::<SessionArgs>(json!({ "sessionId": "harborline" }));
    }
}
