use std::process::Stdio;
use std::sync::Arc;
use std::thread;

use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;

use crate::live_child::{
    drain_lossy, drain_tail_lossy, wait_and_remove, LiveChild, LiveChildRegistry, MAX_STDERR_BYTES,
};

#[derive(Debug, Error)]
pub enum SummarizeError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("unknown provider: {0}")]
    UnknownProvider(String),
    #[error("invocation admission error: {0}")]
    Admission(#[from] crate::invocation_admission::AdmissionError),
    #[error("{0}")]
    WriterLease(#[from] crate::writer_lease::ExposureLeaseError),
}

crate::util::impl_error_serialize!(SummarizeError);

impl SummarizeError {
    fn kind(&self) -> &'static str {
        match self {
            SummarizeError::Io(_) => "io",
            SummarizeError::UnknownProvider(_) => "unknown_provider",
            SummarizeError::Admission(_) => "admission",
            SummarizeError::WriterLease(_) => "writer_lease",
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
    #[serde(default)]
    pub invocation: Option<crate::invocation_admission::InvocationContext>,
    #[serde(default)]
    pub managed_checkouts: Vec<crate::writer_lease::ManagedCheckout>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SummarizeResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

fn exposure(args: &SummarizeArgs) -> Vec<String> {
    let Some(working_dir) = args.working_dir.as_deref().filter(|dir| !dir.is_empty()) else {
        return Vec::new();
    };
    crate::writer_lease::invocation_exposure(&crate::writer_lease::InvocationExposure {
        binary: &args.binary,
        permission_mode: "default",
        is_read_only_role: matches!(args.provider_id.as_str(), "anthropic" | "codex"),
        working_dir,
        writable_roots: &[],
        checkouts: &args.managed_checkouts,
    })
}

#[tauri::command]
pub async fn summarize_session(
    state: State<'_, SummarizeRegistry>,
    admission: State<'_, crate::invocation_admission::InvocationAdmission>,
    queue: State<'_, crate::writer_lease::WriterLeaseQueue>,
    database: State<'_, crate::db::Db>,
    args: SummarizeArgs,
) -> Result<SummarizeResult, SummarizeError> {
    let registry = Arc::clone(&state.0);
    let admission = admission.inner().clone();
    let database = database.inner().clone();
    let invocation =
        args.invocation
            .clone()
            .unwrap_or_else(|| crate::invocation_admission::InvocationContext {
                invocation_id: args.run_id.clone().unwrap_or_else(|| {
                    format!(
                        "summarizer-{}-{}",
                        std::process::id(),
                        crate::util::now_ms()
                    )
                }),
                workspace_id: None,
                session_id: None,
                workflow_run_id: None,
                agent_id: None,
                provider_identity: None,
                purpose: "summarizer".to_string(),
                is_heavyweight: false,
                limits: crate::invocation_admission::InvocationLimits::default(),
                spend_reservation: None,
            });
    let cancel_key = args
        .run_id
        .clone()
        .unwrap_or_else(|| invocation.invocation_id.clone());
    let lease = crate::writer_lease::hold_exposure(
        &database,
        queue.inner(),
        &cancel_key,
        &exposure(&args),
    )
    .await?;
    tauri::async_runtime::spawn_blocking(move || {
        let request = invocation.request(&args.provider_id);
        let permit = admission.admit(database, request, &cancel_key)?;
        run_summarize(&registry, permit, lease, args)
    })
    .await
    .map_err(|e| SummarizeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub fn summarize_cancel(
    state: State<'_, SummarizeRegistry>,
    admission: State<'_, crate::invocation_admission::InvocationAdmission>,
    queue: State<'_, crate::writer_lease::WriterLeaseQueue>,
    run_id: String,
) -> Result<(), SummarizeError> {
    queue.cancel(&run_id);
    admission.cancel(&run_id);
    kill_run(&state.0, &run_id);
    Ok(())
}

fn run_summarize(
    registry: &ChildRegistry,
    mut permit: crate::invocation_admission::InvocationPermit,
    lease: Option<crate::writer_lease::HeldWriterLease>,
    args: SummarizeArgs,
) -> Result<SummarizeResult, SummarizeError> {
    let cli_args = build_cli_args(&args)?;

    let mut command = crate::path_env::command(&args.binary);
    crate::aux_spawn::scrub_nested_session_env(&mut command);
    crate::process_group::isolate(&mut command);
    if let Some(dir) = args.working_dir.as_deref() {
        if !dir.is_empty() {
            command.current_dir(dir);
        }
    }

    let child = command
        .args(&cli_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let process_id = child.id();
    let mut armed = crate::aux_spawn::KillOnDrop::new(child);
    permit.bind_process(process_id)?;
    if let Some(lease) = lease.as_ref() {
        lease.bind_process(process_id);
    }
    let (stdout, stderr) = armed
        .child()
        .map(|child| (child.stdout.take(), child.stderr.take()))
        .unwrap_or((None, None));
    let stdout = stdout.ok_or_else(|| SummarizeError::Io(std::io::Error::other("no stdout")))?;
    let stderr = stderr.ok_or_else(|| SummarizeError::Io(std::io::Error::other("no stderr")))?;

    let child = armed
        .disarm()
        .ok_or_else(|| SummarizeError::Io(std::io::Error::other("summarize child missing")))?;
    let key = args
        .run_id
        .clone()
        .unwrap_or_else(|| crate::live_child::anonymous_key("summary"));
    let live = LiveChild::new(child);
    crate::live_child::register(registry, &key, &live);

    let stdout_handle = thread::spawn(move || drain_lossy(stdout));
    let stderr_handle = thread::spawn(move || drain_tail_lossy(stderr, MAX_STDERR_BYTES));
    let stdout_buf = stdout_handle.join().unwrap_or_default();
    let stderr_buf = stderr_handle.join().unwrap_or_default();
    let exit_code = wait_and_remove(&live, registry, &key);
    let reason = if exit_code == Some(0) {
        "completed"
    } else {
        "non_zero_exit"
    };
    permit.release(reason, exit_code)?;

    Ok(SummarizeResult {
        stdout: stdout_buf,
        stderr: stderr_buf,
        exit_code,
    })
}

fn kill_run(registry: &ChildRegistry, run_id: &str) {
    crate::live_child::kill_one(registry, run_id);
}

fn build_cli_args(args: &SummarizeArgs) -> Result<Vec<String>, SummarizeError> {
    match args.provider_id.as_str() {
        "anthropic" => {
            let mut cli_args = vec![
                "-p".to_string(),
                args.user_message.clone(),
                "--model".to_string(),
                args.model.clone(),
                "--system-prompt".to_string(),
                args.system_prompt.clone(),
                "--setting-sources".to_string(),
                crate::aux_spawn::CLAUDE_SETTING_SOURCES.to_string(),
                "--output-format".to_string(),
                "json".to_string(),
                "--no-session-persistence".to_string(),
                "--tools".to_string(),
                String::new(),
            ];
            crate::aux_spawn::push_claude_mcp_deny(&mut cli_args);
            crate::aux_spawn::push_effort_args("anthropic", args.effort.as_deref(), &mut cli_args);
            Ok(cli_args)
        }
        "cursor" => Ok(vec![
            "-p".to_string(),
            format!("{}\n\n{}", args.system_prompt, args.user_message),
            "--model".to_string(),
            args.model.clone(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--force".to_string(),
        ]),
        "codex" => {
            let mut cli_args = vec![
                "exec".to_string(),
                "--json".to_string(),
                "-m".to_string(),
                args.model.clone(),
                "-s".to_string(),
                "read-only".to_string(),
                "--skip-git-repo-check".to_string(),
            ];
            crate::aux_spawn::push_effort_args("codex", args.effort.as_deref(), &mut cli_args);
            cli_args.push(format!("{}\n\n{}", args.system_prompt, args.user_message));
            Ok(cli_args)
        }
        "gemini" => Ok(vec![
            "-p".to_string(),
            format!("{}\n\n{}", args.system_prompt, args.user_message),
            "--model".to_string(),
            args.model.clone(),
            "--sandbox".to_string(),
        ]),
        "opencode" | "openrouter" | "moonshot" => {
            let mut cli_args = vec![
                "run".to_string(),
                "--format".to_string(),
                "json".to_string(),
                "-m".to_string(),
                args.model.clone(),
            ];
            if let Some(working_dir) = args.working_dir.as_deref() {
                cli_args.push("--dir".to_string());
                cli_args.push(working_dir.to_string());
            }
            crate::aux_spawn::push_effort_args(
                &args.provider_id,
                args.effort.as_deref(),
                &mut cli_args,
            );
            cli_args.push("--agent".to_string());
            cli_args.push("plan".to_string());
            cli_args.push("--".to_string());
            cli_args.push(format!("{}\n\n{}", args.system_prompt, args.user_message));
            Ok(cli_args)
        }
        other => Err(SummarizeError::UnknownProvider(other.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Mutex;

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
            invocation: None,
            managed_checkouts: Vec::new(),
        }
    }

    #[test]
    fn only_an_unproven_summarizer_launcher_leases_its_checkout() {
        let mut claude = make_args("anthropic");
        claude.working_dir = Some("/repos/app/.worktrees/one".to_string());
        assert!(exposure(&claude).is_empty());

        let mut codex = make_args("codex");
        codex.binary = "codex".to_string();
        codex.working_dir = Some("/repos/app/.worktrees/one".to_string());
        assert!(exposure(&codex).is_empty());

        for (provider_id, binary) in [("cursor", "cursor-agent"), ("opencode", "opencode")] {
            let mut unproven = make_args(provider_id);
            unproven.binary = binary.to_string();
            unproven.working_dir = Some("/repos/app/.worktrees/one".to_string());
            assert_eq!(exposure(&unproven).len(), 1, "{binary} must hold a lease");
        }

        let mut detached = make_args("cursor");
        detached.binary = "cursor-agent".to_string();
        assert!(exposure(&detached).is_empty());
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

        wait_and_remove(&slot, &registry, "run-1");

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
