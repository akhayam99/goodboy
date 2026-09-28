use std::io::BufReader;
use std::path::Path;
use std::process::{ChildStdout, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use thiserror::Error;

use crate::live_child::{
    drain_tail_lossy, wait_and_remove, LiveChild, LiveChildRegistry, MAX_STDERR_BYTES,
};
use crate::turn::{
    build_provider_cli_args, read_capped_line, CappedLine, SpawnOneArgs, TurnEventPayload,
    MAX_TURN_LINE_BYTES,
};

pub const EVENT_NAME: &str = "chat_event";

const READ_ONLY_MODE: &str = "plan";

const CLAUDE_READ_TOOLS: [&str; 3] = ["Read", "Grep", "Glob"];

const CLAUDE_WRITE_TOOLS: [&str; 9] = [
    "Bash",
    "Edit",
    "Write",
    "MultiEdit",
    "NotebookEdit",
    "Task",
    "WebFetch",
    "WebSearch",
    "KillShell",
];

const WRITE_FLAGS: [&str; 12] = [
    "--dangerously-skip-permissions",
    "--allow-dangerously-skip-permissions",
    "--force",
    "--yolo",
    "--full-auto",
    "bypassPermissions",
    "acceptEdits",
    "accept-edits",
    "workspace-write",
    "danger-full-access",
    "--resume",
    "--session",
];

#[derive(Debug, Error)]
pub enum ChatError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("chat registry mutex poisoned")]
    Poisoned,
    #[error("{0} cannot be limited to reading files, so it cannot answer in a chat. Pick another provider for this chat.")]
    NotReadOnly(String),
    #[error("unknown provider: {0}")]
    UnknownProvider(String),
    #[error("the {provider} chat cannot run {binary}")]
    BinaryMismatch { provider: String, binary: String },
    #[error("the chat folder is missing: {0}")]
    MissingFolder(String),
    #[error("the chat turn would not be read-only: {0}")]
    WriteArgument(String),
    #[error("chat turn not found: {0}")]
    NotFound(String),
}

crate::util::impl_error_serialize!(ChatError);

impl ChatError {
    fn kind(&self) -> &'static str {
        match self {
            ChatError::Io(_) => "io",
            ChatError::Poisoned => "poisoned",
            ChatError::NotReadOnly(_) => "not_read_only",
            ChatError::UnknownProvider(_) => "unknown_provider",
            ChatError::BinaryMismatch { .. } => "binary_mismatch",
            ChatError::MissingFolder(_) => "missing_folder",
            ChatError::WriteArgument(_) => "write_argument",
            ChatError::NotFound(_) => "not_found",
        }
    }
}

#[derive(Default)]
pub struct ChatRegistry(pub LiveChildRegistry);

impl ChatRegistry {
    pub fn new() -> Self {
        Self::default()
    }
}

