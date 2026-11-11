use std::sync::MutexGuard;
use std::time::Duration;

use tauri::{AppHandle, Emitter, EventTarget, Manager, Rect, Runtime, Url, Window};

use super::guard::{self, AppOrigins};
use super::host::{spawn_webview, webview_of};
use super::local;
use super::profile;
use super::reason::{self, INVALID_ADDRESS, NOT_WEB_ADDRESS, PROFILE_BUSY, TAB_GONE};
use super::registry::{BrowserRegistry, TabFacts, TabState};
use crate::util::{now_ms, MessageError};

pub(crate) const MAX_LIVE_TABS: usize = 4;
pub(crate) const SLEEP_LIMIT_MS: i64 = 10 * 60 * 1000;
pub(crate) const TAB_STATE_EVENT: &str = "browser://tab-state";

const SWEEP_EVERY: Duration = Duration::from_secs(30);

pub(crate) type Gate<'a> = MutexGuard<'a, ()>;

fn failed(error: tauri::Error) -> MessageError {
    MessageError::Failed(error.to_string())
}

pub(crate) fn start<R: Runtime>(app: AppHandle<R>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(SWEEP_EVERY);
        sweep(&app, now_ms());
    });
}

pub(crate) fn sweep<R: Runtime>(app: &AppHandle<R>, now_ms: i64) {
    let registry = app.state::<BrowserRegistry>();
    let gate = registry.gate();
    let ids = registry.expired(now_ms, SLEEP_LIMIT_MS);
    close_webviews(app, &ids, &gate);
}

pub(crate) fn enforce_cap<R: Runtime>(app: &AppHandle<R>, window_label: &str, gate: &Gate<'_>) {
    let ids = app
        .state::<BrowserRegistry>()
        .over_cap(window_label, MAX_LIVE_TABS);
    close_webviews(app, &ids, gate);
}

fn close_webviews<R: Runtime>(app: &AppHandle<R>, ids: &[String], _gate: &Gate<'_>) {
    let registry = app.state::<BrowserRegistry>();
    for id in ids {
        let Some(facts) = registry.mark_closed(id) else {
            continue;
        };
        let webview = app.get_webview(&guard::label_of(id));
        if let Some(live) = webview
            .as_ref()
            .and_then(crate::platform::web_url::live_url_of)
        {
            registry.set_url(id, &local::shown_address(&live));
        }
        let closed = match webview {
            Some(webview) => webview.close(),
            None => Ok(()),
        };
        if let Err(error) = closed {
            log::warn!("[browser] tab_close_failed reason={error}");
            registry.reopen_asleep(id);
            continue;
        }
        announce(app, &registry.facts(id).unwrap_or(facts));
    }
}

pub(crate) fn close_for_switch<R: Runtime>(
    app: &AppHandle<R>,
    ids: &[String],
    _gate: &Gate<'_>,
) -> Result<(), MessageError> {
    let registry = app.state::<BrowserRegistry>();
    close_switched(
        &registry,
        ids,
        |id| {
            let webview = app.get_webview(&guard::label_of(id));
            if let Some(live) = webview
                .as_ref()
                .and_then(crate::platform::web_url::live_url_of)
            {
                registry.set_url(id, &local::shown_address(&live));
            }
            match webview {
                Some(webview) => webview.close().map_err(failed),
                None => Ok(()),
            }
        },
        |facts| announce(app, facts),
    )
}

pub(crate) fn close_switched(
    registry: &BrowserRegistry,
    ids: &[String],
    mut close: impl FnMut(&str) -> Result<(), MessageError>,
    mut tell: impl FnMut(&TabFacts),
) -> Result<(), MessageError> {
    let mut stuck = false;
    for id in ids {
        let Some(before) = registry.mark_switched(id, now_ms()) else {
            continue;
        };
        if let Err(error) = close(id) {
            log::warn!("[browser] profile_switch_close_failed reason={error}");
            registry.restore(before);
            stuck = true;
            continue;
        }
        if let Some(facts) = registry.facts(id) {
            tell(&facts);
        }
    }
    match stuck {
        true => Err(reason::failed(PROFILE_BUSY)),
        false => Ok(()),
    }
}

