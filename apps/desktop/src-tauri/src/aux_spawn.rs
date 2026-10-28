use std::process::Command;

pub const CLAUDE_SETTING_SOURCES: &str = "project,local";

pub const SPAWN_ID_ENV: &str = "GOODBOY_SPAWN_ID";
pub const SPAWN_KIND_ENV: &str = "GOODBOY_SPAWN_KIND";
pub const APP_PID_ENV: &str = "GOODBOY_APP_PID";
pub const APP_START_ENV: &str = "GOODBOY_APP_START";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpawnKind {
    Turn,
    Chat,
    Planner,
    Summary,
    Script,
    Terminal,
    Probe,
}

impl SpawnKind {
    pub fn as_str(self) -> &'static str {
        match self {
            SpawnKind::Turn => "turn",
            SpawnKind::Chat => "chat",
            SpawnKind::Planner => "planner",
            SpawnKind::Summary => "summary",
            SpawnKind::Script => "script",
            SpawnKind::Terminal => "terminal",
            SpawnKind::Probe => "probe",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        [
            SpawnKind::Turn,
            SpawnKind::Chat,
            SpawnKind::Planner,
            SpawnKind::Summary,
            SpawnKind::Script,
            SpawnKind::Terminal,
            SpawnKind::Probe,
        ]
        .into_iter()
        .find(|kind| kind.as_str() == value)
    }

