use tauri::test::{mock_app, MockRuntime};
use tauri::{App, Manager, Url, WebviewUrl, WebviewWindowBuilder, Window};

use super::commands::owned_tab;
use super::guard::label_of;
use super::host::{close_session, close_tab, open_tab, OpenTab, TabBounds};
use super::{forget_window, BrowserRegistry};
use crate::util::source_scan::production_hits;
use crate::util::MessageError;

const PANE: TabBounds = TabBounds {
    x: 963.0,
    y: 36.0,
    width: 477.0,
    height: 864.0,
};

fn app_with_windows(labels: &[&str]) -> App<MockRuntime> {
    let app = mock_app();
    app.manage(BrowserRegistry::default());
    for label in labels {
        WebviewWindowBuilder::new(&app, *label, WebviewUrl::default())
            .build()
            .expect("window builds");
    }
    app
}

fn window(app: &App<MockRuntime>, label: &str) -> Window<MockRuntime> {
    app.get_window(label).expect("window exists")
}

fn url(address: &str) -> Url {
    Url::parse(address).expect("test address parses")
}

fn open(app: &App<MockRuntime>, window_label: &str, session_id: &str) -> String {
    open_tab(
        &window(app, window_label),
        OpenTab::at(session_id, url("http://localhost:5173/"), PANE, true),
    )
    .expect("tab opens")
    .id
}

#[test]
fn creates_no_webview_until_a_tab_opens() {
    let app = app_with_windows(&["main"]);
    assert!(app.state::<BrowserRegistry>().is_empty());
    assert_eq!(app.webviews().len(), 1);
}

#[test]
fn opens_a_tab_as_a_child_of_the_window_that_asked() {
    let app = app_with_windows(&["main"]);
    let id = open(&app, "main", "harborline");
    let webview = app.get_webview(&label_of(&id)).expect("child webview");
    assert_eq!(webview.window().label(), "main");
    let facts = app.state::<BrowserRegistry>().list("harborline");
    assert_eq!(facts.len(), 1);
    assert_eq!(facts[0].url, "http://localhost:5173/");
    assert!(facts[0].is_shown);
}

#[test]
fn opens_a_hidden_tab_with_the_time_it_was_hidden() {
    let app = app_with_windows(&["main"]);
    let facts = open_tab(
        &window(&app, "main"),
        OpenTab::at("harborline", url("about:blank"), PANE, false),
    )
    .expect("tab opens");
    assert!(!facts.is_shown);
    assert!(facts.hidden_since_ms.is_some());
}

#[test]
fn refuses_to_open_an_app_or_script_address() {
    let app = app_with_windows(&["main"]);
    for address in [
        "tauri://localhost/",
        "javascript:alert(1)",
        "file:///etc/hosts",
    ] {
        let result = open_tab(
            &window(&app, "main"),
            OpenTab::at("harborline", url(address), PANE, true),
        );
        assert!(matches!(result, Err(MessageError::Refused(_))), "{address}");
    }
    assert!(app.state::<BrowserRegistry>().is_empty());
    assert_eq!(app.webviews().len(), 1);
}

#[test]
fn lets_only_the_owning_window_drive_a_tab() {
    let app = app_with_windows(&["main", "win-2"]);
    let id = open(&app, "main", "harborline");
    let main = app.get_webview("main").expect("main webview");
    let other = app.get_webview("win-2").expect("project window webview");
    assert!(owned_tab(&main, &id).is_ok());
    assert!(matches!(
        owned_tab(&other, &id),
        Err(MessageError::Refused(_))
    ));
}

#[test]
fn refuses_a_browser_page_that_tries_to_drive_a_tab() {
    let app = app_with_windows(&["main"]);
    let id = open(&app, "main", "harborline");
    let page = app.get_webview(&label_of(&id)).expect("child webview");
    assert!(matches!(
        owned_tab(&page, &id),
        Err(MessageError::Refused(_))
    ));
}

#[test]
fn closes_every_tab_of_an_archived_session_and_no_other() {
    let app = app_with_windows(&["main", "win-2"]);
    let first = open(&app, "main", "harborline");
    let second = open(&app, "win-2", "harborline");
    let kept = open(&app, "main", "northwind");
    assert_eq!(
        close_session(app.handle(), "harborline").expect("closes"),
        2
    );
    let registry = app.state::<BrowserRegistry>();
    assert!(registry.list("harborline").is_empty());
    assert_eq!(registry.ids_of_session("northwind"), vec![kept]);
    assert!(registry.facts(&first).is_none());
    assert!(registry.facts(&second).is_none());
}

#[test]
fn finds_a_window_by_its_window_label_once_it_holds_a_tab() {
    let app = app_with_windows(&["main"]);
    open(&app, "main", "harborline");
    assert!(app.get_webview_window("main").is_none());
    assert!(app.webview_windows().is_empty());
    assert!(app.get_window("main").is_some());
    let offenders = production_hits(&["webview_windows()", "get_webview_window("], &["lib.rs"]);
    assert!(
        offenders.is_empty(),
        "look a window up with get_window or windows, which still see a window that holds a tab: {offenders:?}"
    );
}

#[test]
fn closing_a_gone_tab_is_not_an_error() {
    let app = app_with_windows(&["main"]);
    assert!(close_tab(app.handle(), "gone").is_ok());
}

#[test]
fn forgets_the_tabs_of_a_destroyed_window() {
    let app = app_with_windows(&["main", "win-2"]);
    open(&app, "win-2", "harborline");
    let kept = open(&app, "main", "harborline");
    forget_window(app.handle(), "win-2");
    assert_eq!(
        app.state::<BrowserRegistry>().ids_of_session("harborline"),
        vec![kept]
    );
}
