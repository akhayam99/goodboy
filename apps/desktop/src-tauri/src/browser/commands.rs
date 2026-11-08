use serde::Deserialize;
use tauri::{Manager, Runtime, Webview};

use super::guard::{self, AppOrigins};
use super::host::{self, OpenTab, TabBounds};
use super::registry::{BrowserRegistry, TabFacts};
use crate::util::{now_ms, MessageError};

const BACK_SCRIPT: &str = "history.back()";
const FORWARD_SCRIPT: &str = "history.forward()";

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
        return Err(MessageError::Refused(
            "a browser page cannot drive the browser".to_string(),
        ));
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
        .ok_or_else(|| MessageError::Failed("the tab is gone".to_string()))?;
    if owner != caller.window().label() {
        return Err(MessageError::Refused(
            "the tab belongs to another window".to_string(),
        ));
    }
    host::webview_of(app, tab_id)
}

fn web_address<R: Runtime>(caller: &Webview<R>, address: &str) -> Result<tauri::Url, MessageError> {
    let origins = AppOrigins::of_app(caller.app_handle());
    guard::parse_address(address)
        .filter(|url| guard::is_web_address(url, &origins))
        .ok_or_else(|| {
            MessageError::Refused("the browser opens only http and https addresses".to_string())
        })
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
    let url = guard::parse_address(&args.url)
        .ok_or_else(|| MessageError::Refused("the address is not valid".to_string()))?;
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
        .ok_or_else(|| MessageError::Failed("the tab is gone".to_string()))
}

#[tauri::command]
pub async fn browser_tab_hide(webview: Webview, args: TabArgs) -> Result<TabFacts, MessageError> {
    owned_tab(&webview, &args.tab_id)?.hide().map_err(failed)?;
    webview
        .state::<BrowserRegistry>()
        .set_shown(&args.tab_id, false, now_ms())
        .ok_or_else(|| MessageError::Failed("the tab is gone".to_string()))
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
    owned_tab(&webview, &args.tab_id)?
        .eval(BACK_SCRIPT)
        .map_err(failed)
}

#[tauri::command]
pub async fn browser_tab_forward(webview: Webview, args: TabArgs) -> Result<(), MessageError> {
    owned_tab(&webview, &args.tab_id)?
        .eval(FORWARD_SCRIPT)
        .map_err(failed)
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
    refuse_browser_caller(&webview)?;
    Ok(webview.state::<BrowserRegistry>().list(&args.session_id))
}

#[tauri::command]
pub async fn browser_session_close(
    webview: Webview,
    args: SessionArgs,
) -> Result<usize, MessageError> {
    refuse_browser_caller(&webview)?;
    host::close_session(webview.app_handle(), &args.session_id)
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
