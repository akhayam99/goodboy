use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{
    get_ipc_response, mock_app, mock_builder, mock_context, noop_assets, MockRuntime, INVOKE_KEY,
};
use tauri::webview::InvokeRequest;
use tauri::{App, Listener, Manager, Url, Webview, WebviewUrl, WebviewWindowBuilder, Window};

use super::commands::{close_session, list_session, move_to_window, owned_tab};
use super::guard::label_of;
use super::host::{
    close_each, close_tab, fill_popup, open_tab, reserve_popup, OpenTab, SessionClosed, TabBounds,
    MAX_HIDDEN_POPUPS, TAB_OPENED_EVENT,
};
use super::reason::{
    BROWSER_CALLER, NOT_WEB_ADDRESS, OTHER_WINDOW, SESSION_CLOSING, TAB_GONE, TOO_MANY_POPUPS,
    WINDOW_GONE,
};
use super::{forget_window, refuse_browser_pages, BrowserRegistry};
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
    let facts = app.state::<BrowserRegistry>().list("harborline", "main");
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
        assert!(
            matches!(result, Err(MessageError::Refused(ref code)) if code == NOT_WEB_ADDRESS),
            "{address}"
        );
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
        Err(MessageError::Refused(code)) if code == OTHER_WINDOW
    ));
    assert!(matches!(
        owned_tab(&main, "gone"),
        Err(MessageError::Failed(code)) if code == TAB_GONE
    ));
}

#[test]
fn refuses_a_browser_page_that_tries_to_drive_a_tab() {
    let app = app_with_windows(&["main"]);
    let id = open(&app, "main", "harborline");
    let page = app.get_webview(&label_of(&id)).expect("child webview");
    assert!(matches!(
        owned_tab(&page, &id),
        Err(MessageError::Refused(code)) if code == BROWSER_CALLER
    ));
}

#[tauri::command]
async fn probe() -> String {
    "answered".to_string()
}

struct Caller(Webview<MockRuntime>);

impl AsRef<Webview<MockRuntime>> for Caller {
    fn as_ref(&self) -> &Webview<MockRuntime> {
        &self.0
    }
}

fn local_request(cmd: &str) -> InvokeRequest {
    InvokeRequest {
        cmd: cmd.into(),
        callback: CallbackFn(0),
        error: CallbackFn(1),
        url: url("tauri://localhost"),
        body: InvokeBody::default(),
        headers: Default::default(),
        invoke_key: INVOKE_KEY.to_string(),
    }
}

#[test]
fn refuses_every_app_command_to_a_browser_page_even_from_a_local_address() {
    let app = mock_builder()
        .invoke_handler(refuse_browser_pages(tauri::generate_handler![probe]))
        .build(mock_context(noop_assets()))
        .expect("app builds");
    app.manage(BrowserRegistry::default());
    WebviewWindowBuilder::new(&app, "main", WebviewUrl::default())
        .build()
        .expect("window builds");
    let id = open(&app, "main", "harborline");
    let main = Caller(app.get_webview("main").expect("main webview"));
    let page = Caller(app.get_webview(&label_of(&id)).expect("child webview"));

    let answered = get_ipc_response(&main, local_request("probe"))
        .map(|body| body.deserialize::<String>().expect("string"));
    assert_eq!(answered, Ok("answered".to_string()));

    let refused = get_ipc_response(&page, local_request("probe")).expect_err("refused");
    assert_eq!(refused["kind"], "refused");
    assert_eq!(refused["message"], BROWSER_CALLER);
}

fn webview(app: &App<MockRuntime>, label: &str) -> Webview<MockRuntime> {
    app.get_webview(label).expect("webview exists")
}

