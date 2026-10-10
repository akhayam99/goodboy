const MAX_FIELD_CHARS: usize = 200;

fn blank_control(c: char) -> char {
    if c.is_control() {
        return ' ';
    }
    c
}

fn clean(value: &str) -> String {
    value
        .chars()
        .map(blank_control)
        .take(MAX_FIELD_CHARS)
        .collect()
}

fn standing_line(provider: &str, from: &str, to: &str, reason: &str) -> String {
    format!(
        "[providers] standing {} {} -> {}: {}",
        clean(provider),
        clean(from),
        clean(to),
        clean(reason)
    )
}

#[tauri::command]
pub async fn log_provider_standing(provider: String, from: String, to: String, reason: String) {
    log::info!("{}", standing_line(&provider, &from, &to, &reason));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_line_names_provider_change_and_reason() {
        assert_eq!(
            standing_line("cursor", "connected", "cannot_check", "probe timed out"),
            "[providers] standing cursor connected -> cannot_check: probe timed out"
        );
    }

    #[test]
    fn newlines_and_control_characters_never_split_the_line() {
        let line = standing_line("cursor", "a", "b", "first\nsecond\u{7}third");
        assert_eq!(
            line,
            "[providers] standing cursor a -> b: first second third"
        );
    }

    #[test]
    fn a_long_reason_is_cut() {
        let long = "x".repeat(5_000);
        let line = standing_line("cursor", "a", "b", &long);
        assert!(line.chars().count() < 300);
    }
}
