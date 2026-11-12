use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{
    get_ipc_response, mock_app, mock_builder, mock_context, noop_assets, MockRuntime, INVOKE_KEY,
};
use tauri::webview::InvokeRequest;
use tauri::{App, Listener, Manager, Url, Webview, WebviewUrl, WebviewWindowBuilder, Window};

use super::commands::{close_session, list_session, owned_tab};
use super::guard::label_of;
use super::host::{
    close_each, close_tab, fill_popup, load_local, open_tab, refresh_with, reserve_popup, OpenTab,
    SessionClosed, TabBounds, MAX_HIDDEN_POPUPS, TAB_OPENED_EVENT,
};
use super::lifecycle::{
    close_switched, hide_tab, place_tab, show_tab, sweep, SLEEP_LIMIT_MS, TAB_STATE_EVENT,
};
use super::local::{self, LocalFile};
use super::profile::{begin_clear, ProfileId};
use super::reason::{
    BROWSER_CALLER, INVALID_ADDRESS, NOT_WEB_ADDRESS, OTHER_WINDOW, PROFILE_BUSY, PROFILE_LIVE,
    SESSION_CLOSING, TAB_CLOSED, TAB_GONE, TOO_MANY_POPUPS,
};
use super::registry::{NewTab, TabState};
use super::{
    forget_window, refuse_browser_pages, start_lifecycle, BrowserProfiles, BrowserRegistry,
};
use crate::util::source_scan::production_hits;
use crate::util::{now_ms, uuid_v4, MessageError};

const PANE: TabBounds = TabBounds {
    x: 963.0,
    y: 36.0,
    width: 477.0,
    height: 864.0,
};

