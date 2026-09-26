use std::io::Read;
use std::process::Stdio;
use std::time::{Duration, Instant};

use serde::Serialize;
use thiserror::Error;

use crate::aux_spawn::{scrub_nested_session_env, CLAUDE_SETTING_SOURCES};
use crate::path_env;
use crate::scratch_dir::{prepare_probe_dir, ScratchDirError};

const PROBE_TIMEOUT: Duration = Duration::from_secs(15);
const POLL_INTERVAL: Duration = Duration::from_millis(50);

#[derive(Debug, Error)]
pub enum UsageProbeError {
    #[error("could not prepare a scratch directory: {0}")]
    ScratchDir(#[from] ScratchDirError),
    #[error("could not start claude: {0}")]
    SpawnFailed(String),
    #[error("the usage probe timed out")]
    TimedOut,
    #[error("claude exited with an error: {0}")]
    NonZeroExit(String),
}

impl UsageProbeError {
    fn kind(&self) -> &'static str {
        match self {
            UsageProbeError::ScratchDir(_) => "scratch_dir",
            UsageProbeError::SpawnFailed(_) => "spawn_failed",
            UsageProbeError::TimedOut => "timed_out",
            UsageProbeError::NonZeroExit(_) => "non_zero_exit",
        }
    }
}

crate::util::impl_error_serialize!(UsageProbeError);

#[derive(Debug, Clone, Serialize)]
pub struct UsageProbeOutput {
    pub stdout: String,
    pub stderr: String,
}

fn read_to_string<R: Read>(mut reader: R) -> String {
    let mut buf = String::new();
    let _ = reader.read_to_string(&mut buf);
    buf
}

fn run_probe_until(
    cwd: &str,
    args: &[&str],
    deadline: Instant,
) -> Result<UsageProbeOutput, UsageProbeError> {
    let (binary, rest) = args
        .split_first()
        .ok_or_else(|| UsageProbeError::SpawnFailed("empty command".to_string()))?;
    let mut command = path_env::command(binary);
    command
        .args(rest)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    scrub_nested_session_env(&mut command);
    let mut child = command
        .spawn()
        .map_err(|e| UsageProbeError::SpawnFailed(e.to_string()))?;

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let stdout = child.stdout.take().map(read_to_string).unwrap_or_default();
                let stderr = child.stderr.take().map(read_to_string).unwrap_or_default();
                if status.success() {
                    return Ok(UsageProbeOutput { stdout, stderr });
                }
                let msg = if stderr.trim().is_empty() {
                    stdout
                } else {
                    stderr
                };
                return Err(UsageProbeError::NonZeroExit(msg));
            }
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    return Err(UsageProbeError::TimedOut);
                }
                std::thread::sleep(POLL_INTERVAL);
            }
            Err(e) => return Err(UsageProbeError::SpawnFailed(e.to_string())),
        }
    }
}

fn claude_usage_probe_blocking() -> Result<UsageProbeOutput, UsageProbeError> {
    let cwd = prepare_probe_dir("claude-usage")?;
    run_probe_until(
        &cwd,
        &[
            "claude",
            "-p",
            "/usage",
            "--output-format",
            "json",
            "--setting-sources",
            CLAUDE_SETTING_SOURCES,
            "--no-session-persistence",
        ],
        Instant::now() + PROBE_TIMEOUT,
    )
}

#[tauri::command]
pub async fn claude_usage_probe() -> Result<UsageProbeOutput, UsageProbeError> {
    tauri::async_runtime::spawn_blocking(claude_usage_probe_blocking)
        .await
        .map_err(|e| UsageProbeError::SpawnFailed(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn run_probe_until_reports_missing_binary_as_spawn_failed() {
        let cwd = std::env::temp_dir().to_string_lossy().into_owned();
        let result = run_probe_until(
            &cwd,
            &["goodboy-nonexistent-binary-xyz"],
            Instant::now() + Duration::from_millis(500),
        );
        assert!(matches!(result, Err(UsageProbeError::SpawnFailed(_))));
    }

    #[test]
    fn run_probe_until_captures_stdout_on_success() {
        let cwd = std::env::temp_dir().to_string_lossy().into_owned();
        let result = run_probe_until(&cwd, &["echo", "hello"], Instant::now() + PROBE_TIMEOUT);
        let output = result.expect("echo should succeed");
        assert_eq!(output.stdout.trim(), "hello");
    }

    #[test]
    fn run_probe_until_times_out_on_a_slow_command() {
        let cwd = std::env::temp_dir().to_string_lossy().into_owned();
        let result = run_probe_until(&cwd, &["sleep", "5"], Instant::now() + Duration::from_millis(200));
        assert!(matches!(result, Err(UsageProbeError::TimedOut)));
    }

    #[test]
    fn run_probe_until_reports_a_failing_exit_as_non_zero() {
        let cwd = std::env::temp_dir().to_string_lossy().into_owned();
        let result = run_probe_until(
            &cwd,
            &["sh", "-c", "echo boom >&2; exit 1"],
            Instant::now() + PROBE_TIMEOUT,
        );
        match result {
            Err(UsageProbeError::NonZeroExit(msg)) => assert!(msg.contains("boom")),
            other => panic!("expected NonZeroExit, got {other:?}"),
        }
    }
}