#[test]
fn closes_the_session_tabs_of_the_calling_window_and_no_other() {
    let app = app_with_windows(&["main", "win-2"]);
    let first = open(&app, "main", "harborline");
    let second = open(&app, "main", "harborline");
    let elsewhere = open(&app, "win-2", "harborline");
    let kept = open(&app, "main", "northwind");
    let closed = close_session(&webview(&app, "main"), "harborline").expect("closes");
    assert_eq!(
        closed,
        SessionClosed {
            closed: 2,
            failed: vec![]
        }
    );
    let registry = app.state::<BrowserRegistry>();
    assert!(registry.facts(&first).is_none());
    assert!(registry.facts(&second).is_none());
    assert_eq!(registry.ids_of_session("northwind", "main"), vec![kept]);
    assert_eq!(
        registry.ids_of_session("harborline", "win-2"),
        vec![elsewhere]
    );
    assert!(app.get_webview(&label_of(&first)).is_none());
}

#[test]
fn lists_only_the_session_tabs_of_the_calling_window() {
    let app = app_with_windows(&["main", "win-2"]);
    let mine = open(&app, "main", "harborline");
    let theirs = open(&app, "win-2", "harborline");
    let ids = |label: &str| -> Vec<String> {
        list_session(&webview(&app, label), "harborline")
            .expect("lists")
            .into_iter()
            .map(|facts| facts.id)
            .collect()
    };
    assert_eq!(ids("main"), vec![mine.clone()]);
    assert_eq!(ids("win-2"), vec![theirs]);
    let page = webview(&app, &label_of(&mine));
    assert!(matches!(
        list_session(&page, "harborline"),
        Err(MessageError::Refused(code)) if code == BROWSER_CALLER
    ));
    assert!(matches!(
        close_session(&page, "harborline"),
        Err(MessageError::Refused(code)) if code == BROWSER_CALLER
    ));
}

#[test]
fn closes_the_rest_of_a_session_on_retry_after_a_partial_failure() {
    let app = app_with_windows(&["main"]);
    let first = open(&app, "main", "harborline");
    let stuck = open(&app, "main", "harborline");
    let last = open(&app, "main", "harborline");
    let ids = app
        .state::<BrowserRegistry>()
        .ids_of_session("harborline", "main");
    let partial = close_each(&ids, |id| match id == stuck {
        true => Err(MessageError::Failed("webview-busy".to_string())),
        false => close_tab(app.handle(), id),
    });
    assert_eq!(partial.closed, 2);
    assert_eq!(partial.failed.len(), 1);
    assert_eq!(partial.failed[0].tab_id, stuck);
    assert_eq!(partial.failed[0].reason, "webview-busy");
    let registry = app.state::<BrowserRegistry>();
    assert!(registry.facts(&first).is_none());
    assert!(registry.facts(&last).is_none());
    assert_eq!(
        registry.ids_of_session("harborline", "main"),
        vec![stuck.clone()]
    );

    let retried = close_session(&webview(&app, "main"), "harborline").expect("closes");
    assert_eq!(
        retried,
        SessionClosed {
            closed: 1,
            failed: vec![]
        }
    );
    assert!(registry.is_empty());
    assert!(app.get_webview(&label_of(&stuck)).is_none());
}

#[test]
fn opens_popups_hidden_beside_the_opener_up_to_the_cap_and_tells_the_window() {
    let app = app_with_windows(&["main"]);
    let opener = open(&app, "main", "harborline");
    let heard = Arc::new(AtomicUsize::new(0));
    let counter = Arc::clone(&heard);
    app.listen_any(TAB_OPENED_EVENT, move |_event| {
        counter.fetch_add(1, Ordering::SeqCst);
    });
    for _ in 0..MAX_HIDDEN_POPUPS {
        let seat = reserve_popup(app.handle(), &opener).expect("seat");
        let facts = fill_popup(app.handle(), &seat, url("https://example.com/")).expect("opens");
        assert!(!facts.is_shown);
        assert_eq!(facts.session_id, "harborline");
        assert_eq!(facts.opener_id.as_deref(), Some(opener.as_str()));
        assert_eq!(webview(&app, &label_of(&facts.id)).window().label(), "main");
    }
    assert!(matches!(
        reserve_popup(app.handle(), &opener),
        Err(MessageError::Refused(code)) if code == TOO_MANY_POPUPS
    ));
    assert_eq!(heard.load(Ordering::SeqCst), MAX_HIDDEN_POPUPS);
    assert_eq!(
        app.state::<BrowserRegistry>()
            .ids_of_session("harborline", "main")
            .len(),
        MAX_HIDDEN_POPUPS + 1
    );
}

