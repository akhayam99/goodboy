pub(crate) mod commands;
mod guard;
mod host;
mod lifecycle;
#[cfg(any(target_os = "macos", test))]
mod passkey;
mod profile;
mod reason;
mod registry;
pub(crate) mod tab_rows;

use tauri::ipc::Invoke;
use tauri::{AppHandle, Manager, Runtime};

pub(crate) use lifecycle::start as start_lifecycle;
pub(crate) use profile::BrowserProfiles;
pub(crate) use registry::BrowserRegistry;

pub(crate) fn forget_window<R: Runtime>(app: &AppHandle<R>, window_label: &str) {
    let removed = app.state::<BrowserRegistry>().remove_window(window_label);
    forget_passkey_watches(&removed);
}

#[cfg(target_os = "macos")]
fn forget_passkey_watches(tab_ids: &[String]) {
    for tab_id in tab_ids {
        passkey::WATCHES.forget(tab_id);
    }
}

#[cfg(not(target_os = "macos"))]
fn forget_passkey_watches(_tab_ids: &[String]) {}

pub(crate) fn refuse_browser_pages<R, F>(commands: F) -> impl Fn(Invoke<R>) -> bool + Send + Sync
where
    R: Runtime,
    F: Fn(Invoke<R>) -> bool + Send + Sync,
{
    move |invoke| {
        if guard::is_browser_label(invoke.message.webview_ref().label()) {
            invoke
                .resolver
                .reject(reason::refused(reason::BROWSER_CALLER));
            return true;
        }
        commands(invoke)
    }
}

#[cfg(test)]
mod tests;
