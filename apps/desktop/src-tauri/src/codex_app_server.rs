use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Stdio};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::time::{Duration, Instant};

use serde_json::{json, Value};
use thiserror::Error;

use crate::path_env;
use crate::scratch_dir::{prepare_probe_dir, ScratchDirError};

const READ_TIMEOUT: Duration = Duration::from_secs(15);
const CONSUME_TIMEOUT: Duration = Duration::from_secs(20);
const INITIALIZE_ID: u64 = 1;
const REQUEST_ID: u64 = 2;

#[derive(Debug, Error)]
pub enum CodexAppServerError {
    #[error("could not prepare a scratch directory: {0}")]
    ScratchDir(#[from] ScratchDirError),
    #[error("could not start codex app-server: {0}")]
    SpawnFailed(String),
    #[error("codex app-server did not answer in time")]
    TimedOut,
    #[error("codex app-server closed before answering")]
    Closed,
    #[error("codex app-server returned an error: {0}")]
    Rpc(String),
}

impl CodexAppServerError {
    fn kind(&self) -> &'static str {
        match self {
            CodexAppServerError::ScratchDir(_) => "scratch_dir",
            CodexAppServerError::SpawnFailed(_) => "spawn_failed",
            CodexAppServerError::TimedOut => "timed_out",
            CodexAppServerError::Closed => "closed",
            CodexAppServerError::Rpc(_) => "rpc",
        }
    }
}

crate::util::impl_error_serialize!(CodexAppServerError);

fn write_message(stdin: &mut ChildStdin, message: &Value) -> Result<(), CodexAppServerError> {
    let mut line = message.to_string();
    line.push('\n');
    stdin
        .write_all(line.as_bytes())
        .and_then(|_| stdin.flush())
        .map_err(|_| CodexAppServerError::Closed)
}

fn rpc_error_message(error: &Value) -> String {
    error
        .get("message")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| error.to_string())
}

fn initialize_message() -> Value {
    json!({
        "id": INITIALIZE_ID,
        "method": "initialize",
        "params": {
            "clientInfo": {
                "name": "goodboy",
                "title": "Goodboy",
                "version": env!("CARGO_PKG_VERSION"),
            },
            "capabilities": null,
        },
    })
}

fn converse(
    stdin: &mut ChildStdin,
    lines: &Receiver<String>,
    method: &str,
    params: Value,
    deadline: Instant,
) -> Result<Value, CodexAppServerError> {
    write_message(stdin, &initialize_message())?;
    let mut request = Some(json!({ "id": REQUEST_ID, "method": method, "params": params }));
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err(CodexAppServerError::TimedOut);
        }
        let line = match lines.recv_timeout(remaining) {
            Ok(line) => line,
            Err(RecvTimeoutError::Timeout) => return Err(CodexAppServerError::TimedOut),
            Err(RecvTimeoutError::Disconnected) => return Err(CodexAppServerError::Closed),
        };
        let Ok(message) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let Some(id) = message.get("id").and_then(Value::as_u64) else {
            continue;
        };
        if let Some(error) = message.get("error") {
            return Err(CodexAppServerError::Rpc(rpc_error_message(error)));
        }
        if id == INITIALIZE_ID {
            let Some(next) = request.take() else {
                continue;
            };
            write_message(stdin, &json!({ "method": "initialized" }))?;
            write_message(stdin, &next)?;
            continue;
        }
        if id == REQUEST_ID {
            return Ok(message.get("result").cloned().unwrap_or(Value::Null));
        }
    }
}

fn spawn_line_reader(child: &mut Child) -> Result<Receiver<String>, CodexAppServerError> {
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| CodexAppServerError::SpawnFailed("no stdout".to_string()))?;
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else {
                return;
            };
            if sender.send(line).is_err() {
                return;
            }
        }
    });
    Ok(receiver)
}

fn call_with(
    program: &[&str],
    cwd: &str,
    method: &str,
    params: Value,
    timeout: Duration,
) -> Result<Value, CodexAppServerError> {
    let (binary, rest) = program
        .split_first()
        .ok_or_else(|| CodexAppServerError::SpawnFailed("empty command".to_string()))?;
    let mut command = path_env::command(binary);
    command
        .args(rest)
        .current_dir(cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    crate::process_group::isolate(&mut command);
    let mut child = command
        .spawn()
        .map_err(|e| CodexAppServerError::SpawnFailed(e.to_string()))?;
    let result = (|| {
        let lines = spawn_line_reader(&mut child)?;
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| CodexAppServerError::SpawnFailed("no stdin".to_string()))?;
        converse(&mut stdin, &lines, method, params, Instant::now() + timeout)
    })();
    crate::process_group::kill(child.id());
    let _ = child.kill();
    let _ = child.wait();
    result
}

