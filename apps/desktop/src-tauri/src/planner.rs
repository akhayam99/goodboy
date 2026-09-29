use std::process::Stdio;
use std::sync::Arc;
use std::thread;

use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;

use crate::live_child::{drain_lossy, wait_and_remove, LiveChild, LiveChildRegistry};
use crate::providers::cli_args::{side_job_args, ArgsError, Job, SideJob};

#[derive(Debug, Error)]
pub enum PlannerError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("unknown provider: {0}")]
    UnknownProvider(String),
    #[error("argument policy violated: {0}")]
    Policy(String),
}

impl From<ArgsError> for PlannerError {
    fn from(error: ArgsError) -> Self {
        match error {
            ArgsError::UnknownProvider(provider) => PlannerError::UnknownProvider(provider),
            ArgsError::Policy(message) => PlannerError::Policy(message),
        }
    }
}

crate::util::impl_error_serialize!(PlannerError);

impl PlannerError {
    fn kind(&self) -> &'static str {
        match self {
            PlannerError::Io(_) => "io",
            PlannerError::UnknownProvider(_) => "unknown_provider",
            PlannerError::Policy(_) => "policy",
        }
    }
}

#[derive(Default)]
pub struct PlannerRegistry(pub LiveChildRegistry);

impl PlannerRegistry {
    pub fn new() -> Self {
        Self::default()
    }
}

