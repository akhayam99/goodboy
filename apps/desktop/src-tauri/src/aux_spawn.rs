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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn setting_sources_keeps_project_and_local_only() {
        assert_eq!(CLAUDE_SETTING_SOURCES, "project,local");
        assert!(!CLAUDE_SETTING_SOURCES.contains("user"));
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
