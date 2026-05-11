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

type ChildSlot = Arc<Mutex<Option<Child>>>;
type ChildRegistry = Arc<Mutex<HashMap<String, ChildSlot>>>;

#[derive(Default)]
pub struct TurnRegistry(pub ChildRegistry);

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
    #[serde(default)]
    pub allowed_tools: Vec<String>,
    #[serde(default)]
    pub disallowed_tools: Vec<String>,
    #[serde(default)]
    pub permission_mode: Option<String>,
    // claude-only: when Some, spawn carries `--resume <id>` so the CLI restores
    // the prior conversation instead of starting fresh. Ignored by codex/cursor.
    #[serde(default)]
    pub resume_session_id: Option<String>,
    // claude-only: when Some, spawn carries `--append-system-prompt <prompt>`.
    // Used to bias planner/implementer/debugger agents toward their role.
    #[serde(default)]
    pub system_prompt: Option<String>,
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

pub const EVENT_NAME: &str = "turn_event";

/// Build per-binary CLI args. The Tauri side spawns the binary directly, so
/// flag shapes have to match each CLI: claude code uses `-p / --output-format
/// stream-json / --permission-mode / --allowedTools / --disallowedTools`,
/// cursor-agent uses `-p / --output-format stream-json / --workspace /
/// --model / --force`, and codex uses `exec --json --model --cwd -- prompt`.
/// Falls back to claude flags for unknown binaries to preserve previous
/// behaviour.
fn build_provider_cli_args(binary: &str, args: &SpawnOneArgs<'_>) -> Vec<String> {
    let bin = std::path::Path::new(binary)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(binary);

    match bin {
        "cursor-agent" => {
            let mut v = vec![
                "-p".to_string(),
                args.prompt.to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
                "--workspace".to_string(),
                args.working_dir.to_string(),
                "--model".to_string(),
                args.model.to_string(),
                // matches the claude --dangerously-skip-permissions: cursor-agent
                // runs tools without interactive confirmation.
                "--force".to_string(),
            ];
            // permission rules + permission_mode + resume + system_prompt aren't
            // supported by cursor-agent today; intentionally dropped here to
            // avoid unknown-flag errors.
            let _ = (
                args.permission_mode,
                args.allowed_tools,
                args.disallowed_tools,
                args.resume_session_id,
                args.system_prompt,
            );
            v.shrink_to_fit();
            v
        }
        "codex" => {
            // codex exec takes a single prompt argument after `--`. permission
            // rules + resume + system_prompt aren't supported by the codex CLI
            // yet.
            let _ = (args.resume_session_id, args.system_prompt);
            vec![
                "exec".to_string(),
                "--json".to_string(),
                "--model".to_string(),
                args.model.to_string(),
                "--cwd".to_string(),
                args.working_dir.to_string(),
                "--".to_string(),
                args.prompt.to_string(),
            ]
        }
        _ => {
            // claude (default).
            let mut v: Vec<String> = Vec::new();
            // --resume must come before -p so claude restores the prior session
            // before consuming the new user message.
            if let Some(sid) = args.resume_session_id {
                v.push("--resume".to_string());
                v.push(sid.to_string());
            }
            v.extend([
                "-p".to_string(),
                args.prompt.to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
                "--verbose".to_string(),
                "--model".to_string(),
                args.model.to_string(),
                "--permission-mode".to_string(),
                args.permission_mode.to_string(),
            ]);
            if let Some(sp) = args.system_prompt {
                v.push("--append-system-prompt".to_string());
                v.push(sp.to_string());
            }
            if !args.allowed_tools.is_empty() {
                v.push("--allowedTools".to_string());
                v.push(args.allowed_tools.join(","));
            }
            if !args.disallowed_tools.is_empty() {
                v.push("--disallowedTools".to_string());
                v.push(args.disallowed_tools.join(","));
            }
            v
        }
    }
}

/// Per-run spawn parameters used by both `turn_spawn` and `parallel_session_spawn`.
pub struct SpawnOneArgs<'a> {
    pub run_id: &'a str,
    pub binary: &'a str,
    pub model: &'a str,
    pub working_dir: &'a str,
    pub prompt: &'a str,
    pub permission_mode: &'a str,
    pub allowed_tools: &'a [String],
    pub disallowed_tools: &'a [String],
    pub resume_session_id: Option<&'a str>,
    pub system_prompt: Option<&'a str>,
}

