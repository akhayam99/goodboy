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

fn step_end_line(agent: &str, reason: &str) -> String {
    format!(
        "[turns] step ended without a result agent {}: {}",
        clean(agent),
        clean(reason)
    )
}

#[tauri::command]
pub async fn log_step_end(agent: String, reason: String) {
    log::info!("{}", step_end_line(&agent, &reason));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_line_names_the_agent_and_the_reason() {
        assert_eq!(
            step_end_line("agent-7", "no marker, no question, no continuation"),
            "[turns] step ended without a result agent agent-7: no marker, no question, no continuation"
        );
    }

    #[test]
    fn newlines_and_control_characters_never_split_the_line() {
        let line = step_end_line("agent-7", "first\nsecond\u{7}third");
        assert_eq!(
            line,
            "[turns] step ended without a result agent agent-7: first second third"
        );
    }

    #[test]
    fn a_long_reason_is_cut() {
        let long = "x".repeat(5_000);
        let line = step_end_line("agent-7", &long);
        assert!(line.chars().count() < 300);
    }
}