    pub fn is_swept_at_startup(self) -> bool {
        matches!(
            self,
            SpawnKind::Turn
                | SpawnKind::Chat
                | SpawnKind::Planner
                | SpawnKind::Summary
                | SpawnKind::Probe
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpawnTag {
    pub id: String,
    pub kind: SpawnKind,
}

impl SpawnTag {
    pub fn new(kind: SpawnKind) -> Self {
        Self {
            id: format!("{:032x}", rand::random::<u128>()),
            kind,
        }
    }

    pub fn env(&self) -> [(&'static str, String); 4] {
        [
            (SPAWN_ID_ENV, self.id.clone()),
            (SPAWN_KIND_ENV, self.kind.as_str().to_string()),
            (APP_PID_ENV, std::process::id().to_string()),
            (APP_START_ENV, app_start().to_string()),
        ]
    }
}

pub fn app_start() -> u64 {
    static START: std::sync::OnceLock<u64> = std::sync::OnceLock::new();
    *START.get_or_init(|| {
        crate::proc::kernel::identity(std::process::id())
            .map(|identity| identity.start)
            .unwrap_or(0)
    })
}

pub fn tag_spawn(command: &mut Command, kind: SpawnKind) -> SpawnTag {
    let tag = SpawnTag::new(kind);
    for (key, value) in tag.env() {
        command.env(key, value);
    }
    tag
}

pub fn tag_pty_spawn(command: &mut portable_pty::CommandBuilder, kind: SpawnKind) -> SpawnTag {
    let tag = SpawnTag::new(kind);
    for (key, value) in tag.env() {
        command.env(key, value);
    }
    tag
}

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

const COPILOT_CLASSIC_TOKEN_PREFIX: &str = "ghp_";
const COPILOT_FINE_GRAINED_TOKEN_PREFIX: &str = "github_pat_";
const COPILOT_OWN_TOKEN_ENV: &str = "COPILOT_GITHUB_TOKEN";
const COPILOT_SHARED_TOKEN_ENV: [&str; 2] = ["GH_TOKEN", "GITHUB_TOKEN"];

pub fn is_copilot_binary(binary: &str) -> bool {
    std::path::Path::new(binary)
        .file_stem()
        .and_then(|name| name.to_str())
        == Some("copilot")
}

fn effective_env(
    command: &Command,
    name: &str,
    inherited: &impl Fn(&str) -> Option<String>,
) -> Option<String> {
    let set = command
        .get_envs()
        .find(|(key, _)| key.to_string_lossy() == name);
    match set {
        Some((_, Some(value))) => Some(value.to_string_lossy().into_owned()),
        Some((_, None)) => None,
        None => inherited(name),
    }
}

pub fn strip_tokens_copilot_refuses_with(
    command: &mut Command,
    inherited: impl Fn(&str) -> Option<String>,
) {
    let own = effective_env(command, COPILOT_OWN_TOKEN_ENV, &inherited);
    if own.is_some_and(|value| value.starts_with(COPILOT_CLASSIC_TOKEN_PREFIX)) {
        command.env_remove(COPILOT_OWN_TOKEN_ENV);
    }
    for name in COPILOT_SHARED_TOKEN_ENV {
        let value = effective_env(command, name, &inherited);
        if value.is_some_and(|value| !value.starts_with(COPILOT_FINE_GRAINED_TOKEN_PREFIX)) {
            command.env_remove(name);
        }
    }
}

pub fn strip_tokens_copilot_refuses(command: &mut Command) {
    strip_tokens_copilot_refuses_with(command, |name| std::env::var(name).ok());
}

#[cfg(test)]
mod tests {
    use super::*;

    fn removed_names(command: &Command) -> Vec<String> {
        command
            .get_envs()
            .filter(|(_, value)| value.is_none())
            .map(|(key, _)| key.to_string_lossy().into_owned())
            .collect()
    }

    fn inherited_with(
        pairs: &'static [(&'static str, &'static str)],
    ) -> impl Fn(&str) -> Option<String> {
        move |name| {
            pairs
                .iter()
                .find(|(key, _)| *key == name)
                .map(|(_, value)| value.to_string())
        }
    }

    #[test]
    fn a_classic_token_in_the_shared_variables_is_removed_for_copilot() {
        let mut command = Command::new("copilot");
        strip_tokens_copilot_refuses_with(
            &mut command,
            inherited_with(&[
                ("GH_TOKEN", "ghp_harborline"),
                ("GITHUB_TOKEN", "ghp_northwind"),
            ]),
        );
        let removed = removed_names(&command);
        assert!(removed.contains(&"GH_TOKEN".to_string()));
        assert!(removed.contains(&"GITHUB_TOKEN".to_string()));
    }

    #[test]
    fn a_fine_grained_token_is_kept_for_copilot() {
        let mut command = Command::new("copilot");
        strip_tokens_copilot_refuses_with(
            &mut command,
            inherited_with(&[("GH_TOKEN", "github_pat_harborline")]),
        );
        assert!(removed_names(&command).is_empty());
    }

    #[test]
    fn a_token_the_app_set_on_the_command_is_judged_before_the_inherited_one() {
        let mut command = Command::new("copilot");
        command.env("GITHUB_TOKEN", "ghp_acme");
        strip_tokens_copilot_refuses_with(
            &mut command,
            inherited_with(&[("GITHUB_TOKEN", "github_pat_cascadia")]),
        );
        assert_eq!(removed_names(&command), vec!["GITHUB_TOKEN".to_string()]);
    }

    #[test]
    fn only_a_classic_copilot_token_is_removed_from_its_own_variable() {
        let mut classic = Command::new("copilot");
        strip_tokens_copilot_refuses_with(
            &mut classic,
            inherited_with(&[("COPILOT_GITHUB_TOKEN", "ghp_harborline")]),
        );
        assert_eq!(
            removed_names(&classic),
            vec!["COPILOT_GITHUB_TOKEN".to_string()]
        );
        let mut other = Command::new("copilot");
        strip_tokens_copilot_refuses_with(
            &mut other,
            inherited_with(&[("COPILOT_GITHUB_TOKEN", "gho_northwind")]),
        );
        assert!(removed_names(&other).is_empty());
    }

    #[test]
    fn a_variable_nobody_set_is_left_alone() {
        let mut command = Command::new("copilot");
        strip_tokens_copilot_refuses_with(&mut command, inherited_with(&[]));
        assert!(removed_names(&command).is_empty());
    }

    #[test]
    fn copilot_is_recognised_by_its_binary_name() {
        assert!(is_copilot_binary("copilot"));
        assert!(is_copilot_binary("/opt/bin/copilot"));
        assert!(is_copilot_binary("copilot.exe"));
        assert!(!is_copilot_binary("copilot-agent"));
        assert!(!is_copilot_binary("codex"));
    }

    #[test]
    fn setting_sources_keeps_project_and_local_only() {
        assert_eq!(CLAUDE_SETTING_SOURCES, "project,local");
        assert!(!CLAUDE_SETTING_SOURCES.contains("user"));
    }

    #[test]
    fn a_tag_names_the_spawn_its_kind_and_this_app() {
        let mut command = Command::new("echo");
        let tag = tag_spawn(&mut command, SpawnKind::Planner);
        let envs: std::collections::HashMap<String, String> = command
            .get_envs()
            .filter_map(|(key, value)| {
                Some((
                    key.to_string_lossy().into_owned(),
                    value?.to_string_lossy().into_owned(),
                ))
            })
            .collect();
        assert_eq!(envs[SPAWN_ID_ENV], tag.id);
        assert_eq!(envs[SPAWN_KIND_ENV], "planner");
        assert_eq!(envs[APP_PID_ENV], std::process::id().to_string());
        assert_eq!(envs[APP_START_ENV], app_start().to_string());
        assert_eq!(tag.id.len(), 32);
    }

    #[test]
    fn two_tags_never_share_an_id() {
        assert_ne!(
            SpawnTag::new(SpawnKind::Turn).id,
            SpawnTag::new(SpawnKind::Turn).id
        );
    }

    #[test]
    fn kinds_round_trip_and_only_agent_kinds_are_swept() {
        for name in [
            "turn", "chat", "planner", "summary", "script", "terminal", "probe",
        ] {
            assert_eq!(SpawnKind::parse(name).map(SpawnKind::as_str), Some(name));
        }
        assert_eq!(SpawnKind::parse("daemon"), None);
        assert!(SpawnKind::Turn.is_swept_at_startup());
        assert!(SpawnKind::Probe.is_swept_at_startup());
        assert!(!SpawnKind::Script.is_swept_at_startup());
        assert!(!SpawnKind::Terminal.is_swept_at_startup());
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
