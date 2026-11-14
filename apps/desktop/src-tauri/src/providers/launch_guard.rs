use std::process::Command;

use serde::Deserialize;

use super::cli_args::Cli;

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LaunchGuardEnv {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Deserialize, Clone, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LaunchGuardArgs {
    #[serde(default)]
    pub denied_tools: Vec<String>,
    #[serde(default)]
    pub env: Vec<LaunchGuardEnv>,
    #[serde(default)]
    pub is_network_off: bool,
}

const RESERVED_ENV_PREFIXES: &[&str] = &["GIT_", "GOODBOY_"];
const RESERVED_ENV_NAMES: &[&str] = &["PATH", "HOME", "SHELL", "USER", "TMPDIR"];

fn is_env_name(name: &str) -> bool {
    let mut chars = name.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    (first.is_ascii_alphabetic() || first == '_')
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

fn is_reserved(name: &str) -> bool {
    let upper = name.to_ascii_uppercase();
    RESERVED_ENV_NAMES.contains(&upper.as_str())
        || RESERVED_ENV_PREFIXES
            .iter()
            .any(|prefix| upper.starts_with(prefix))
        || upper.ends_with("_TOKEN")
}

pub(crate) fn ensure_launch_guard(binary: &str, guard: &LaunchGuardArgs) -> Result<(), String> {
    match Cli::of_binary(binary) {
        Some(Cli::Claude) | Some(Cli::Codex) => {}
        _ => {
            return Err(format!(
                "The launch guard of this agent runs only on Claude or Codex, so this turn on {binary} did not start. Ask Auto to continue it."
            ))
        }
    }
    if let Some(bad) = guard
        .env
        .iter()
        .find(|entry| !is_env_name(&entry.name) || is_reserved(&entry.name))
    {
        return Err(format!(
            "The launch guard named an environment setting Goodboy does not set ({}), so the turn did not start.",
            bad.name
        ));
    }
    Ok(())
}

pub(crate) fn apply_launch_guard_env(command: &mut Command, guard: Option<&LaunchGuardArgs>) {
    let Some(guard) = guard else {
        return;
    };
    for entry in &guard.env {
        command.env(&entry.name, &entry.value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn env(name: &str, value: &str) -> LaunchGuardEnv {
        LaunchGuardEnv {
            name: name.to_string(),
            value: value.to_string(),
        }
    }

    fn guard_with(entries: Vec<LaunchGuardEnv>) -> LaunchGuardArgs {
        LaunchGuardArgs {
            denied_tools: Vec::new(),
            env: entries,
            is_network_off: true,
        }
    }

    #[test]
    fn a_guard_runs_only_on_claude_or_codex() {
        let guard = guard_with(vec![env("npm_config_offline", "true")]);
        assert_eq!(ensure_launch_guard("claude", &guard), Ok(()));
        assert_eq!(ensure_launch_guard("/usr/local/bin/codex", &guard), Ok(()));
        for binary in ["cursor-agent", "opencode", "agy", "copilot", "unknown"] {
            let refusal = ensure_launch_guard(binary, &guard).expect_err("refused");
            assert!(refusal.contains("did not start"), "{refusal}");
        }
    }

    #[test]
    fn a_guard_never_sets_a_reserved_or_malformed_name() {
        for name in [
            "PATH",
            "HOME",
            "GIT_CONFIG_COUNT",
            "git_dir",
            "GH_TOKEN",
            "GOODBOY_SOCKET",
            "1BAD",
            "A-B",
            "",
        ] {
            let guard = guard_with(vec![env(name, "x")]);
            assert!(ensure_launch_guard("claude", &guard).is_err(), "{name}");
        }
    }

    #[test]
    fn the_guard_env_lands_on_the_command() {
        let guard = guard_with(vec![
            env("pnpm_config_offline", "true"),
            env("CARGO_NET_OFFLINE", "true"),
        ]);
        let mut command = Command::new("true");
        apply_launch_guard_env(&mut command, Some(&guard));
        let set: Vec<(String, String)> = command
            .get_envs()
            .filter_map(|(name, value)| {
                Some((name.to_str()?.to_string(), value?.to_str()?.to_string()))
            })
            .collect();
        assert!(set.contains(&("pnpm_config_offline".to_string(), "true".to_string())));
        assert!(set.contains(&("CARGO_NET_OFFLINE".to_string(), "true".to_string())));
        let mut bare = Command::new("true");
        apply_launch_guard_env(&mut bare, None);
        assert_eq!(bare.get_envs().count(), 0);
    }
}