const PAGE: TabBounds = TabBounds {
    x: 247.0,
    y: 36.0,
    width: 1193.0,
    height: 864.0,
};

#[test]
fn moves_a_tab_to_another_window_with_the_same_id_and_address() {
    let app = app_with_windows(&["main", "win-2"]);
    let id = open(&app, "main", "harborline");
    let before = app.webviews().len();
    let moved = move_to_window(&webview(&app, "main"), &id, "win-2", PAGE).expect("moves");
    assert_eq!(moved.id, id);
    assert_eq!(moved.url, "http://localhost:5173/");
    assert!(!moved.is_shown);
    assert_eq!(app.webviews().len(), before);
    assert_eq!(webview(&app, &label_of(&id)).window().label(), "win-2");
    let registry = app.state::<BrowserRegistry>();
    assert_eq!(registry.window_of(&id).as_deref(), Some("win-2"));
    assert!(list_session(&webview(&app, "main"), "harborline")
        .expect("lists")
        .is_empty());
    let listed = list_session(&webview(&app, "win-2"), "harborline").expect("lists");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, id);
    assert!(owned_tab(&webview(&app, "win-2"), &id).is_ok());
    assert!(matches!(
        owned_tab(&webview(&app, "main"), &id),
        Err(MessageError::Refused(code)) if code == OTHER_WINDOW
    ));
}

#[test]
fn refuses_to_move_a_tab_to_a_gone_window_and_keeps_it_where_it_was() {
    let app = app_with_windows(&["main"]);
    let id = open(&app, "main", "harborline");
    for target in ["win-gone", &label_of(&id)] {
        assert!(matches!(
            move_to_window(&webview(&app, "main"), &id, target, PAGE),
            Err(MessageError::Refused(ref code)) if code == WINDOW_GONE
        ));
    }
    assert_eq!(webview(&app, &label_of(&id)).window().label(), "main");
    let facts = app.state::<BrowserRegistry>().list("harborline", "main");
    assert_eq!(facts.len(), 1);
    assert!(facts[0].is_shown);
}

#[test]
fn lets_only_the_owning_window_move_a_tab() {
    let app = app_with_windows(&["main", "win-2"]);
    let id = open(&app, "main", "harborline");
    assert!(matches!(
        move_to_window(&webview(&app, "win-2"), &id, "win-2", PAGE),
        Err(MessageError::Refused(code)) if code == OTHER_WINDOW
    ));
    assert!(matches!(
        move_to_window(&webview(&app, &label_of(&id)), &id, "win-2", PAGE),
        Err(MessageError::Refused(code)) if code == BROWSER_CALLER
    ));
    assert_eq!(
        app.state::<BrowserRegistry>().window_of(&id).as_deref(),
        Some("main")
    );
}

#[test]
fn counts_a_moved_popup_against_the_cap_of_its_new_window() {
    let app = app_with_windows(&["main", "win-2"]);
    let opener = open(&app, "main", "harborline");
    let mut popups = Vec::new();
    for _ in 0..MAX_HIDDEN_POPUPS {
        let seat = reserve_popup(app.handle(), &opener).expect("seat");
        popups.push(
            fill_popup(app.handle(), &seat, url("https://example.com/"))
                .expect("opens")
                .id,
        );
    }
    assert!(reserve_popup(app.handle(), &opener).is_err());
    move_to_window(&webview(&app, "main"), &popups[0], "win-2", PAGE).expect("moves");
    assert!(reserve_popup(app.handle(), &opener).is_ok());
    let there = open(&app, "win-2", "harborline");
    for _ in 1..MAX_HIDDEN_POPUPS {
        reserve_popup(app.handle(), &there).expect("seat in the new window");
    }
    assert!(matches!(
        reserve_popup(app.handle(), &there),
        Err(MessageError::Refused(code)) if code == TOO_MANY_POPUPS
    ));
}

