use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::providers::{
    check_provider_auth_blocking, detect_claude, detect_codex, detect_cursor, detect_gemini,
    detect_opencode, AuthState, ProviderStatus,
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
type ActiveProviders = Arc<Mutex<HashMap<String, String>>>;

#[derive(Default)]
pub struct ProviderLifecycleRegistry {
    runs: Arc<Mutex<HashMap<String, PtySlot>>>,
    active: ActiveProviders,
}

impl ProviderLifecycleRegistry {
    pub fn new() -> Self {
        Self::default()
    }
}

fn reserve_provider(active: &Mutex<HashMap<String, String>>, provider_id: &str, run_id: &str) -> bool {
    let Ok(mut map) = active.lock() else {
        return false;
    };
    if map.contains_key(provider_id) {
        return false;
    }
    map.insert(provider_id.to_string(), run_id.to_string());
    true
}

fn release_provider(active: &Mutex<HashMap<String, String>>, run_id: &str) {
    if let Ok(mut map) = active.lock() {
        map.retain(|_, active_run| active_run != run_id);
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
    #[error("a lifecycle run is already active for provider: {0}")]
    Busy(String),
}

crate::util::impl_error_serialize!(LifecycleError);

impl LifecycleError {
    fn kind(&self) -> &'static str {
        match self {
            LifecycleError::Poisoned => "poisoned",
            LifecycleError::Io(_) => "io",
            LifecycleError::Busy(_) => "busy",
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
        "opencode" => detect_opencode(),
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
    env: Option<HashMap<String, String>>,
) -> Result<(), LifecycleError> {
    let registry_arc = Arc::clone(&registry.runs);
    let active_arc = Arc::clone(&registry.active);

    tauri::async_runtime::spawn_blocking(move || {
        if !reserve_provider(&active_arc, &provider_id, &run_id) {
            return Err(LifecycleError::Busy(provider_id));
        }
        let started = start_lifecycle_pty(StartParams {
            app,
            registry_arc,
            active_arc: Arc::clone(&active_arc),
            provider_id,
            action,
            command,
            run_id: run_id.clone(),
            cols,
            rows,
            env,
        });
        if started.is_err() {
            release_provider(&active_arc, &run_id);
        }
        started
    })
    .await
    .map_err(|e| LifecycleError::Io(e.to_string()))?
}

struct StartParams {
    app: AppHandle,
    registry_arc: Arc<Mutex<HashMap<String, PtySlot>>>,
    active_arc: ActiveProviders,
    provider_id: String,
    action: String,
    command: String,
    run_id: String,
    cols: u16,
    rows: u16,
    env: Option<HashMap<String, String>>,
}

fn start_lifecycle_pty(params: StartParams) -> Result<(), LifecycleError> {
    let StartParams {
        app,
        registry_arc,
        active_arc,
        provider_id,
        action,
        command,
        run_id,
        cols,
        rows,
        env,
    } = params;
    {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| LifecycleError::Io(e.to_string()))?;

        let mut cmd = CommandBuilder::new("bash");
        cmd.arg("-c");
        cmd.arg(&command);
        let cwd = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
        cmd.cwd(&cwd);
        for (key, value) in crate::path_env::resolved_env() {
            cmd.env(key, value);
        }
        cmd.env("PATH", crate::path_env::resolved_path());
        cmd.env("TERM", "xterm-256color");
        if let Ok(home) = std::env::var("HOME") {
            cmd.env("HOME", home);
        }
        if let Ok(user) = std::env::var("USER") {
            cmd.env("USER", user);
        }
        for (key, value) in env.unwrap_or_default() {
            cmd.env(key, value);
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
            release_provider(&active_arc, &run_id_r);
        });

        Ok(())
    }
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
        let map = registry.runs.lock().map_err(|_| LifecycleError::Poisoned)?;
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
        let map = registry.runs.lock().map_err(|_| LifecycleError::Poisoned)?;
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
        let map = registry.runs.lock().map_err(|_| LifecycleError::Poisoned)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn second_run_for_the_same_provider_is_refused() {
        let active: Mutex<HashMap<String, String>> = Mutex::new(HashMap::new());
        assert!(reserve_provider(&active, "anthropic", "run-1"));
        assert!(!reserve_provider(&active, "anthropic", "run-2"));
    }

    #[test]
    fn a_different_provider_runs_in_parallel() {
        let active: Mutex<HashMap<String, String>> = Mutex::new(HashMap::new());
        assert!(reserve_provider(&active, "anthropic", "run-1"));
        assert!(reserve_provider(&active, "codex", "run-2"));
    }

    #[test]
    fn releasing_a_run_frees_its_provider() {
        let active: Mutex<HashMap<String, String>> = Mutex::new(HashMap::new());
        reserve_provider(&active, "anthropic", "run-1");
        release_provider(&active, "run-1");
        assert!(reserve_provider(&active, "anthropic", "run-2"));
    }

    #[test]
    fn releasing_a_stale_run_leaves_the_active_one_alone() {
        let active: Mutex<HashMap<String, String>> = Mutex::new(HashMap::new());
        reserve_provider(&active, "anthropic", "run-1");
        release_provider(&active, "run-0");
        assert!(!reserve_provider(&active, "anthropic", "run-2"));
    }
}
