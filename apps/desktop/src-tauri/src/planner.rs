use std::process::Stdio;

use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PlannerError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("unknown provider: {0}")]
    UnknownProvider(String),
    #[error("invocation admission error: {0}")]
    Admission(#[from] crate::invocation_admission::AdmissionError),
    #[error("{0}")]
    WriterLease(#[from] crate::writer_lease::ExposureLeaseError),
}

crate::util::impl_error_serialize!(PlannerError);

impl PlannerError {
    fn kind(&self) -> &'static str {
        match self {
            PlannerError::Io(_) => "io",
            PlannerError::UnknownProvider(_) => "unknown_provider",
            PlannerError::Admission(_) => "admission",
            PlannerError::WriterLease(_) => "writer_lease",
        }
    }
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
    #[serde(default)]
    pub invocation: Option<crate::invocation_admission::InvocationContext>,
    #[serde(default)]
    pub managed_checkouts: Vec<crate::writer_lease::ManagedCheckout>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannerResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

fn exposure(args: &PlannerArgs) -> Vec<String> {
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
pub async fn planner_run(
    admission: State<'_, crate::invocation_admission::InvocationAdmission>,
    queue: State<'_, crate::writer_lease::WriterLeaseQueue>,
    database: State<'_, crate::db::Db>,
    args: PlannerArgs,
) -> Result<PlannerResult, PlannerError> {
    let admission = admission.inner().clone();
    let database = database.inner().clone();
    let cli_args = build_cli_args(&args)?;
    let invocation = args.invocation.clone().unwrap_or_else(|| {
        crate::invocation_admission::InvocationContext {
            invocation_id: format!("planner-{}-{}", std::process::id(), crate::util::now_ms()),
            workspace_id: None,
            session_id: None,
            workflow_run_id: None,
            agent_id: None,
            provider_identity: None,
            purpose: "planner".to_string(),
            is_heavyweight: false,
            limits: crate::invocation_admission::InvocationLimits::default(),
            spend_reservation: None,
        }
    });
    let lease = crate::writer_lease::hold_exposure(
        &database,
        queue.inner(),
        &invocation.invocation_id,
        &exposure(&args),
    )
    .await?;
    tauri::async_runtime::spawn_blocking(move || {
        let cancel_key = invocation.invocation_id.clone();
        let mut permit = admission.admit(
            database,
            invocation.request(&args.provider_id),
            &cancel_key,
        )?;

        let mut command = crate::path_env::command(&args.binary);
        crate::aux_spawn::scrub_nested_session_env(&mut command);
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
        let armed = crate::aux_spawn::KillOnDrop::new(child);
        permit.bind_process(process_id)?;
        if let Some(lease) = lease.as_ref() {
            lease.bind_process(process_id);
        }
        let child = armed
            .disarm()
            .ok_or_else(|| PlannerError::Io(std::io::Error::other("planner child missing")))?;
        let output = child.wait_with_output()?;
        drop(lease);
        let exit_code = output.status.code();
        let reason = if exit_code == Some(0) {
            "completed"
        } else {
            "non_zero_exit"
        };
        permit.release(reason, exit_code)?;

        Ok(PlannerResult {
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            exit_code,
        })
    })
    .await
    .map_err(|e| {
        PlannerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })?
}

fn build_cli_args(args: &PlannerArgs) -> Result<Vec<String>, PlannerError> {
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
                crate::aux_spawn::claude_setting_sources(!args.tools_disabled).to_string(),
                "--output-format".to_string(),
                "json".to_string(),
                "--no-session-persistence".to_string(),
                "--permission-mode".to_string(),
                "default".to_string(),
                "--tools".to_string(),
            ];
            match args.tools_disabled {
                true => cli_args.push(String::new()),
                false => cli_args.push(crate::aux_spawn::CLAUDE_READ_ONLY_TOOLS.to_string()),
            }
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
                "--model".to_string(),
                args.model.clone(),
                "-s".to_string(),
                "read-only".to_string(),
            ];
            crate::aux_spawn::push_effort_args("codex", args.effort.as_deref(), &mut cli_args);
            cli_args.push("--".to_string());
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
            cli_args.push("--agent".to_string());
            cli_args.push("plan".to_string());
            cli_args.push("--".to_string());
            cli_args.push(format!("{}\n\n{}", args.system_prompt, args.user_message));
            Ok(cli_args)
        }
        other => Err(PlannerError::UnknownProvider(other.to_string())),
    }
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
            invocation: None,
            managed_checkouts: Vec::new(),
        }
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
    fn anthropic_args_keep_only_read_only_tools_by_default() {
        let cli = build_cli_args(&make_args("anthropic")).expect("anthropic args");
        let idx = cli.iter().position(|a| a == "--tools").expect("--tools");
        assert_eq!(cli[idx + 1], crate::aux_spawn::CLAUDE_READ_ONLY_TOOLS);
        let mode = cli
            .iter()
            .position(|a| a == "--permission-mode")
            .expect("--permission-mode");
        assert_eq!(cli[mode + 1], "default");
        assert!(cli
            .windows(2)
            .any(|pair| pair[0] == "--disallowedTools" && pair[1] == "mcp__*"));
    }

    #[test]
    fn codex_args_run_in_the_read_only_sandbox() {
        let cli = build_cli_args(&make_args("codex")).expect("codex args");
        assert!(cli
            .windows(2)
            .any(|pair| pair[0] == "-s" && pair[1] == "read-only"));
    }

    #[test]
    fn only_an_unproven_planner_launcher_leases_its_checkout() {
        let mut claude = make_args("anthropic");
        claude.working_dir = Some("/repos/app/.worktrees/one".to_string());
        assert!(exposure(&claude).is_empty());

        let mut codex = make_args("codex");
        codex.binary = "codex".to_string();
        codex.working_dir = Some("/repos/app/.worktrees/one".to_string());
        assert!(exposure(&codex).is_empty());

        let mut cursor = make_args("cursor");
        cursor.binary = "cursor-agent".to_string();
        cursor.working_dir = Some("/repos/app/.worktrees/one".to_string());
        cursor.managed_checkouts = vec![crate::writer_lease::ManagedCheckout {
            repo_root: "/repos/app".to_string(),
            worktree_path: "/repos/app/.worktrees/one".to_string(),
            git_dir: None,
        }];
        assert_eq!(
            exposure(&cursor),
            vec![crate::writer_lease::worktree_resource(
                "/repos/app",
                "/repos/app/.worktrees/one"
            )]
        );
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
    fn anthropic_args_isolate_user_settings() {
        let cli = build_cli_args(&make_args("anthropic")).expect("anthropic args");
        let idx = cli
            .iter()
            .position(|a| a == "--setting-sources")
            .expect("--setting-sources");
        assert_eq!(cli[idx + 1], "local");
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
}