pub fn shutdown(registry: &ChatRegistry) {
    crate::live_child::shutdown(&registry.0);
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChatTurnArgs {
    pub run_id: String,
    pub chat_id: String,
    pub provider: String,
    pub model: String,
    pub working_dir: String,
    #[serde(default)]
    pub read_roots: Vec<String>,
    pub prompt: String,
    #[serde(default)]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub effort: Option<String>,
    #[serde(default)]
    pub binary: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ChatEventEnvelope {
    #[serde(rename = "runId")]
    pub run_id: String,
    #[serde(rename = "chatId")]
    pub chat_id: String,
    pub seq: u64,
    #[serde(flatten)]
    pub event: TurnEventPayload,
}

fn cli_shape_for(provider: &str) -> Result<&'static str, ChatError> {
    match provider {
        "anthropic" => Ok("claude"),
        "codex" => Ok("codex"),
        "cursor" => Ok("cursor-agent"),
        "gemini" => Ok("agy"),
        "opencode" | "openrouter" | "moonshot" => Err(ChatError::NotReadOnly(provider.to_string())),
        other => Err(ChatError::UnknownProvider(other.to_string())),
    }
}

fn resolve_binary(provider: &str, shape: &str, binary: Option<&str>) -> Result<String, ChatError> {
    let chosen = binary
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(shape);
    let stem = Path::new(chosen)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    if stem != shape {
        return Err(ChatError::BinaryMismatch {
            provider: provider.to_string(),
            binary: chosen.to_string(),
        });
    }
    Ok(chosen.to_string())
}

fn folded_prompt(shape: &str, args: &ChatTurnArgs) -> String {
    match (shape, args.system_prompt.as_deref()) {
        ("claude", _) | (_, None) => args.prompt.clone(),
        (_, Some(system_prompt)) => format!("{system_prompt}\n\n{}", args.prompt),
    }
}

fn build_chat_cli_args(shape: &str, args: &ChatTurnArgs) -> Vec<String> {
    let allowed_tools: Vec<String> = CLAUDE_READ_TOOLS
        .iter()
        .map(|tool| tool.to_string())
        .collect();
    let disallowed_tools: Vec<String> = CLAUDE_WRITE_TOOLS
        .iter()
        .map(|tool| tool.to_string())
        .collect();
    let prompt = folded_prompt(shape, args);
    let spawn = SpawnOneArgs {
        run_id: &args.run_id,
        binary: shape,
        model: &args.model,
        working_dir: &args.working_dir,
        writable_roots: &[],
        query_socket_directory: None,
        prompt: &prompt,
        permission_mode: READ_ONLY_MODE,
        allowed_tools: &allowed_tools,
        disallowed_tools: &disallowed_tools,
        resume_session_id: None,
        system_prompt: args.system_prompt.as_deref(),
        effort: args.effort.as_deref(),
        api_key_env: None,
        credential_id: None,
        workspace_id: None,
        session_id: None,
        mount_id: None,
        cursor_max_mode: false,
        writer_lease: None,
        blocks_push: true,
        excludes_tmp: true,
    };
    let mut cli = build_provider_cli_args(shape, &spawn);
    if shape != "claude" {
        return cli;
    }
    cli.push("--tools".to_string());
    cli.push(CLAUDE_READ_TOOLS.join(","));
    cli.push("--no-session-persistence".to_string());
    for root in &args.read_roots {
        cli.push("--add-dir".to_string());
        cli.push(root.to_string());
    }
    cli
}

fn prompt_index(shape: &str, cli: &[String]) -> Option<usize> {
    let marker = if shape == "codex" { "--" } else { "-p" };
    cli.iter()
        .position(|arg| arg == marker)
        .map(|index| index + 1)
}

fn flag_value<'a>(cli: &'a [String], flag: &str) -> Option<&'a str> {
    cli.iter()
        .position(|arg| arg == flag)
        .and_then(|index| cli.get(index + 1))
        .map(|value| value.as_str())
}

fn assert_read_only(shape: &str, cli: &[String]) -> Result<(), ChatError> {
    let prompt_at = prompt_index(shape, cli)
        .ok_or_else(|| ChatError::WriteArgument("no prompt position".to_string()))?;
    let offending = cli
        .iter()
        .enumerate()
        .filter(|(index, _)| *index != prompt_at)
        .find(|(_, arg)| WRITE_FLAGS.contains(&arg.as_str()));
    if let Some((_, arg)) = offending {
        return Err(ChatError::WriteArgument(arg.to_string()));
    }
    let required: &[(&str, &str)] = match shape {
        "claude" => &[("--permission-mode", "plan"), ("--tools", "Read,Grep,Glob")],
        "codex" => &[("-s", "read-only")],
        "cursor-agent" => &[("--mode", "plan")],
        "agy" => &[("--mode", "plan")],
        _ => return Err(ChatError::NotReadOnly(shape.to_string())),
    };
    for (flag, value) in required {
        if flag_value(cli, flag) != Some(value) {
            return Err(ChatError::WriteArgument(format!("{flag} is not {value}")));
        }
    }
    if shape == "agy" && !cli.iter().any(|arg| arg == "--sandbox") {
        return Err(ChatError::WriteArgument("--sandbox is missing".to_string()));
    }
    Ok(())
}

struct PreparedChatTurn {
    binary: String,
    cli: Vec<String>,
}