fn announce<R: Runtime>(app: &AppHandle<R>, facts: &TabFacts) {
    let Some(window_label) = app.state::<BrowserRegistry>().window_of(&facts.id) else {
        return;
    };
    let _ = app.emit_to(
        EventTarget::webview_window(&window_label),
        TAB_STATE_EVENT,
        facts,
    );
}

pub(crate) fn show_tab<R: Runtime>(
    window: &Window<R>,
    tab_id: &str,
    now_ms: i64,
) -> Result<TabFacts, MessageError> {
    let app = window.app_handle();
    let registry = app.state::<BrowserRegistry>();
    let gate = registry.gate();
    let before = registry
        .state_of(tab_id)
        .ok_or_else(|| reason::failed(TAB_GONE))?;
    let facts = match before {
        TabState::Closed => recreate(window, tab_id, now_ms, &gate)?,
        TabState::Live | TabState::Asleep => {
            webview_of(app, tab_id)?.show().map_err(failed)?;
            registry
                .set_shown(tab_id, true, now_ms)
                .ok_or_else(|| reason::failed(TAB_GONE))?
        }
    };
    if facts.state != before {
        announce(app, &facts);
    }
    enforce_cap(app, window.label(), &gate);
    Ok(facts)
}

fn recreate<R: Runtime>(
    window: &Window<R>,
    tab_id: &str,
    now_ms: i64,
    gate: &Gate<'_>,
) -> Result<TabFacts, MessageError> {
    let app = window.app_handle();
    let registry = app.state::<BrowserRegistry>();
    let tab_profile = registry
        .profile_of(tab_id)
        .ok_or_else(|| reason::failed(TAB_GONE))?;
    let last = registry
        .facts(tab_id)
        .ok_or_else(|| reason::failed(TAB_GONE))?;
    let rect = registry
        .rect_of(tab_id)
        .ok_or_else(|| reason::failed(TAB_GONE))?;
    let url = Url::parse(&last.url).map_err(|_| reason::refused(INVALID_ADDRESS))?;
    let url = match local::is_file_address(&url) {
        true => local::reopen_url(&registry, tab_id, &url),
        false => Some(url).filter(|url| guard::may_open(url, &AppOrigins::of_app(app))),
    }
    .ok_or_else(|| reason::refused(NOT_WEB_ADDRESS))?;
    profile::prepare(app, &tab_profile)?;
    profile::activate(app, &tab_profile, gate)?;
    let webview = spawn_webview(window, tab_id, &tab_profile, &url, rect, true)?;
    registry.revive(tab_id, true, now_ms).ok_or_else(|| {
        let _ = webview.close();
        reason::failed(TAB_GONE)
    })
}

pub(crate) fn hide_tab<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: &str,
    now_ms: i64,
) -> Result<TabFacts, MessageError> {
    let registry = app.state::<BrowserRegistry>();
    let gate = registry.gate();
    let before = registry
        .state_of(tab_id)
        .ok_or_else(|| reason::failed(TAB_GONE))?;
    if before != TabState::Closed {
        webview_of(app, tab_id)?.hide().map_err(failed)?;
    }
    let facts = registry
        .set_shown(tab_id, false, now_ms)
        .ok_or_else(|| reason::failed(TAB_GONE))?;
    if facts.state != before {
        announce(app, &facts);
    }
    if let Some(window_label) = registry.window_of(tab_id) {
        enforce_cap(app, &window_label, &gate);
    }
    Ok(registry.facts(tab_id).unwrap_or(facts))
}

pub(crate) fn place_tab<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: &str,
    rect: Rect,
) -> Result<(), MessageError> {
    let registry = app.state::<BrowserRegistry>();
    let _gate = registry.gate();
    let state = registry
        .state_of(tab_id)
        .ok_or_else(|| reason::failed(TAB_GONE))?;
    if state != TabState::Closed {
        webview_of(app, tab_id)?.set_bounds(rect).map_err(failed)?;
    }
    registry.set_rect(tab_id, rect);
    Ok(())
}
