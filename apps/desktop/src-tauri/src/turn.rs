use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::process::{Child, ChildStderr, ChildStdout, Stdio};
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

crate::util::impl_error_serialize!(TurnError);

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
    #[serde(default)]
    pub effort: Option<String>,
    #[serde(default)]
    pub api_key_env: Option<String>,
    #[serde(default)]
    pub credential_id: Option<String>,
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

/// Per-binary CLI flag set. Unknown binaries fall through to claude.
fn build_provider_cli_args(binary: &str, args: &SpawnOneArgs<'_>) -> Vec<String> {
    let bin = std::path::Path::new(binary)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(binary);

    match bin {
        "cursor-agent" => {
            // --force is cursor's equivalent of claude --dangerously-skip-permissions.
            let mut v = vec![
                "-p".to_string(),
                args.prompt.to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
                "--workspace".to_string(),
                args.working_dir.to_string(),
                "--model".to_string(),
                args.model.to_string(),
                "--force".to_string(),
            ];
            // cursor-agent ignores permission rules + resume + system_prompt.
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
        "agy" => {
            let _ = (
                args.allowed_tools,
                args.disallowed_tools,
                args.resume_session_id,
                args.system_prompt,
            );
            let mut v = vec![
                "-p".to_string(),
                args.prompt.to_string(),
                "-m".to_string(),
                args.model.to_string(),
            ];
            if args.permission_mode == "bypassPermissions" {
                v.push("--dangerously-skip-permissions".to_string());
            } else {
                v.push("--sandbox".to_string());
            }
            v.shrink_to_fit();
            v
        }
        "codex" => {
            // codex exec v0.130 gotchas:
            //   --cd, NOT --cwd (codex exits 1 with "unexpected argument").
            //   --skip-git-repo-check, else codex refuses non-trusted dirs.
            //   default sandbox is read-only and silently drops writes; force
            //     workspace-write unless bypass replaces it entirely.
            let _ = (args.resume_session_id, args.system_prompt);
            let mut v: Vec<String> = vec![
                "exec".to_string(),
                "--json".to_string(),
                "--skip-git-repo-check".to_string(),
                "-m".to_string(),
                args.model.to_string(),
                "--cd".to_string(),
                args.working_dir.to_string(),
            ];
            if args.permission_mode == "bypassPermissions" {
                v.push("--dangerously-bypass-approvals-and-sandbox".to_string());
            } else {
                v.push("-s".to_string());
                v.push("workspace-write".to_string());
            }
            if let Some(eff) = args.effort {
                v.push("-c".to_string());
                v.push(format!("model_reasoning_effort=\"{eff}\""));
            }
            v.push("--".to_string());
            v.push(args.prompt.to_string());
            v
        }
        "opencode" | "openrouter" => {
            let _ = (
                args.permission_mode,
                args.allowed_tools,
                args.disallowed_tools,
                args.system_prompt,
            );
            let mut v = vec![
                "run".to_string(),
                "--format".to_string(),
                "json".to_string(),
                "-m".to_string(),
                args.model.to_string(),
                "--dir".to_string(),
                args.working_dir.to_string(),
                "--dangerously-skip-permissions".to_string(),
            ];
            if let Some(effort) = args.effort {
                v.push("--variant".to_string());
                v.push(effort.to_string());
            }
            if let Some(session_id) = args.resume_session_id {
                v.push("--session".to_string());
                v.push(session_id.to_string());
            }
            v.push("--".to_string());
            v.push(args.prompt.to_string());
            v
        }
        _ => {
            let mut v: Vec<String> = Vec::new();
            // --resume must precede -p so claude restores the prior session
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
                "--setting-sources".to_string(),
                crate::aux_spawn::CLAUDE_SETTING_SOURCES.to_string(),
            ]);
            if let Some(sp) = args.system_prompt {
                v.push("--append-system-prompt".to_string());
                v.push(sp.to_string());
            }
            if let Some(eff) = args.effort {
                v.push("--effort".to_string());
                v.push(eff.to_string());
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

/// Per-run spawn parameters used by both `turn_spawn` and `parallel_agent_spawn`.
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
    pub effort: Option<&'a str>,
    pub api_key_env: Option<&'a str>,
    pub credential_id: Option<&'a str>,
}

/// Spawns one child process, registers it in the registry, and starts the
/// forwarding thread. Returns `run_id` on success.
///
/// Extracted so that `turn_spawn` (single run) and `parallel_agent_spawn`
/// (N runs) share the same logic without copy-paste.
pub(crate) fn spawn_one(
    app: &AppHandle,
    registry: &ChildRegistry,
    args: SpawnOneArgs<'_>,
) -> Result<String, TurnError> {
    let mut command = crate::path_env::command(args.binary);
    command.current_dir(args.working_dir);
    crate::aux_spawn::scrub_nested_session_env(&mut command);

    if let (Some(env_name), Some(cred_id)) = (args.api_key_env, args.credential_id) {
        if let Ok(Some(secret)) = crate::secrets::read(&format!("provider_credential.{cred_id}")) {
            command.env(env_name, secret);
        }
    }

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

    // Drain stderr on its own thread so it runs concurrently with stdout
    // forwarding. Reading stderr only after stdout EOF used to deadlock: a CLI
    // that writes >~64KB to stderr mid-stream fills the pipe buffer, blocks on
    // the write, and stops producing stdout — so forward_lines waits forever.
    let stderr_handle = thread::spawn(move || capture_stderr(stderr));

    thread::spawn(move || {
        forward_lines(&app_clone, &run_id_owned, stdout);
        let stderr_buf = stderr_handle.join().unwrap_or_default();
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
            effort: args.effort.as_deref(),
            api_key_env: args.api_key_env.as_deref(),
            credential_id: args.credential_id.as_deref(),
        },
    )
}

#[tauri::command]
pub fn turn_list_live(state: State<'_, TurnRegistry>) -> Result<Vec<String>, TurnError> {
    let map = state.0.lock().map_err(|_| TurnError::Poisoned)?;
    Ok(map.keys().cloned().collect())
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

/// Kill the child registered under `run_id`, if present. No-op when the run is
/// unknown or already reaped. Used by `parallel_agent_spawn` to roll back a
/// partially-spawned batch so a mid-batch failure can't orphan live children.
pub(crate) fn kill_run(registry: &ChildRegistry, run_id: &str) {
    let slot = {
        let Ok(map) = registry.lock() else {
            return;
        };
        map.get(run_id).cloned()
    };
    if let Some(slot) = slot {
        if let Ok(mut guard) = slot.lock() {
            if let Some(child) = guard.as_mut() {
                let _ = child.kill();
            }
        }
    }
}

fn forward_lines(app: &AppHandle, run_id: &str, stdout: ChildStdout) {
    let mut reader = BufReader::new(stdout);
    let mut buf: Vec<u8> = Vec::new();
    loop {
        buf.clear();
        // read_until + from_utf8_lossy instead of BufRead::lines(): lines()
        // yields Err on the first non-UTF8 byte, and the old code `break`ed on
        // that, abandoning the rest of the turn. A stray byte in passthrough
        // tool output must not truncate the stream.
        match reader.read_until(b'\n', &mut buf) {
            Ok(0) => break,
            Ok(_) => {
                while matches!(buf.last(), Some(b'\n') | Some(b'\r')) {
                    buf.pop();
                }
                let line = String::from_utf8_lossy(&buf).into_owned();
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
            effort: None,
            api_key_env: None,
            credential_id: None,
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
            effort: None,
            api_key_env: None,
            credential_id: None,
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
    fn claude_args_include_effort_when_set() {
        let empty: Vec<String> = vec![];
        let mut args = make_args(None, None, &empty);
        args.effort = Some("xhigh");
        let cli = build_provider_cli_args("claude", &args);
        let idx = cli.iter().position(|a| a == "--effort").expect("--effort");
        assert_eq!(cli[idx + 1], "xhigh");
    }

    #[test]
    fn claude_args_omit_effort_when_none() {
        let empty: Vec<String> = vec![];
        let args = make_args(None, None, &empty);
        let cli = build_provider_cli_args("claude", &args);
        assert!(!cli.contains(&"--effort".to_string()));
    }

    #[test]
    fn claude_args_isolate_user_settings() {
        let empty: Vec<String> = vec![];
        let args = make_args(None, None, &empty);
        let cli = build_provider_cli_args("claude", &args);
        let idx = cli
            .iter()
            .position(|a| a == "--setting-sources")
            .expect("--setting-sources");
        assert_eq!(cli[idx + 1], "project,local");
    }

    #[test]
    fn claude_args_never_use_bare() {
        let empty: Vec<String> = vec![];
        let args = make_args(None, Some("sp"), &empty);
        let cli = build_provider_cli_args("claude", &args);
        assert!(!cli.iter().any(|a| a == "--bare"));
    }

    #[test]
    fn codex_args_use_cd_not_cwd() {
        let empty: Vec<String> = vec![];
        let args = make_args(None, None, &empty);
        let cli = build_provider_cli_args("codex", &args);
        assert!(cli.iter().any(|a| a == "--cd"));
        assert!(!cli.iter().any(|a| a == "--cwd"));
        let idx = cli.iter().position(|a| a == "--cd").expect("--cd");
        assert_eq!(cli[idx + 1], "/tmp");
    }

    #[test]
    fn codex_args_always_skip_git_repo_check() {
        let empty: Vec<String> = vec![];
        let args = make_args(None, None, &empty);
        let cli = build_provider_cli_args("codex", &args);
        assert!(cli.iter().any(|a| a == "--skip-git-repo-check"));
    }

    #[test]
    fn codex_args_default_to_workspace_write_sandbox() {
        let empty: Vec<String> = vec![];
        let args = make_args(None, None, &empty);
        let cli = build_provider_cli_args("codex", &args);
        let idx = cli.iter().position(|a| a == "-s").expect("-s");
        assert_eq!(cli[idx + 1], "workspace-write");
        assert!(!cli.iter().any(|a| a == "--dangerously-bypass-approvals-and-sandbox"));
    }

    #[test]
    fn codex_args_include_reasoning_effort_when_set() {
        let empty: Vec<String> = vec![];
        let mut args = make_args(None, None, &empty);
        args.effort = Some("high");
        let cli = build_provider_cli_args("codex", &args);
        let idx = cli.iter().position(|a| a == "-c").expect("-c");
        assert_eq!(cli[idx + 1], "model_reasoning_effort=\"high\"");
    }

    #[test]
    fn codex_args_omit_reasoning_effort_when_none() {
        let empty: Vec<String> = vec![];
        let args = make_args(None, None, &empty);
        let cli = build_provider_cli_args("codex", &args);
        assert!(!cli.iter().any(|a| a.starts_with("model_reasoning_effort")));
    }

    #[test]
    fn opencode_args_include_variant_and_session() {
        let empty: Vec<String> = vec![];
        let mut args = make_args(Some("ses_123"), None, &empty);
        args.model = "opencode/big-pickle";
        args.effort = Some("high");
        let cli = build_provider_cli_args("opencode", &args);
        assert_eq!(
            cli,
            vec![
                "run",
                "--format",
                "json",
                "-m",
                "opencode/big-pickle",
                "--dir",
                "/tmp",
                "--dangerously-skip-permissions",
                "--variant",
                "high",
                "--session",
                "ses_123",
                "--",
                "hi",
            ]
        );
    }

    #[test]
    fn openrouter_args_keep_the_pre_slugged_model() {
        let empty: Vec<String> = vec![];
        let mut args = make_args(None, None, &empty);
        args.model = "openrouter/openai/gpt-5.4";
        let cli = build_provider_cli_args("openrouter", &args);
        assert_eq!(
            cli,
            vec![
                "run",
                "--format",
                "json",
                "-m",
                "openrouter/openai/gpt-5.4",
                "--dir",
                "/tmp",
                "--dangerously-skip-permissions",
                "--",
                "hi",
            ]
        );
    }

    #[test]
    fn codex_args_bypass_replaces_sandbox_flag() {
        let empty: Vec<String> = vec![];
        let mut args = make_args(None, None, &empty);
        args.binary = "codex";
        args.permission_mode = "bypassPermissions";
        let cli = build_provider_cli_args("codex", &args);
        assert!(cli.iter().any(|a| a == "--dangerously-bypass-approvals-and-sandbox"));
        assert!(!cli.iter().any(|a| a == "-s"));
        assert!(cli.iter().any(|a| a == "--skip-git-repo-check"));
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

    #[test]
    fn gemini_args_use_short_model_flag() {
        let empty: Vec<String> = vec![];
        let args = make_args(None, None, &empty);
        let cli = build_provider_cli_args("agy", &args);
        let index = cli.iter().position(|arg| arg == "-m").expect("-m");
        assert_eq!(cli[index + 1], "claude-3");
        assert!(!cli.iter().any(|arg| arg == "--model"));
    }

    #[test]
    #[ignore = "requires real codex binary + active login; opt in via GOODBOY_TEST_REAL_CODEX=1"]
    fn codex_real_spawn_emits_json_events() {
        if std::env::var("GOODBOY_TEST_REAL_CODEX")
            .map(|v| v.is_empty())
            .unwrap_or(true)
        {
            return;
        }
        let allowed: Vec<String> = vec![];
        let disallowed: Vec<String> = vec![];
        let args = SpawnOneArgs {
            run_id: "smoke-test",
            binary: "codex",
            model: "gpt-5.5",
            working_dir: "/tmp",
            prompt: "say hello",
            permission_mode: "default",
            allowed_tools: &allowed,
            disallowed_tools: &disallowed,
            resume_session_id: None,
            system_prompt: None,
            effort: None,
            api_key_env: None,
            credential_id: None,
        };
        let cli = build_provider_cli_args("codex", &args);
        let out = std::process::Command::new("codex")
            .args(&cli)
            .output()
            .expect("spawn codex");

        let stdout = String::from_utf8_lossy(&out.stdout);
        let stderr = String::from_utf8_lossy(&out.stderr);
        assert!(
            out.status.success(),
            "codex exited {:?}\nstdout: {}\nstderr: {}",
            out.status.code(),
            stdout,
            stderr
        );
        assert!(
            stdout.contains(r#""type":"thread.started""#),
            "missing thread.started in stdout: {}",
            stdout
        );
        assert!(
            stdout.contains(r#""type":"item.completed""#),
            "missing item.completed in stdout: {}",
            stdout
        );
        assert!(
            stdout.contains(r#""type":"turn.completed""#),
            "missing turn.completed in stdout: {}",
            stdout
        );
    }
}
