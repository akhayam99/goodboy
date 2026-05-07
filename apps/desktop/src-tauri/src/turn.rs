use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::process::{Child, ChildStderr, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TurnError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("turn registry mutex poisoned")]
    Poisoned,
    #[error("turn not found: {0}")]
    NotFound(String),
}

impl Serialize for TurnError {
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

impl TurnError {
    fn kind(&self) -> &'static str {
        match self {
            TurnError::Io(_) => "io",
            TurnError::Poisoned => "poisoned",
            TurnError::NotFound(_) => "not_found",
        }
    }
}

#[derive(Default)]
pub struct TurnRegistry(pub Arc<Mutex<HashMap<String, Arc<Mutex<Option<Child>>>>>>);

impl TurnRegistry {
    pub fn new() -> Self {
        Self::default()
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnArgs {
    pub run_id: String,
    pub model: String,
    pub working_dir: String,
    pub prompt: String,
    #[serde(default)]
    pub binary: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TurnEventPayload {
    Line { line: String },
    End {
        exit_code: Option<i32>,
        stderr: String,
    },
    Error { message: String },
}

#[derive(Debug, Serialize, Clone)]
pub struct TurnEventEnvelope {
    #[serde(rename = "runId")]
    pub run_id: String,
    #[serde(flatten)]
    pub event: TurnEventPayload,
}

const EVENT_NAME: &str = "turn_event";

#[tauri::command]
pub fn turn_spawn(
    app: AppHandle,
    state: State<'_, TurnRegistry>,
    args: SpawnArgs,
) -> Result<String, TurnError> {
    let binary = args.binary.unwrap_or_else(|| "claude".to_string());
    let mut child = Command::new(binary)
        .arg("-p")
        .arg(&args.prompt)
        .arg("--output-format")
        .arg("stream-json")
        .arg("--working-dir")
        .arg(&args.working_dir)
        .arg("--model")
        .arg(&args.model)
        .arg("--dangerously-skip-permissions")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| TurnError::Io(std::io::Error::other("no stdout")))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| TurnError::Io(std::io::Error::other("no stderr")))?;

    let slot = Arc::new(Mutex::new(Some(child)));
    state
        .0
        .lock()
        .map_err(|_| TurnError::Poisoned)?
        .insert(args.run_id.clone(), Arc::clone(&slot));

    let app_clone = app.clone();
    let registry = Arc::clone(&state.0);
    let run_id = args.run_id.clone();

    thread::spawn(move || {
        forward_lines(&app_clone, &run_id, stdout);
        let stderr_buf = capture_stderr(stderr);
        let exit_code = wait_and_remove(&slot, &registry, &run_id);
        let _ = app_clone.emit(
            EVENT_NAME,
            TurnEventEnvelope {
                run_id: run_id.clone(),
                event: TurnEventPayload::End {
                    exit_code,
                    stderr: stderr_buf,
                },
            },
        );
    });

    Ok(args.run_id)
}

#[tauri::command]
pub fn turn_cancel(state: State<'_, TurnRegistry>, run_id: String) -> Result<(), TurnError> {
    let map = state.0.lock().map_err(|_| TurnError::Poisoned)?;
    let slot = map
        .get(&run_id)
        .cloned()
        .ok_or_else(|| TurnError::NotFound(run_id.clone()))?;
    drop(map);

    if let Ok(mut guard) = slot.lock() {
        if let Some(child) = guard.as_mut() {
            let _ = child.kill();
        }
    }
    Ok(())
}

fn forward_lines(app: &AppHandle, run_id: &str, stdout: ChildStdout) {
    let reader = BufReader::new(stdout);
    for line in reader.lines() {
        match line {
            Ok(line) => {
                let _ = app.emit(
                    EVENT_NAME,
                    TurnEventEnvelope {
                        run_id: run_id.to_string(),
                        event: TurnEventPayload::Line { line },
                    },
                );
            }
            Err(err) => {
                let _ = app.emit(
                    EVENT_NAME,
                    TurnEventEnvelope {
                        run_id: run_id.to_string(),
                        event: TurnEventPayload::Error {
                            message: err.to_string(),
                        },
                    },
                );
                break;
            }
        }
    }
}

fn capture_stderr(mut stderr: ChildStderr) -> String {
    let mut buf = String::new();
    let _ = stderr.read_to_string(&mut buf);
    buf
}

fn wait_and_remove(
    slot: &Arc<Mutex<Option<Child>>>,
    registry: &Arc<Mutex<HashMap<String, Arc<Mutex<Option<Child>>>>>>,
    run_id: &str,
) -> Option<i32> {
    let exit = {
        let mut guard = slot.lock().ok()?;
        let child = guard.as_mut()?;
        child.wait().ok().and_then(|status| status.code())
    };
    if let Ok(mut map) = registry.lock() {
        map.remove(run_id);
    }
    exit
}
