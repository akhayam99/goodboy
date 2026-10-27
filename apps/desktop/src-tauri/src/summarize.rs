use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;

use crate::aux_spawn::SpawnKind;
use crate::live_child::{
    run_side_job, LiveChildRegistry, RunSideJobParams, MAX_SIDE_JOB_STDOUT_BYTES, SIDE_JOB_IDLE,
};
use crate::providers::cli_args::{side_job_args, side_job_stdin, ArgsError, Job, SideJob};

#[derive(Debug, Error)]
pub enum SummarizeError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("unknown provider: {0}")]
    UnknownProvider(String),
    #[error("argument policy violated: {0}")]
    Policy(String),
}

impl From<ArgsError> for SummarizeError {
    fn from(error: ArgsError) -> Self {
        match error {
            ArgsError::UnknownProvider(provider) => SummarizeError::UnknownProvider(provider),
            ArgsError::Policy(message) => SummarizeError::Policy(message),
        }
    }
}

crate::util::impl_error_serialize!(SummarizeError);

impl SummarizeError {
    fn kind(&self) -> &'static str {
        match self {
            SummarizeError::Io(_) => "io",
            SummarizeError::UnknownProvider(_) => "unknown_provider",
            SummarizeError::Policy(_) => "policy",
        }
    }
}

type ChildRegistry = LiveChildRegistry;

#[derive(Default)]
pub struct SummarizeRegistry(pub ChildRegistry);

impl SummarizeRegistry {
    pub fn new() -> Self {
        Self::default()
    }
}

