use std::process::Command;

pub const CLAUDE_SETTING_SOURCES: &str = "project,local";

/// Strip env vars that signal "running inside another Claude Code / Agent SDK
/// session". When Goodboy is launched from such a context the vars propagate to
/// children; the claude CLI then either refuses with a nested-session error or
/// falls through to broken auth (401). We want every spawn to behave as a fresh
/// shell invocation that hits claude's own ~/.claude credentials.
pub fn scrub_nested_session_env(command: &mut Command) {
    command
        .env_remove("CLAUDECODE")
        .env_remove("CLAUDE_CODE_ENTRYPOINT")
        .env_remove("CLAUDE_AGENT_SDK_VERSION");
}


pub fn push_effort_args(provider_id: &str, effort: Option<&str>, args: &mut Vec<String>) {
    let Some(level) = effort else {
        return;
    };
    if level.is_empty() {
        return;
    }
    match provider_id {
        "anthropic" => {
            args.push("--effort".to_string());
            args.push(level.to_string());
        }
        "codex" => {
            args.push("-c".to_string());
            args.push(format!("model_reasoning_effort=\"{level}\""));
        }
        "opencode" | "openrouter" => {
            args.push("--variant".to_string());
            args.push(level.to_string());
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn setting_sources_keeps_project_and_local_only() {
        assert_eq!(CLAUDE_SETTING_SOURCES, "project,local");
        assert!(!CLAUDE_SETTING_SOURCES.contains("user"));
    }

    #[test]
    fn push_effort_args_maps_each_provider() {
        let mut anthropic = Vec::new();
        push_effort_args("anthropic", Some("high"), &mut anthropic);
        assert_eq!(anthropic, vec!["--effort".to_string(), "high".to_string()]);

        let mut codex = Vec::new();
        push_effort_args("codex", Some("low"), &mut codex);
        assert_eq!(
            codex,
            vec!["-c".to_string(), "model_reasoning_effort=\"low\"".to_string()]
        );

        let mut opencode = Vec::new();
        push_effort_args("opencode", Some("max"), &mut opencode);
        assert_eq!(opencode, vec!["--variant".to_string(), "max".to_string()]);

        let mut gemini = Vec::new();
        push_effort_args("gemini", Some("high"), &mut gemini);
        assert!(gemini.is_empty());

        let mut none = Vec::new();
        push_effort_args("anthropic", None, &mut none);
        assert!(none.is_empty());
    }

    #[test]
    fn scrub_removes_nested_session_markers() {
        let mut command = Command::new("echo");
        command.env("CLAUDECODE", "1");
        command.env("CLAUDE_CODE_ENTRYPOINT", "cli");
        command.env("CLAUDE_AGENT_SDK_VERSION", "1.2.3");
        scrub_nested_session_env(&mut command);
        let removed: Vec<&std::ffi::OsStr> = command
            .get_envs()
            .filter(|(_, value)| value.is_none())
            .map(|(key, _)| key)
            .collect();
        assert!(removed.contains(&std::ffi::OsStr::new("CLAUDECODE")));
        assert!(removed.contains(&std::ffi::OsStr::new("CLAUDE_CODE_ENTRYPOINT")));
        assert!(removed.contains(&std::ffi::OsStr::new("CLAUDE_AGENT_SDK_VERSION")));
    }
}