fn app_with_windows(labels: &[&str]) -> App<MockRuntime> {
    let app = mock_app();
    app.manage(BrowserRegistry::default());
    app.manage(BrowserProfiles::under(
        std::env::temp_dir().join(format!("goodboy-browser-test-{}", uuid_v4())),
    ));
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

fn northwind() -> ProfileId {
    ProfileId::of_workspace("northwind").expect("workspace id is valid")
}

fn acme() -> ProfileId {
    ProfileId::of_workspace("acme").expect("workspace id is valid")
}

fn open_for(
    app: &App<MockRuntime>,
    window_label: &str,
    profile: ProfileId,
    session_id: &str,
) -> String {
    open_tab(
        &window(app, window_label),
        OpenTab::at(
            session_id,
            profile,
            url("http://localhost:5173/"),
            PANE,
            true,
        ),
    )
    .expect("tab opens")
    .id
}

fn open(app: &App<MockRuntime>, window_label: &str, session_id: &str) -> String {
    open_for(app, window_label, northwind(), session_id)
}

#[cfg(target_os = "macos")]
#[test]
fn builds_every_tab_with_a_current_safari_user_agent() {
    use super::host::TAB_USER_AGENT;
    assert!(TAB_USER_AGENT.contains("AppleWebKit/605.1.15"));
    assert!(TAB_USER_AGENT.contains(" Version/26.0 "));
    assert!(TAB_USER_AGENT.ends_with(" Safari/605.1.15"));
    assert!(include_str!("host.rs").contains(".user_agent(TAB_USER_AGENT)"));
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
        OpenTab::at("harborline", northwind(), url("about:blank"), PANE, false),
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
            OpenTab::at("harborline", northwind(), url(address), PANE, true),
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
    app.manage(BrowserProfiles::under(
        std::env::temp_dir().join(format!("goodboy-browser-test-{}", uuid_v4())),
    ));
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
fn closes_the_session_tabs_of_every_window_and_no_other_session() {
    let app = app_with_windows(&["main", "win-2"]);
    let first = open(&app, "main", "harborline");
    let second = open(&app, "main", "harborline");
    let elsewhere = open(&app, "win-2", "harborline");
    let kept = open(&app, "main", "northwind");
    let kept_elsewhere = open(&app, "win-2", "northwind");
    let closed = close_session(&webview(&app, "main"), "harborline").expect("closes");
    assert_eq!(
        closed,
        SessionClosed {
            closed: 3,
            failed: vec![]
        }
    );
    let registry = app.state::<BrowserRegistry>();
    assert!(registry.facts(&first).is_none());
    assert!(registry.facts(&second).is_none());
    assert!(registry.facts(&elsewhere).is_none());
    assert!(app.get_webview(&label_of(&first)).is_none());
    assert!(app.get_webview(&label_of(&elsewhere)).is_none());
    assert_eq!(registry.ids_of_session("northwind", "main"), vec![kept]);
    assert_eq!(
        registry.ids_of_session("northwind", "win-2"),
        vec![kept_elsewhere]
    );
}

#[test]
fn refuses_a_tab_that_started_opening_in_another_window_before_the_session_closed() {
    let app = app_with_windows(&["main", "win-2"]);
    let registry = app.state::<BrowserRegistry>();
    let generation = registry.generation("harborline", "win-2");
    close_session(&webview(&app, "main"), "harborline").expect("closes");
    let mut stale = OpenTab::at(
        "harborline",
        northwind(),
        url("http://localhost:5173/"),
        PANE,
        true,
    );
    stale.generation = Some(generation);
    assert!(matches!(
        open_tab(&window(&app, "win-2"), stale),
        Err(MessageError::Refused(code)) if code == SESSION_CLOSING
    ));
    assert!(registry.is_empty());
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
    let seats: Vec<_> = (0..MAX_HIDDEN_POPUPS)
        .map(|_| reserve_popup(app.handle(), &opener).expect("seat"))
        .collect();
    assert!(matches!(
        reserve_popup(app.handle(), &opener),
        Err(MessageError::Refused(code)) if code == TOO_MANY_POPUPS
    ));
    for seat in &seats {
        let facts = fill_popup(app.handle(), seat, url("https://example.com/")).expect("opens");
        assert!(!facts.is_shown);
        assert_eq!(facts.session_id, "harborline");
        assert_eq!(facts.opener_id.as_deref(), Some(opener.as_str()));
        assert_eq!(webview(&app, &label_of(&facts.id)).window().label(), "main");
    }
    assert_eq!(heard.load(Ordering::SeqCst), MAX_HIDDEN_POPUPS);
    assert_eq!(
        app.state::<BrowserRegistry>()
            .ids_of_session("harborline", "main")
            .len(),
        MAX_HIDDEN_POPUPS + 1
    );
}

#[test]
fn frees_a_popup_seat_when_the_cap_closes_a_popup() {
    let app = app_with_windows(&["main"]);
    let opener = open(&app, "main", "harborline");
    let seats: Vec<_> = (0..MAX_HIDDEN_POPUPS)
        .map(|_| reserve_popup(app.handle(), &opener).expect("seat"))
        .collect();
    assert!(reserve_popup(app.handle(), &opener).is_err());
    let opened: Vec<_> = seats
        .iter()
        .map(|seat| fill_popup(app.handle(), seat, url("https://example.com/")).expect("opens"))
        .collect();
    assert_eq!(state_of(&app, &opened[0].id), Some(TabState::Closed));
    assert!(reserve_popup(app.handle(), &opener).is_ok());
    show_tab(&window(&app, "main"), &opened[1].id, 5_000).expect("shows");
    assert_eq!(state_of(&app, &opened[1].id), Some(TabState::Live));
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
        .close_session("harborline", &["main".to_string()]);
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
    registry.close_session("harborline", &["main".to_string()]);
    let mut stale = OpenTab::at(
        "harborline",
        northwind(),
        url("http://localhost:5173/"),
        PANE,
        true,
    );
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

#[cfg(target_os = "macos")]
#[test]
fn forgets_the_passkey_watch_of_a_destroyed_window_tab() {
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    let app = app_with_windows(&["main", "win-2"]);
    let id = open(&app, "win-2", "harborline");
    let calls = Arc::new(AtomicUsize::new(0));
    let counted = Arc::clone(&calls);
    let handler = 0x5eed_0001;
    super::passkey::WATCHES.watch(
        handler,
        &id,
        Arc::new(move || {
            counted.fetch_add(1, Ordering::SeqCst);
        }),
    );
    forget_window(app.handle(), "win-2");
    assert!(!super::passkey::WATCHES.ask(handler));
    assert_eq!(calls.load(Ordering::SeqCst), 0);
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

fn hear_window(app: &App<MockRuntime>, label: &str) -> Arc<Mutex<Vec<String>>> {
    let heard = Arc::new(Mutex::new(vec![]));
    let sink = Arc::clone(&heard);
    app.get_webview_window(label)
        .expect("window that holds no tab yet")
        .listen(TAB_STATE_EVENT, move |event| {
            let payload: serde_json::Value =
                serde_json::from_str(event.payload()).expect("payload is json");
            sink.lock()
                .expect("sink")
                .push(payload["state"].as_str().expect("state").to_string());
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
    webview(&app, &label_of(&id))
        .navigate(url("http://localhost:5173/pricing"))
        .expect("same document move");
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
    webview(&app, &label_of(&id))
        .navigate(url("http://localhost:5173/pricing"))
        .expect("same document move");
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

fn local_plan() -> (std::path::PathBuf, LocalFile) {
    let root = std::env::temp_dir().join(format!("goodboy-browser-local-{}", uuid_v4()));
    std::fs::create_dir_all(root.join("harborline")).expect("folder");
    let plan = root.join("harborline/plan.html");
    std::fs::write(&plan, "<title>Plan</title>").expect("page");
    let file = local::resolve(plan.to_str().expect("utf8"), None).expect("plan resolves");
    (root, file)
}

fn open_local(app: &App<MockRuntime>, file: &LocalFile) -> String {
    let blank = open_tab(
        &window(app, "main"),
        OpenTab::at("harborline", northwind(), url("about:blank"), PANE, true),
    )
    .expect("blank tab opens");
    load_local(app.handle(), &blank.id, file).expect("local page loads");
    blank.id
}

#[test]
fn loads_a_typed_local_file_through_a_grant_of_its_own_tab() {
    let app = app_with_windows(&["main"]);
    let (root, file) = local_plan();
    let id = open_local(&app, &file);
    let registry = app.state::<BrowserRegistry>();
    let shown = Url::from_file_path(&file.path).expect("file address");
    assert_eq!(registry.facts(&id).expect("facts").url, shown.as_str());
    let live = webview(&app, &label_of(&id)).url().expect("live url");
    let (token, path) = local::split_live(&live).expect("live address is local");
    assert_eq!(path, file.path);
    assert!(local::may_load(&registry, &id, &live));
    let other = open(&app, "main", "harborline");
    assert!(!local::may_load(&registry, &other, &live));
    assert_eq!(
        registry.list("harborline", "main")[0].url,
        shown.as_str(),
        "a listing shows the file address, never the token"
    );
    close_tab(app.handle(), &id).expect("closes");
    assert_eq!(registry.local_grant(&id, &token), None);
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn shows_a_closed_local_tab_again_at_its_file_through_the_same_grant() {
    let app = app_with_windows(&["main"]);
    let (root, file) = local_plan();
    let id = open_local(&app, &file);
    let page = webview(&app, &label_of(&id));
    let moved = local::routed(
        page.url().expect("live url"),
        Some("step=2"),
        Some("/checkout"),
    );
    page.navigate(moved).expect("same document move");
    let before = webview(&app, &label_of(&id)).url().expect("live url");
    let shown = local::routed(
        Url::from_file_path(&file.path).expect("file address"),
        Some("step=2"),
        Some("/checkout"),
    );
    let listed = list_session(&webview(&app, "main"), "harborline").expect("lists");
    assert_eq!(listed[0].url, shown.as_str());
    hide_tab(app.handle(), &id, 100).expect("hides");
    sweep(app.handle(), 100 + SLEEP_LIMIT_MS);
    assert!(!is_live_webview(&app, &id));

    let facts = show_tab(&window(&app, "main"), &id, 900_000).expect("shows");
    assert_eq!(facts.url, shown.as_str());
    let after = webview(&app, &label_of(&id)).url().expect("live url");
    assert_eq!(after, before);
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn refuses_to_open_a_file_address_as_a_web_tab() {
    let app = app_with_windows(&["main"]);
    let (root, file) = local_plan();
    let shown = Url::from_file_path(&file.path).expect("file address");
    let refused = open_tab(
        &window(&app, "main"),
        OpenTab::at("harborline", northwind(), shown, PANE, true),
    );
    assert!(matches!(refused, Err(MessageError::Refused(ref code)) if code == NOT_WEB_ADDRESS));
    let _ = std::fs::remove_dir_all(root);
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
    let main_heard = hear_window(&app, "main");
    let other_heard = hear_window(&app, "win-2");
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
    assert_eq!(
        *main_heard.lock().expect("sink"),
        vec!["asleep", "closed", "live"]
    );
    assert!(other_heard.lock().expect("sink").is_empty());
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

#[test]
fn answers_and_announces_a_popup_the_cap_closed_as_closed() {
    let app = app_with_windows(&["main"]);
    let shown: Vec<String> = (0..4).map(|_| open(&app, "main", "harborline")).collect();
    let states = hear_states(&app);
    let opened = Arc::new(Mutex::new(vec![]));
    let sink = Arc::clone(&opened);
    app.listen_any(TAB_OPENED_EVENT, move |event| {
        let payload: serde_json::Value =
            serde_json::from_str(event.payload()).expect("payload is json");
        sink.lock()
            .expect("sink")
            .push(payload["state"].as_str().expect("state").to_string());
    });
    let seat = reserve_popup(app.handle(), &shown[0]).expect("seat");
    let popup = fill_popup(app.handle(), &seat, url("https://example.com/")).expect("opens");
    assert_eq!(popup.state, TabState::Closed);
    assert_eq!(state_of(&app, &popup.id), Some(TabState::Closed));
    assert!(!is_live_webview(&app, &popup.id));
    assert!(shown.iter().all(|id| is_live_webview(&app, id)));
    assert_eq!(
        *states.lock().expect("sink"),
        vec![(popup.id.clone(), "closed".to_string())]
    );
    assert_eq!(*opened.lock().expect("sink"), vec!["closed"]);
    assert!(reserve_popup(app.handle(), &shown[0]).is_ok());
}

#[test]
fn keeps_a_tab_closed_when_it_cannot_be_rebuilt_and_shows_it_once_the_address_is_fixed() {
    let app = app_with_windows(&["main"]);
    let id = open(&app, "main", "harborline");
    let registry = app.state::<BrowserRegistry>();
    hide_tab(app.handle(), &id, 100).expect("hides");
    sweep(app.handle(), 100 + SLEEP_LIMIT_MS);
    for (stored, code) in [
        ("not an address", INVALID_ADDRESS),
        ("javascript:alert(1)", NOT_WEB_ADDRESS),
        ("tauri://localhost/", NOT_WEB_ADDRESS),
    ] {
        registry.set_url(&id, stored);
        assert!(
            matches!(
                show_tab(&window(&app, "main"), &id, 900_000),
                Err(MessageError::Refused(ref refused)) if refused == code
            ),
            "{stored}"
        );
        assert_eq!(state_of(&app, &id), Some(TabState::Closed), "{stored}");
        assert!(!is_live_webview(&app, &id), "{stored}");
    }
    registry.set_url(&id, "http://localhost:5173/pricing");
    let facts = show_tab(&window(&app, "main"), &id, 900_100).expect("shows");
    assert_eq!(facts.state, TabState::Live);
    assert!(is_live_webview(&app, &id));
}

#[test]
fn keeps_the_address_the_page_moved_to_when_the_sweep_closes_it_before_any_listing() {
    let app = app_with_windows(&["main"]);
    let id = open(&app, "main", "harborline");
    webview(&app, &label_of(&id))
        .navigate(url("http://localhost:5173/pricing#plans"))
        .expect("same document move");
    hide_tab(app.handle(), &id, 100).expect("hides");
    sweep(app.handle(), 100 + SLEEP_LIMIT_MS);
    assert!(!is_live_webview(&app, &id));
    let facts = show_tab(&window(&app, "main"), &id, 900_000).expect("shows");
    assert_eq!(facts.url, "http://localhost:5173/pricing#plans");
}

#[test]
fn closes_the_tab_that_was_hidden_when_a_fifth_shown_tab_already_went_over_the_cap() {
    let app = app_with_windows(&["main"]);
    let ids: Vec<String> = (0..5).map(|_| open(&app, "main", "harborline")).collect();
    let heard = hear_states(&app);
    let hidden = hide_tab(app.handle(), &ids[0], 100).expect("hides");
    assert_eq!(hidden.state, TabState::Closed);
    assert!(!is_live_webview(&app, &ids[0]));
    assert!(ids[1..].iter().all(|id| is_live_webview(&app, id)));
    assert_eq!(
        *heard.lock().expect("sink"),
        vec![
            (ids[0].clone(), "asleep".to_string()),
            (ids[0].clone(), "closed".to_string())
        ]
    );
}

#[test]
fn keeps_the_old_place_when_the_webview_would_not_take_the_new_one() {
    let app = app_with_windows(&["main"]);
    let registry = app.state::<BrowserRegistry>();
    registry.insert(NewTab {
        id: "orphan",
        session_id: "harborline",
        window_label: "main",
        profile: northwind(),
        url: "http://localhost:5173/",
        rect: PANE.rect(),
        is_shown: false,
        opener_id: None,
        now_ms: 100,
    });
    let moved = TabBounds {
        x: 0.0,
        y: 0.0,
        width: 10.0,
        height: 10.0,
    };
    assert!(matches!(
        place_tab(app.handle(), "orphan", moved.rect()),
        Err(MessageError::Failed(code)) if code == TAB_GONE
    ));
    assert_eq!(
        format!("{:?}", registry.rect_of("orphan")),
        format!("{:?}", Some(PANE.rect()))
    );
}

#[test]
fn ends_consistent_when_a_sweep_and_a_close_cross_paths() {
    let app = app_with_windows(&["main"]);
    let first = open(&app, "main", "harborline");
    let second = open(&app, "main", "harborline");
    hide_tab(app.handle(), &first, 100).expect("hides");
    hide_tab(app.handle(), &second, 100).expect("hides");
    let registry = app.state::<BrowserRegistry>();
    let ids = registry.close_session("harborline", &["main".to_string()]);
    sweep(app.handle(), 100 + SLEEP_LIMIT_MS);
    assert_eq!(state_of(&app, &first), Some(TabState::Closed));
    let closed = close_each(&ids, |id| close_tab(app.handle(), id));
    assert_eq!(
        closed,
        SessionClosed {
            closed: 2,
            failed: vec![]
        }
    );
    assert!(registry.is_empty());
    assert!(!is_live_webview(&app, &first));
    assert!(!is_live_webview(&app, &second));

    let third = open(&app, "main", "harborline");
    hide_tab(app.handle(), &third, 200).expect("hides");
    close_tab(app.handle(), &third).expect("closes");
    sweep(app.handle(), 200 + SLEEP_LIMIT_MS);
    assert!(registry.is_empty());
}

#[test]
fn opening_in_another_workspace_closes_the_first_workspace_s_views() {
    let app = app_with_windows(&["main"]);
    let first = open_for(&app, "main", northwind(), "harborline");
    let second = open_for(&app, "main", northwind(), "harborline");
    let other = open_for(&app, "main", acme(), "cascadia");
    assert_eq!(state_of(&app, &first), Some(TabState::Closed));
    assert_eq!(state_of(&app, &second), Some(TabState::Closed));
    assert!(!is_live_webview(&app, &first));
    assert!(!is_live_webview(&app, &second));
    assert_eq!(state_of(&app, &other), Some(TabState::Live));
    assert!(is_live_webview(&app, &other));
    let listed = app.state::<BrowserRegistry>().list("harborline", "main");
    assert_eq!(listed.len(), 2);
    assert!(listed.iter().all(|facts| !facts.is_shown));
}

#[test]
fn keeps_every_view_of_one_workspace_running_together() {
    let app = app_with_windows(&["main"]);
    let first = open_for(&app, "main", northwind(), "harborline");
    let second = open_for(&app, "main", northwind(), "payments");
    assert!(is_live_webview(&app, &first));
    assert!(is_live_webview(&app, &second));
}

#[test]
fn runs_one_workspace_at_a_time_across_windows() {
    let app = app_with_windows(&["main", "win-2"]);
    let first = open_for(&app, "main", northwind(), "harborline");
    let other = open_for(&app, "win-2", acme(), "cascadia");
    assert_eq!(state_of(&app, &first), Some(TabState::Closed));
    assert!(!is_live_webview(&app, &first));
    assert!(is_live_webview(&app, &other));
}

#[test]
fn brings_a_closed_view_back_under_the_same_id_and_closes_the_other_workspace() {
    let app = app_with_windows(&["main"]);
    let first = open_for(&app, "main", northwind(), "harborline");
    let other = open_for(&app, "main", acme(), "cascadia");
    let facts = show_tab(&window(&app, "main"), &first, now_ms()).expect("shows");
    assert_eq!(facts.id, first);
    assert_eq!(facts.state, TabState::Live);
    assert!(is_live_webview(&app, &first));
    assert_eq!(state_of(&app, &other), Some(TabState::Closed));
    assert!(!is_live_webview(&app, &other));
}

#[test]
fn announces_the_views_a_switch_closed() {
    let app = app_with_windows(&["main"]);
    let heard = hear_states(&app);
    let first = open_for(&app, "main", northwind(), "harborline");
    open_for(&app, "main", acme(), "cascadia");
    assert_eq!(
        *heard.lock().expect("sink"),
        vec![(first, "closed".to_string())]
    );
}

#[test]
fn a_popup_opens_in_the_workspace_of_its_opener() {
    let app = app_with_windows(&["main"]);
    let opener = open_for(&app, "main", acme(), "cascadia");
    let seat = reserve_popup(app.handle(), &opener).expect("seat");
    assert_eq!(seat.profile, acme());
    let facts = fill_popup(app.handle(), &seat, url("https://example.com/")).expect("popup opens");
    assert_eq!(
        app.state::<BrowserRegistry>().profile_of(&facts.id),
        Some(acme())
    );
    assert!(is_live_webview(&app, &opener));
}

#[test]
fn refuses_to_clear_a_workspace_that_has_a_live_view() {
    let app = app_with_windows(&["main"]);
    let id = open_for(&app, "main", northwind(), "harborline");
    assert!(matches!(
        begin_clear(app.handle(), "northwind"),
        Err(MessageError::Refused(code)) if code == PROFILE_LIVE
    ));
    hide_tab(app.handle(), &id, now_ms()).expect("hides");
    assert!(matches!(
        begin_clear(app.handle(), "northwind"),
        Err(MessageError::Refused(code)) if code == PROFILE_LIVE
    ));
}

#[test]
fn clears_a_workspace_once_its_views_are_closed() {
    let app = app_with_windows(&["main"]);
    let id = open_for(&app, "main", northwind(), "harborline");
    open_for(&app, "main", acme(), "cascadia");
    assert_eq!(state_of(&app, &id), Some(TabState::Closed));
    assert!(begin_clear(app.handle(), "northwind").is_ok());
    assert!(begin_clear(app.handle(), "acme").is_err());
}

#[test]
fn leaves_other_workspaces_alone_while_one_is_clearing() {
    let app = app_with_windows(&["main"]);
    let lease = begin_clear(app.handle(), "northwind").expect("nothing is live");
    let other = open_for(&app, "main", acme(), "cascadia");
    assert!(is_live_webview(&app, &other));
    drop(lease);
    assert!(begin_clear(app.handle(), "northwind").is_ok());
}

#[test]
fn refuses_to_open_or_bring_back_a_view_while_its_workspace_clears() {
    let app = app_with_windows(&["main"]);
    let id = open_for(&app, "main", northwind(), "harborline");
    open_for(&app, "main", acme(), "cascadia");
    let lease = begin_clear(app.handle(), "northwind").expect("northwind is closed");
    let refused = open_tab(
        &window(&app, "main"),
        OpenTab::at(
            "harborline",
            northwind(),
            url("http://localhost:5173/"),
            PANE,
            true,
        ),
    );
    assert!(matches!(refused, Err(MessageError::Refused(code)) if code == PROFILE_BUSY));
    assert!(matches!(
        show_tab(&window(&app, "main"), &id, now_ms()),
        Err(MessageError::Refused(code)) if code == PROFILE_BUSY
    ));
    assert_eq!(state_of(&app, &id), Some(TabState::Closed));
    drop(lease);
    assert!(show_tab(&window(&app, "main"), &id, now_ms()).is_ok());
}

#[test]
fn clearing_twice_at_once_is_refused() {
    let app = app_with_windows(&["main"]);
    let lease = begin_clear(app.handle(), "northwind").expect("first");
    assert!(matches!(
        begin_clear(app.handle(), "northwind"),
        Err(MessageError::Refused(code)) if code == PROFILE_BUSY
    ));
    drop(lease);
}

#[test]
fn refuses_to_clear_a_blank_workspace() {
    let app = app_with_windows(&["main"]);
    assert!(matches!(
        begin_clear(app.handle(), " "),
        Err(MessageError::Refused(_))
    ));
}

pub(super) fn seed_local_tab(registry: &BrowserRegistry, id: &str) {
    seed_tab(registry, id, northwind(), true);
}

fn seed_tab(registry: &BrowserRegistry, id: &str, profile: ProfileId, is_shown: bool) {
    registry.insert(NewTab {
        id,
        session_id: "harborline",
        window_label: "main",
        profile,
        url: "http://localhost:5173/",
        rect: PANE.rect(),
        is_shown,
        opener_id: None,
        now_ms: 100,
    });
}

#[test]
fn a_switch_that_cannot_close_one_view_restores_it_and_closes_the_rest() {
    let registry = BrowserRegistry::default();
    seed_tab(&registry, "ledger-core", northwind(), false);
    seed_tab(&registry, "notify-relay", northwind(), true);
    seed_tab(&registry, "payments-api", northwind(), false);
    let ids: Vec<String> = ["ledger-core", "notify-relay", "payments-api"]
        .iter()
        .map(|id| id.to_string())
        .collect();
    let stuck_before = registry.facts("notify-relay").expect("tab exists");
    assert_eq!(stuck_before.state, TabState::Live);
    assert!(stuck_before.is_shown);
    let told = Mutex::new(Vec::new());
    let result = close_switched(
        &registry,
        &ids,
        |id| match id {
            "notify-relay" => Err(MessageError::Failed("webview-stuck".to_string())),
            _ => Ok(()),
        },
        |facts| told.lock().expect("sink").push(facts.id.clone()),
    );
    assert!(matches!(result, Err(MessageError::Failed(code)) if code == PROFILE_BUSY));
    assert_eq!(registry.facts("notify-relay"), Some(stuck_before));
    assert_eq!(registry.state_of("ledger-core"), Some(TabState::Closed));
    assert_eq!(registry.state_of("payments-api"), Some(TabState::Closed));
    assert_eq!(
        *told.lock().expect("sink"),
        vec!["ledger-core".to_string(), "payments-api".to_string()]
    );
}

#[test]
fn a_switch_retried_after_a_stuck_view_closes_it() {
    let registry = BrowserRegistry::default();
    seed_tab(&registry, "ledger-core", northwind(), true);
    let ids = vec!["ledger-core".to_string()];
    let stuck = close_switched(
        &registry,
        &ids,
        |_| Err(MessageError::Failed("webview-stuck".to_string())),
        |_| {},
    );
    assert!(stuck.is_err());
    assert_eq!(registry.state_of("ledger-core"), Some(TabState::Live));
    let retried = close_switched(&registry, &ids, |_| Ok(()), |_| {});
    assert!(retried.is_ok());
    assert_eq!(registry.state_of("ledger-core"), Some(TabState::Closed));
}

#[test]
fn a_stale_open_closes_no_view_of_the_running_workspace() {
    let app = app_with_windows(&["main"]);
    let running = open_for(&app, "main", acme(), "cascadia");
    let registry = app.state::<BrowserRegistry>();
    let generation = registry.generation("harborline", "main");
    registry.close_session("harborline", &["main".to_string()]);
    let mut stale = OpenTab::at(
        "harborline",
        northwind(),
        url("http://localhost:5173/"),
        PANE,
        true,
    );
    stale.generation = Some(generation);
    assert!(matches!(
        open_tab(&window(&app, "main"), stale),
        Err(MessageError::Refused(code)) if code == SESSION_CLOSING
    ));
    assert_eq!(state_of(&app, &running), Some(TabState::Live));
    assert!(is_live_webview(&app, &running));
}

#[test]
fn an_open_that_waited_for_the_gate_does_not_outlive_a_session_close() {
    let app = app_with_windows(&["main"]);
    let registry = app.state::<BrowserRegistry>();
    let main = window(&app, "main");
    let gate = registry.gate();
    let opened = std::thread::scope(|scope| {
        let waiting = scope.spawn(|| {
            open_tab(
                &main,
                OpenTab::at(
                    "harborline",
                    northwind(),
                    url("http://localhost:5173/"),
                    PANE,
                    true,
                ),
            )
        });
        std::thread::sleep(Duration::from_millis(200));
        registry.close_session("harborline", &["main".to_string()]);
        drop(gate);
        waiting.join().expect("open thread")
    });
    assert!(matches!(
        opened,
        Err(MessageError::Refused(code)) if code == SESSION_CLOSING
    ));
    assert!(registry.is_empty());
    assert_eq!(app.webviews().len(), 1);
}

#[test]
fn a_popup_open_whose_opener_was_switched_out_closes_no_view() {
    let app = app_with_windows(&["main"]);
    let opener = open_for(&app, "main", acme(), "cascadia");
    let running = open_for(&app, "main", northwind(), "harborline");
    assert_eq!(state_of(&app, &opener), Some(TabState::Closed));
    let mut popup = OpenTab::at("cascadia", acme(), url("https://example.com/"), PANE, false);
    popup.opener_id = Some(&opener);
    assert!(matches!(
        open_tab(&window(&app, "main"), popup),
        Err(MessageError::Failed(code)) if code == TAB_GONE
    ));
    assert_eq!(state_of(&app, &running), Some(TabState::Live));
    assert!(is_live_webview(&app, &running));
}

#[test]
fn tells_the_window_the_address_a_hidden_page_moved_to_when_the_sweep_closes_it() {
    let app = app_with_windows(&["main"]);
    let heard = Arc::new(Mutex::new(Vec::new()));
    let sink = Arc::clone(&heard);
    app.listen_any(TAB_STATE_EVENT, move |event| {
        let payload: serde_json::Value =
            serde_json::from_str(event.payload()).expect("payload is json");
        sink.lock().expect("sink").push((
            payload["state"].as_str().expect("state").to_string(),
            payload["url"].as_str().expect("url").to_string(),
        ));
    });
    let id = open(&app, "main", "harborline");
    hide_tab(app.handle(), &id, 100).expect("hides");
    webview(&app, &label_of(&id))
        .navigate(url("http://localhost:5173/pricing#plans"))
        .expect("same document move");
    sweep(app.handle(), 100 + SLEEP_LIMIT_MS);
    assert_eq!(
        heard.lock().expect("sink").last(),
        Some(&(
            "closed".to_string(),
            "http://localhost:5173/pricing#plans".to_string()
        ))
    );
}

#[test]
fn a_switch_does_not_touch_a_view_that_is_already_closed() {
    let registry = BrowserRegistry::default();
    seed_tab(&registry, "ledger-core", northwind(), false);
    registry.mark_closed("ledger-core");
    let calls = AtomicUsize::new(0);
    let result = close_switched(
        &registry,
        &["ledger-core".to_string()],
        |_| {
            calls.fetch_add(1, Ordering::SeqCst);
            Ok(())
        },
        |_| {},
    );
    assert!(result.is_ok());
    assert_eq!(calls.load(Ordering::SeqCst), 0);
}

#[test]
fn a_popup_whose_opener_was_switched_out_fails_and_leaves_no_view() {
    let app = app_with_windows(&["main"]);
    let opener = open_for(&app, "main", acme(), "cascadia");
    let seat = reserve_popup(app.handle(), &opener).expect("seat");
    let other = open_for(&app, "main", northwind(), "harborline");
    assert_eq!(state_of(&app, &opener), Some(TabState::Closed));
    let before = app.webviews().len();
    let late = fill_popup(app.handle(), &seat, url("https://example.com/"));
    assert!(matches!(late, Err(MessageError::Failed(code)) if code == TAB_GONE));
    assert_eq!(app.webviews().len(), before);
    assert!(is_live_webview(&app, &other));
    assert_eq!(
        app.state::<BrowserRegistry>()
            .ids_of_session("cascadia", "main"),
        vec![opener]
    );
}

#[cfg(not(target_os = "macos"))]
#[test]
fn keeps_the_running_workspace_when_the_new_one_has_no_folder() {
    let app = app_with_windows(&["main"]);
    let running = open_for(&app, "main", northwind(), "harborline");
    let blocked = app
        .state::<BrowserProfiles>()
        .dir_of(&acme())
        .expect("folder path");
    std::fs::create_dir_all(blocked.parent().expect("parent")).expect("parent folder");
    std::fs::write(&blocked, b"file").expect("blocking file");
    let failed = open_tab(
        &window(&app, "main"),
        OpenTab::at(
            "cascadia",
            acme(),
            url("http://localhost:5173/"),
            PANE,
            true,
        ),
    );
    assert!(matches!(failed, Err(MessageError::Failed(_))));
    assert_eq!(state_of(&app, &running), Some(TabState::Live));
    assert!(is_live_webview(&app, &running));
    let facts = app
        .state::<BrowserRegistry>()
        .facts(&running)
        .expect("facts");
    assert!(facts.is_shown);
}

#[test]
fn keeps_the_saved_address_when_a_page_has_none_yet() {
    let registry = BrowserRegistry::default();
    seed_tab(&registry, "ledger-core", northwind(), true);
    let saved = registry.facts("ledger-core").expect("tab exists");
    let listed = refresh_with(&registry, vec![saved.clone()], |_| None);
    assert_eq!(listed, vec![saved.clone()]);
    assert_eq!(registry.facts("ledger-core"), Some(saved));
}
