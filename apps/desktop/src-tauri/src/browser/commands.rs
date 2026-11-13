use serde::Deserialize;
use tauri::{Manager, Runtime, Webview};

use super::favicon::{self, BrowserFavicons, TabFavicon};
use super::find::{self, FindOutcome};
use super::guard::{self, AppOrigins};
use super::host::{self, OpenTab, SessionClosed, TabBounds};
use super::lifecycle;
use super::local::{self, LocalFile};
use super::page_keys::PageKeys;
use super::profile::{self, ClearOutcome, Isolation, ProfileId};
use super::reason::{
    self, BROWSER_CALLER, HOST_UNKNOWN, INVALID_ADDRESS, NOT_WEB_ADDRESS, OTHER_SESSION,
    OTHER_WINDOW, PAGE_TEXT_UNAVAILABLE, TAB_CLOSED, TAB_GONE,
};
use super::registry::{BrowserRegistry, TabFacts, TabState};
use crate::platform::web_history::{HistoryState, HistoryStep};
use crate::platform::web_text::{self, PageText};
use crate::platform::web_url;
use crate::util::{now_ms, MessageError};

const BLANK_ADDRESS: &str = "about:blank";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabOpenArgs {
    session_id: String,
    workspace_id: String,
    url: String,
    bounds: TabBounds,
    is_shown: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabOpenLocalArgs {
    session_id: String,
    workspace_id: String,
    path: String,
    bounds: TabBounds,
    is_shown: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabNavigateLocalArgs {
    tab_id: String,
    path: String,
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
pub(crate) struct TabFindArgs {
    tab_id: String,
    needle: String,
    is_backwards: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PageTextArgs {
    tab_id: String,
    session_id: String,
    host: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PageKeysArgs {
    combos: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionArgs {
    session_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceArgs {
    workspace_id: String,
}

fn refuse_browser_caller<R: Runtime>(caller: &Webview<R>) -> Result<(), MessageError> {
    if guard::is_browser_label(caller.label()) {
        return Err(reason::refused(BROWSER_CALLER));
    }
    Ok(())
}

fn check_owner<R: Runtime>(caller: &Webview<R>, tab_id: &str) -> Result<(), MessageError> {
    refuse_browser_caller(caller)?;
    let owner = caller
        .state::<BrowserRegistry>()
        .window_of(tab_id)
        .ok_or_else(|| reason::failed(TAB_GONE))?;
    if owner != caller.window().label() {
        return Err(reason::refused(OTHER_WINDOW));
    }
    Ok(())
}

pub(super) fn owned_tab<R: Runtime>(
    caller: &Webview<R>,
    tab_id: &str,
) -> Result<Webview<R>, MessageError> {
    check_owner(caller, tab_id)?;
    let app = caller.app_handle();
    if app.state::<BrowserRegistry>().state_of(tab_id) == Some(TabState::Closed) {
        return Err(reason::failed(TAB_CLOSED));
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
    let profile = ProfileId::of_workspace(&args.workspace_id)?;
    let url = guard::parse_address(&args.url).ok_or_else(|| reason::refused(INVALID_ADDRESS))?;
    host::open_tab(
        &webview.window(),
        OpenTab::at(&args.session_id, profile, url, args.bounds, args.is_shown),
    )
}

fn local_file(path: &str) -> Result<LocalFile, MessageError> {
    local::resolve(path, dirs::home_dir().as_deref()).map_err(reason::refused)
}

#[tauri::command]
pub async fn browser_tab_open_local(
    webview: Webview,
    args: TabOpenLocalArgs,
) -> Result<TabFacts, MessageError> {
    refuse_browser_caller(&webview)?;
    let profile = ProfileId::of_workspace(&args.workspace_id)?;
    let file = local_file(&args.path)?;
    let blank =
        guard::parse_address(BLANK_ADDRESS).ok_or_else(|| reason::refused(INVALID_ADDRESS))?;
    let opened = host::open_tab(
        &webview.window(),
        OpenTab::at(&args.session_id, profile, blank, args.bounds, args.is_shown),
    )?;
    let app = webview.app_handle();
    host::load_local(app, &opened.id, &file).inspect_err(|_| {
        let _ = host::close_tab(app, &opened.id);
    })
}

#[tauri::command]
pub async fn browser_tab_navigate_local(
    webview: Webview,
    args: TabNavigateLocalArgs,
) -> Result<(), MessageError> {
    owned_tab(&webview, &args.tab_id)?;
    let file = local_file(&args.path)?;
    host::load_local(webview.app_handle(), &args.tab_id, &file).map(|_| ())
}

#[tauri::command]
pub async fn browser_profile_clear(
    webview: Webview,
    args: WorkspaceArgs,
) -> Result<ClearOutcome, MessageError> {
    refuse_browser_caller(&webview)?;
    profile::clear(webview.app_handle(), &args.workspace_id).await
}

#[tauri::command]
pub async fn browser_profile_isolation(webview: Webview) -> Result<Isolation, MessageError> {
    refuse_browser_caller(&webview)?;
    Ok(profile::isolation())
}

#[tauri::command]
pub async fn browser_tab_place(webview: Webview, args: TabPlaceArgs) -> Result<(), MessageError> {
    check_owner(&webview, &args.tab_id)?;
    lifecycle::place_tab(webview.app_handle(), &args.tab_id, args.bounds.rect())
}

#[tauri::command]
pub async fn browser_tab_show(webview: Webview, args: TabArgs) -> Result<TabFacts, MessageError> {
    check_owner(&webview, &args.tab_id)?;
    lifecycle::show_tab(&webview.window(), &args.tab_id, now_ms())
}

#[tauri::command]
pub async fn browser_tab_hide(webview: Webview, args: TabArgs) -> Result<TabFacts, MessageError> {
    check_owner(&webview, &args.tab_id)?;
    lifecycle::hide_tab(webview.app_handle(), &args.tab_id, now_ms())
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
pub async fn browser_tab_stop(webview: Webview, args: TabArgs) -> Result<(), MessageError> {
    host::stop_load(&owned_tab(&webview, &args.tab_id)?)
}

#[tauri::command]
pub async fn browser_history_state(
    webview: Webview,
    args: TabArgs,
) -> Result<Option<HistoryState>, MessageError> {
    host::history_state(&owned_tab(&webview, &args.tab_id)?)
}

#[tauri::command]
pub async fn browser_find(
    webview: Webview,
    args: TabFindArgs,
) -> Result<FindOutcome, MessageError> {
    find::find_in_page(
        &owned_tab(&webview, &args.tab_id)?,
        &args.needle,
        args.is_backwards,
    )
}

#[tauri::command]
pub async fn browser_favicon(
    webview: Webview,
    args: TabArgs,
) -> Result<Option<TabFavicon>, MessageError> {
    let page = owned_tab(&webview, &args.tab_id)?.url().map_err(failed)?;
    let Some(origin) = favicon::host_key(&page) else {
        return Ok(None);
    };
    let cache = webview.state::<BrowserFavicons>();
    let src = favicon::favicon_of(&cache, &page, favicon::find_icon).await;
    Ok(Some(TabFavicon { origin, src }))
}

fn check_page_read(
    owner_session: &str,
    args: &PageTextArgs,
    live: &tauri::Url,
    origins: &AppOrigins,
) -> Result<(), MessageError> {
    if owner_session != args.session_id {
        return Err(reason::refused(OTHER_SESSION));
    }
    if !guard::is_web_address(live, origins) {
        return Err(reason::refused(NOT_WEB_ADDRESS));
    }
    if guard::host_of(live) != args.host.trim().trim_end_matches('.').to_ascii_lowercase() {
        return Err(reason::refused(HOST_UNKNOWN));
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_page_text(
    webview: Webview,
    args: PageTextArgs,
) -> Result<PageText, MessageError> {
    let tab = owned_tab(&webview, &args.tab_id)?;
    let owner_session = webview
        .state::<BrowserRegistry>()
        .facts(&args.tab_id)
        .map(|facts| facts.session_id)
        .ok_or_else(|| reason::failed(TAB_GONE))?;
    let live = web_url::live_url_of(&tab).ok_or_else(|| reason::failed(PAGE_TEXT_UNAVAILABLE))?;
    check_page_read(
        &owner_session,
        &args,
        &live,
        &AppOrigins::of_app(webview.app_handle()),
    )?;
    web_text::read_page_text(&tab, PAGE_TEXT_UNAVAILABLE)
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
pub async fn browser_tab_inspectable(webview: Webview, args: TabArgs) -> Result<(), MessageError> {
    host::make_inspectable(&owned_tab(&webview, &args.tab_id)?)
}

#[tauri::command]
pub async fn browser_tab_close(webview: Webview, args: TabArgs) -> Result<(), MessageError> {
    check_owner(&webview, &args.tab_id)?;
    host::close_tab(webview.app_handle(), &args.tab_id)
}

#[tauri::command]
pub async fn browser_tab_passkey_dismiss(
    webview: Webview,
    args: TabArgs,
) -> Result<TabFacts, MessageError> {
    check_owner(&webview, &args.tab_id)?;
    webview
        .state::<BrowserRegistry>()
        .set_passkey_blocked(&args.tab_id, false)
        .ok_or_else(|| reason::failed(TAB_GONE))
}

#[tauri::command]
pub async fn browser_tab_list(
    webview: Webview,
    args: SessionArgs,
) -> Result<Vec<TabFacts>, MessageError> {
    list_session(&webview, &args.session_id)
}

#[tauri::command]
pub async fn browser_session_close(
    webview: Webview,
    args: SessionArgs,
) -> Result<SessionClosed, MessageError> {
    close_session(&webview, &args.session_id)
}

#[tauri::command]
pub async fn browser_page_keys(
    webview: Webview,
    args: PageKeysArgs,
) -> Result<usize, MessageError> {
    set_page_keys(&webview, &args.combos)
}

pub(super) fn set_page_keys<R: Runtime>(
    caller: &Webview<R>,
    combos: &[String],
) -> Result<usize, MessageError> {
    refuse_browser_caller(caller)?;
    Ok(caller.state::<PageKeys>().replace(combos))
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

pub(super) fn close_session<R: Runtime>(
    caller: &Webview<R>,
    session_id: &str,
) -> Result<SessionClosed, MessageError> {
    refuse_browser_caller(caller)?;
    Ok(host::close_session(caller.app_handle(), session_id))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::util::wire_shape::{assert_wire_reads, assert_wire_value};

    #[test]
    fn wire_shape_tab_open_args() {
        assert_wire_reads::<TabOpenArgs>(json!({
            "sessionId": "harborline",
            "workspaceId": "northwind",
            "url": "http://localhost:5173/",
            "bounds": { "x": 963.5, "y": 36.5, "width": 477.5, "height": 864.5 },
            "isShown": true,
        }));
    }

    #[test]
    fn wire_shape_tab_open_local_args() {
        assert_wire_reads::<TabOpenLocalArgs>(json!({
            "sessionId": "harborline",
            "workspaceId": "northwind",
            "path": "~/harborline/plan.html",
            "bounds": { "x": 963.5, "y": 36.5, "width": 477.5, "height": 864.5 },
            "isShown": false,
        }));
    }

    #[test]
    fn wire_shape_tab_navigate_local_args() {
        assert_wire_reads::<TabNavigateLocalArgs>(json!({
            "tabId": "0f1e",
            "path": "/work/harborline/plan.html",
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
    fn wire_shape_tab_find_args() {
        assert_wire_reads::<TabFindArgs>(json!({
            "tabId": "0f1e",
            "needle": "retry",
            "isBackwards": false,
        }));
    }

    #[test]
    fn wire_shape_session_args() {
        assert_wire_reads::<SessionArgs>(json!({ "sessionId": "harborline" }));
    }

    #[test]
    fn wire_shape_page_text_args() {
        assert_wire_reads::<PageTextArgs>(json!({
            "tabId": "0f1e",
            "sessionId": "harborline",
            "host": "localhost",
        }));
    }

    fn page_args(session_id: &str, host: &str) -> PageTextArgs {
        PageTextArgs {
            tab_id: "0f1e".into(),
            session_id: session_id.into(),
            host: host.into(),
        }
    }

    fn page_check(owner: &str, args: &PageTextArgs, address: &str) -> Result<(), String> {
        let live = guard::parse_address(address).expect("an address");
        check_page_read(owner, args, &live, &AppOrigins::with_dev_origin(None))
            .map_err(|error| error.to_string())
    }

    #[test]
    fn reads_a_page_whose_host_the_press_named() {
        let args = page_args("harborline", "acme.test");

        assert!(page_check("harborline", &args, "https://Acme.test/checkout").is_ok());
        assert!(page_check("harborline", &args, "https://acme.test./checkout").is_ok());
    }

    #[test]
    fn refuses_a_page_that_moved_to_another_host_after_the_press() {
        let args = page_args("harborline", "acme.test");

        assert_eq!(
            page_check("harborline", &args, "https://northwind.test/"),
            Err(HOST_UNKNOWN.to_string())
        );
        assert_eq!(
            page_check("harborline", &args, "https://acme.test.northwind.test/"),
            Err(HOST_UNKNOWN.to_string())
        );
    }

    #[test]
    fn refuses_a_tab_that_belongs_to_another_session() {
        let args = page_args("harborline", "acme.test");

        assert_eq!(
            page_check("cascadia", &args, "https://acme.test/"),
            Err(OTHER_SESSION.to_string())
        );
    }

    #[test]
    fn refuses_a_page_that_is_not_a_web_address() {
        let args = page_args("harborline", "");

        for address in ["about:blank", "file:///work/harborline/plan.html"] {
            assert_eq!(
                page_check("harborline", &args, address),
                Err(NOT_WEB_ADDRESS.to_string()),
                "{address}"
            );
        }
    }

    #[test]
    fn wire_shape_workspace_args() {
        assert_wire_reads::<WorkspaceArgs>(json!({ "workspaceId": "northwind" }));
    }

    #[test]
    fn wire_shape_clear_outcome() {
        assert_wire_value(
            &ClearOutcome {
                should_restart: true,
            },
            json!({ "shouldRestart": true }),
        );
    }
}
