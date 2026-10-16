use tauri::menu::{Menu, MenuItem, MenuItemKind, Submenu, HELP_SUBMENU_ID};
use tauri::{AppHandle, Emitter, EventTarget, Manager, Runtime};

pub const REPORT_ITEM_ID: &str = "goodboy-report-bug";
pub const REPORT_OPEN_EVENT: &str = "goodboy://report-open";
const REPORT_LABEL: &str = "Report a bug";
const REPORT_ACCELERATOR: &str = "CmdOrCtrl+I";

pub const CLOSE_ITEM_ID: &str = "goodboy-close";
pub const CLOSE_CURRENT_EVENT: &str = "goodboy://close-current";
const CLOSE_LABEL: &str = "Close";
const CLOSE_ACCELERATOR: &str = "CmdOrCtrl+W";
const PREDEFINED_CLOSE_LABEL: &str = "Close Window";
const FILE_LABEL: &str = "File";

fn is_predefined_close(text: &str) -> bool {
    text == PREDEFINED_CLOSE_LABEL
}

fn replace_close_window<R: Runtime>(app: &AppHandle<R>, menu: &Menu<R>) -> tauri::Result<()> {
    let close = MenuItem::with_id(
        app,
        CLOSE_ITEM_ID,
        CLOSE_LABEL,
        true,
        Some(CLOSE_ACCELERATOR),
    )?;
    let mut is_placed = false;
    for kind in menu.items()? {
        let MenuItemKind::Submenu(submenu) = kind else {
            continue;
        };
        for entry in submenu.items()? {
            let MenuItemKind::Predefined(predefined) = &entry else {
                continue;
            };
            if is_predefined_close(&predefined.text()?) {
                submenu.remove(&entry)?;
                if !is_placed && submenu.text()? == FILE_LABEL {
                    submenu.insert(&close, 0)?;
                    is_placed = true;
                }
            }
        }
    }
    Ok(())
}

pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::default(app)?;
    replace_close_window(app, &menu)?;
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
    Ok(menu)
}

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    app.set_menu(build_menu(app)?)?;
    app.on_menu_event(|app, event| {
        if event.id() == REPORT_ITEM_ID {
            emit_to_focused_window(app, REPORT_OPEN_EVENT);
            return;
        }
        if event.id() == CLOSE_ITEM_ID {
            emit_to_focused_window(app, CLOSE_CURRENT_EVENT);
        }
    });
    Ok(())
}

fn emit_to_focused_window<R: Runtime>(app: &AppHandle<R>, event: &str) {
    let windows = app.webview_windows();
    let focused = windows
        .values()
        .find(|window| window.is_focused().unwrap_or(false))
        .or_else(|| windows.values().next());
    if let Some(window) = focused {
        let _ = app.emit_to(EventTarget::webview_window(window.label()), event, ());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_only_the_predefined_close_window_label() {
        assert!(is_predefined_close("Close Window"));
        assert!(!is_predefined_close("Close"));
        assert!(!is_predefined_close("Minimize"));
    }

    #[test]
    fn close_item_owns_the_command_w_accelerator_and_a_distinct_id() {
        assert_eq!(CLOSE_ACCELERATOR, "CmdOrCtrl+W");
        assert_ne!(CLOSE_ITEM_ID, REPORT_ITEM_ID);
        assert_eq!(CLOSE_CURRENT_EVENT, "goodboy://close-current");
    }
}
