use serde::Serialize;
use tauri::{AppHandle, Emitter, EventTarget, Manager, Runtime, Webview};

use super::guard;
use super::reason::{self, TAB_GONE};
use super::registry::{BrowserRegistry, PasskeySeat};
use crate::util::MessageError;

pub(crate) const PASSKEY_COMMAND: &str = "browser_passkey_asked";
pub(crate) const PASSKEY_EVENT: &str = "browser://passkey";

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub(crate) const PASSKEY_SCRIPT: &str = r#"(() => {
  const credentials = window.navigator.credentials;
  if (credentials == null) {
    return;
  }
  const internals = window.__TAURI_INTERNALS__;
  let wasTold = false;
  const tell = () => {
    const channel = internals ?? window.__TAURI_INTERNALS__;
    if (wasTold || channel == null || typeof channel.invoke !== 'function') {
      return;
    }
    wasTold = true;
    try {
      Promise.resolve(channel.invoke('browser_passkey_asked')).catch(() => undefined);
    } catch {
      return;
    }
  };
  const isPasskeyAsk = (options) =>
    options != null && options.publicKey != null && options.mediation !== 'conditional';
  const wrap = (name) => {
    const original = credentials[name];
    if (typeof original !== 'function') {
      return;
    }
    credentials[name] = function (options) {
      if (isPasskeyAsk(options)) {
        tell();
      }
      return original.apply(this, arguments);
    };
  };
  wrap('get');
  wrap('create');
})();"#;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PasskeyAsk {
    pub(crate) tab_id: String,
    pub(crate) session_id: String,
    pub(crate) host: String,
    pub(crate) is_asked: bool,
}

impl PasskeyAsk {
    fn of(tab_id: &str, seat: &PasskeySeat, host: String, is_asked: bool) -> Self {
        Self {
            tab_id: tab_id.to_string(),
            session_id: seat.session_id.clone(),
            host,
            is_asked,
        }
    }
}

fn tell<R: Runtime>(app: &AppHandle<R>, seat: &PasskeySeat, ask: &PasskeyAsk) {
    if let Err(error) = app.emit_to(
        EventTarget::webview_window(&seat.window_label),
        PASSKEY_EVENT,
        ask,
    ) {
        log::warn!(
            "[browser] passkey_event_failed tab={} reason={error}",
            ask.tab_id
        );
    }
}

fn host_of<R: Runtime>(webview: &Webview<R>, tab_id: &str) -> String {
    let live = webview.url().ok();
    let known = webview
        .state::<BrowserRegistry>()
        .facts(tab_id)
        .and_then(|facts| tauri::Url::parse(&facts.url).ok());
    live.or(known)
        .and_then(|url| url.host_str().map(str::to_string))
        .unwrap_or_default()
}

pub(crate) fn note_ask<R: Runtime>(caller: &Webview<R>) -> Result<(), MessageError> {
    let tab_id = guard::tab_id_of(caller.label()).ok_or_else(|| reason::failed(TAB_GONE))?;
    let registry = caller.state::<BrowserRegistry>();
    let Some(seat) = registry.mark_passkey_asked(tab_id) else {
        return Ok(());
    };
    let ask = PasskeyAsk::of(tab_id, &seat, host_of(caller, tab_id), true);
    tell(caller.app_handle(), &seat, &ask);
    Ok(())
}

pub(crate) fn clear_on_load<R: Runtime>(app: &AppHandle<R>, tab_id: &str) {
    let Some(seat) = app.state::<BrowserRegistry>().clear_passkey_asked(tab_id) else {
        return;
    };
    tell(
        app,
        &seat,
        &PasskeyAsk::of(tab_id, &seat, String::new(), false),
    );
}

#[tauri::command]
pub(crate) fn browser_passkey_asked<R: Runtime>(webview: Webview<R>) -> Result<(), MessageError> {
    note_ask(&webview)
}
