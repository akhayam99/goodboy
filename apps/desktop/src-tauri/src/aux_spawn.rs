use std::process::Command;

pub const CLAUDE_SETTING_SOURCES: &str = "project,local";

pub const SPAWN_ID_ENV: &str = "GOODBOY_SPAWN_ID";
pub const SPAWN_KIND_ENV: &str = "GOODBOY_SPAWN_KIND";
pub const APP_PID_ENV: &str = "GOODBOY_APP_PID";

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

    pub fn env(&self) -> [(&'static str, String); 3] {
        [
            (SPAWN_ID_ENV, self.id.clone()),
            (SPAWN_KIND_ENV, self.kind.as_str().to_string()),
            (APP_PID_ENV, std::process::id().to_string()),
        ]
    }
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

#[cfg(test)]
mod tests {
    use super::*;

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