pub fn shutdown(registry: &PlannerRegistry) {
    crate::live_child::shutdown(&registry.0);
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannerArgs {
    pub provider_id: String,
    pub model: String,
    pub binary: String,
    pub user_message: String,
    pub system_prompt: String,
    #[serde(default)]
    pub working_dir: Option<String>,
    #[serde(default)]
    pub tools_disabled: bool,
    #[serde(default)]
    pub effort: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannerResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

#[tauri::command]
pub async fn planner_run(
    state: State<'_, PlannerRegistry>,
    args: PlannerArgs,
) -> Result<PlannerResult, PlannerError> {
    let registry = Arc::clone(&state.0);
    tauri::async_runtime::spawn_blocking(move || run_planner(&registry, args))
        .await
        .map_err(|e| PlannerError::Io(std::io::Error::other(e.to_string())))?
}

fn run_planner(
    registry: &LiveChildRegistry,
    args: PlannerArgs,
) -> Result<PlannerResult, PlannerError> {
    let cli_args = build_cli_args(&args)?;

    let mut command = crate::path_env::command(&args.binary);
    crate::aux_spawn::scrub_nested_session_env(&mut command);
    crate::process_group::isolate(&mut command);
    if let Some(dir) = args.working_dir.as_deref() {
        if !dir.is_empty() {
            command.current_dir(dir);
        }
    }

    let mut child = command
        .args(&cli_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| PlannerError::Io(std::io::Error::other("no stdout")))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| PlannerError::Io(std::io::Error::other("no stderr")))?;

    let key = crate::live_child::anonymous_key("planner");
    let live = LiveChild::new(child);
    crate::live_child::register(registry, &key, &live);

    let stdout_handle = thread::spawn(move || drain_lossy(stdout));
    let stderr_handle = thread::spawn(move || drain_lossy(stderr));
    let stdout_buf = stdout_handle.join().unwrap_or_default();
    let stderr_buf = stderr_handle.join().unwrap_or_default();
    let exit_code = wait_and_remove(&live, registry, &key);

    Ok(PlannerResult {
        stdout: stdout_buf,
        stderr: stderr_buf,
        exit_code,
    })
}

fn build_cli_args(args: &PlannerArgs) -> Result<Vec<String>, PlannerError> {
    side_job_args(&SideJob {
        job: Job::Planner,
        provider_id: &args.provider_id,
        model: &args.model,
        system_prompt: &args.system_prompt,
        user_message: &args.user_message,
        working_dir: args.working_dir.as_deref(),
        tools_disabled: args.tools_disabled,
        effort: args.effort.as_deref(),
    })
    .map_err(PlannerError::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_args(provider_id: &str) -> PlannerArgs {
        PlannerArgs {
            provider_id: provider_id.to_string(),
            model: "cheap-model".to_string(),
            binary: "claude".to_string(),
            user_message: "plan this".to_string(),
            system_prompt: "you plan".to_string(),
            working_dir: None,
            tools_disabled: false,
            effort: None,
        }
    }

    #[test]
    fn cursor_args_never_carry_force() {
        let cli = build_cli_args(&make_args("cursor")).expect("cursor args");
        assert!(!cli.iter().any(|a| a == "--force"), "{cli:?}");
        let idx = cli.iter().position(|a| a == "--model").expect("--model");
        assert_eq!(cli[idx + 1], "cheap-model");
    }

    #[test]
    fn anthropic_args_pass_effort_when_set() {
        let mut args = make_args("anthropic");
        args.effort = Some("high".to_string());
        let cli = build_cli_args(&args).expect("anthropic args");
        let idx = cli.iter().position(|a| a == "--effort").expect("--effort");
        assert_eq!(cli[idx + 1], "high");
    }

    #[test]
    fn codex_args_pass_effort_before_the_prompt() {
        let mut args = make_args("codex");
        args.effort = Some("low".to_string());
        let cli = build_cli_args(&args).expect("codex args");
        let effort_idx = cli
            .iter()
            .position(|a| a == "model_reasoning_effort=\"low\"")
            .expect("effort config");
        let sep_idx = cli.iter().position(|a| a == "--").expect("separator");
        assert!(effort_idx < sep_idx);
    }

    #[test]
    fn args_without_effort_stay_unchanged() {
        let cli = build_cli_args(&make_args("anthropic")).expect("anthropic args");
        assert!(!cli.iter().any(|a| a == "--effort"));
    }

    #[test]
    fn anthropic_args_disable_tools_when_requested() {
        let mut args = make_args("anthropic");
        args.tools_disabled = true;
        let cli = build_cli_args(&args).expect("anthropic args");
        let idx = cli.iter().position(|a| a == "--tools").expect("--tools");
        assert_eq!(cli[idx + 1], "");
        assert!(cli
            .windows(2)
            .any(|pair| pair[0] == "--disallowedTools" && pair[1] == "mcp__*"));
    }

    #[test]
    fn anthropic_args_keep_tools_by_default() {
        let cli = build_cli_args(&make_args("anthropic")).expect("anthropic args");
        assert!(!cli.iter().any(|a| a == "--tools"));
        assert!(cli
            .windows(2)
            .any(|pair| pair[0] == "--disallowedTools" && pair[1] == "mcp__*"));
    }

    #[test]
    fn cursor_and_codex_args_do_not_deny_mcp_tools() {
        for provider_id in ["cursor", "codex"] {
            let cli = build_cli_args(&make_args(provider_id)).expect("provider args");
            assert!(!cli
                .windows(2)
                .any(|pair| pair[0] == "--disallowedTools" && pair[1] == "mcp__*"));
        }
    }

    #[test]
    fn codex_args_run_outside_git_repositories() {
        let cli = build_cli_args(&make_args("codex")).expect("codex args");
        let sep_idx = cli.iter().position(|a| a == "--").expect("separator");
        let skip_idx = cli
            .iter()
            .position(|a| a == "--skip-git-repo-check")
            .expect("--skip-git-repo-check");
        assert!(skip_idx < sep_idx);
        assert!(cli
            .windows(2)
            .any(|pair| pair[0] == "-s" && pair[1] == "read-only"));
    }

    #[test]
    fn anthropic_args_isolate_user_settings() {
        let cli = build_cli_args(&make_args("anthropic")).expect("anthropic args");
        let idx = cli
            .iter()
            .position(|a| a == "--setting-sources")
            .expect("--setting-sources");
        assert_eq!(cli[idx + 1], "project,local");
        assert!(!cli.iter().any(|a| a == "--bare"));
    }

    #[test]
    fn openrouter_uses_opencode_run_args() {
        let mut args = make_args("openrouter");
        args.working_dir = Some("/tmp/project".to_string());
        let cli = build_cli_args(&args).expect("openrouter args");
        assert_eq!(
            cli,
            vec![
                "run",
                "--format",
                "json",
                "-m",
                "cheap-model",
                "--dir",
                "/tmp/project",
                "--dangerously-skip-permissions",
                "--agent",
                "plan",
                "--",
                "you plan\n\nplan this",
            ]
        );
    }

    #[test]
    fn unknown_provider_is_rejected() {
        let err = build_cli_args(&make_args("nonexistent")).expect_err("unknown provider");
        assert_eq!(err.kind(), "unknown_provider");
    }

    #[cfg(unix)]
    #[test]
    fn shutdown_kills_live_planner_runs() {
        use crate::live_child::test_support::{
            assert_waiter_returns, register_sleeping, spawn_waiter,
        };
        let registry = PlannerRegistry::new();
        let live = register_sleeping(&registry.0, "planner-test");
        let waiter = spawn_waiter(&registry.0, "planner-test", &live);

        shutdown(&registry);

        assert_waiter_returns(
            waiter,
            std::time::Duration::from_secs(2),
            "shutdown left the planner running",
        );
        assert!(registry.0.lock().expect("registry").is_empty());
    }
}
