use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::process::{ChildStdout, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use thiserror::Error;

use crate::db::Db;
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

const CLAUDE_DENIED: [&str; 26] = [
    "Bash",
    "Edit",
    "Write",
    "MultiEdit",
    "NotebookEdit",
    "Task",
    "WebFetch",
    "WebSearch",
    "KillShell",
    "ExitPlanMode",
    "Read(~/.ssh/**)",
    "Read(~/.aws/**)",
    "Read(~/.gnupg/**)",
    "Read(~/.config/**)",
    "Read(~/.goodboy/**)",
    "Read(~/.claude/**)",
    "Read(~/.codex/**)",
    "Read(~/.kube/**)",
    "Read(~/.docker/**)",
    "Read(~/.netrc)",
    "Read(~/.npmrc)",
    "Read(~/Library/Keychains/**)",
    "Read(**/.env)",
    "Read(**/.env.*)",
    "Read(**/*.pem)",
    "Read(**/id_rsa*)",
];

const CLAUDE_NO_SETTINGS: &str = "";
const CLAUDE_NO_HOOKS: &str = "{\"disableAllHooks\":true}";
const CLAUDE_NO_MCP: &str = "{\"mcpServers\":{}}";
const CODEX_NO_MCP: &str = "mcp_servers={}";

const READ_ONLY_REFUSAL: &str = "Chat needs a provider that can run read-only: Claude or Codex";

const WRITE_FLAGS: [&str; 13] = [
    "--dangerously-skip-permissions",
    "--allow-dangerously-skip-permissions",
    "--dangerously-bypass-approvals-and-sandbox",
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
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("chat registry mutex poisoned")]
    Poisoned,
    #[error("{READ_ONLY_REFUSAL}")]
    NotReadOnly(String),
    #[error("unknown provider: {0}")]
    UnknownProvider(String),
    #[error("the chat uses {stored}, not {requested}")]
    ProviderMismatch { stored: String, requested: String },
    #[error("{field} is not a valid value: {value}")]
    InvalidValue { field: &'static str, value: String },
    #[error("Add a project to this workspace to ask about its code.")]
    MissingFolder,
    #[error("the chat turn would not be read-only: {0}")]
    WriteArgument(String),
    #[error("chat not found: {0}")]
    NotFound(String),
}

crate::util::impl_error_serialize!(ChatError);

impl ChatError {
    fn kind(&self) -> &'static str {
        match self {
            ChatError::Io(_) => "io",
            ChatError::Database(_) => "database",
            ChatError::Poisoned => "poisoned",
            ChatError::NotReadOnly(_) => "not_read_only",
            ChatError::UnknownProvider(_) => "unknown_provider",
            ChatError::ProviderMismatch { .. } => "provider_mismatch",
            ChatError::InvalidValue { .. } => "invalid_value",
            ChatError::MissingFolder => "missing_folder",
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
    pub prompt: String,
    #[serde(default)]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub effort: Option<String>,
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

#[derive(Debug, PartialEq, Eq)]
struct ChatRoots {
    working_dir: String,
    read_roots: Vec<String>,
}

struct ChatScope {
    provider: String,
    roots: Vec<String>,
}

fn cli_shape_for(provider: &str) -> Result<&'static str, ChatError> {
    match provider {
        "anthropic" => Ok("claude"),
        "codex" => Ok("codex"),
        "cursor" | "gemini" | "opencode" | "openrouter" | "moonshot" => {
            Err(ChatError::NotReadOnly(provider.to_string()))
        }
        other => Err(ChatError::UnknownProvider(other.to_string())),
    }
}

fn is_safe_value(value: &str) -> bool {
    !value.is_empty()
        && !value.starts_with('-')
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | ':' | '-'))
}

fn require_safe_value(field: &'static str, value: &str) -> Result<(), ChatError> {
    if is_safe_value(value) {
        return Ok(());
    }
    Err(ChatError::InvalidValue {
        field,
        value: value.to_string(),
    })
}

