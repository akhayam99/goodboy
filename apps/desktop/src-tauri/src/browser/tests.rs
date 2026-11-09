use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{
    get_ipc_response, mock_app, mock_builder, mock_context, noop_assets, MockRuntime, INVOKE_KEY,
};
use tauri::webview::InvokeRequest;
use tauri::{App, Listener, Manager, Url, Webview, WebviewUrl, WebviewWindowBuilder, Window};

use super::commands::{close_session, list_session, owned_tab};
use super::guard::label_of;
use super::host::{
    close_each, close_tab, fill_popup, open_tab, reserve_popup, OpenTab, SessionClosed, TabBounds,
    MAX_HIDDEN_POPUPS, TAB_OPENED_EVENT,
};
use super::lifecycle::{hide_tab, place_tab, show_tab, sweep, SLEEP_LIMIT_MS, TAB_STATE_EVENT};
use super::reason::{
    BROWSER_CALLER, NOT_WEB_ADDRESS, OTHER_WINDOW, SESSION_CLOSING, TAB_CLOSED, TAB_GONE,
    TOO_MANY_POPUPS,
};
use super::registry::TabState;
use super::{forget_window, refuse_browser_pages, start_lifecycle, BrowserRegistry};
use crate::util::source_scan::production_hits;
use crate::util::{now_ms, MessageError};

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
    show_tab(&window(&app, "main"), &opened[0].id, 5_000).expect("shows");
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

fn state_of(app: &App<MockRuntime>, id: &str) -> Option<TabState> {
    app.state::<BrowserRegistry>().state_of(id)
}

fn is_live_webview(app: &App<MockRuntime>, id: &str) -> bool {
    app.get_webview(&label_of(id)).is_some()
}

fn hear_states(app: &App<MockRuntime>) -> Arc<Mutex<Vec<(String, String)>>> {
    let heard = Arc::new(Mutex::new(vec![]));
    let sink = Arc::clone(&heard);
    app.listen_any(TAB_STATE_EVENT, move |event| {
        let payload: serde_json::Value =
            serde_json::from_str(event.payload()).expect("payload is json");
        sink.lock().expect("sink").push((
            payload["id"].as_str().expect("id").to_string(),
            payload["state"].as_str().expect("state").to_string(),
        ));
    });
    heard
}

#[test]
fn creates_nothing_and_registers_nothing_when_the_lifecycle_starts_at_boot() {
    let app = app_with_windows(&["main"]);
    start_lifecycle(app.handle().clone());
    assert!(app.state::<BrowserRegistry>().is_empty());
    assert_eq!(app.webviews().len(), 1);
}

#[test]
fn closes_a_tab_hidden_for_ten_minutes_and_keeps_its_address_and_title() {
    let app = app_with_windows(&["main"]);
    let id = open(&app, "main", "harborline");
    let registry = app.state::<BrowserRegistry>();
    registry.set_url(&id, "http://localhost:5173/pricing");
    registry.set_title(&id, "Pricing");
    let hidden_at = now_ms();
    hide_tab(app.handle(), &id, hidden_at).expect("hides");
    assert_eq!(state_of(&app, &id), Some(TabState::Asleep));

    sweep(app.handle(), hidden_at + SLEEP_LIMIT_MS - 1);
    assert_eq!(state_of(&app, &id), Some(TabState::Asleep));
    assert!(is_live_webview(&app, &id));

    sweep(app.handle(), hidden_at + SLEEP_LIMIT_MS);
    assert_eq!(state_of(&app, &id), Some(TabState::Closed));
    assert!(!is_live_webview(&app, &id));
    let facts = registry.facts(&id).expect("still listed");
    assert_eq!(facts.url, "http://localhost:5173/pricing");
    assert_eq!(facts.title, "Pricing");
    assert_eq!(registry.ids_of_session("harborline", "main"), vec![id]);
}

#[test]
fn never_closes_a_shown_tab_however_late_the_sweep_runs() {
    let app = app_with_windows(&["main"]);
    let id = open(&app, "main", "harborline");
    sweep(app.handle(), i64::MAX);
    assert_eq!(state_of(&app, &id), Some(TabState::Live));
    assert!(is_live_webview(&app, &id));
}

