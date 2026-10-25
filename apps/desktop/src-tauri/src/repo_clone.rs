use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{ChildStderr, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use thiserror::Error;

use crate::live_child::{kill_one, register, wait_and_remove, LiveChild, LiveChildRegistry};
use crate::proc::git::{run_with_timeout, Git, GitError, GitOutput};
use crate::proc::ledger::LedgerContext;
use crate::proc::rename::move_exclusive;
use crate::util::lock_or_recover;

mod auth;
mod failure;
mod source;
mod staging;
#[cfg(test)]
mod tests;

use auth::{login_tool, ProbeCall, ProbeOutput, Runner};
use failure::{classify_failure, progress_of, FailureKind, PhaseKind, Progress};
use source::{parse_source, CloneHost, CloneSource};
use staging::{
    admit, check_destination, discard_staging, is_intact, Admission, Staged, StagingGuard,
};

const PROBE_TIMEOUT: Duration = Duration::from_secs(30);
const TAIL_LINES: usize = 5;
const FREE_NAME_ATTEMPTS: u32 = 99;
const PROGRESS_EVENT: &str = "clone-progress";

#[derive(Debug, Error)]
pub enum CloneError {
    #[error("the address is not a GitHub, GitLab or Bitbucket repository")]
    UnknownSource,
    #[error("the destination already exists")]
    DestinationNotEmpty,
    #[error("the destination is not a folder Goodboy can clone into")]
    DestinationNotAFolder,
    #[error("Goodboy could not reach the host")]
    Network,
    #[error("no login for {host} is usable here")]
    AuthRefused { host: &'static str },
    #[error("the host cannot find that repository")]
    NotFound,
    #[error("the clone was cancelled")]
    Cancelled,
    #[error("clone failed: {0}")]
    Failed(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

crate::util::impl_error_serialize!(CloneError);

impl CloneError {
    fn kind(&self) -> &'static str {
        match self {
            CloneError::UnknownSource => "unknown_source",
            CloneError::DestinationNotEmpty => "destination_not_empty",
            CloneError::DestinationNotAFolder => "destination_not_a_folder",
            CloneError::Network => "network",
            CloneError::AuthRefused { .. } => "auth_refused",
            CloneError::NotFound => "not_found",
            CloneError::Cancelled => "cancelled",
            CloneError::Failed(_) => "failed",
            CloneError::Io(_) => "io",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CloneRoute {
    Git,
    Gh,
    Glab,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneProbe {
    pub route: CloneRoute,
    pub host: &'static str,
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneDone {
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    request_id: String,
    phase: PhaseKind,
    percent: u8,
}

#[derive(Clone, Default)]
pub struct CloneRegistry {
    live: LiveChildRegistry,
    admission: Arc<Mutex<Admission>>,
}

impl CloneRegistry {
    pub fn new() -> Self {
        Self::default()
    }
}

fn ls_remote_call(source: &CloneSource) -> ProbeCall {
    ProbeCall {
        binary: "git",
        args: vec![
            "ls-remote".to_string(),
            source.remote.clone(),
            "HEAD".to_string(),
        ],
        input: None,
    }
}

pub(crate) fn probe_route(
    source: &CloneSource,
    destination: &Path,
    run: Runner<'_>,
) -> Result<CloneRoute, CloneError> {
    check_destination(destination)?;
    let reached = run(&ls_remote_call(source))
        .ok_or_else(|| CloneError::Failed("git is not available".to_string()))?;
    if reached.is_success {
        return Ok(CloneRoute::Git);
    }
    if classify_failure(&reached.stderr) == FailureKind::Network {
        return Err(CloneError::Network);
    }
    match login_tool(source.host, run) {
        Some("gh") => Ok(CloneRoute::Gh),
        Some("glab") => Ok(CloneRoute::Glab),
        _ => Err(CloneError::AuthRefused {
            host: source.host.label(),
        }),
    }
}

fn probe_output_of(output: &GitOutput) -> ProbeOutput {
    ProbeOutput {
        is_success: output.success(),
        stdout: output.stdout_lossy(),
        stderr: output.stderr_redacted(),
    }
}

fn git_probe(call: &ProbeCall) -> Git {
    let mut git = Git::new()
        .args(&call.args)
        .batch_auth()
        .english()
        .env_remove("LANGUAGE")
        .timeout(PROBE_TIMEOUT);
    if let Some(input) = &call.input {
        git = git.input(input.clone().into_bytes());
    }
    git
}

fn cli_probe_command(call: &ProbeCall) -> Command {
    let mut command = crate::path_env::command(call.binary);
    command.args(&call.args);
    english_output(&mut command);
    command
}

fn english_output(command: &mut Command) {
    command.env("LC_ALL", "C").env_remove("LANGUAGE");
}

fn run_git_probe(call: &ProbeCall) -> Option<ProbeOutput> {
    match git_probe(call).output() {
        Ok(output) => Some(probe_output_of(&output)),
        Err(GitError::Timeout { .. }) => Some(ProbeOutput {
            is_success: false,
            stdout: String::new(),
            stderr: "connection timed out".to_string(),
        }),
        Err(_) => None,
    }
}

fn run_cli_probe(call: &ProbeCall) -> Option<ProbeOutput> {
    let output = run_with_timeout(cli_probe_command(call), PROBE_TIMEOUT).ok()?;
    Some(probe_output_of(&output))
}

fn system_runner(call: &ProbeCall) -> Option<ProbeOutput> {
    if call.binary == "git" {
        return run_git_probe(call);
    }
    run_cli_probe(call)
}

fn cli_binary(route: CloneRoute) -> &'static str {
    match route {
        CloneRoute::Git => "git",
        CloneRoute::Gh => "gh",
        CloneRoute::Glab => "glab",
    }
}

fn cli_host_variable(route: CloneRoute) -> &'static str {
    match route {
        CloneRoute::Glab => "GITLAB_HOST",
        CloneRoute::Git | CloneRoute::Gh => "GH_HOST",
    }
}

fn clone_command(source: &CloneSource, route: CloneRoute, destination: &Path) -> Command {
    let mut command = match route {
        CloneRoute::Git => Git::new()
            .args(["clone", "--progress", "--"])
            .arg(&source.remote)
            .arg(destination)
            .batch_auth()
            .into_command(),
        CloneRoute::Gh | CloneRoute::Glab => {
            let mut command = crate::path_env::command(cli_binary(route));
            command
                .args(["repo", "clone"])
                .arg(&source.https_remote)
                .arg(destination)
                .args(["--", "--progress"])
                .env(cli_host_variable(route), source.host.domain());
            command
        }
    };
    english_output(&mut command);
    command
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_ASKPASS", "")
        .env("SSH_ASKPASS", "")
        .env("GIT_SSH_COMMAND", "ssh -oBatchMode=yes")
        .env_remove("GIT_DIR")
        .env_remove("GIT_WORK_TREE")
        .env_remove("GIT_INDEX_FILE");
    command
}

fn take_line(
    line: &mut Vec<u8>,
    tail: &mut Vec<String>,
    last: &mut Option<Progress>,
    on_progress: &dyn Fn(&Progress),
) {
    let text = String::from_utf8_lossy(line).trim().to_string();
    line.clear();
    if text.is_empty() {
        return;
    }
    match progress_of(&text) {
        Some(progress) => {
            if last.as_ref() != Some(&progress) {
                on_progress(&progress);
                *last = Some(progress);
            }
        }
        None => {
            tail.push(text);
            if tail.len() > TAIL_LINES {
                tail.remove(0);
            }
        }
    }
}

fn read_stderr(stderr: Option<ChildStderr>, on_progress: &dyn Fn(&Progress)) -> String {
    let Some(mut stderr) = stderr else {
        return String::new();
    };
    let mut tail = Vec::new();
    let mut line = Vec::new();
    let mut last = None;
    let mut buffer = [0u8; 4096];
    loop {
        let read = match stderr.read(&mut buffer) {
            Ok(0) | Err(_) => break,
            Ok(read) => read,
        };
        for byte in &buffer[..read] {
            if *byte == b'\r' || *byte == b'\n' {
                take_line(&mut line, &mut tail, &mut last, on_progress);
                continue;
            }
            line.push(*byte);
        }
    }
    take_line(&mut line, &mut tail, &mut last, on_progress);
    crate::worktree::redact_credentials(&tail.join("\n"))
}

pub(crate) struct RunParams<'a> {
    pub(crate) registry: &'a CloneRegistry,
    pub(crate) request_id: &'a str,
    pub(crate) host: CloneHost,
    pub(crate) command: Command,
    pub(crate) staged: &'a Staged,
}

pub(crate) fn run_clone(
    params: RunParams<'_>,
    on_progress: &(dyn Fn(&Progress) + Sync),
) -> Result<(), CloneError> {
    let mut guard = StagingGuard::new(params.registry, params.request_id, params.staged);
    let staged = params.staged;
    let result = run_tracked(params, on_progress).and_then(|()| publish(staged));
    if result.is_ok() {
        guard.mark_published();
    }
    result
}

pub(crate) fn done_of(staged: &Staged) -> CloneDone {
    CloneDone {
        path: staged.destination.to_string_lossy().into_owned(),
    }
}

fn publish(staged: &Staged) -> Result<(), CloneError> {
    if !is_intact(staged) {
        return Err(CloneError::Failed(
            "the destination folder changed while cloning".to_string(),
        ));
    }
    let Err(error) = move_exclusive(&staged.path, &staged.destination) else {
        return Ok(());
    };
    if error.kind() == std::io::ErrorKind::AlreadyExists {
        return Err(CloneError::DestinationNotEmpty);
    }
    Err(CloneError::Io(error))
}

fn is_cancelled(registry: &CloneRegistry, request_id: &str) -> bool {
    lock_or_recover(&registry.admission).is_cancelled(request_id)
}

fn run_tracked(
    RunParams {
        registry,
        request_id,
        host,
        mut command,
        staged: _,
    }: RunParams<'_>,
    on_progress: &(dyn Fn(&Progress) + Sync),
) -> Result<(), CloneError> {
    if is_cancelled(registry, request_id) {
        return Err(CloneError::Cancelled);
    }
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    let tag = crate::aux_spawn::tag_spawn(&mut command, crate::aux_spawn::SpawnKind::Probe);
    crate::process_group::isolate(&mut command);
    let mut child = command.spawn()?;
    let stderr = child.stderr.take();
    let live = LiveChild::tagged(child, &tag, LedgerContext::from_command(&command));
    register(&registry.live, request_id, &live);
    if is_cancelled(registry, request_id) {
        kill_one(&registry.live, request_id);
    }
    let (exited, tail) = std::thread::scope(|scope| {
        let reader =
            std::thread::Builder::new().spawn_scoped(scope, || read_stderr(stderr, on_progress));
        if reader.is_err() {
            kill_one(&registry.live, request_id);
        }
        let exited = wait_and_remove(&live, &registry.live, request_id);
        let tail = reader.map(|reader| reader.join().unwrap_or_default());
        (exited, tail)
    });
    let tail = tail?;
    if is_cancelled(registry, request_id) {
        return Err(CloneError::Cancelled);
    }
    if exited.code == Some(0) {
        return Ok(());
    }
    Err(match classify_failure(&tail) {
        FailureKind::Network => CloneError::Network,
        FailureKind::AuthRefused => CloneError::AuthRefused { host: host.label() },
        FailureKind::NotFound => CloneError::NotFound,
        FailureKind::Other => CloneError::Failed(tail),
    })
}

fn cancel(registry: &CloneRegistry, request_id: &str) {
    lock_or_recover(&registry.admission).mark_cancelled(request_id);
    kill_one(&registry.live, request_id);
}

pub fn shutdown(registry: &CloneRegistry) {
    let staged = lock_or_recover(&registry.admission).close();
    crate::live_child::shutdown(&registry.live);
    for (_, staged) in staged {
        discard_staging(&staged);
    }
}

pub fn reopen(registry: &CloneRegistry) {
    lock_or_recover(&registry.admission).reopen();
}

pub(crate) fn free_destination(path: &Path) -> Option<PathBuf> {
    let base = path.to_string_lossy().into_owned();
    (2..=FREE_NAME_ATTEMPTS + 1)
        .map(|attempt| PathBuf::from(format!("{base}-{attempt}")))
        .find(|candidate| check_destination(candidate).is_ok())
}

#[tauri::command]
pub async fn clone_probe(url: String, destination: String) -> Result<CloneProbe, CloneError> {
    tauri::async_runtime::spawn_blocking(move || {
        let source = parse_source(&url).ok_or(CloneError::UnknownSource)?;
        let route = probe_route(&source, Path::new(&destination), &system_runner)?;
        Ok(CloneProbe {
            route,
            host: source.host.key(),
            name: source.name,
        })
    })
    .await
    .map_err(|error| CloneError::Failed(error.to_string()))?
}

#[tauri::command]
pub async fn clone_repository(
    app: AppHandle,
    state: State<'_, CloneRegistry>,
    request_id: String,
    url: String,
    destination: String,
    route: CloneRoute,
) -> Result<CloneDone, CloneError> {
    let registry = state.inner().clone();
    let generation = lock_or_recover(&registry.admission).generation();
    tauri::async_runtime::spawn_blocking(move || {
        let source = parse_source(&url).ok_or(CloneError::UnknownSource)?;
        let staged = admit(&registry, &request_id, Path::new(&destination), generation)?;
        let emit_id = request_id.clone();
        let on_progress = move |progress: &Progress| {
            let _ = app.emit(
                PROGRESS_EVENT,
                ProgressPayload {
                    request_id: emit_id.clone(),
                    phase: progress.phase,
                    percent: progress.percent,
                },
            );
        };
        run_clone(
            RunParams {
                registry: &registry,
                request_id: &request_id,
                host: source.host,
                command: clone_command(&source, route, &staged.path),
                staged: &staged,
            },
            &on_progress,
        )?;
        Ok(done_of(&staged))
    })
    .await
    .map_err(|error| CloneError::Failed(error.to_string()))?
}

#[tauri::command]
pub fn clone_cancel(state: State<'_, CloneRegistry>, request_id: String) {
    cancel(&state, &request_id);
}

#[tauri::command]
pub async fn clone_free_destination(path: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || {
        free_destination(Path::new(&path)).map(|free| free.to_string_lossy().into_owned())
    })
    .await
    .ok()
    .flatten()
}
