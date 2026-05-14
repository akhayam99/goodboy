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

impl Serialize for SummarizeError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serde_json::Map::new();
        map.insert(
            "kind".to_string(),
            serde_json::Value::String(self.kind().to_string()),
        );
        map.insert(
            "message".to_string(),
            serde_json::Value::String(self.to_string()),
        );
        serde_json::Value::Object(map).serialize(serializer)
    }
}

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
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SummarizeResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

#[tauri::command]
pub async fn summarize_task(args: SummarizeArgs) -> Result<SummarizeResult, SummarizeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cli_args = build_cli_args(&args)?;

        let output = crate::path_env::command(&args.binary)
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
        other => Err(SummarizeError::UnknownProvider(other.to_string())),
    }
}