#[test]
fn closes_the_least_recently_shown_hidden_tab_first_when_a_fifth_goes_live() {
    let app = app_with_windows(&["main"]);
    let ids: Vec<String> = (0..4).map(|_| open(&app, "main", "harborline")).collect();
    hide_tab(app.handle(), &ids[2], 100).expect("hides");
    hide_tab(app.handle(), &ids[0], 200).expect("hides");
    hide_tab(app.handle(), &ids[1], 300).expect("hides");

    let fifth = open(&app, "main", "harborline");
    assert_eq!(state_of(&app, &ids[2]), Some(TabState::Closed));
    assert_eq!(state_of(&app, &ids[0]), Some(TabState::Asleep));
    assert_eq!(state_of(&app, &ids[1]), Some(TabState::Asleep));
    assert_eq!(state_of(&app, &ids[3]), Some(TabState::Live));
    assert_eq!(state_of(&app, &fifth), Some(TabState::Live));

    let sixth = open(&app, "main", "harborline");
    assert_eq!(state_of(&app, &ids[0]), Some(TabState::Closed));
    assert_eq!(state_of(&app, &ids[1]), Some(TabState::Asleep));
    assert_eq!(state_of(&app, &sixth), Some(TabState::Live));
    let live = [&ids[1], &ids[3], &fifth, &sixth];
    assert!(live.iter().all(|id| is_live_webview(&app, id)));
}

#[test]
fn keeps_every_shown_tab_when_all_of_them_are_over_the_cap() {
    let app = app_with_windows(&["main"]);
    let ids: Vec<String> = (0..6).map(|_| open(&app, "main", "harborline")).collect();
    assert!(ids
        .iter()
        .all(|id| state_of(&app, id) == Some(TabState::Live) && is_live_webview(&app, id)));
}

#[test]
fn counts_the_cap_per_window() {
    let app = app_with_windows(&["main", "win-2"]);
    let ids: Vec<String> = (0..4).map(|_| open(&app, "main", "harborline")).collect();
    for id in &ids {
        hide_tab(app.handle(), id, 100).expect("hides");
    }
    let other = open(&app, "win-2", "harborline");
    assert!(ids.iter().all(|id| is_live_webview(&app, id)));
    assert!(is_live_webview(&app, &other));
}

#[test]
fn shows_a_closed_tab_again_under_the_same_id_at_its_last_address() {
    let app = app_with_windows(&["main"]);
    let id = open(&app, "main", "harborline");
    let registry = app.state::<BrowserRegistry>();
    registry.set_url(&id, "http://localhost:5173/pricing");
    hide_tab(app.handle(), &id, 100).expect("hides");
    sweep(app.handle(), 100 + SLEEP_LIMIT_MS);
    assert!(!is_live_webview(&app, &id));

    let facts = show_tab(&window(&app, "main"), &id, 900_000).expect("shows");
    assert_eq!(facts.id, id);
    assert_eq!(facts.state, TabState::Live);
    assert!(facts.is_shown);
    assert_eq!(facts.hidden_since_ms, None);
    assert_eq!(facts.url, "http://localhost:5173/pricing");
    let page = webview(&app, &label_of(&id));
    assert_eq!(
        page.url().expect("url").as_str(),
        "http://localhost:5173/pricing"
    );
    assert_eq!(registry.ids_of_session("harborline", "main"), vec![id]);
}

#[test]
fn closes_an_older_hidden_tab_when_showing_a_closed_one_goes_over_the_cap() {
    let app = app_with_windows(&["main"]);
    let ids: Vec<String> = (0..4).map(|_| open(&app, "main", "harborline")).collect();
    hide_tab(app.handle(), &ids[0], 100).expect("hides");
    hide_tab(app.handle(), &ids[1], 200).expect("hides");
    let fifth = open(&app, "main", "harborline");
    assert_eq!(state_of(&app, &ids[0]), Some(TabState::Closed));

    show_tab(&window(&app, "main"), &ids[0], 300).expect("shows");
    assert_eq!(state_of(&app, &ids[0]), Some(TabState::Live));
    assert_eq!(state_of(&app, &ids[1]), Some(TabState::Closed));
    assert_eq!(state_of(&app, &fifth), Some(TabState::Live));
}