fn trim_root(root: &str) -> String {
    let trimmed = root.trim();
    let without_slash = trimmed.trim_end_matches('/');
    if without_slash.is_empty() {
        return trimmed.to_string();
    }
    without_slash.to_string()
}

fn is_too_wide(root: &Path, home: Option<&Path>) -> bool {
    if root.parent().is_none() {
        return true;
    }
    home.is_some_and(|home| home.starts_with(root))
}

fn is_inside(root: &str, folder: &str) -> bool {
    root == folder || root.starts_with(&format!("{folder}/"))
}

fn select_chat_roots(roots: &[String], home: Option<&Path>) -> Result<ChatRoots, ChatError> {
    let mut usable: Vec<String> = Vec::new();
    for root in roots.iter().map(|root| trim_root(root)) {
        let path = Path::new(&root);
        if !path.is_absolute() || is_too_wide(path, home) || usable.contains(&root) {
            continue;
        }
        usable.push(root);
    }
    let Some(working_dir) = usable.first().cloned() else {
        return Err(ChatError::MissingFolder);
    };
    let read_roots = usable
        .into_iter()
        .filter(|root| !is_inside(root, &working_dir))
        .collect();
    Ok(ChatRoots {
        working_dir,
        read_roots,
    })
}

fn existing_roots(roots: Vec<String>) -> Vec<String> {
    roots
        .into_iter()
        .filter(|root| Path::new(root.trim()).is_dir())
        .collect()
}

fn load_chat_scope(conn: &Connection, chat_id: &str) -> Result<ChatScope, ChatError> {
    let provider: Option<String> = conn
        .query_row(
            "SELECT provider FROM chats WHERE id = ?1",
            [chat_id],
            |row| row.get(0),
        )
        .optional()?;
    let Some(provider) = provider else {
        return Err(ChatError::NotFound(chat_id.to_string()));
    };
    let mut stmt = conn.prepare(
        "SELECT p.root_path FROM chats c
         JOIN projects p ON p.workspace_id = c.workspace_id
         WHERE c.id = ?1 AND p.disconnected_at IS NULL
         ORDER BY p.created_at, p.id",
    )?;
    let roots = stmt
        .query_map([chat_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ChatScope { provider, roots })
}

fn build_chat_cli_args(shape: &str, args: &ChatTurnArgs, roots: &ChatRoots) -> Vec<String> {
    let allowed_tools: Vec<String> = CLAUDE_READ_TOOLS
        .iter()
        .map(|tool| tool.to_string())
        .collect();
    let disallowed_tools: Vec<String> = CLAUDE_DENIED.iter().map(|tool| tool.to_string()).collect();
    let prompt = match (shape, args.system_prompt.as_deref()) {
        ("codex", Some(system_prompt)) => format!("{system_prompt}\n\n{}", args.prompt),
        _ => args.prompt.clone(),
    };
    let spawn = SpawnOneArgs {
        run_id: &args.run_id,
        binary: shape,
        model: &args.model,
        working_dir: &roots.working_dir,
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
    let cli = build_provider_cli_args(shape, &spawn);
    if shape == "codex" {
        return harden_codex(cli);
    }
    harden_claude(cli, &prompt, &roots.read_roots)
}

fn harden_codex(mut cli: Vec<String>) -> Vec<String> {
    let at = cli.iter().position(|arg| arg == "--").unwrap_or(cli.len());
    let extra = [
        "--ignore-user-config",
        "--ignore-rules",
        "--ephemeral",
        "-c",
        CODEX_NO_MCP,
    ];
    for (offset, arg) in extra.iter().enumerate() {
        cli.insert(at + offset, arg.to_string());
    }
    cli
}

fn harden_claude(cli: Vec<String>, prompt: &str, read_roots: &[String]) -> Vec<String> {
    let mut hardened: Vec<String> = Vec::with_capacity(cli.len() + 16);
    let mut skip_next = false;
    let mut replace_next = false;
    for arg in cli {
        if skip_next {
            skip_next = false;
            continue;
        }
        if replace_next {
            replace_next = false;
            hardened.push(CLAUDE_NO_SETTINGS.to_string());
            continue;
        }
        if arg == "-p" {
            skip_next = true;
        }
        if arg == "--setting-sources" {
            replace_next = true;
        }
        hardened.push(arg);
    }
    for arg in [
        "--restricted",
        "--settings",
        CLAUDE_NO_HOOKS,
        "--strict-mcp-config",
        "--mcp-config",
        CLAUDE_NO_MCP,
        "--tools",
    ] {
        hardened.push(arg.to_string());
    }
    hardened.push(CLAUDE_READ_TOOLS.join(","));
    hardened.push("--no-session-persistence".to_string());
    for root in read_roots {
        hardened.push("--add-dir".to_string());
        hardened.push(root.to_string());
    }
    hardened.push("--".to_string());
    hardened.push(prompt.to_string());
    hardened
}

fn flag_value<'a>(cli: &'a [String], flag: &str) -> Option<&'a str> {
    cli.iter()
        .position(|arg| arg == flag)
        .and_then(|index| cli.get(index + 1))
        .map(|value| value.as_str())
}

