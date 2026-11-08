pub(crate) mod commands;
mod guard;
mod host;
mod registry;

use tauri::{AppHandle, Manager, Runtime};

pub(crate) use registry::BrowserRegistry;

pub(crate) fn forget_window<R: Runtime>(app: &AppHandle<R>, window_label: &str) {
    app.state::<BrowserRegistry>().remove_window(window_label);
}

#[cfg(test)]
mod tests;