fn prepare_chat_turn(args: &ChatTurnArgs) -> Result<PreparedChatTurn, ChatError> {
    let shape = cli_shape_for(&args.provider)?;
    let binary = resolve_binary(&args.provider, shape, args.binary.as_deref())?;
    let cli = build_chat_cli_args(shape, args);
    assert_read_only(shape, &cli)?;
    Ok(PreparedChatTurn { binary, cli })
}

fn require_folder(path: &str) -> Result<(), ChatError> {
    let folder = Path::new(path);
    if !folder.is_absolute() || !folder.is_dir() {
        return Err(ChatError::MissingFolder(path.to_string()));
    }
    Ok(())
}

struct ChatSink {
    app: AppHandle,
    run_id: String,
    chat_id: String,
    seq: AtomicU64,
}

impl ChatSink {
    fn send(&self, event: TurnEventPayload) {
        let seq = self.seq.fetch_add(1, Ordering::SeqCst) + 1;
        let _ = self.app.emit(
            EVENT_NAME,
            ChatEventEnvelope {
                run_id: self.run_id.clone(),
                chat_id: self.chat_id.clone(),
                seq,
                event,
            },
        );
    }
}

fn forward_lines(sink: &ChatSink, live: &LiveChild, stdout: ChildStdout) {
    let mut reader = BufReader::new(stdout);
    let mut buf: Vec<u8> = Vec::new();
    loop {
        match read_capped_line(&mut reader, &mut buf, MAX_TURN_LINE_BYTES) {
            Ok(CappedLine::Eof) => break,
            Ok(CappedLine::Line) => {
                let line = String::from_utf8_lossy(&buf).into_owned();
                sink.send(TurnEventPayload::Line { line });
            }
            Ok(CappedLine::Overflow) => {
                sink.send(TurnEventPayload::Error {
                    message: "chat output line exceeded 64 MiB".to_string(),
                });
                crate::process_group::terminate(live.pid);
                break;
            }
            Err(err) => {
                sink.send(TurnEventPayload::Error {
                    message: err.to_string(),
                });
                break;
            }
        }
    }
}

fn spawn_chat_turn(
    app: &AppHandle,
    registry: &LiveChildRegistry,
    args: &ChatTurnArgs,
    prepared: PreparedChatTurn,
) -> Result<String, ChatError> {
    let mut command = crate::path_env::command(&prepared.binary);
    command.current_dir(&args.working_dir);
    crate::aux_spawn::scrub_nested_session_env(&mut command);
    crate::process_group::isolate(&mut command);
    crate::turn::apply_push_block(&mut command);
    let mut child = command
        .args(&prepared.cli)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| ChatError::Io(std::io::Error::other("no stdout")))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| ChatError::Io(std::io::Error::other("no stderr")))?;

    let live = LiveChild::new(child);
    registry
        .lock()
        .map_err(|_| ChatError::Poisoned)?
        .insert(args.run_id.clone(), live.clone());

    let sink = ChatSink {
        app: app.clone(),
        run_id: args.run_id.clone(),
        chat_id: args.chat_id.clone(),
        seq: AtomicU64::new(0),
    };
    let registry_clone = Arc::clone(registry);
    let stderr_handle = thread::spawn(move || drain_tail_lossy(stderr, MAX_STDERR_BYTES));
    thread::spawn(move || {
        forward_lines(&sink, &live, stdout);
        let stderr_buf = stderr_handle.join().unwrap_or_default();
        let exit_code = wait_and_remove(&live, &registry_clone, &sink.run_id);
        sink.send(TurnEventPayload::End {
            exit_code,
            stderr: stderr_buf,
        });
    });
    Ok(args.run_id.clone())
}

#[tauri::command]
pub async fn chat_turn(
    app: AppHandle,
    state: State<'_, ChatRegistry>,
    args: ChatTurnArgs,
) -> Result<String, ChatError> {
    let prepared = prepare_chat_turn(&args)?;
    require_folder(&args.working_dir)?;
    spawn_chat_turn(&app, &state.0, &args, prepared)
}