fn has_pair(cli: &[String], flag: &str, value: &str) -> bool {
    cli.windows(2)
        .any(|pair| pair[0] == flag && pair[1] == value)
}

fn assert_read_only(shape: &str, cli: &[String]) -> Result<(), ChatError> {
    let prompt_at = cli.len().saturating_sub(1);
    let separators = cli.iter().filter(|arg| arg.as_str() == "--").count();
    if cli.len() < 2 || cli[prompt_at - 1] != "--" || separators != 1 {
        return Err(ChatError::WriteArgument(
            "the prompt must follow a single --".to_string(),
        ));
    }
    let offending = cli[..prompt_at]
        .iter()
        .find(|arg| WRITE_FLAGS.contains(&arg.as_str()));
    if let Some(arg) = offending {
        return Err(ChatError::WriteArgument(arg.to_string()));
    }
    let required: &[(&str, &str)] = match shape {
        "claude" => &[
            ("--permission-mode", READ_ONLY_MODE),
            ("--tools", "Read,Grep,Glob"),
            ("--setting-sources", CLAUDE_NO_SETTINGS),
            ("--settings", CLAUDE_NO_HOOKS),
            ("--mcp-config", CLAUDE_NO_MCP),
        ],
        "codex" => &[("-s", "read-only"), ("-c", CODEX_NO_MCP)],
        _ => return Err(ChatError::NotReadOnly(shape.to_string())),
    };
    for (flag, value) in required {
        if !has_pair(&cli[..prompt_at], flag, value) {
            return Err(ChatError::WriteArgument(format!("{flag} is not {value}")));
        }
    }
    let switches: &[&str] = match shape {
        "claude" => &[
            "--restricted",
            "--strict-mcp-config",
            "--no-session-persistence",
        ],
        _ => &["--ignore-user-config", "--ephemeral"],
    };
    for switch in switches {
        if !cli[..prompt_at].iter().any(|arg| arg == switch) {
            return Err(ChatError::WriteArgument(format!("{switch} is missing")));
        }
    }
    Ok(())
}

struct PreparedChatTurn {
    binary: &'static str,
    cli: Vec<String>,
    working_dir: String,
}

