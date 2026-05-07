use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::State;

const DETECT_TIMEOUT: Duration = Duration::from_secs(2);
const POLL_INTERVAL: Duration = Duration::from_millis(50);

#[derive(Debug, Clone, Serialize)]
pub struct ProviderStatus {
    pub id: String,
    pub binary: String,
    pub available: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

pub struct ProviderState(pub Mutex<ProviderStatus>);

pub fn detect_claude() -> ProviderStatus {
    detect_binary("anthropic", "claude")
}

fn detect_binary(id: &str, binary: &str) -> ProviderStatus {
    let mut child = match Command::new(binary)
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(err) => {
            return ProviderStatus {
                id: id.to_string(),
                binary: binary.to_string(),
                available: false,
                version: None,
                error: Some(err.to_string()),
            };
        }
    };

    let deadline = Instant::now() + DETECT_TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let stdout = child
                    .stdout
                    .take()
                    .map(read_to_string)
                    .unwrap_or_default()
                    .trim()
                    .to_string();
                if status.success() {
                    return ProviderStatus {
                        id: id.to_string(),
                        binary: binary.to_string(),
                        available: true,
                        version: Some(stdout),
                        error: None,
                    };
                } else {
                    return ProviderStatus {
                        id: id.to_string(),
                        binary: binary.to_string(),
                        available: false,
                        version: None,
                        error: Some(format!("exited with code {}", status.code().unwrap_or(-1))),
                    };
                }
            }
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    return ProviderStatus {
                        id: id.to_string(),
                        binary: binary.to_string(),
                        available: false,
                        version: None,
                        error: Some("detection timed out".to_string()),
                    };
                }
                std::thread::sleep(POLL_INTERVAL);
            }
            Err(err) => {
                return ProviderStatus {
                    id: id.to_string(),
                    binary: binary.to_string(),
                    available: false,
                    version: None,
                    error: Some(err.to_string()),
                };
            }
        }
    }
}

fn read_to_string<R: std::io::Read>(mut reader: R) -> String {
    let mut buf = String::new();
    let _ = reader.read_to_string(&mut buf);
    buf
}

#[tauri::command]
pub fn get_provider_status(state: State<'_, ProviderState>) -> ProviderStatus {
    state.0.lock().map(|s| s.clone()).unwrap_or_else(|_| ProviderStatus {
        id: "anthropic".to_string(),
        binary: "claude".to_string(),
        available: false,
        version: None,
        error: Some("status mutex poisoned".to_string()),
    })
}

#[tauri::command]
pub fn refresh_provider_status(state: State<'_, ProviderState>) -> ProviderStatus {
    let next = detect_claude();
    if let Ok(mut current) = state.0.lock() {
        *current = next.clone();
    }
    next
}
