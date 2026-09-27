use tauri::menu::{Menu, MenuItem, Submenu, HELP_SUBMENU_ID};
use tauri::{AppHandle, Emitter, EventTarget, Manager, Runtime};

pub const REPORT_ITEM_ID: &str = "goodboy-report-bug";
pub const REPORT_OPEN_EVENT: &str = "goodboy://report-open";
const REPORT_LABEL: &str = "Report a bug";
const REPORT_ACCELERATOR: &str = "CmdOrCtrl+I";

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = Menu::default(app)?;
    let item = MenuItem::with_id(
        app,
        REPORT_ITEM_ID,
        REPORT_LABEL,
        true,
        Some(REPORT_ACCELERATOR),
    )?;
    match menu
        .get(HELP_SUBMENU_ID)
        .and_then(|kind| kind.as_submenu().cloned())
    {
        Some(help) => help.append(&item)?,
        None => {
            let help = Submenu::with_id_and_items(app, HELP_SUBMENU_ID, "Help", true, &[&item])?;
            menu.append(&help)?;
        }
    }
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        if event.id() == REPORT_ITEM_ID {
            open_report_in_focused_window(app);
        }
    });
    Ok(())
}

fn open_report_in_focused_window<R: Runtime>(app: &AppHandle<R>) {
    let windows = app.webview_windows();
    let focused = windows
        .values()
        .find(|window| window.is_focused().unwrap_or(false))
        .or_else(|| windows.values().next());
    if let Some(window) = focused {
        let _ = app.emit_to(
            EventTarget::webview_window(window.label()),
            REPORT_OPEN_EVENT,
            (),
        );
    }
}