fn prepare_chat_turn(
    args: &ChatTurnArgs,
    scope: &ChatScope,
    home: Option<&Path>,
) -> Result<PreparedChatTurn, ChatError> {
    if scope.provider != args.provider {
        return Err(ChatError::ProviderMismatch {
            stored: scope.provider.clone(),
            requested: args.provider.clone(),
        });
    }
    let shape = cli_shape_for(&args.provider)?;
    require_safe_value("model", &args.model)?;
    if let Some(effort) = args.effort.as_deref() {
        require_safe_value("effort", effort)?;
    }
    let roots = select_chat_roots(&scope.roots, home)?;
    let cli = build_chat_cli_args(shape, args, &roots);
    assert_read_only(shape, &cli)?;
    Ok(PreparedChatTurn {
        binary: shape,
        cli,
        working_dir: roots.working_dir,
    })
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
    let mut command = crate::path_env::command(prepared.binary);
    command.current_dir(&prepared.working_dir);
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
    db: State<'_, Db>,
    args: ChatTurnArgs,
) -> Result<String, ChatError> {
    let scope = {
        let conn = db.0.lock().map_err(|_| ChatError::Poisoned)?;
        load_chat_scope(&conn, &args.chat_id)?
    };
    let scope = ChatScope {
        provider: scope.provider,
        roots: existing_roots(scope.roots),
    };
    let home: Option<PathBuf> = dirs::home_dir();
    let prepared = prepare_chat_turn(&args, &scope, home.as_deref())?;
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

    const PROVIDERS: [&str; 2] = ["anthropic", "codex"];
    const HOME: &str = "/Users/mara";

    fn args_for(provider: &str) -> ChatTurnArgs {
        ChatTurnArgs {
            run_id: "run-1".to_string(),
            chat_id: "chat-1".to_string(),
            provider: provider.to_string(),
            model: "claude-sonnet-5".to_string(),
            prompt: "Where is the consent step defined?".to_string(),
            system_prompt: Some("Answer from the Harborline code.".to_string()),
            effort: Some("medium".to_string()),
        }
    }

    fn scope_for(provider: &str) -> ChatScope {
        ChatScope {
            provider: provider.to_string(),
            roots: vec![
                "/Users/mara/code/harborline/payments-api".to_string(),
                "/Users/mara/code/harborline/ledger-core/".to_string(),
            ],
        }
    }

    fn prepare(args: &ChatTurnArgs) -> Result<PreparedChatTurn, ChatError> {
        prepare_chat_turn(args, &scope_for(&args.provider), Some(Path::new(HOME)))
    }

    fn cli_for(provider: &str) -> Vec<String> {
        prepare(&args_for(provider))
            .expect("read-only provider")
            .cli
    }

    #[test]
    fn no_write_argument_reaches_any_supported_cli() {
        for provider in PROVIDERS {
            let cli = cli_for(provider);
            let prompt_at = cli.len() - 1;
            assert_eq!(cli[prompt_at - 1], "--", "{provider}: {cli:?}");
            for arg in &cli[..prompt_at] {
                assert!(
                    !WRITE_FLAGS.contains(&arg.as_str()),
                    "{provider} carries {arg}: {cli:?}"
                );
            }
        }
    }

    #[test]
    fn claude_ignores_project_settings_hooks_and_mcp_servers() {
        let cli = cli_for("anthropic");
        assert_eq!(flag_value(&cli, "--setting-sources"), Some(""));
        assert_eq!(
            flag_value(&cli, "--settings"),
            Some("{\"disableAllHooks\":true}")
        );
        assert!(cli.contains(&"--strict-mcp-config".to_string()));
        assert_eq!(
            flag_value(&cli, "--mcp-config"),
            Some("{\"mcpServers\":{}}")
        );
        assert!(cli.contains(&"--restricted".to_string()));
        assert!(!cli.iter().any(|arg| arg == "project,local"));
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
    fn claude_denies_reading_secrets_outside_the_projects() {
        let cli = cli_for("anthropic");
        let denied = flag_value(&cli, "--disallowedTools").unwrap();
        for rule in [
            "Read(~/.ssh/**)",
            "Read(~/.aws/**)",
            "Read(~/.gnupg/**)",
            "Read(~/.config/**)",
            "Read(~/.goodboy/**)",
            "Read(~/.claude/**)",
            "Read(~/.codex/**)",
            "Read(~/Library/Keychains/**)",
            "Read(**/.env)",
        ] {
            assert!(
                denied.split(',').any(|entry| entry == rule),
                "{rule} is not denied"
            );
        }
    }

    #[test]
    fn claude_reads_only_the_project_roots() {
        let cli = cli_for("anthropic");
        let prepared = prepare(&args_for("anthropic")).unwrap();
        assert_eq!(
            prepared.working_dir,
            "/Users/mara/code/harborline/payments-api"
        );
        assert_eq!(
            flag_value(&cli, "--add-dir"),
            Some("/Users/mara/code/harborline/ledger-core")
        );
        assert_eq!(cli.iter().filter(|arg| *arg == "--add-dir").count(), 1);
    }

    #[test]
    fn codex_uses_the_read_only_sandbox_without_user_config_or_mcp() {
        let cli = cli_for("codex");
        assert_eq!(flag_value(&cli, "-s"), Some("read-only"));
        assert!(has_pair(&cli, "-c", "mcp_servers={}"));
        for switch in ["--ignore-user-config", "--ignore-rules", "--ephemeral"] {
            assert!(cli.contains(&switch.to_string()), "{switch} missing");
        }
        assert!(!cli.contains(&"--add-dir".to_string()));
        assert_eq!(
            flag_value(&cli, "--cd"),
            Some("/Users/mara/code/harborline/payments-api")
        );
        let last = cli.last().unwrap();
        assert!(last.starts_with("Answer from the Harborline code.\n\n"));
        assert!(last.ends_with("Where is the consent step defined?"));
    }

    #[test]
    fn providers_that_cannot_be_read_only_are_refused() {
        for provider in ["cursor", "gemini", "opencode", "openrouter", "moonshot"] {
            let error = prepare(&args_for(provider)).err().unwrap();
            assert!(matches!(error, ChatError::NotReadOnly(_)));
            assert_eq!(
                error.to_string(),
                "Chat needs a provider that can run read-only: Claude or Codex"
            );
        }
        let unknown = prepare(&args_for("mystery")).err().unwrap();
        assert!(matches!(unknown, ChatError::UnknownProvider(_)));
    }

    #[test]
    fn a_question_that_looks_like_a_flag_stays_the_prompt_after_the_separator() {
        for provider in PROVIDERS {
            let mut args = args_for(provider);
            args.prompt = "--dangerously-skip-permissions".to_string();
            args.system_prompt = None;
            let cli = prepare(&args).expect("prompt is data").cli;
            assert_eq!(cli.last().unwrap(), "--dangerously-skip-permissions");
            assert_eq!(cli[cli.len() - 2], "--");
            let count = cli
                .iter()
                .filter(|arg| arg.as_str() == "--dangerously-skip-permissions")
                .count();
            assert_eq!(count, 1, "{provider}: {cli:?}");
        }
    }

    #[test]
    fn model_and_effort_must_be_plain_values() {
        for model in ["--force", "workspace-write x", "sonnet;rm", "", "-m"] {
            let mut args = args_for("codex");
            args.model = model.to_string();
            let error = prepare(&args).err().unwrap();
            assert!(matches!(error, ChatError::InvalidValue { .. }), "{model}");
        }
        let mut args = args_for("anthropic");
        args.effort = Some("--dangerously-skip-permissions".to_string());
        assert!(matches!(
            prepare(&args).err().unwrap(),
            ChatError::InvalidValue { .. }
        ));
        let mut args = args_for("codex");
        args.model = "gpt-5.6-sol".to_string();
        args.effort = Some("low".to_string());
        assert!(prepare(&args).is_ok());
    }

    #[test]
    fn a_write_flag_smuggled_as_the_model_is_refused() {
        let mut args = args_for("codex");
        args.model = "workspace-write".to_string();
        let error = prepare(&args).err().unwrap();
        assert!(matches!(error, ChatError::WriteArgument(_)));
    }

    #[test]
    fn the_provider_comes_from_the_chat_row() {
        let args = args_for("codex");
        let error = prepare_chat_turn(&args, &scope_for("anthropic"), Some(Path::new(HOME)))
            .err()
            .unwrap();
        assert!(matches!(error, ChatError::ProviderMismatch { .. }));
    }

    #[test]
    fn the_front_end_cannot_pick_folders_binaries_or_permissions() {
        let base = serde_json::json!({
            "runId": "run-1",
            "chatId": "chat-1",
            "provider": "anthropic",
            "model": "sonnet",
            "prompt": "hi",
        });
        assert!(serde_json::from_value::<ChatTurnArgs>(base.clone()).is_ok());
        for (key, value) in [
            ("permissionMode", serde_json::json!("bypassPermissions")),
            ("writableRoots", serde_json::json!(["/Users/mara"])),
            ("workingDir", serde_json::json!("/")),
            ("readRoots", serde_json::json!(["/Users/mara"])),
            ("binary", serde_json::json!("/tmp/evil")),
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
    fn the_root_the_home_folder_and_its_parents_are_never_chat_folders() {
        let home = Some(Path::new(HOME));
        let roots = vec![
            "/".to_string(),
            "/Users/mara/".to_string(),
            "/Users".to_string(),
            "relative/ledger-core".to_string(),
            "/Users/mara/code/harborline/notify-relay".to_string(),
        ];
        assert_eq!(
            select_chat_roots(&roots, home).unwrap(),
            ChatRoots {
                working_dir: "/Users/mara/code/harborline/notify-relay".to_string(),
                read_roots: vec![],
            }
        );
        assert!(matches!(
            select_chat_roots(&["/".to_string(), "/Users/mara".to_string()], home),
            Err(ChatError::MissingFolder)
        ));
    }

    #[test]
    fn the_first_project_is_the_folder_and_never_a_shared_parent() {
        let roots = vec![
            "/Users/mara/code/harborline/payments-api".to_string(),
            "/Users/mara/code/harborline/payments-api/packages/web".to_string(),
            "/Users/mara/code/harborline/ledger-core".to_string(),
        ];
        assert_eq!(
            select_chat_roots(&roots, Some(Path::new(HOME))).unwrap(),
            ChatRoots {
                working_dir: "/Users/mara/code/harborline/payments-api".to_string(),
                read_roots: vec!["/Users/mara/code/harborline/ledger-core".to_string()],
            }
        );
    }

    #[test]
    fn the_scope_is_read_from_the_chat_row_and_its_connected_projects() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE chats (id TEXT PRIMARY KEY, workspace_id TEXT, provider TEXT);
             CREATE TABLE projects (id TEXT PRIMARY KEY, workspace_id TEXT, root_path TEXT,
               disconnected_at INTEGER, created_at INTEGER);
             INSERT INTO chats VALUES ('chat-1', 'harborline', 'codex');
             INSERT INTO projects VALUES ('p2', 'harborline', '/code/ledger-core', NULL, 2);
             INSERT INTO projects VALUES ('p1', 'harborline', '/code/payments-api', NULL, 1);
             INSERT INTO projects VALUES ('p3', 'harborline', '/code/old', 5, 0);
             INSERT INTO projects VALUES ('p4', 'northwind', '/code/storefront-web', NULL, 0);",
        )
        .unwrap();
        let scope = load_chat_scope(&conn, "chat-1").unwrap();
        assert_eq!(scope.provider, "codex");
        assert_eq!(scope.roots, vec!["/code/payments-api", "/code/ledger-core"]);
        assert!(matches!(
            load_chat_scope(&conn, "missing"),
            Err(ChatError::NotFound(_))
        ));
    }

    #[test]
    fn missing_project_folders_are_dropped() {
        let here = std::env::temp_dir().to_string_lossy().into_owned();
        assert_eq!(
            existing_roots(vec![
                "/definitely/not/a/harborline/folder".to_string(),
                here.clone()
            ]),
            vec![here]
        );
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
