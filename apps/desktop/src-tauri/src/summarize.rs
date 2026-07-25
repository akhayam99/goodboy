use std::process::Stdio;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SummarizeError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("unknown provider: {0}")]
    UnknownProvider(String),
}

crate::util::impl_error_serialize!(SummarizeError);

impl SummarizeError {
    fn kind(&self) -> &'static str {
        match self {
            SummarizeError::Io(_) => "io",
            SummarizeError::UnknownProvider(_) => "unknown_provider",
        }
    }
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
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SummarizeResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

#[tauri::command]
pub async fn summarize_session(args: SummarizeArgs) -> Result<SummarizeResult, SummarizeError> {
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

        Ok(SummarizeResult {
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            exit_code: output.status.code(),
        })
    })
    .await
    .map_err(|e| SummarizeError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?
}

fn build_cli_args(args: &SummarizeArgs) -> Result<Vec<String>, SummarizeError> {
    match args.provider_id.as_str() {
        "anthropic" => Ok(vec![
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
        ]),
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
            "-m".to_string(),
            args.model.clone(),
            "-s".to_string(),
            "read-only".to_string(),
            "--skip-git-repo-check".to_string(),
            format!("{}\n\n{}", args.system_prompt, args.user_message),
        ]),
        "gemini" => Ok(vec![
            "-p".to_string(),
            format!("{}\n\n{}", args.system_prompt, args.user_message),
            "--model".to_string(),
            args.model.clone(),
            "--sandbox".to_string(),
        ]),
        other => Err(SummarizeError::UnknownProvider(other.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_args(provider_id: &str) -> SummarizeArgs {
        SummarizeArgs {
            provider_id: provider_id.to_string(),
            model: "cheap-model".to_string(),
            binary: "claude".to_string(),
            user_message: "summarize this".to_string(),
            system_prompt: "you summarize".to_string(),
            working_dir: None,
        }
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
    fn gemini_is_supported() {
        let cli = build_cli_args(&make_args("gemini")).expect("gemini args");
        assert!(cli.iter().any(|a| a == "--sandbox"));
        let idx = cli.iter().position(|a| a == "--model").expect("--model");
        assert_eq!(cli[idx + 1], "cheap-model");
    }

    #[test]
    fn unknown_provider_is_rejected() {
        let err = build_cli_args(&make_args("openrouter")).expect_err("unknown provider");
        assert_eq!(err.kind(), "unknown_provider");
    }
}