fn call_app_server(
    method: &str,
    params: Value,
    timeout: Duration,
) -> Result<Value, CodexAppServerError> {
    let cwd = prepare_probe_dir("codex-app-server")?;
    call_with(&["codex", "app-server"], &cwd, method, params, timeout)
}

#[tauri::command]
pub async fn codex_rate_limits_probe(
    include_reset_credit_details: bool,
) -> Result<Value, CodexAppServerError> {
    tauri::async_runtime::spawn_blocking(move || {
        call_app_server(
            "account/rateLimits/read",
            json!({ "excludeResetCreditDetails": !include_reset_credit_details }),
            READ_TIMEOUT,
        )
    })
    .await
    .map_err(|e| CodexAppServerError::SpawnFailed(e.to_string()))?
}

#[tauri::command]
pub async fn codex_consume_reset_credit(
    idempotency_key: String,
) -> Result<Value, CodexAppServerError> {
    tauri::async_runtime::spawn_blocking(move || {
        call_app_server(
            "account/rateLimitResetCredit/consume",
            json!({ "idempotencyKey": idempotency_key }),
            CONSUME_TIMEOUT,
        )
    })
    .await
    .map_err(|e| CodexAppServerError::SpawnFailed(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_cwd() -> String {
        std::env::temp_dir().to_string_lossy().into_owned()
    }

    const FAKE_SERVER: &str = r#"read init
echo '{"id":1,"result":{"platformOs":"macos"}}'
echo '{"method":"account/updated","params":{"planType":"plus"}}'
read initialized
read request
case "$request" in
  *'"account/rateLimits/read"'*'"excludeResetCreditDetails":true'*) echo '{"id":2,"result":{"rateLimits":{"limitId":"codex"}}}' ;;
  *) echo '{"id":2,"error":{"code":-1,"message":"unexpected request"}}' ;;
esac
sleep 5"#;

    #[test]
    fn call_with_initializes_then_returns_the_request_result() {
        let result = call_with(
            &["sh", "-c", FAKE_SERVER],
            &temp_cwd(),
            "account/rateLimits/read",
            json!({ "excludeResetCreditDetails": true }),
            Duration::from_secs(5),
        )
        .expect("fake server answers");
        assert_eq!(result["rateLimits"]["limitId"], "codex");
    }

    #[test]
    fn call_with_surfaces_an_rpc_error() {
        let result = call_with(
            &["sh", "-c", FAKE_SERVER],
            &temp_cwd(),
            "account/rateLimitResetCredit/consume",
            json!({ "idempotencyKey": "k" }),
            Duration::from_secs(5),
        );
        match result {
            Err(CodexAppServerError::Rpc(message)) => assert_eq!(message, "unexpected request"),
            other => panic!("expected Rpc, got {other:?}"),
        }
    }

    #[cfg(unix)]
    #[test]
    fn call_with_kills_a_process_the_server_started() {
        let pid_file = std::env::temp_dir().join(format!(
            "goodboy-codex-fixture-{}-{}",
            std::process::id(),
            rand::random::<u32>()
        ));
        let server = format!(
            "sleep 30 &\necho $! > '{}'\n{}",
            pid_file.display(),
            FAKE_SERVER
        );
        let result = call_with(
            &["sh", "-c", &server],
            &temp_cwd(),
            "account/rateLimits/read",
            json!({ "excludeResetCreditDetails": true }),
            Duration::from_secs(5),
        );
        assert!(result.is_ok());
        let helper: libc::pid_t = std::fs::read_to_string(&pid_file)
            .expect("fixture wrote the helper pid")
            .trim()
            .parse()
            .expect("helper pid");
        let _ = std::fs::remove_file(&pid_file);
        let mut alive = true;
        for _ in 0..20 {
            if unsafe { libc::kill(helper, 0) } != 0 {
                alive = false;
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        assert!(!alive, "the server's helper process outlived the call");
    }

    #[test]
    fn call_with_times_out_when_nothing_answers() {
        let result = call_with(
            &["sh", "-c", "sleep 5"],
            &temp_cwd(),
            "account/rateLimits/read",
            json!({}),
            Duration::from_millis(200),
        );
        assert!(matches!(result, Err(CodexAppServerError::TimedOut)));
    }

    #[test]
    fn call_with_reports_a_closed_server() {
        let result = call_with(
            &["sh", "-c", "exit 0"],
            &temp_cwd(),
            "account/rateLimits/read",
            json!({}),
            Duration::from_secs(5),
        );
        assert!(matches!(
            result,
            Err(CodexAppServerError::Closed) | Err(CodexAppServerError::TimedOut)
        ));
    }

    #[test]
    fn call_with_reports_a_missing_binary() {
        let result = call_with(
            &["goodboy-nonexistent-binary-xyz"],
            &temp_cwd(),
            "account/rateLimits/read",
            json!({}),
            Duration::from_millis(500),
        );
        assert!(matches!(result, Err(CodexAppServerError::SpawnFailed(_))));
    }
}