pub fn shutdown(registry: &SummarizeRegistry) {
    crate::live_child::shutdown(&registry.0);
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummarizeArgs {
    pub provider_id: String,
    pub model: String,
    pub binary: String,
    pub user_message: String,
    pub system_prompt: String,
    #[serde(default)]
    pub working_dir: Option<String>,
    #[serde(default)]
    pub effort: Option<String>,
    #[serde(default)]
    pub run_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SummarizeResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub is_timed_out: bool,
}

#[tauri::command]
pub async fn summarize_session(
    state: State<'_, SummarizeRegistry>,
    args: SummarizeArgs,
) -> Result<SummarizeResult, SummarizeError> {
    let registry = Arc::clone(&state.0);
    tauri::async_runtime::spawn_blocking(move || run_summarize(&registry, args))
        .await
        .map_err(|e| SummarizeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub fn summarize_cancel(
    state: State<'_, SummarizeRegistry>,
    run_id: String,
) -> Result<(), SummarizeError> {
    kill_run(&state.0, &run_id);
    Ok(())
}

pub(crate) fn run_summarize(
    registry: &ChildRegistry,
    args: SummarizeArgs,
) -> Result<SummarizeResult, SummarizeError> {
    let mut cli_args = build_cli_args(&args)?;
    let trust = crate::providers::cli_probe::workspace_trust_args(&args.binary, &cli_args);
    cli_args.extend(trust);
    let output = run_side_job(RunSideJobParams {
        registry,
        kind: SpawnKind::Summary,
        binary: &args.binary,
        cli_args: &cli_args,
        working_dir: args.working_dir.as_deref(),
        prompt: side_job_stdin(&side_job_of(&args)),
        run_id: args.run_id.as_deref(),
        idle: SIDE_JOB_IDLE,
        max_stdout_bytes: MAX_SIDE_JOB_STDOUT_BYTES,
    })?;
    Ok(SummarizeResult {
        stdout: output.stdout,
        stderr: output.stderr,
        exit_code: output.exit_code,
        is_timed_out: output.is_timed_out,
    })
}

fn kill_run(registry: &ChildRegistry, run_id: &str) {
    crate::live_child::kill_one(registry, run_id);
}

fn side_job_of(args: &SummarizeArgs) -> SideJob<'_> {
    SideJob {
        job: Job::Summarizer,
        provider_id: &args.provider_id,
        model: &args.model,
        system_prompt: &args.system_prompt,
        user_message: &args.user_message,
        working_dir: args.working_dir.as_deref(),
        tools_disabled: true,
        effort: args.effort.as_deref(),
    }
}

fn build_cli_args(args: &SummarizeArgs) -> Result<Vec<String>, SummarizeError> {
    side_job_args(&side_job_of(args)).map_err(SummarizeError::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::live_child::LiveChild;
    use std::collections::HashMap;
    use std::sync::Mutex;
    use std::thread;

    fn make_args(provider_id: &str) -> SummarizeArgs {
        SummarizeArgs {
            provider_id: provider_id.to_string(),
            model: "cheap-model".to_string(),
            binary: "claude".to_string(),
            user_message: "summarize this".to_string(),
            system_prompt: "you summarize".to_string(),
            working_dir: None,
            effort: None,
            run_id: None,
        }
    }

    #[test]
    fn anthropic_args_pass_effort_when_set() {
        let mut args = make_args("anthropic");
        args.effort = Some("medium".to_string());
        let cli = build_cli_args(&args).expect("anthropic args");
        let idx = cli.iter().position(|a| a == "--effort").expect("--effort");
        assert_eq!(cli[idx + 1], "medium");
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
    fn anthropic_args_disable_builtin_tools() {
        let cli = build_cli_args(&make_args("anthropic")).expect("anthropic args");
        let idx = cli.iter().position(|a| a == "--tools").expect("--tools");
        assert_eq!(cli[idx + 1], "");
    }

    #[test]
    fn anthropic_args_deny_mcp_tools() {
        let cli = build_cli_args(&make_args("anthropic")).expect("anthropic args");
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
    fn gemini_is_supported() {
        let cli = build_cli_args(&make_args("gemini")).expect("gemini args");
        assert!(cli.iter().any(|a| a == "--sandbox"));
        let idx = cli.iter().position(|a| a == "--model").expect("--model");
        assert_eq!(cli[idx + 1], "cheap-model");
    }

    #[test]
    fn opencode_uses_run_args() {
        let mut args = make_args("opencode");
        args.working_dir = Some("/tmp/project".to_string());
        let cli = build_cli_args(&args).expect("opencode args");
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
                "--agent",
                "plan",
                "--",
                "you summarize\n\nsummarize this",
            ]
        );
    }

    #[test]
    fn cursor_args_never_carry_force() {
        let cli = build_cli_args(&make_args("cursor")).expect("cursor args");
        assert!(!cli.iter().any(|a| a == "--force"), "{cli:?}");
        let idx = cli.iter().position(|a| a == "--model").expect("--model");
        assert_eq!(cli[idx + 1], "cheap-model");
    }

    #[test]
    fn unknown_provider_is_rejected() {
        let err = build_cli_args(&make_args("nonexistent")).expect_err("unknown provider");
        assert_eq!(err.kind(), "unknown_provider");
    }

    #[cfg(unix)]
    fn register_sleeping_child(registry: &ChildRegistry, run_id: &str) -> LiveChild {
        crate::live_child::test_support::register_sleeping(registry, run_id)
    }

    #[cfg(unix)]
    fn assert_exits_within(live: &LiveChild, budget: std::time::Duration, message: &str) {
        let deadline = std::time::Instant::now() + budget;
        loop {
            let exited = live
                .slot
                .lock()
                .expect("slot")
                .as_mut()
                .expect("child")
                .try_wait()
                .expect("try_wait")
                .is_some();
            if exited {
                return;
            }
            assert!(std::time::Instant::now() < deadline, "{message}");
            thread::sleep(std::time::Duration::from_millis(20));
        }
    }

    #[cfg(unix)]
    #[test]
    fn cancel_kills_the_registered_child() {
        let registry: ChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let slot = register_sleeping_child(&registry, "run-1");

        kill_run(&registry, "run-1");

        assert_exits_within(
            &slot,
            std::time::Duration::from_secs(2),
            "cancel left the child running",
        );
    }

    #[cfg(unix)]
    #[test]
    fn cancel_leaves_a_different_run_alive() {
        let registry: ChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let cancelled = register_sleeping_child(&registry, "run-1");
        let other = register_sleeping_child(&registry, "run-2");

        kill_run(&registry, "run-1");

        assert_exits_within(
            &cancelled,
            std::time::Duration::from_secs(2),
            "cancel left the child running",
        );
        assert!(other
            .slot
            .lock()
            .expect("slot")
            .as_mut()
            .expect("child")
            .try_wait()
            .expect("try_wait")
            .is_none());
        kill_run(&registry, "run-2");
    }

    #[test]
    fn cancel_for_an_unknown_run_is_a_no_op() {
        let registry: ChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        kill_run(&registry, "missing");
        assert!(registry.lock().expect("registry").is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn waiting_drops_the_registry_entry() {
        let registry: ChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let slot = register_sleeping_child(&registry, "run-1");
        kill_run(&registry, "run-1");

        crate::live_child::wait_and_remove(&slot, &registry, "run-1");

        assert!(registry.lock().expect("registry").is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn shutdown_kills_live_summaries() {
        use crate::live_child::test_support::{assert_waiter_returns, spawn_waiter};
        let registry = SummarizeRegistry::new();
        let live = register_sleeping_child(&registry.0, "run-1");
        let waiter = spawn_waiter(&registry.0, "run-1", &live);

        shutdown(&registry);

        assert_waiter_returns(
            waiter,
            std::time::Duration::from_secs(2),
            "shutdown left the summary running",
        );
        assert!(registry.0.lock().expect("registry").is_empty());
    }
}