/// Spawns one child process, registers it in the registry, and starts the
/// forwarding thread. Returns `run_id` on success.
///
/// Extracted so that `turn_spawn` (single run) and `parallel_session_spawn`
/// (N runs) share the same logic without copy-paste.
pub(crate) fn spawn_one(
    app: &AppHandle,
    registry: &ChildRegistry,
    args: SpawnOneArgs<'_>,
) -> Result<String, TurnError> {
    if args.permission_mode == "bypassPermissions"
        && args.allowed_tools.is_empty()
        && args.disallowed_tools.is_empty()
    {
        eprintln!(
            "[spawn_one] permission_mode=bypassPermissions with no rules — \
             relying on claude CLI native bypass; --dangerously-skip-permissions intentionally not set"
        );
    }

    let mut command = Command::new(args.binary);
    command
        .current_dir(args.working_dir)
        // Strip env vars that signal "running inside another Claude Code /
        // Agent SDK session". When kay-am is launched from such a context the
        // vars propagate to children; the claude CLI then either refuses with
        // a nested-session error or falls through to broken auth (401). We
        // want every spawn to behave as a fresh shell invocation that hits
        // claude's own ~/.claude credentials.
        .env_remove("CLAUDECODE")
        .env_remove("CLAUDE_CODE_ENTRYPOINT")
        .env_remove("CLAUDE_AGENT_SDK_VERSION");

    let cli_args = build_provider_cli_args(args.binary, &args);
    for a in &cli_args {
        command.arg(a);
    }

    let mut child = command
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
    registry
        .lock()
        .map_err(|_| TurnError::Poisoned)?
        .insert(args.run_id.to_string(), Arc::clone(&slot));

    let app_clone = app.clone();
    let registry_clone = Arc::clone(registry);
    let run_id_owned = args.run_id.to_string();

    thread::spawn(move || {
        forward_lines(&app_clone, &run_id_owned, stdout);
        let stderr_buf = capture_stderr(stderr);
        let exit_code = wait_and_remove(&slot, &registry_clone, &run_id_owned);
        let _ = app_clone.emit(
            EVENT_NAME,
            TurnEventEnvelope {
                run_id: run_id_owned.clone(),
                event: TurnEventPayload::End {
                    exit_code,
                    stderr: stderr_buf,
                },
            },
        );
    });

    Ok(args.run_id.to_string())
}

#[tauri::command]
pub fn turn_spawn(
    app: AppHandle,
    state: State<'_, TurnRegistry>,
    args: SpawnArgs,
) -> Result<String, TurnError> {
    let binary = args.binary.as_deref().unwrap_or("claude");
    let permission_mode = args
        .permission_mode
        .as_deref()
        .unwrap_or("default")
        .to_string();

    spawn_one(
        &app,
        &state.0,
        SpawnOneArgs {
            run_id: &args.run_id,
            binary,
            model: &args.model,
            working_dir: &args.working_dir,
            prompt: &args.prompt,
            permission_mode: &permission_mode,
            allowed_tools: &args.allowed_tools,
            disallowed_tools: &args.disallowed_tools,
            resume_session_id: args.resume_session_id.as_deref(),
            system_prompt: args.system_prompt.as_deref(),
        },
    )
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
    slot: &ChildSlot,
    registry: &ChildRegistry,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn turn_registry_default_is_empty() {
        let registry = TurnRegistry::new();
        let map = registry.0.lock().unwrap();
        assert!(map.is_empty());
    }

    #[test]
    fn spawn_one_args_fields_accessible() {
        let allowed: Vec<String> = vec!["Bash".to_string()];
        let disallowed: Vec<String> = vec![];
        let args = SpawnOneArgs {
            run_id: "run-1",
            binary: "echo",
            model: "claude-3",
            working_dir: "/tmp",
            prompt: "hello",
            permission_mode: "default",
            allowed_tools: &allowed,
            disallowed_tools: &disallowed,
            resume_session_id: None,
            system_prompt: None,
        };
        assert_eq!(args.run_id, "run-1");
        assert_eq!(args.binary, "echo");
        assert_eq!(args.allowed_tools, &["Bash".to_string()]);
    }

    fn make_args<'a>(
        resume: Option<&'a str>,
        system_prompt: Option<&'a str>,
        empty: &'a [String],
    ) -> SpawnOneArgs<'a> {
        SpawnOneArgs {
            run_id: "run-1",
            binary: "claude",
            model: "claude-3",
            working_dir: "/tmp",
            prompt: "hi",
            permission_mode: "default",
            allowed_tools: empty,
            disallowed_tools: empty,
            resume_session_id: resume,
            system_prompt,
        }
    }

    #[test]
    fn claude_args_omit_resume_and_system_prompt_when_none() {
        let empty: Vec<String> = vec![];
        let args = make_args(None, None, &empty);
        let cli = build_provider_cli_args("claude", &args);
        assert!(!cli.contains(&"--resume".to_string()));
        assert!(!cli.contains(&"--append-system-prompt".to_string()));
    }

    #[test]
    fn claude_args_include_resume_before_prompt() {
        let empty: Vec<String> = vec![];
        let args = make_args(Some("sess-abc"), None, &empty);
        let cli = build_provider_cli_args("claude", &args);
        let resume_idx = cli.iter().position(|a| a == "--resume").expect("--resume");
        let p_idx = cli.iter().position(|a| a == "-p").expect("-p");
        assert!(resume_idx < p_idx, "--resume must precede -p");
        assert_eq!(cli[resume_idx + 1], "sess-abc");
    }

    #[test]
    fn claude_args_include_system_prompt() {
        let empty: Vec<String> = vec![];
        let args = make_args(None, Some("you are a planner"), &empty);
        let cli = build_provider_cli_args("claude", &args);
        let idx = cli
            .iter()
            .position(|a| a == "--append-system-prompt")
            .expect("--append-system-prompt");
        assert_eq!(cli[idx + 1], "you are a planner");
    }

    #[test]
    fn cursor_and_codex_ignore_resume_and_system_prompt() {
        let empty: Vec<String> = vec![];
        let args = make_args(Some("sid"), Some("sp"), &empty);
        let cli_cursor = build_provider_cli_args("cursor-agent", &args);
        let cli_codex = build_provider_cli_args("codex", &args);
        assert!(!cli_cursor.iter().any(|a| a == "--resume" || a == "--append-system-prompt"));
        assert!(!cli_codex.iter().any(|a| a == "--resume" || a == "--append-system-prompt"));
    }
}
