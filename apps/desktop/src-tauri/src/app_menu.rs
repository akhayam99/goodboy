use serde::Serialize;
use tauri::menu::{
    AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
};
use tauri::{AppHandle, Emitter, EventTarget, Manager, Runtime};

pub const MENU_EVENT: &str = "goodboy://menu";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
enum Native {
    About,
    Services,
    Hide,
    HideOthers,
    ShowAll,
    Quit,
    Undo,
    Redo,
    Cut,
    Copy,
    Paste,
    SelectAll,
    FullScreen,
    Minimize,
    Zoom,
    BringAllToFront,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Command {
    id: &'static str,
    label: &'static str,
    combo: Option<&'static str>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Row {
    Command(Command),
    Native(Native),
    Separator,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Title {
    AppName,
    Text(&'static str),
}

struct Section {
    id: Option<&'static str>,
    title: Title,
    rows: &'static [Row],
}

const fn command(id: &'static str, label: &'static str, combo: Option<&'static str>) -> Row {
    Row::Command(Command { id, label, combo })
}

const fn native(item: Native) -> Row {
    Row::Native(item)
}

const SEPARATOR: Row = Row::Separator;

const APP_ROWS: &[Row] = &[
    native(Native::About),
    command("menu.checkForUpdates", "Check for Updates…", None),
    SEPARATOR,
    command("settings.open", "Settings…", Some("cmd+Comma")),
    SEPARATOR,
    native(Native::Services),
    SEPARATOR,
    native(Native::Hide),
    native(Native::HideOthers),
    native(Native::ShowAll),
    SEPARATOR,
    native(Native::Quit),
];

const FILE_ROWS: &[Row] = &[
    command("session.new", "New Session", Some("cmd+KeyN")),
    command("chat.new", "New Chat", Some("cmd+shift+KeyN")),
    command("menu.newTerminal", "New Terminal", None),
    command("menu.newWorkspace", "New Workspace…", None),
    SEPARATOR,
    command("app.close", "Close", Some("cmd+KeyW")),
];

const EDIT_ROWS: &[Row] = &[
    native(Native::Undo),
    native(Native::Redo),
    SEPARATOR,
    native(Native::Cut),
    native(Native::Copy),
    native(Native::Paste),
    native(Native::SelectAll),
    SEPARATOR,
    command("search.open", "Search", Some("cmd+KeyF")),
];

const VIEW_ROWS: &[Row] = &[
    command("column.toggle", "Show or Hide Sidebar", Some("cmd+KeyB")),
    command("palette.open", "Command Palette", Some("cmd+KeyK")),
    SEPARATOR,
    command("zoom.in", "Zoom In", Some("cmd+Equal")),
    command("zoom.out", "Zoom Out", Some("cmd+Minus")),
    command("zoom.reset", "Actual Size", Some("cmd+Digit0")),
    SEPARATOR,
    command("app.reload", "Reload", Some("cmd+KeyR")),
    native(Native::FullScreen),
];

const GO_ROWS: &[Row] = &[
    command("nav.back", "Back", Some("cmd+BracketLeft")),
    command("nav.forward", "Forward", Some("cmd+BracketRight")),
    SEPARATOR,
    command("session.board", "Sessions", Some("cmd+shift+KeyH")),
    command("menu.tasks", "Tasks", None),
    command("menu.chat", "Chat", None),
    command("menu.workflows", "Workflows", None),
    command("terminal.studio", "Terminal", Some("ctrl+Backquote")),
    command("menu.impact", "Impact", None),
    SEPARATOR,
    command("menu.notifications", "Notifications", None),
    command("menu.monitoring", "Monitoring", None),
];

const WINDOW_ROWS: &[Row] = &[
    native(Native::Minimize),
    native(Native::Zoom),
    SEPARATOR,
    native(Native::BringAllToFront),
];

const HELP_ROWS: &[Row] = &[
    command("menu.guide", "Guide", None),
    command("menu.whatsNew", "What's New", None),
    command(
        "settings.shortcuts",
        "Keyboard Shortcuts",
        Some("cmd+Slash"),
    ),
    SEPARATOR,
    command("report.open", "Report a Bug", Some("cmd+KeyI")),
];

const SECTIONS: &[Section] = &[
    Section {
        id: None,
        title: Title::AppName,
        rows: APP_ROWS,
    },
    Section {
        id: None,
        title: Title::Text("File"),
        rows: FILE_ROWS,
    },
    Section {
        id: None,
        title: Title::Text("Edit"),
        rows: EDIT_ROWS,
    },
    Section {
        id: None,
        title: Title::Text("View"),
        rows: VIEW_ROWS,
    },
    Section {
        id: None,
        title: Title::Text("Go"),
        rows: GO_ROWS,
    },
    Section {
        id: Some(WINDOW_SUBMENU_ID),
        title: Title::Text("Window"),
        rows: WINDOW_ROWS,
    },
    Section {
        id: Some(HELP_SUBMENU_ID),
        title: Title::Text("Help"),
        rows: HELP_ROWS,
    },
];

#[derive(Clone, Serialize)]
struct MenuCommandPayload {
    id: &'static str,
}

fn commands() -> impl Iterator<Item = Command> {
    SECTIONS
        .iter()
        .flat_map(|section| section.rows.iter())
        .filter_map(|row| match row {
            Row::Command(command) => Some(*command),
            _ => None,
        })
}

fn command_id(id: &str) -> Option<&'static str> {
    commands()
        .find(|command| command.id == id)
        .map(|command| command.id)
}

fn about_metadata<R: Runtime>(app: &AppHandle<R>) -> AboutMetadata<'static> {
    let package = app.package_info();
    let config = app.config();
    AboutMetadata {
        name: Some(package.name.clone()),
        version: Some(package.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config
            .bundle
            .publisher
            .clone()
            .map(|publisher| vec![publisher]),
        ..Default::default()
    }
}

fn native_item<R: Runtime>(
    app: &AppHandle<R>,
    item: Native,
) -> tauri::Result<PredefinedMenuItem<R>> {
    match item {
        Native::About => PredefinedMenuItem::about(app, None, Some(about_metadata(app))),
        Native::Services => PredefinedMenuItem::services(app, None),
        Native::Hide => PredefinedMenuItem::hide(app, None),
        Native::HideOthers => PredefinedMenuItem::hide_others(app, None),
        Native::ShowAll => PredefinedMenuItem::show_all(app, None),
        Native::Quit => PredefinedMenuItem::quit(app, None),
        Native::Undo => PredefinedMenuItem::undo(app, None),
        Native::Redo => PredefinedMenuItem::redo(app, None),
        Native::Cut => PredefinedMenuItem::cut(app, None),
        Native::Copy => PredefinedMenuItem::copy(app, None),
        Native::Paste => PredefinedMenuItem::paste(app, None),
        Native::SelectAll => PredefinedMenuItem::select_all(app, None),
        Native::FullScreen => PredefinedMenuItem::fullscreen(app, None),
        Native::Minimize => PredefinedMenuItem::minimize(app, None),
        Native::Zoom => PredefinedMenuItem::maximize(app, None),
        Native::BringAllToFront => PredefinedMenuItem::bring_all_to_front(app, None),
    }
}

fn append_row<R: Runtime>(app: &AppHandle<R>, submenu: &Submenu<R>, row: Row) -> tauri::Result<()> {
    match row {
        Row::Command(command) => submenu.append(&MenuItem::with_id(
            app,
            command.id,
            command.label,
            true,
            command.combo,
        )?),
        Row::Native(item) => submenu.append(&native_item(app, item)?),
        Row::Separator => submenu.append(&PredefinedMenuItem::separator(app)?),
    }
}

fn section_title<R: Runtime>(app: &AppHandle<R>, title: Title) -> String {
    match title {
        Title::AppName => app.package_info().name.clone(),
        Title::Text(text) => text.to_string(),
    }
}

fn build_section<R: Runtime>(app: &AppHandle<R>, section: &Section) -> tauri::Result<Submenu<R>> {
    let title = section_title(app, section.title);
    let submenu = match section.id {
        Some(id) => Submenu::with_id(app, id, title, true)?,
        None => Submenu::new(app, title, true)?,
    };
    for row in section.rows {
        append_row(app, &submenu, *row)?;
    }
    Ok(submenu)
}

pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::new(app)?;
    for section in SECTIONS {
        menu.append(&build_section(app, section)?)?;
    }
    Ok(menu)
}

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    app.set_menu(build_menu(app)?)?;
    app.on_menu_event(|app, event| {
        let Some(id) = command_id(event.id().as_ref()) else {
            return;
        };
        emit_to_focused_window(app, MenuCommandPayload { id });
    });
    Ok(())
}

