use std::process::Stdio;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PlannerError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("unknown provider: {0}")]
    UnknownProvider(String),
}

crate::util::impl_error_serialize!(PlannerError);

impl PlannerError {
    fn kind(&self) -> &'static str {
        match self {
            PlannerError::Io(_) => "io",
            PlannerError::UnknownProvider(_) => "unknown_provider",
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
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannerResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

#[tauri::command]
pub async fn planner_run(args: PlannerArgs) -> Result<PlannerResult, PlannerError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cli_args = build_cli_args(&args)?;

        let mut command = crate::path_env::command(&args.binary);
        crate::aux_spawn::scrub_nested_session_env(&mut command);
        if let Some(dir) = args.working_dir.as_deref() {
            if !dir.is_empty() {
                command.current_dir(dir);
            }
        }

        let output = command
            .args(&cli_args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()?;

        Ok(PlannerResult {
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            exit_code: output.status.code(),
        })
    })
    .await
    .map_err(|e| PlannerError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?
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
                crate::aux_spawn::CLAUDE_SETTING_SOURCES.to_string(),
                "--output-format".to_string(),
                "json".to_string(),
                "--no-session-persistence".to_string(),
            ];
            if args.tools_disabled {
                cli_args.push("--tools".to_string());
                cli_args.push(String::new());
            }
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
        "codex" => Ok(vec![
            "exec".to_string(),
            "--json".to_string(),
            "--model".to_string(),
            args.model.clone(),
            "--".to_string(),
            format!("{}\n\n{}", args.system_prompt, args.user_message),
        ]),
        "gemini" => Ok(vec![
            "-p".to_string(),
            format!("{}\n\n{}", args.system_prompt, args.user_message),
            "--model".to_string(),
            args.model.clone(),
            "--sandbox".to_string(),
        ]),
        "opencode" | "openrouter" => {
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
        }
    }

    #[test]
    fn anthropic_args_disable_tools_when_requested() {
        let mut args = make_args("anthropic");
        args.tools_disabled = true;
        let cli = build_cli_args(&args).expect("anthropic args");
        let idx = cli.iter().position(|a| a == "--tools").expect("--tools");
        assert_eq!(cli[idx + 1], "");
    }

    #[test]
    fn anthropic_args_keep_tools_by_default() {
        let cli = build_cli_args(&make_args("anthropic")).expect("anthropic args");
        assert!(!cli.iter().any(|a| a == "--tools"));
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
