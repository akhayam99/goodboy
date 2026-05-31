use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use portable_pty::{native_pty_system, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::providers::{
    check_provider_auth_blocking, detect_claude, detect_codex, detect_cursor, detect_gemini,
    AuthState, ProviderStatus,
};

// ---------------------------------------------------------------------------
// PTY run slot
// ---------------------------------------------------------------------------

struct PtyRun {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Serialize, Clone)]
struct LifecycleOutputPayload {
    #[serde(rename = "runId")]
    run_id: String,
    #[serde(rename = "providerId")]
    provider_id: String,
    action: String,
    data: String,
}

#[derive(Serialize, Clone)]
struct LifecycleExitPayload {
    #[serde(rename = "runId")]
    run_id: String,
    #[serde(rename = "providerId")]
    provider_id: String,
    action: String,
    #[serde(rename = "exitCode")]
    exit_code: i32,
    // Coherence guarantee: ship the fresh detection + auth result alongside the
    // exit code so the UI cannot stay desynced from the actual on-disk state.
    status: ProviderStatus,
    auth: AuthState,
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

type PtySlot = Arc<Mutex<Option<PtyRun>>>;

#[derive(Default)]
pub struct ProviderLifecycleRegistry(Arc<Mutex<HashMap<String, PtySlot>>>);

impl ProviderLifecycleRegistry {
    pub fn new() -> Self {
        Self::default()
    }
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum LifecycleError {
    #[error("registry mutex poisoned")]
    Poisoned,
    #[error("io error: {0}")]
    Io(String),
}

impl Serialize for LifecycleError {
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

impl LifecycleError {
    fn kind(&self) -> &'static str {
        match self {
            LifecycleError::Poisoned => "poisoned",
            LifecycleError::Io(_) => "io",
        }
    }
}

// ---------------------------------------------------------------------------
// Detection refresh helper
// ---------------------------------------------------------------------------

// Re-detect both binary presence and auth status for the affected provider.
// Called on PTY exit so the lifecycle-exit event ships ground-truth state.
fn refresh_provider(provider_id: &str) -> (ProviderStatus, AuthState) {
    let status = match provider_id {
        "anthropic" => detect_claude(),
        "cursor" => detect_cursor(),
        "codex" => detect_codex(),
        "gemini" => detect_gemini(),
        _ => ProviderStatus {
            id: provider_id.to_string(),
            binary: provider_id.to_string(),
            available: false,
            version: None,
            error: Some(format!("unknown provider: {}", provider_id)),
        },
    };
    let auth = check_provider_auth_blocking(provider_id);
    (status, auth)
}

// ---------------------------------------------------------------------------
// Command: spawn a provider lifecycle command in a pty
// ---------------------------------------------------------------------------

/// Spawns `bash -c <command>` in a pty for an install/login/logout flow.
/// Output streams as `provider-lifecycle-output` events. On exit, the backend
/// re-runs detection + auth check for the provider and emits the fresh state
/// alongside the exit code in `provider-lifecycle-exit`. This is the coherence
/// contract: the UI never has to guess what changed.
#[tauri::command]
pub async fn provider_lifecycle_run(
    app: AppHandle,
    registry: State<'_, ProviderLifecycleRegistry>,
    provider_id: String,
    action: String,
    command: String,
    run_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), LifecycleError> {
    let registry_arc = Arc::clone(&registry.0);

    tauri::async_runtime::spawn_blocking(move || {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| LifecycleError::Io(e.to_string()))?;

        let mut cmd = crate::shell::command_in_shell(&command);
        let cwd = dirs::home_dir()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| ".".to_string());
        cmd.cwd(&cwd);
        cmd.env("PATH", crate::path_env::resolved_path());
        cmd.env("TERM", "xterm-256color");
        #[cfg(not(windows))]
        {
            if let Ok(home) = std::env::var("HOME") {
                cmd.env("HOME", home);
            }
            if let Ok(user) = std::env::var("USER") {
                cmd.env("USER", user);
            }
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| LifecycleError::Io(e.to_string()))?;
        drop(pair.slave);

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| LifecycleError::Io(e.to_string()))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| LifecycleError::Io(e.to_string()))?;

