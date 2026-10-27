use std::collections::HashMap;
use std::io::Read;
use std::sync::{Arc, Mutex};
use std::thread;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime, State};

use crate::proc::pty::{InputError, PtyChild, PtyInput};
use crate::providers::{
    check_provider_auth_blocking, detect_provider as detect_provider_status, AuthState,
    ProviderStatus,
};

struct PtyRun {
    spawn_id: String,
    master: Box<dyn portable_pty::MasterPty + Send>,
    child: PtyChild,
}

#[derive(Clone)]
struct LifecycleRun {
    slot: PtySlot,
    input: PtyInput,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LifecycleOutputPayload {
    run_id: String,
    provider_id: String,
    action: String,
    data: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LifecycleExitPayload {
    run_id: String,
    provider_id: String,
    action: String,
    exit_code: i32,
    status: ProviderStatus,
    auth: AuthState,
}

type PtySlot = Arc<Mutex<Option<PtyRun>>>;
type ActiveProviders = Arc<Mutex<HashMap<String, String>>>;
type LifecycleRuns = Arc<Mutex<HashMap<String, LifecycleRun>>>;

#[derive(Default)]
pub struct ProviderLifecycleRegistry {
    runs: LifecycleRuns,
    active: ActiveProviders,
}

impl ProviderLifecycleRegistry {
    pub fn new() -> Self {
        Self::default()
    }
}

pub fn shutdown(registry: &ProviderLifecycleRegistry) {
    let slots: Vec<LifecycleRun> = match registry.runs.lock() {
        Ok(mut map) => map.drain().map(|(_, run)| run).collect(),
        Err(_) => return,
    };
    if let Ok(mut active) = registry.active.lock() {
        active.clear();
    }
    for run in slots {
        let Ok(mut guard) = run.slot.lock() else {
            continue;
        };
        let Some(mut pty) = guard.take() else {
            continue;
        };
        crate::proc::pty::stop(&mut pty.child, &pty.spawn_id, "provider login kill");
    }
}

fn reserve_provider(
    active: &Mutex<HashMap<String, String>>,
    provider_id: &str,
    run_id: &str,
) -> bool {
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

#[derive(Debug, thiserror::Error)]
pub enum LifecycleError {
    #[error("registry mutex poisoned")]
    Poisoned,
    #[error("io error: {0}")]
    Io(String),
    #[error("a lifecycle run is already active for provider: {0}")]
    Busy(String),
    #[error("{0}")]
    Refused(String),
    #[error("the login terminal is not accepting input")]
    Backlogged,
    #[error("the login terminal input is closed")]
    InputClosed,
}

crate::util::impl_error_serialize!(LifecycleError);

impl LifecycleError {
    fn kind(&self) -> &'static str {
        match self {
            LifecycleError::Poisoned => "poisoned",
            LifecycleError::Io(_) => "io",
            LifecycleError::Busy(_) => "busy",
            LifecycleError::Refused(_) => "refused",
            LifecycleError::Backlogged => "backlogged",
            LifecycleError::InputClosed => "input_closed",
        }
    }
}

fn refresh_provider(provider_id: &str) -> (ProviderStatus, AuthState) {
    let status = detect_provider_status(provider_id);
    let auth = check_provider_auth_blocking(provider_id);
    (status, auth)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn provider_lifecycle_run(
    app: AppHandle,
    registry: State<'_, ProviderLifecycleRegistry>,
    provider_id: String,
    action: String,
    run_id: String,
    cols: u16,
    rows: u16,
    env: Option<HashMap<String, String>>,
) -> Result<(), LifecycleError> {
    let command = crate::provider_commands::lifecycle_command(&provider_id, &action)
        .map_err(|e| LifecycleError::Refused(e.to_string()))?
        .to_string();
    let env = crate::provider_commands::checked_env(env)
        .map_err(|e| LifecycleError::Refused(e.to_string()))?;
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

struct StartParams<R: Runtime> {
    app: AppHandle<R>,
    registry_arc: LifecycleRuns,
    active_arc: ActiveProviders,
    provider_id: String,
    action: String,
    command: String,
    run_id: String,
    cols: u16,
    rows: u16,
    env: HashMap<String, String>,
}

fn start_lifecycle_pty<R: Runtime>(params: StartParams<R>) -> Result<(), LifecycleError> {
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
        let tag = crate::aux_spawn::tag_pty_spawn(&mut cmd, crate::aux_spawn::SpawnKind::Terminal);
        if let Ok(home) = std::env::var("HOME") {
            cmd.env("HOME", home);
        }
        if let Ok(user) = std::env::var("USER") {
            cmd.env("USER", user);
        }
        for (key, value) in env {
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

        let pid = child.process_id();
        if let Some(pid) = pid {
            crate::proc::ledger::record(
                &tag,
                pid,
                crate::proc::ledger::LedgerContext {
                    cwd: Some(cwd.clone()),
                    ..Default::default()
                },
            );
        }
        let spawn_id = tag.id.clone();
        let slot: PtySlot = Arc::new(Mutex::new(Some(PtyRun {
            spawn_id: tag.id,
            master: pair.master,
            child,
        })));

        registry_arc
            .lock()
            .map_err(|_| LifecycleError::Poisoned)?
            .insert(
                run_id.clone(),
                LifecycleRun {
                    slot: Arc::clone(&slot),
                    input: PtyInput::spawn(writer),
                },
            );

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

            let exit_code =
                crate::proc::pty::exit_code_of(crate::proc::pty::wait_for_exit(&slot, |run| {
                    &mut run.child
                }));
            crate::proc::ledger::forget(&spawn_id);

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

#[tauri::command]
pub fn provider_lifecycle_write(
    registry: State<'_, ProviderLifecycleRegistry>,
    run_id: String,
    data: String,
) -> Result<(), LifecycleError> {
    let bytes = STANDARD
        .decode(&data)
        .map_err(|e| LifecycleError::Io(e.to_string()))?;
    write_run(&registry.runs, &run_id, bytes)
}

fn write_run(runs: &LifecycleRuns, run_id: &str, bytes: Vec<u8>) -> Result<(), LifecycleError> {
    let input = {
        let map = runs.lock().map_err(|_| LifecycleError::Poisoned)?;
        map.get(run_id).map(|run| run.input.clone())
    };
    let Some(input) = input else {
        return Ok(());
    };
    input.send(bytes).map_err(|error| match error {
        InputError::Backlogged => LifecycleError::Backlogged,
        InputError::Closed => LifecycleError::InputClosed,
    })
}

#[tauri::command]
pub fn provider_lifecycle_resize(
    registry: State<'_, ProviderLifecycleRegistry>,
    run_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), LifecycleError> {
    let slot = {
        let map = registry.runs.lock().map_err(|_| LifecycleError::Poisoned)?;
        map.get(&run_id).map(|run| Arc::clone(&run.slot))
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

#[tauri::command]
pub async fn provider_lifecycle_cancel(
    registry: State<'_, ProviderLifecycleRegistry>,
    run_id: String,
) -> Result<(), LifecycleError> {
    let runs = Arc::clone(&registry.runs);
    tauri::async_runtime::spawn_blocking(move || cancel_run(&runs, &run_id))
        .await
        .map_err(|e| LifecycleError::Io(e.to_string()))?
}

fn cancel_run(runs: &LifecycleRuns, run_id: &str) -> Result<(), LifecycleError> {
    let slot = {
        let map = runs.lock().map_err(|_| LifecycleError::Poisoned)?;
        map.get(run_id).map(|run| Arc::clone(&run.slot))
    };
    let Some(slot) = slot else {
        return Ok(());
    };
    let Ok(mut guard) = slot.lock() else {
        return Ok(());
    };
    if let Some(run) = guard.as_mut() {
        crate::proc::pty::stop(&mut run.child, &run.spawn_id, "provider login kill");
    }
    Ok(())
}

#[cfg(test)]
mod wire_shape;

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
    fn moonshot_detects_through_the_opencode_binary() {
        let status = detect_provider_status("moonshot");
        assert_eq!(status.id, "moonshot");
        assert_eq!(status.binary, "opencode");
        assert!(!status
            .error
            .as_deref()
            .unwrap_or("")
            .contains("unknown provider"));
    }

    #[test]
    fn openrouter_detects_through_the_opencode_binary() {
        let status = detect_provider_status("openrouter");
        assert_eq!(status.id, "openrouter");
        assert_eq!(status.binary, "opencode");
        assert!(!status
            .error
            .as_deref()
            .unwrap_or("")
            .contains("unknown provider"));
    }

    #[test]
    fn a_provider_we_do_not_drive_still_reports_unknown() {
        let status = detect_provider_status("nope");
        assert!(status
            .error
            .as_deref()
            .unwrap_or("")
            .contains("unknown provider"));
    }

    #[test]
    fn releasing_a_stale_run_leaves_the_active_one_alone() {
        let active: Mutex<HashMap<String, String>> = Mutex::new(HashMap::new());
        reserve_provider(&active, "anthropic", "run-1");
        release_provider(&active, "run-0");
        assert!(!reserve_provider(&active, "anthropic", "run-2"));
    }

    #[cfg(unix)]
    fn start_test_run(runs: &LifecycleRuns, run_id: &str, command: String) {
        let app = tauri::test::mock_app();
        start_lifecycle_pty(StartParams {
            app: app.handle().clone(),
            registry_arc: Arc::clone(runs),
            active_arc: Arc::default(),
            provider_id: "nope".to_string(),
            action: "login".to_string(),
            command,
            run_id: run_id.to_string(),
            cols: 80,
            rows: 24,
            env: HashMap::new(),
        })
        .expect("start the run");
    }

    #[cfg(unix)]
    fn leader_pid_of(runs: &LifecycleRuns, run_id: &str) -> u32 {
        let slot = Arc::clone(&runs.lock().unwrap().get(run_id).unwrap().slot);
        let guard = slot.lock().unwrap();
        guard.as_ref().unwrap().child.process_id().unwrap()
    }

    #[cfg(unix)]
    fn wait_until(deadline_secs: u64, mut condition: impl FnMut() -> bool) -> bool {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(deadline_secs);
        while std::time::Instant::now() < deadline {
            if condition() {
                return true;
            }
            thread::sleep(std::time::Duration::from_millis(30));
        }
        condition()
    }

    #[cfg(unix)]
    #[test]
    fn cancelling_a_login_leaves_no_descendant_and_no_ledger_row() {
        let dir = crate::proc::ledger::test_support::scratch_dir("lifecycle-cancel");
        let pid_file = dir.join("pid");
        let command = format!(
            "trap '' HUP; sleep 120 & echo $! > '{}'; wait",
            pid_file.display()
        );
        let runs: LifecycleRuns = Arc::default();
        start_test_run(&runs, "run-cancel", command);
        assert!(wait_until(10, || std::fs::read_to_string(&pid_file)
            .map(|text| text.trim().parse::<i32>().is_ok())
            .unwrap_or(false)));
        let descendant: i32 = std::fs::read_to_string(&pid_file)
            .unwrap()
            .trim()
            .parse()
            .unwrap();
        let leader = leader_pid_of(&runs, "run-cancel");
        assert_eq!(
            crate::proc::signal::session_of(descendant as u32),
            Some(leader)
        );
        assert!(crate::proc::ledger::process_ledger_list()
            .iter()
            .any(|row| row.pid == leader && row.kind == "terminal"));

        cancel_run(&runs, "run-cancel").expect("cancel");

        assert!(
            wait_until(10, || !crate::proc::signal::exists(descendant as u32)),
            "the login's background process outlived Cancel"
        );
        assert!(wait_until(10, || runs.lock().unwrap().is_empty()));
        assert!(!crate::proc::ledger::process_ledger_list()
            .iter()
            .any(|row| row.pid == leader));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn cancelling_or_writing_to_a_run_that_is_gone_is_a_quiet_no_op() {
        let runs: LifecycleRuns = Arc::default();
        assert!(cancel_run(&runs, "run-none").is_ok());
        assert!(write_run(&runs, "run-none", b"y\n".to_vec()).is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn input_reaches_a_running_login() {
        let dir = crate::proc::ledger::test_support::scratch_dir("lifecycle-write");
        let out_file = dir.join("answer");
        let command = format!("read line; echo \"$line\" > '{}'", out_file.display());
        let runs: LifecycleRuns = Arc::default();
        start_test_run(&runs, "run-write", command);

        write_run(&runs, "run-write", b"approved\n".to_vec()).expect("write");

        assert!(wait_until(10, || std::fs::read_to_string(&out_file)
            .map(|text| text.trim() == "approved")
            .unwrap_or(false)));
        assert!(wait_until(10, || runs.lock().unwrap().is_empty()));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
