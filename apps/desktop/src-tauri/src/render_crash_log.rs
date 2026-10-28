const MAX_NAME_CHARS: usize = 80;
const MAX_MESSAGE_CHARS: usize = 400;
const MAX_STACK_CHARS: usize = 4_000;
const HOME_TOKEN: &str = "~";

fn home_prefix() -> Option<String> {
    let home = dirs::home_dir()?;
    let text = home.to_string_lossy().into_owned();
    if text.len() < 2 {
        return None;
    }
    Some(text)
}

fn strip_user_dirs(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(at) = rest.find("/Users/") {
        out.push_str(&rest[..at]);
        out.push_str(HOME_TOKEN);
        let after = &rest[at + "/Users/".len()..];
        let end = after.find('/').unwrap_or(after.len());
        rest = &after[end..];
    }
    out.push_str(rest);
    out
}

fn redact_home(text: &str, home: Option<&str>) -> String {
    let swapped = match home {
        Some(prefix) => text.replace(prefix, HOME_TOKEN),
        None => text.to_string(),
    };
    strip_user_dirs(&swapped)
}

fn blank_control(c: char) -> char {
    if c.is_control() {
        return ' ';
    }
    c
}

fn clean(value: &str, limit: usize, home: Option<&str>) -> String {
    let redacted = redact_home(&crate::worktree::redact_credentials(value), home);
    let flat: String = redacted.chars().map(blank_control).collect();
    let mut kept: String = flat.chars().take(limit).collect();
    if flat.chars().count() > limit {
        kept.push_str("...");
    }
    kept
}

fn crash_lines(
    name: &str,
    message: &str,
    stack: &str,
    component_stack: &str,
    home: Option<&str>,
) -> Vec<String> {
    vec![
        format!(
            "[render-crash] {}: {}",
            clean(name, MAX_NAME_CHARS, home),
            clean(message, MAX_MESSAGE_CHARS, home)
        ),
        format!(
            "[render-crash] stack {}",
            clean(stack, MAX_STACK_CHARS, home)
        ),
        format!(
            "[render-crash] component stack {}",
            clean(component_stack, MAX_STACK_CHARS, home)
        ),
    ]
}

#[tauri::command]
pub async fn log_render_crash(
    name: String,
    message: String,
    stack: String,
    component_stack: String,
) {
    let home = home_prefix();
    for line in crash_lines(&name, &message, &stack, &component_stack, home.as_deref()) {
        log::error!("{line}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn three_lines_carry_name_message_and_both_stacks() {
        let lines = crash_lines("TypeError", "x is undefined", "at a\nat b", "in Drawer", None);
        assert_eq!(lines[0], "[render-crash] TypeError: x is undefined");
        assert_eq!(lines[1], "[render-crash] stack at a at b");
        assert_eq!(lines[2], "[render-crash] component stack in Drawer");
    }

    #[test]
    fn the_home_folder_becomes_a_tilde() {
        let line = clean(
            "at open (/home/acme/app/index.js:1:2)",
            MAX_STACK_CHARS,
            Some("/home/acme"),
        );
        assert_eq!(line, "at open (~/app/index.js:1:2)");
    }

    #[test]
    fn any_users_folder_loses_its_account_name() {
        let line = clean(
            "at open (/Users/northwind/code/app.js:1:2)",
            MAX_STACK_CHARS,
            None,
        );
        assert_eq!(line, "at open (~/code/app.js:1:2)");
    }

    #[test]
    fn a_long_stack_is_cut() {
        let long = "x".repeat(10_000);
        let line = clean(&long, MAX_STACK_CHARS, None);
        assert!(line.chars().count() <= MAX_STACK_CHARS + 3);
    }
}