#[test]
fn shows_and_hides_a_live_tab_without_creating_a_webview() {
    let app = app_with_windows(&["main"]);
    let id = open(&app, "main", "harborline");
    let before = app.webviews().len();
    let hidden = hide_tab(app.handle(), &id, 100).expect("hides");
    assert_eq!(hidden.state, TabState::Asleep);
    assert_eq!(hidden.hidden_since_ms, Some(100));
    let shown = show_tab(&window(&app, "main"), &id, 200).expect("shows");
    assert_eq!(shown.state, TabState::Live);
    assert_eq!(app.webviews().len(), before);
}

#[test]
fn hides_a_closed_tab_without_error_and_leaves_it_closed() {
    let app = app_with_windows(&["main"]);
    let id = open(&app, "main", "harborline");
    hide_tab(app.handle(), &id, 100).expect("hides");
    sweep(app.handle(), 100 + SLEEP_LIMIT_MS);
    let again = hide_tab(app.handle(), &id, 700_000).expect("hides again");
    assert_eq!(again.state, TabState::Closed);
    assert!(!again.is_shown);
}

#[test]
fn refuses_to_drive_a_closed_tab_with_its_own_code_and_still_places_and_closes_it() {
    let app = app_with_windows(&["main"]);
    let id = open(&app, "main", "harborline");
    hide_tab(app.handle(), &id, 100).expect("hides");
    sweep(app.handle(), 100 + SLEEP_LIMIT_MS);
    assert!(matches!(
        owned_tab(&webview(&app, "main"), &id),
        Err(MessageError::Failed(code)) if code == TAB_CLOSED
    ));
    assert!(place_tab(app.handle(), &id, PANE.rect()).is_ok());
    assert!(matches!(
        place_tab(app.handle(), "gone", PANE.rect()),
        Err(MessageError::Failed(code)) if code == TAB_GONE
    ));
    close_tab(app.handle(), &id).expect("closes");
    assert!(app.state::<BrowserRegistry>().is_empty());
}

#[test]
fn refuses_to_show_a_tab_that_is_gone() {
    let app = app_with_windows(&["main"]);
    assert!(matches!(
        show_tab(&window(&app, "main"), "gone", 100),
        Err(MessageError::Failed(code)) if code == TAB_GONE
    ));
}

#[test]
fn tells_the_owning_window_each_time_a_tab_changes_state() {
    let app = app_with_windows(&["main", "win-2"]);
    let heard = hear_states(&app);
    let id = open(&app, "main", "harborline");
    hide_tab(app.handle(), &id, 100).expect("hides");
    hide_tab(app.handle(), &id, 150).expect("hides again");
    sweep(app.handle(), 100 + SLEEP_LIMIT_MS);
    sweep(app.handle(), 200 + SLEEP_LIMIT_MS);
    show_tab(&window(&app, "main"), &id, 900_000).expect("shows");
    show_tab(&window(&app, "main"), &id, 900_100).expect("shows again");
    let expected: Vec<(String, String)> = ["asleep", "closed", "live"]
        .iter()
        .map(|state| (id.clone(), state.to_string()))
        .collect();
    assert_eq!(*heard.lock().expect("sink"), expected);
}

#[test]
fn tells_the_window_about_a_tab_closed_over_the_cap() {
    let app = app_with_windows(&["main"]);
    let heard = hear_states(&app);
    let ids: Vec<String> = (0..4).map(|_| open(&app, "main", "harborline")).collect();
    hide_tab(app.handle(), &ids[0], 100).expect("hides");
    open(&app, "main", "harborline");
    let heard = heard.lock().expect("sink");
    assert_eq!(
        *heard,
        vec![
            (ids[0].clone(), "asleep".to_string()),
            (ids[0].clone(), "closed".to_string())
        ]
    );
}

#[test]
fn keeps_a_closed_popup_in_the_registry_so_it_can_come_back() {
    let app = app_with_windows(&["main"]);
    let opener = open(&app, "main", "harborline");
    let seat = reserve_popup(app.handle(), &opener).expect("seat");
    let popup = fill_popup(app.handle(), &seat, url("https://example.com/")).expect("opens");
    sweep(
        app.handle(),
        popup.hidden_since_ms.expect("hidden") + SLEEP_LIMIT_MS,
    );
    assert_eq!(state_of(&app, &popup.id), Some(TabState::Closed));
    let shown = show_tab(&window(&app, "main"), &popup.id, 900_000).expect("shows");
    assert_eq!(shown.opener_id.as_deref(), Some(opener.as_str()));
    assert_eq!(shown.url, "https://example.com/");
}