        let slot: PtySlot = Arc::new(Mutex::new(Some(PtyRun {
            writer,
            master: pair.master,
            child,
        })));

        registry_arc
            .lock()
            .map_err(|_| LifecycleError::Poisoned)?
            .insert(run_id.clone(), Arc::clone(&slot));

        let run_id_r = run_id.clone();
        let provider_id_r = provider_id.clone();
        let action_r = action.clone();
        let app_r = app.clone();
        let registry_r = Arc::clone(&registry_arc);

        thread::spawn(move || {
            let mut reader = reader;
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let encoded = STANDARD.encode(&buf[..n]);
                        let _ = app_r.emit(
                            "provider-lifecycle-output",
                            LifecycleOutputPayload {
                                run_id: run_id_r.clone(),
                                provider_id: provider_id_r.clone(),
                                action: action_r.clone(),
                                data: encoded,
                            },
                        );
                    }
                }
            }

            let exit_code = {
                let slot = {
                    let guard = registry_r.lock().ok();
                    guard.as_ref().and_then(|m| m.get(&run_id_r).cloned())
                };
                if let Some(slot) = slot {
                    let mut g = slot.lock().unwrap_or_else(|e| e.into_inner());
                    g.as_mut()
                        .and_then(|r| r.child.wait().ok())
                        .map(|s| if s.success() { 0_i32 } else { 1_i32 })
                        .unwrap_or(-1)
                } else {
                    -1
                }
            };

            // Refresh detection + auth before announcing exit. Always run, even
            // on non-zero exit, because a half-installed CLI or partial logout
            // still changes ground truth.
            let (status, auth) = refresh_provider(&provider_id_r);

            let _ = app_r.emit(
                "provider-lifecycle-exit",
                LifecycleExitPayload {
                    run_id: run_id_r.clone(),
                    provider_id: provider_id_r.clone(),
                    action: action_r.clone(),
                    exit_code,
                    status,
                    auth,
                },
            );

            if let Ok(mut map) = registry_r.lock() {
                map.remove(&run_id_r);
            }
        });

        Ok(())
    })
    .await
    .map_err(|e| LifecycleError::Io(e.to_string()))?
}

// ---------------------------------------------------------------------------
// Command: send keyboard input to a running lifecycle pty
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn provider_lifecycle_write(
    registry: State<'_, ProviderLifecycleRegistry>,
    run_id: String,
    data: String,
) -> Result<(), LifecycleError> {
    let bytes = STANDARD
        .decode(&data)
        .map_err(|e| LifecycleError::Io(e.to_string()))?;

    let slot = {
        let map = registry.0.lock().map_err(|_| LifecycleError::Poisoned)?;
        map.get(&run_id).cloned()
    };

    if let Some(slot) = slot {
        if let Ok(mut guard) = slot.lock() {
            if let Some(run) = guard.as_mut() {
                let _ = run.writer.write_all(&bytes);
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Command: resize the pty window
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn provider_lifecycle_resize(
    registry: State<'_, ProviderLifecycleRegistry>,
    run_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), LifecycleError> {
    let slot = {
        let map = registry.0.lock().map_err(|_| LifecycleError::Poisoned)?;
        map.get(&run_id).cloned()
    };

    if let Some(slot) = slot {
        if let Ok(guard) = slot.lock() {
            if let Some(run) = guard.as_ref() {
                let _ = run.master.resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                });
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Command: cancel an in-flight lifecycle run
// ---------------------------------------------------------------------------

/// Kills the pty child. Dropping the master sends SIGHUP to the entire process
/// group. Exit handler still runs and refreshes detection, so UI reflects the
/// real (possibly half-installed) state.
#[tauri::command]
pub fn provider_lifecycle_cancel(
    registry: State<'_, ProviderLifecycleRegistry>,
    run_id: String,
) -> Result<(), LifecycleError> {
    let slot = {
        let map = registry.0.lock().map_err(|_| LifecycleError::Poisoned)?;
        map.get(&run_id).cloned()
    };
    if let Some(slot) = slot {
        if let Ok(mut guard) = slot.lock() {
            if let Some(run) = guard.as_mut() {
                let _ = run.child.kill();
            }
        }
    }
    Ok(())
}