fn emit_to_focused_window<R: Runtime>(app: &AppHandle<R>, payload: MenuCommandPayload) {
    let windows = app.webview_windows();
    let focused = windows
        .values()
        .find(|window| window.is_focused().unwrap_or(false))
        .or_else(|| windows.values().next());
    if let Some(window) = focused {
        let _ = app.emit_to(
            EventTarget::webview_window(window.label()),
            MENU_EVENT,
            payload,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    const MODIFIERS: &[&str] = &["cmd", "shift", "alt", "ctrl"];
    const NAMED_KEYS: &[&str] = &[
        "Comma",
        "Slash",
        "Equal",
        "Minus",
        "BracketLeft",
        "BracketRight",
        "Backquote",
    ];

    fn is_key_code(code: &str) -> bool {
        let is_letter = code.len() == 4
            && code.starts_with("Key")
            && code.chars().last().is_some_and(|c| c.is_ascii_uppercase());
        let is_digit = code.len() == 6
            && code.starts_with("Digit")
            && code.chars().last().is_some_and(|c| c.is_ascii_digit());
        is_letter || is_digit || NAMED_KEYS.contains(&code)
    }

    fn is_valid_combo(combo: &str) -> bool {
        let parts: Vec<&str> = combo.split('+').collect();
        let Some((key, modifiers)) = parts.split_last() else {
            return false;
        };
        let has_modifier = !modifiers.is_empty();
        let are_known = modifiers.iter().all(|part| MODIFIERS.contains(part));
        let are_unique = modifiers.iter().collect::<HashSet<_>>().len() == modifiers.len();
        has_modifier && are_known && are_unique && is_key_code(key)
    }

    fn titles() -> Vec<Title> {
        SECTIONS.iter().map(|section| section.title).collect()
    }

    #[test]
    fn lays_out_the_seven_menus_in_macos_order() {
        assert_eq!(
            titles(),
            vec![
                Title::AppName,
                Title::Text("File"),
                Title::Text("Edit"),
                Title::Text("View"),
                Title::Text("Go"),
                Title::Text("Window"),
                Title::Text("Help"),
            ]
        );
    }

    #[test]
    fn hands_window_and_help_to_appkit() {
        let ids: Vec<Option<&str>> = SECTIONS.iter().map(|section| section.id).collect();
        assert_eq!(ids[5], Some(WINDOW_SUBMENU_ID));
        assert_eq!(ids[6], Some(HELP_SUBMENU_ID));
        assert!(ids[..5].iter().all(Option::is_none));
    }

    #[test]
    fn gives_every_command_a_unique_id() {
        let ids: Vec<&str> = commands().map(|command| command.id).collect();
        let unique: HashSet<&str> = ids.iter().copied().collect();
        assert_eq!(ids.len(), unique.len());
    }

    #[test]
    fn gives_every_key_a_single_item() {
        let combos: Vec<&str> = commands().filter_map(|command| command.combo).collect();
        let unique: HashSet<&str> = combos.iter().copied().collect();
        assert_eq!(combos.len(), unique.len());
    }

    #[test]
    fn writes_every_accelerator_as_a_registry_combo() {
        let invalid: Vec<&str> = commands()
            .filter_map(|command| command.combo)
            .filter(|combo| !is_valid_combo(combo))
            .collect();
        assert!(invalid.is_empty(), "invalid combos: {invalid:?}");
    }

    #[test]
    fn leaves_undo_and_redo_to_the_predefined_items() {
        assert_eq!(EDIT_ROWS[0], native(Native::Undo));
        assert_eq!(EDIT_ROWS[1], native(Native::Redo));
        let combos: Vec<&str> = commands().filter_map(|command| command.combo).collect();
        assert!(!combos.contains(&"cmd+KeyZ"));
        assert!(!combos.contains(&"cmd+shift+KeyZ"));
    }

    #[test]
    fn owns_close_report_and_settings_with_their_keys() {
        let combo_of = |id: &str| {
            commands()
                .find(|command| command.id == id)
                .and_then(|command| command.combo)
        };
        assert_eq!(combo_of("app.close"), Some("cmd+KeyW"));
        assert_eq!(combo_of("report.open"), Some("cmd+KeyI"));
        assert_eq!(combo_of("settings.open"), Some("cmd+Comma"));
    }

    #[test]
    fn keeps_close_window_out_so_command_w_has_one_item() {
        let natives: Vec<Native> = SECTIONS
            .iter()
            .flat_map(|section| section.rows.iter())
            .filter_map(|row| match row {
                Row::Native(item) => Some(*item),
                _ => None,
            })
            .collect();
        let unique: HashSet<Native> = natives.iter().copied().collect();
        assert_eq!(natives.len(), unique.len());
        assert!(natives.contains(&Native::Quit));
    }

    #[test]
    fn emits_only_ids_from_the_table() {
        assert_eq!(command_id("settings.open"), Some("settings.open"));
        assert_eq!(command_id("menu.guide"), Some("menu.guide"));
        assert_eq!(command_id("goodboy-close"), None);
        assert_eq!(command_id(""), None);
    }

    #[test]
    fn sends_the_id_as_the_event_payload() {
        let payload = serde_json::to_value(MenuCommandPayload { id: "app.close" }).unwrap();
        assert_eq!(payload, serde_json::json!({ "id": "app.close" }));
        assert_eq!(MENU_EVENT, "goodboy://menu");
    }

    #[test]
    fn never_starts_or_ends_a_menu_with_a_separator() {
        for section in SECTIONS {
            assert_ne!(section.rows.first(), Some(&SEPARATOR));
            assert_ne!(section.rows.last(), Some(&SEPARATOR));
        }
    }
}