#[tauri::command]
pub async fn chat_cancel(state: State<'_, ChatRegistry>, run_id: String) -> Result<(), ChatError> {
    if crate::live_child::kill_one(&state.0, &run_id) {
        return Ok(());
    }
    Err(ChatError::NotFound(run_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    const PROVIDERS: [&str; 4] = ["anthropic", "codex", "cursor", "gemini"];

    fn args_for(provider: &str) -> ChatTurnArgs {
        ChatTurnArgs {
            run_id: "run-1".to_string(),
            chat_id: "chat-1".to_string(),
            provider: provider.to_string(),
            model: "sonnet".to_string(),
            working_dir: "/code/harborline".to_string(),
            read_roots: vec!["/code/harborline/payments-api".to_string()],
            prompt: "Where is the consent step defined?".to_string(),
            system_prompt: Some("Answer from the Harborline code.".to_string()),
            effort: Some("medium".to_string()),
            binary: None,
        }
    }

    fn cli_for(provider: &str) -> Vec<String> {
        prepare_chat_turn(&args_for(provider))
            .expect("read-only provider")
            .cli
    }

    #[test]
    fn no_write_argument_reaches_any_supported_cli() {
        for provider in PROVIDERS {
            let cli = cli_for(provider);
            let prompt_at = prompt_index(cli_shape_for(provider).unwrap(), &cli).unwrap();
            for (index, arg) in cli.iter().enumerate() {
                if index == prompt_at {
                    continue;
                }
                assert!(
                    !WRITE_FLAGS.contains(&arg.as_str()),
                    "{provider} carries {arg}: {cli:?}"
                );
            }
        }
    }

    #[test]
    fn claude_runs_in_plan_mode_with_only_read_tools() {
        let cli = cli_for("anthropic");
        assert_eq!(flag_value(&cli, "--permission-mode"), Some("plan"));
        assert_eq!(flag_value(&cli, "--tools"), Some("Read,Grep,Glob"));
        assert_eq!(flag_value(&cli, "--allowedTools"), Some("Read,Grep,Glob"));
        let denied = flag_value(&cli, "--disallowedTools").unwrap();
        for tool in [
            "Bash",
            "Edit",
            "Write",
            "MultiEdit",
            "NotebookEdit",
            "mcp__*",
        ] {
            assert!(
                denied.split(',').any(|entry| entry == tool),
                "{tool} is not denied"
            );
        }
        assert!(cli.contains(&"--no-session-persistence".to_string()));
        assert_eq!(
            flag_value(&cli, "--append-system-prompt"),
            Some("Answer from the Harborline code.")
        );
    }

    #[test]
    fn claude_reads_the_other_project_roots_without_a_write_tool() {
        let cli = cli_for("anthropic");
        assert_eq!(
            flag_value(&cli, "--add-dir"),
            Some("/code/harborline/payments-api")
        );
        let tools = flag_value(&cli, "--tools").unwrap();
        assert!(tools
            .split(',')
            .all(|tool| CLAUDE_READ_TOOLS.contains(&tool)));
    }

    #[test]
    fn codex_uses_the_read_only_sandbox_and_no_extra_folders() {
        let cli = cli_for("codex");
        assert_eq!(flag_value(&cli, "-s"), Some("read-only"));
        assert!(!cli.contains(&"--add-dir".to_string()));
        assert_eq!(flag_value(&cli, "--cd"), Some("/code/harborline"));
        let last = cli.last().unwrap();
        assert!(last.starts_with("Answer from the Harborline code.\n\n"));
        assert!(last.ends_with("Where is the consent step defined?"));
    }

    #[test]
    fn cursor_and_gemini_run_in_plan_mode() {
        let cursor = cli_for("cursor");
        assert_eq!(flag_value(&cursor, "--mode"), Some("plan"));
        let gemini = cli_for("gemini");
        assert_eq!(flag_value(&gemini, "--mode"), Some("plan"));
        assert!(gemini.contains(&"--sandbox".to_string()));
    }

    #[test]
    fn providers_that_cannot_be_read_only_are_refused() {
        for provider in ["opencode", "openrouter", "moonshot"] {
            let error = prepare_chat_turn(&args_for(provider)).err().unwrap();
            assert!(matches!(error, ChatError::NotReadOnly(_)));
            assert!(error.to_string().contains("Pick another provider"));
        }
        let unknown = prepare_chat_turn(&args_for("mystery")).err().unwrap();
        assert!(matches!(unknown, ChatError::UnknownProvider(_)));
    }

    #[test]
    fn a_prompt_that_looks_like_a_write_flag_stays_the_prompt() {
        for provider in PROVIDERS {
            let mut args = args_for(provider);
            args.prompt = "--dangerously-skip-permissions".to_string();
            args.system_prompt = None;
            let prepared = prepare_chat_turn(&args).expect("prompt is data");
            let shape = cli_shape_for(provider).unwrap();
            let at = prompt_index(shape, &prepared.cli).unwrap();
            assert_eq!(prepared.cli[at], "--dangerously-skip-permissions");
            let count = prepared
                .cli
                .iter()
                .filter(|arg| arg.as_str() == "--dangerously-skip-permissions")
                .count();
            assert_eq!(count, 1, "{provider}: {:?}", prepared.cli);
        }
    }

    #[test]
    fn a_write_flag_smuggled_as_the_model_is_refused() {
        let mut args = args_for("codex");
        args.model = "workspace-write".to_string();
        let error = prepare_chat_turn(&args).err().unwrap();
        assert!(matches!(error, ChatError::WriteArgument(_)));
    }

    #[test]
    fn the_front_end_cannot_ask_for_a_permission_mode_or_writable_roots() {
        let base = serde_json::json!({
            "runId": "run-1",
            "chatId": "chat-1",
            "provider": "anthropic",
            "model": "sonnet",
            "workingDir": "/code/harborline",
            "prompt": "hi",
        });
        assert!(serde_json::from_value::<ChatTurnArgs>(base.clone()).is_ok());
        for (key, value) in [
            ("permissionMode", serde_json::json!("bypassPermissions")),
            ("writableRoots", serde_json::json!(["/code/harborline"])),
            ("allowedTools", serde_json::json!(["Bash"])),
            ("resumeSessionId", serde_json::json!("abc")),
        ] {
            let mut payload = base.clone();
            payload[key] = value;
            assert!(
                serde_json::from_value::<ChatTurnArgs>(payload).is_err(),
                "{key} was accepted"
            );
        }
    }

    #[test]
    fn a_binary_of_another_provider_is_refused() {
        let mut args = args_for("anthropic");
        args.binary = Some("/opt/homebrew/bin/opencode".to_string());
        let error = prepare_chat_turn(&args).err().unwrap();
        assert!(matches!(error, ChatError::BinaryMismatch { .. }));
        args.binary = Some("/opt/homebrew/bin/claude".to_string());
        assert_eq!(
            prepare_chat_turn(&args).unwrap().binary,
            "/opt/homebrew/bin/claude"
        );
    }

    #[test]
    fn a_relative_or_missing_folder_is_refused() {
        assert!(matches!(
            require_folder("code/harborline"),
            Err(ChatError::MissingFolder(_))
        ));
        assert!(matches!(
            require_folder("/definitely/not/a/harborline/folder"),
            Err(ChatError::MissingFolder(_))
        ));
        let here = std::env::temp_dir();
        assert!(require_folder(here.to_str().unwrap()).is_ok());
    }

    #[test]
    fn chat_events_carry_the_chat_and_never_use_the_turn_channel() {
        assert_ne!(EVENT_NAME, crate::turn::EVENT_NAME);
        let envelope = ChatEventEnvelope {
            run_id: "run-1".to_string(),
            chat_id: "chat-1".to_string(),
            seq: 1,
            event: TurnEventPayload::Line {
                line: "{}".to_string(),
            },
        };
        let value = serde_json::to_value(envelope).unwrap();
        assert_eq!(value["chatId"], "chat-1");
        assert_eq!(value["runId"], "run-1");
        assert_eq!(value["type"], "line");
    }
}
