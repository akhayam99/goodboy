use std::collections::HashMap;

const MAX_COMMAND_CHARS: usize = 200;

pub(crate) fn parse_ps_args(text: &str) -> HashMap<u32, String> {
    text.lines()
        .filter_map(|line| {
            let trimmed = line.trim_start();
            let (pid, rest) = trimmed.split_once(char::is_whitespace)?;
            let pid = pid.parse::<u32>().ok()?;
            let command = rest.trim();
            if command.is_empty() {
                return None;
            }
            Some((pid, command.chars().take(MAX_COMMAND_CHARS).collect()))
        })
        .collect()
}

#[cfg(unix)]
pub(crate) fn commands_of(pids: &[u32]) -> HashMap<u32, String> {
    if pids.is_empty() {
        return HashMap::new();
    }
    let list = pids
        .iter()
        .map(|pid| pid.to_string())
        .collect::<Vec<_>>()
        .join(",");
    let Ok(output) = crate::path_env::command("ps")
        .args(["-o", "pid=,args=", "-p", &list])
        .output()
    else {
        return HashMap::new();
    };
    parse_ps_args(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(not(unix))]
pub(crate) fn commands_of(_pids: &[u32]) -> HashMap<u32, String> {
    HashMap::new()
}

#[cfg(test)]
mod tests {
    use super::{commands_of, parse_ps_args};

    #[test]
    fn a_ps_row_becomes_the_pid_and_its_whole_command_line() {
        let parsed = parse_ps_args(
            "  4321 pnpm dev --port 4310\n 77 node /work/ledger-core/node_modules/.bin/vitest\n",
        );
        assert_eq!(
            parsed.get(&4321).map(String::as_str),
            Some("pnpm dev --port 4310")
        );
        assert_eq!(
            parsed.get(&77).map(String::as_str),
            Some("node /work/ledger-core/node_modules/.bin/vitest")
        );
    }

    #[test]
    fn a_row_without_a_pid_or_a_command_is_skipped() {
        let parsed = parse_ps_args("abc pnpm dev\n 12\n\n 13   \n");
        assert!(parsed.is_empty());
    }

    #[test]
    fn a_very_long_command_line_is_cut() {
        let parsed = parse_ps_args(&format!("9 {}", "x".repeat(500)));
        assert_eq!(parsed.get(&9).map(String::len), Some(200));
    }

    #[cfg(unix)]
    #[test]
    fn no_pids_ask_ps_nothing_and_a_live_pid_reports_its_command() {
        assert!(commands_of(&[]).is_empty());
        let me = std::process::id();
        let found = commands_of(&[me]);
        assert!(found.get(&me).is_some_and(|command| !command.is_empty()));
    }
}