#[test]
fn frees_a_popup_seat_when_the_user_shows_the_popup() {
    let app = app_with_windows(&["main"]);
    let opener = open(&app, "main", "harborline");
    let mut opened = vec![];
    for _ in 0..MAX_HIDDEN_POPUPS {
        let seat = reserve_popup(app.handle(), &opener).expect("seat");
        opened.push(fill_popup(app.handle(), &seat, url("https://example.com/")).expect("opens"));
    }
    assert!(reserve_popup(app.handle(), &opener).is_err());
    app.state::<BrowserRegistry>()
        .set_shown(&opened[0].id, true, 5_000);
    assert!(reserve_popup(app.handle(), &opener).is_ok());
}

#[test]
fn refuses_a_popup_seat_for_a_gone_opener() {
    let app = app_with_windows(&["main"]);
    assert!(matches!(
        reserve_popup(app.handle(), "gone"),
        Err(MessageError::Failed(code)) if code == TAB_GONE
    ));
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
fn refuses_and_destroys_a_popup_that_finishes_opening_after_its_session_closed() {
    let app = app_with_windows(&["main"]);
    let opener = open(&app, "main", "harborline");
    let seat = reserve_popup(app.handle(), &opener).expect("seat");
    let before = app.webviews().len();
    app.state::<BrowserRegistry>()
        .close_session("harborline", "main");
    let late = fill_popup(app.handle(), &seat, url("https://example.com/"));
    assert!(matches!(
        late,
        Err(MessageError::Refused(code)) if code == SESSION_CLOSING
    ));
    assert_eq!(app.webviews().len(), before);
    assert_eq!(
        app.state::<BrowserRegistry>()
            .ids_of_session("harborline", "main"),
        vec![opener]
    );
}

#[test]
fn refuses_a_tab_that_started_opening_before_its_session_closed() {
    let app = app_with_windows(&["main"]);
    let registry = app.state::<BrowserRegistry>();
    let generation = registry.generation("harborline", "main");
    registry.close_session("harborline", "main");
    let mut stale = OpenTab::at("harborline", url("http://localhost:5173/"), PANE, true);
    stale.generation = Some(generation);
    assert!(matches!(
        open_tab(&window(&app, "main"), stale),
        Err(MessageError::Refused(code)) if code == SESSION_CLOSING
    ));
    assert!(registry.is_empty());
    assert_eq!(app.webviews().len(), 1);
}

#[test]
fn opens_tabs_again_in_a_session_after_it_was_closed() {
    let app = app_with_windows(&["main"]);
    open(&app, "main", "harborline");
    close_session(&webview(&app, "main"), "harborline").expect("closes");
    let reopened = open(&app, "main", "harborline");
    assert_eq!(
        app.state::<BrowserRegistry>()
            .ids_of_session("harborline", "main"),
        vec![reopened]
    );
}

#[test]
fn lists_the_address_the_page_moved_to_without_a_new_page_load() {
    let app = app_with_windows(&["main"]);
    let id = open(&app, "main", "harborline");
    webview(&app, &label_of(&id))
        .navigate(url("http://localhost:5173/pricing#plans"))
        .expect("same document move");
    let listed = list_session(&webview(&app, "main"), "harborline").expect("lists");
    assert_eq!(listed[0].url, "http://localhost:5173/pricing#plans");
    assert_eq!(
        app.state::<BrowserRegistry>()
            .facts(&id)
            .map(|facts| facts.url),
        Some("http://localhost:5173/pricing#plans".to_string())
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
        app.state::<BrowserRegistry>()
            .ids_of_session("harborline", "main"),
        vec![kept]
    );
}
