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

use crate::attachment::sanitize_segment;
use crate::chat_images::{ChatImageError, TurnImages};
use crate::db::Db;
use crate::live_child::{
    drain_tail_lossy, run_to_exit, LiveChild, LiveChildRegistry, MAX_STDERR_BYTES,
};
use crate::providers::cli_args::{read_only_violations, turn_args, Cli, Job};
use crate::turn::{
    read_capped_line, CappedLine, SpawnOneArgs, TurnEventPayload, MAX_TURN_LINE_BYTES,
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
const CODEX_PROFILE_SETTING: &str = "default_permissions=\"goodboy-ask\"";
const CODEX_FILESYSTEM_KEY: &str = "permissions.goodboy-ask.filesystem=";
const CODEX_PROFILE_SINCE: (u64, u64, u64) = (0, 160, 0);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CodexSandbox {
    ReadOnly,
    Profile,
}

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
    #[error(transparent)]
    Images(#[from] ChatImageError),
    #[error("the session files for Ask are not valid: {0}")]
    InvalidDossier(String),
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
            ChatError::Images(_) => "images",
            ChatError::InvalidDossier(_) => "invalid_dossier",
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
    #[serde(default)]
    pub images: bool,
    #[serde(default)]
    pub message_id: Option<String>,
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
    codex: CodexSandbox,
}

fn parse_cli_version(raw: &str) -> Option<(u64, u64, u64)> {
    raw.split_whitespace().find_map(|token| {
        let core = token.trim_start_matches('v').split(['-', '+']).next()?;
        let mut parts = core.split('.').map(|part| part.parse::<u64>().ok());
        let major = parts.next()??;
        let minor = parts.next()??;
        let patch = parts.next().unwrap_or(Some(0))?;
        Some((major, minor, patch))
    })
}

fn codex_sandbox_for(version: Option<&str>) -> CodexSandbox {
    match version.and_then(parse_cli_version) {
        Some(found) if found >= CODEX_PROFILE_SINCE => CodexSandbox::Profile,
        _ => CodexSandbox::ReadOnly,
    }
}

fn detect_codex_sandbox(provider: &str) -> CodexSandbox {
    if provider != "codex" {
        return CodexSandbox::ReadOnly;
    }
    codex_sandbox_for(crate::providers::detect_codex().version.as_deref())
}

fn toml_string(value: &str) -> String {
    let mut quoted = String::with_capacity(value.len() + 2);
    quoted.push('"');
    for ch in value.chars() {
        match ch {
            '\\' => quoted.push_str("\\\\"),
            '"' => quoted.push_str("\\\""),
            ch if ch.is_control() => quoted.push_str(&format!("\\u{:04X}", ch as u32)),
            ch => quoted.push(ch),
        }
    }
    quoted.push('"');
    quoted
}

fn canonical_root(root: &str) -> String {
    std::fs::canonicalize(root)
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_else(|_| root.to_string())
}

fn codex_filesystem(roots: &[String]) -> String {
    let mut grants = vec![format!("{}=\"read\"", toml_string(":minimal"))];
    let mut seen: Vec<String> = Vec::with_capacity(roots.len());
    for root in roots.iter().map(|root| canonical_root(root)) {
        if seen.contains(&root) {
            continue;
        }
        grants.push(format!("{}=\"read\"", toml_string(&root)));
        seen.push(root);
    }
    format!("{CODEX_FILESYSTEM_KEY}{{{}}}", grants.join(","))
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
    Ok(ChatScope {
        provider,
        roots,
        codex: CodexSandbox::ReadOnly,
    })
}

const IMAGE_BLOCK_HEADER: &str =
    "Images attached in this chat. Read the ones the question needs with your Read tool:";

fn image_block(images: &TurnImages) -> String {
    let mut lines = vec![IMAGE_BLOCK_HEADER.to_string()];
    for image in &images.images {
        let label = if image.is_current {
            " (this message)"
        } else {
            ""
        };
        lines.push(format!(
            "- {}{label}: {}",
            sanitize_segment(&image.file_name),
            image.path
        ));
    }
    lines.join("\n")
}

fn build_chat_cli_args(
    shape: &str,
    args: &ChatTurnArgs,
    roots: &ChatRoots,
    images: Option<&TurnImages>,
    codex: CodexSandbox,
) -> Vec<String> {
    let allowed_tools: Vec<String> = CLAUDE_READ_TOOLS
        .iter()
        .map(|tool| tool.to_string())
        .collect();
    let disallowed_tools: Vec<String> = CLAUDE_DENIED.iter().map(|tool| tool.to_string()).collect();
    let prompt = match (shape, args.system_prompt.as_deref(), images) {
        ("codex", Some(system_prompt), _) => format!("{system_prompt}\n\n{}", args.prompt),
        ("claude", _, Some(images)) => format!("{}\n\n{}", args.prompt, image_block(images)),
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
    let cli = turn_args(shape, &spawn);
    if shape == "codex" {
        let readable: Vec<String> = std::iter::once(roots.working_dir.clone())
            .chain(roots.read_roots.iter().cloned())
            .chain(images.map(|images| images.root.clone()))
            .collect();
        return harden_codex(cli, images, codex, &readable);
    }
    let image_root = images.map(|images| images.root.as_str());
    harden_claude(cli, &prompt, &roots.read_roots, image_root)
}

fn without_sandbox_flag(cli: Vec<String>) -> Vec<String> {
    let mut kept: Vec<String> = Vec::with_capacity(cli.len());
    let mut skip_next = false;
    let mut is_prompt = false;
    for arg in cli {
        if skip_next {
            skip_next = false;
            continue;
        }
        if !is_prompt && arg == "-s" {
            skip_next = true;
            continue;
        }
        is_prompt = is_prompt || arg == "--";
        kept.push(arg);
    }
    kept
}

fn harden_codex(
    cli: Vec<String>,
    images: Option<&TurnImages>,
    codex: CodexSandbox,
    readable: &[String],
) -> Vec<String> {
    let mut cli = match codex {
        CodexSandbox::ReadOnly => cli,
        CodexSandbox::Profile => without_sandbox_flag(cli),
    };
    let at = cli.iter().position(|arg| arg == "--").unwrap_or(cli.len());
    let mut extra: Vec<String> = [
        "--ignore-user-config",
        "--ignore-rules",
        "--ephemeral",
        "-c",
        CODEX_NO_MCP,
    ]
    .iter()
    .map(|arg| arg.to_string())
    .collect();
    if codex == CodexSandbox::Profile {
        extra.push("-c".to_string());
        extra.push(CODEX_PROFILE_SETTING.to_string());
        extra.push("-c".to_string());
        extra.push(codex_filesystem(readable));
    }
    for image in images
        .map(|images| images.images.as_slice())
        .unwrap_or_default()
        .iter()
        .filter(|image| image.is_current)
    {
        extra.push("--image".to_string());
        extra.push(image.path.clone());
    }
    for (offset, arg) in extra.into_iter().enumerate() {
        cli.insert(at + offset, arg);
    }
    cli
}

fn harden_claude(
    cli: Vec<String>,
    prompt: &str,
    read_roots: &[String],
    image_root: Option<&str>,
) -> Vec<String> {
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
    for root in read_roots
        .iter()
        .map(|root| root.as_str())
        .chain(image_root)
    {
        hardened.push("--add-dir".to_string());
        hardened.push(root.to_string());
    }
    hardened.push("--".to_string());
    hardened.push(prompt.to_string());
    hardened
}

fn has_pair(cli: &[String], flag: &str, value: &str) -> bool {
    cli.windows(2)
        .any(|pair| pair[0] == flag && pair[1] == value)
}

fn assert_codex_profile(flags: &[String]) -> Result<(), ChatError> {
    if flags.iter().any(|arg| arg == "-s" || arg == "--sandbox") {
        return Err(ChatError::WriteArgument(
            "a sandbox flag would override the read profile".to_string(),
        ));
    }
    let filesystem: Vec<&String> = flags
        .windows(2)
        .filter(|pair| pair[0] == "-c" && pair[1].starts_with(CODEX_FILESYSTEM_KEY))
        .map(|pair| &pair[1])
        .collect();
    let [grants] = filesystem.as_slice() else {
        return Err(ChatError::WriteArgument(
            "the read profile needs one filesystem table".to_string(),
        ));
    };
    if grants.contains("=\"write\"") {
        return Err(ChatError::WriteArgument(grants.to_string()));
    }
    Ok(())
}

fn assert_read_only(shape: &str, cli: &[String], codex: CodexSandbox) -> Result<(), ChatError> {
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
        "codex" if codex == CodexSandbox::Profile => {
            &[("-c", CODEX_NO_MCP), ("-c", CODEX_PROFILE_SETTING)]
        }
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
    let is_profile = shape == "codex" && codex == CodexSandbox::Profile;
    if is_profile {
        assert_codex_profile(&cli[..prompt_at])?;
    }
    let policy_cli = if shape == "claude" {
        Cli::Claude
    } else {
        Cli::Codex
    };
    let sandbox_pair = "-s must be \"read-only\"";
    match read_only_violations(policy_cli, Job::Turn, cli)
        .into_iter()
        .find(|violation| !(is_profile && violation == sandbox_pair))
    {
        Some(violation) => Err(ChatError::WriteArgument(violation)),
        None => Ok(()),
    }
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
    images: Option<&TurnImages>,
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
    let images = images.filter(|images| {
        !images.images.is_empty()
            && !scope
                .roots
                .iter()
                .any(|root| is_inside(&images.root, &trim_root(root)))
    });
    let cli = build_chat_cli_args(shape, args, &roots, images, scope.codex);
    assert_read_only(shape, &cli, scope.codex)?;
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
    run_id: &str,
    chat_id: &str,
    prepared: PreparedChatTurn,
    cleanup_root: Option<PathBuf>,
) -> Result<String, ChatError> {
    let mut command = crate::path_env::command(prepared.binary);
    command.current_dir(&prepared.working_dir);
    crate::aux_spawn::scrub_nested_session_env(&mut command);
    let tag = crate::aux_spawn::tag_spawn(&mut command, crate::aux_spawn::SpawnKind::Chat);
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

    let live = LiveChild::tagged(
        child,
        &tag,
        crate::proc::ledger::LedgerContext::from_command(&command),
    );
    registry
        .lock()
        .map_err(|_| ChatError::Poisoned)?
        .insert(run_id.to_string(), live.clone());

    let sink = ChatSink {
        app: app.clone(),
        run_id: run_id.to_string(),
        chat_id: chat_id.to_string(),
        seq: AtomicU64::new(0),
    };
    let registry_clone = Arc::clone(registry);
    let stderr_handle = thread::spawn(move || drain_tail_lossy(stderr, MAX_STDERR_BYTES));
    thread::spawn(move || {
        let ((), exited) = run_to_exit(&live, &registry_clone, &sink.run_id, None, || {
            forward_lines(&sink, &live, stdout)
        });
        let stderr_buf = stderr_handle.join().unwrap_or_default();
        if let Some(root) = cleanup_root.as_deref() {
            remove_staged_root(root);
        }
        sink.send(TurnEventPayload::End {
            exit_code: exited.code,
            stderr: stderr_buf,
        });
    });
    Ok(run_id.to_string())
}

#[tauri::command]
pub async fn chat_turn(
    app: AppHandle,
    state: State<'_, ChatRegistry>,
    db: State<'_, Db>,
    args: ChatTurnArgs,
) -> Result<String, ChatError> {
    let (scope, images) = {
        let conn = db.0.lock().map_err(|_| ChatError::Poisoned)?;
        let scope = load_chat_scope(&conn, &args.chat_id)?;
        let images = if args.images {
            crate::chat_images::load_chat_images(&conn, &args.chat_id)?
        } else {
            Vec::new()
        };
        (scope, images)
    };
    let scope = ChatScope {
        codex: detect_codex_sandbox(&scope.provider),
        provider: scope.provider,
        roots: existing_roots(scope.roots),
    };
    let home: Option<PathBuf> = dirs::home_dir();
    let turn_images = crate::chat_images::prepare_turn_images(
        &args.chat_id,
        &args.run_id,
        &images,
        args.message_id.as_deref(),
    )?;
    let image_root = turn_images
        .as_ref()
        .map(|images| PathBuf::from(&images.root));
    let spawned = prepare_chat_turn(&args, &scope, home.as_deref(), turn_images.as_ref()).and_then(
        |prepared| {
            spawn_chat_turn(
                &app,
                &state.0,
                &args.run_id,
                &args.chat_id,
                prepared,
                image_root.clone(),
            )
        },
    );
    if spawned.is_err() {
        if let Some(root) = image_root.as_deref() {
            crate::chat_images::remove_turn_root(root);
        }
    }
    spawned
}

#[tauri::command]
pub async fn chat_cancel(state: State<'_, ChatRegistry>, run_id: String) -> Result<(), ChatError> {
    if crate::live_child::kill_one(&state.0, &run_id) {
        return Ok(());
    }
    Err(ChatError::NotFound(run_id))
}

const ASK_DIR: &str = "goodboy-ask";
const ASK_MAX_FILES: usize = 40;
const ASK_MAX_BYTES: usize = 512 * 1024;
const ASK_FILES_HEADER: &str =
    "Session files staged for this question. Read the ones the question needs:";
const ASK_WORKTREES_HEADER: &str =
    "Session worktrees (the branch code). Read them, never change them:";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AskDossierFile {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AskTurnArgs {
    pub run_id: String,
    pub thread_id: String,
    pub session_id: String,
    pub provider: String,
    pub model: String,
    pub prompt: String,
    #[serde(default)]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub effort: Option<String>,
    #[serde(default)]
    pub dossier: Vec<AskDossierFile>,
}

struct AskScope {
    provider: String,
    worktrees: Vec<String>,
    codex: CodexSandbox,
}

fn load_ask_scope(
    conn: &Connection,
    thread_id: &str,
    session_id: &str,
) -> Result<AskScope, ChatError> {
    let provider: Option<String> = conn
        .query_row(
            "SELECT provider FROM chats WHERE id = ?1 AND session_id = ?2",
            [thread_id, session_id],
            |row| row.get(0),
        )
        .optional()?;
    let Some(provider) = provider else {
        return Err(ChatError::NotFound(thread_id.to_string()));
    };
    let mut stmt = conn.prepare(
        "SELECT worktree_path FROM session_worktrees
         WHERE session_id = ?1 AND worktree_path IS NOT NULL AND is_attached = 1
         ORDER BY parallel_index, created_at, id",
    )?;
    let worktrees = stmt
        .query_map([session_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(AskScope {
        provider,
        worktrees,
        codex: CodexSandbox::ReadOnly,
    })
}

fn is_safe_dossier_segment(segment: &str) -> bool {
    !segment.is_empty()
        && segment.len() <= 80
        && !segment.starts_with('.')
        && !segment.starts_with('-')
        && segment
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-'))
}

fn is_safe_dossier_name(name: &str) -> bool {
    let segments: Vec<&str> = name.split('/').collect();
    segments.len() <= 2
        && segments
            .iter()
            .all(|segment| is_safe_dossier_segment(segment))
        && name.ends_with(".md")
}

fn check_dossier(files: &[AskDossierFile]) -> Result<(), ChatError> {
    if files.len() > ASK_MAX_FILES {
        return Err(ChatError::InvalidDossier(format!(
            "{} files, at most {ASK_MAX_FILES}",
            files.len()
        )));
    }
    let total: usize = files.iter().map(|file| file.content.len()).sum();
    if total > ASK_MAX_BYTES {
        return Err(ChatError::InvalidDossier(format!(
            "{total} bytes, at most {ASK_MAX_BYTES}"
        )));
    }
    let mut seen: Vec<&str> = Vec::with_capacity(files.len());
    for file in files {
        if !is_safe_dossier_name(&file.name) || seen.contains(&file.name.as_str()) {
            return Err(ChatError::InvalidDossier(file.name.clone()));
        }
        seen.push(file.name.as_str());
    }
    Ok(())
}

fn stage_ask_dossier_in(
    temp: &Path,
    run_id: &str,
    files: &[AskDossierFile],
) -> Result<PathBuf, ChatError> {
    if !crate::chat_images::is_safe_id(run_id) {
        return Err(ChatError::InvalidValue {
            field: "run id",
            value: run_id.to_string(),
        });
    }
    check_dossier(files)?;
    let root = temp.join(ASK_DIR).join(run_id);
    remove_staged_root(&root);
    std::fs::create_dir_all(&root)?;
    for file in files {
        let target = root.join(&file.name);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&target, file.content.as_bytes())?;
        crate::chat_images::set_mode(&target, 0o444)?;
    }
    for entry in std::fs::read_dir(&root)? {
        let path = entry?.path();
        if path.is_dir() {
            crate::chat_images::set_mode(&path, 0o555)?;
        }
    }
    crate::chat_images::set_mode(&root, 0o555)?;
    Ok(std::fs::canonicalize(&root)?)
}

fn remove_staged_root(root: &Path) {
    if !root.exists() {
        return;
    }
    let _ = crate::chat_images::set_mode(root, 0o755);
    if let Ok(entries) = std::fs::read_dir(root) {
        for path in entries.flatten().map(|entry| entry.path()) {
            if path.is_dir() {
                let _ = crate::chat_images::set_mode(&path, 0o755);
            }
        }
    }
    crate::chat_images::remove_turn_root(root);
}

fn ask_prompt(args: &AskTurnArgs, dossier_root: &str, worktrees: &[String]) -> String {
    let mut parts = vec![args.prompt.clone()];
    if !args.dossier.is_empty() {
        let mut lines = vec![ASK_FILES_HEADER.to_string()];
        for file in &args.dossier {
            lines.push(format!("- {dossier_root}/{}", file.name));
        }
        parts.push(lines.join("\n"));
    }
    if !worktrees.is_empty() {
        let mut lines = vec![ASK_WORKTREES_HEADER.to_string()];
        for worktree in worktrees {
            lines.push(format!("- {worktree}"));
        }
        parts.push(lines.join("\n"));
    }
    parts.join("\n\n")
}

fn prepare_ask_turn(
    args: &AskTurnArgs,
    scope: &AskScope,
    home: Option<&Path>,
    dossier_root: &str,
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
    let worktrees: Vec<String> = scope
        .worktrees
        .iter()
        .map(|root| trim_root(root))
        .filter(|root| {
            let path = Path::new(root);
            path.is_absolute() && !is_too_wide(path, home) && !is_inside(dossier_root, root)
        })
        .collect();
    let candidates: Vec<String> = match (shape, scope.codex) {
        ("codex", CodexSandbox::ReadOnly) => vec![dossier_root.to_string()],
        _ => worktrees
            .iter()
            .cloned()
            .chain(std::iter::once(dossier_root.to_string()))
            .collect(),
    };
    let roots = select_chat_roots(&candidates, home)?;
    let turn = ChatTurnArgs {
        run_id: args.run_id.clone(),
        chat_id: args.thread_id.clone(),
        provider: args.provider.clone(),
        model: args.model.clone(),
        prompt: ask_prompt(args, dossier_root, &worktrees),
        system_prompt: args.system_prompt.clone(),
        effort: args.effort.clone(),
        images: false,
        message_id: None,
    };
    let cli = build_chat_cli_args(shape, &turn, &roots, None, scope.codex);
    assert_read_only(shape, &cli, scope.codex)?;
    Ok(PreparedChatTurn {
        binary: shape,
        cli,
        working_dir: roots.working_dir,
    })
}

#[tauri::command]
pub async fn ask_turn(
    app: AppHandle,
    state: State<'_, ChatRegistry>,
    db: State<'_, Db>,
    args: AskTurnArgs,
) -> Result<String, ChatError> {
    let scope = {
        let conn = db.0.lock().map_err(|_| ChatError::Poisoned)?;
        load_ask_scope(&conn, &args.thread_id, &args.session_id)?
    };
    let scope = AskScope {
        codex: detect_codex_sandbox(&scope.provider),
        provider: scope.provider,
        worktrees: existing_roots(scope.worktrees),
    };
    let home: Option<PathBuf> = dirs::home_dir();
    let dossier_root = stage_ask_dossier_in(&std::env::temp_dir(), &args.run_id, &args.dossier)?;
    let dossier = dossier_root.to_string_lossy().into_owned();
    let spawned = prepare_ask_turn(&args, &scope, home.as_deref(), &dossier).and_then(|prepared| {
        spawn_chat_turn(
            &app,
            &state.0,
            &args.run_id,
            &args.thread_id,
            prepared,
            Some(dossier_root.clone()),
        )
    });
    if spawned.is_err() {
        remove_staged_root(&dossier_root);
    }
    spawned
}

#[cfg(test)]
mod tests {
    use super::*;

    fn flag_value<'a>(cli: &'a [String], flag: &str) -> Option<&'a str> {
        cli.iter()
            .position(|arg| arg == flag)
            .and_then(|index| cli.get(index + 1))
            .map(|value| value.as_str())
    }

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
            images: false,
            message_id: None,
        }
    }

    fn scope_for(provider: &str) -> ChatScope {
        ChatScope {
            provider: provider.to_string(),
            roots: vec![
                "/Users/mara/code/harborline/payments-api".to_string(),
                "/Users/mara/code/harborline/ledger-core/".to_string(),
            ],
            codex: CodexSandbox::ReadOnly,
        }
    }

    fn prepare(args: &ChatTurnArgs) -> Result<PreparedChatTurn, ChatError> {
        prepare_chat_turn(
            args,
            &scope_for(&args.provider),
            Some(Path::new(HOME)),
            None,
        )
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
        let error = prepare_chat_turn(&args, &scope_for("anthropic"), Some(Path::new(HOME)), None)
            .err()
            .unwrap();
        assert!(matches!(error, ChatError::ProviderMismatch { .. }));
    }

    const IMAGE_ROOT: &str = "/private/var/folders/xy/T/goodboy-chat/run-1";

    fn turn_images(root: &str) -> TurnImages {
        TurnImages {
            root: root.to_string(),
            images: vec![
                crate::chat_images::TurnImage {
                    path: format!("{root}/0-checkout-502.png"),
                    file_name: "checkout-502.png".to_string(),
                    is_current: false,
                },
                crate::chat_images::TurnImage {
                    path: format!("{root}/1-acme-trace.png"),
                    file_name: "acme\ntrace.png".to_string(),
                    is_current: true,
                },
            ],
        }
    }

    fn prepare_with_images(provider: &str, root: &str) -> PreparedChatTurn {
        let mut args = args_for(provider);
        args.images = true;
        prepare_chat_turn(
            &args,
            &scope_for(provider),
            Some(Path::new(HOME)),
            Some(&turn_images(root)),
        )
        .expect("read-only provider")
    }

    #[test]
    fn claude_reads_chat_images_from_a_read_only_root_that_is_never_a_project() {
        let prepared = prepare_with_images("anthropic", IMAGE_ROOT);
        let cli = &prepared.cli;
        assert_eq!(
            prepared.working_dir,
            "/Users/mara/code/harborline/payments-api"
        );
        let added: Vec<&str> = cli
            .windows(2)
            .filter(|pair| pair[0] == "--add-dir")
            .map(|pair| pair[1].as_str())
            .collect();
        assert_eq!(
            added,
            vec!["/Users/mara/code/harborline/ledger-core", IMAGE_ROOT]
        );
        assert_eq!(flag_value(cli, "--permission-mode"), Some("plan"));
        assert_eq!(flag_value(cli, "--tools"), Some("Read,Grep,Glob"));
        assert!(!cli.iter().any(|arg| arg == "--image"));
        let prompt = cli.last().unwrap();
        assert!(prompt.starts_with("Where is the consent step defined?\n\n"));
        assert!(prompt.contains(&format!(
            "- checkout-502.png: {IMAGE_ROOT}/0-checkout-502.png"
        )));
        assert!(prompt.contains(&format!(
            "- acme_trace.png (this message): {IMAGE_ROOT}/1-acme-trace.png"
        )));
        assert!(assert_read_only("claude", cli, CodexSandbox::ReadOnly).is_ok());
    }

    #[test]
    fn codex_attaches_only_the_images_of_the_new_message() {
        let prepared = prepare_with_images("codex", IMAGE_ROOT);
        let cli = &prepared.cli;
        let separator = cli.iter().position(|arg| arg == "--").unwrap();
        let attached: Vec<&str> = cli[..separator]
            .windows(2)
            .filter(|pair| pair[0] == "--image")
            .map(|pair| pair[1].as_str())
            .collect();
        assert_eq!(attached, vec![format!("{IMAGE_ROOT}/1-acme-trace.png")]);
        assert!(!cli.contains(&"--add-dir".to_string()));
        assert!(!cli.last().unwrap().contains(IMAGE_ROOT));
        assert!(assert_read_only("codex", cli, CodexSandbox::ReadOnly).is_ok());
    }

    #[test]
    fn an_image_root_inside_a_project_is_dropped() {
        let inside = "/Users/mara/code/harborline/ledger-core/.cache/goodboy-chat/run-1";
        let prepared = prepare_with_images("anthropic", inside);
        assert!(!prepared.cli.iter().any(|arg| arg == inside));
        assert!(!prepared.cli.last().unwrap().contains(inside));
    }

    #[test]
    fn images_never_stand_in_for_a_missing_project() {
        let mut args = args_for("anthropic");
        args.images = true;
        let scope = ChatScope {
            provider: "anthropic".to_string(),
            roots: vec![],
            codex: CodexSandbox::ReadOnly,
        };
        assert!(matches!(
            prepare_chat_turn(
                &args,
                &scope,
                Some(Path::new(HOME)),
                Some(&turn_images(IMAGE_ROOT))
            ),
            Err(ChatError::MissingFolder)
        ));
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
            ("imageRoot", serde_json::json!("/Users/mara")),
            ("imagePaths", serde_json::json!(["/Users/mara/.ssh/id_rsa"])),
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

    const DOSSIER: &str = "/private/tmp/goodboy-ask/run-1";

    fn ask_args_for(provider: &str) -> AskTurnArgs {
        AskTurnArgs {
            run_id: "run-1".to_string(),
            thread_id: "ask-1".to_string(),
            session_id: "session-1".to_string(),
            provider: provider.to_string(),
            model: "claude-sonnet-5-5".to_string(),
            prompt: "What needs me?".to_string(),
            system_prompt: Some("Answer about the Fix webhook retries session.".to_string()),
            effort: Some("low".to_string()),
            dossier: vec![AskDossierFile {
                name: "agents/A2.md".to_string(),
                content: "Implementer transcript tail".to_string(),
            }],
        }
    }

    fn ask_scope_for(provider: &str, worktrees: &[&str]) -> AskScope {
        AskScope {
            provider: provider.to_string(),
            worktrees: worktrees.iter().map(|root| root.to_string()).collect(),
            codex: CodexSandbox::ReadOnly,
        }
    }

    const WORKTREES: [&str; 2] = [
        "/Users/mara/code/notify-relay/.goodboy/worktrees/webhook-retries",
        "/Users/mara/code/payments-api/.goodboy/worktrees/webhook-retries/",
    ];

    fn prepare_ask(provider: &str, worktrees: &[&str]) -> PreparedChatTurn {
        prepare_ask_turn(
            &ask_args_for(provider),
            &ask_scope_for(provider, worktrees),
            Some(Path::new(HOME)),
            DOSSIER,
        )
        .expect("read-only ask")
    }

    #[test]
    fn claude_asks_from_the_session_worktrees_and_reads_the_dossier_as_an_extra_root() {
        let prepared = prepare_ask("anthropic", &WORKTREES);
        assert_eq!(prepared.working_dir, WORKTREES[0]);
        let roots: Vec<&str> = prepared
            .cli
            .windows(2)
            .filter(|pair| pair[0] == "--add-dir")
            .map(|pair| pair[1].as_str())
            .collect();
        assert_eq!(
            roots,
            vec![
                "/Users/mara/code/payments-api/.goodboy/worktrees/webhook-retries",
                DOSSIER
            ]
        );
        assert_eq!(flag_value(&prepared.cli, "--permission-mode"), Some("plan"));
        assert_eq!(flag_value(&prepared.cli, "--tools"), Some("Read,Grep,Glob"));
        assert!(prepared.cli.contains(&"--restricted".to_string()));
        assert!(assert_read_only("claude", &prepared.cli, CodexSandbox::ReadOnly).is_ok());
    }

    #[test]
    fn codex_before_0_160_asks_inside_the_dossier_with_the_read_only_sandbox() {
        let prepared = prepare_ask("codex", &WORKTREES);
        assert_eq!(prepared.working_dir, DOSSIER);
        assert_eq!(flag_value(&prepared.cli, "--cd"), Some(DOSSIER));
        assert_eq!(flag_value(&prepared.cli, "-s"), Some("read-only"));
        assert!(!prepared.cli.contains(&"--add-dir".to_string()));
        for switch in ["--ignore-user-config", "--ignore-rules", "--ephemeral"] {
            assert!(
                prepared.cli.contains(&switch.to_string()),
                "{switch} missing"
            );
        }
        let prompt = prepared.cli.last().unwrap();
        assert!(prompt.starts_with("Answer about the Fix webhook retries session.\n\n"));
        assert!(prompt.contains(&format!("- {DOSSIER}/agents/A2.md")));
        assert!(prompt.contains(&format!("- {}", WORKTREES[0])));
        assert!(assert_read_only("codex", &prepared.cli, CodexSandbox::ReadOnly).is_ok());
    }

    fn grants(roots: &[&str]) -> String {
        let listed: Vec<String> = roots
            .iter()
            .map(|root| format!("\"{root}\"=\"read\""))
            .collect();
        format!(
            "permissions.goodboy-ask.filesystem={{\":minimal\"=\"read\",{}}}",
            listed.join(",")
        )
    }

    fn assert_read_profile(cli: &[String], roots: &[&str]) {
        assert_eq!(flag_value(cli, "-s"), None, "{cli:?}");
        assert!(has_pair(cli, "-c", "default_permissions=\"goodboy-ask\""));
        assert!(has_pair(cli, "-c", &grants(roots)), "{cli:?}");
        assert!(has_pair(cli, "-c", "mcp_servers={}"));
        for switch in ["--ignore-user-config", "--ignore-rules", "--ephemeral"] {
            assert!(cli.contains(&switch.to_string()), "{switch} missing");
        }
        assert!(assert_read_only("codex", cli, CodexSandbox::Profile).is_ok());
        assert!(assert_read_only("codex", cli, CodexSandbox::ReadOnly).is_err());
    }

    #[test]
    fn the_codex_sandbox_follows_the_cli_version() {
        for version in [
            "codex-cli 0.160.0",
            "codex-cli 0.161.2",
            "codex-cli 1.0.0",
            "codex-cli 0.160.0-alpha.3",
            "v0.172",
        ] {
            assert_eq!(
                codex_sandbox_for(Some(version)),
                CodexSandbox::Profile,
                "{version}"
            );
        }
        for version in ["codex-cli 0.159.9", "codex-cli 0.98.0", "codex-cli", ""] {
            assert_eq!(
                codex_sandbox_for(Some(version)),
                CodexSandbox::ReadOnly,
                "{version}"
            );
        }
        assert_eq!(codex_sandbox_for(None), CodexSandbox::ReadOnly);
        assert_eq!(detect_codex_sandbox("anthropic"), CodexSandbox::ReadOnly);
    }

    #[test]
    fn codex_from_0_160_asks_from_the_worktrees_and_reads_only_them_and_the_dossier() {
        let mut scope = ask_scope_for("codex", &WORKTREES);
        scope.codex = CodexSandbox::Profile;
        let prepared = prepare_ask_turn(
            &ask_args_for("codex"),
            &scope,
            Some(Path::new(HOME)),
            DOSSIER,
        )
        .expect("read profile ask");
        assert_eq!(prepared.working_dir, WORKTREES[0]);
        assert_eq!(flag_value(&prepared.cli, "--cd"), Some(WORKTREES[0]));
        assert_read_profile(
            &prepared.cli,
            &[
                WORKTREES[0],
                "/Users/mara/code/payments-api/.goodboy/worktrees/webhook-retries",
                DOSSIER,
            ],
        );
        let prompt = prepared.cli.last().unwrap();
        assert!(prompt.contains(&format!("- {DOSSIER}/agents/A2.md")));
    }

    #[test]
    fn codex_from_0_160_chats_over_the_workspace_projects_and_its_images_only() {
        let mut scope = scope_for("codex");
        scope.codex = CodexSandbox::Profile;
        let args = args_for("codex");
        let prepared = prepare_chat_turn(&args, &scope, Some(Path::new(HOME)), None)
            .expect("read profile chat");
        assert_eq!(
            prepared.working_dir,
            "/Users/mara/code/harborline/payments-api"
        );
        assert_read_profile(
            &prepared.cli,
            &[
                "/Users/mara/code/harborline/payments-api",
                "/Users/mara/code/harborline/ledger-core",
            ],
        );
        let mut with_images = args_for("codex");
        with_images.images = true;
        let prepared = prepare_chat_turn(
            &with_images,
            &scope,
            Some(Path::new(HOME)),
            Some(&turn_images(IMAGE_ROOT)),
        )
        .expect("read profile chat with images");
        assert_read_profile(
            &prepared.cli,
            &[
                "/Users/mara/code/harborline/payments-api",
                "/Users/mara/code/harborline/ledger-core",
                IMAGE_ROOT,
            ],
        );
        assert_eq!(
            flag_value(&prepared.cli, "--image"),
            Some(format!("{IMAGE_ROOT}/1-acme-trace.png").as_str())
        );
    }

    #[test]
    fn a_sandbox_flag_or_a_write_grant_breaks_the_read_profile() {
        let mut scope = scope_for("codex");
        scope.codex = CodexSandbox::Profile;
        let cli = prepare_chat_turn(&args_for("codex"), &scope, Some(Path::new(HOME)), None)
            .expect("read profile chat")
            .cli;
        let separator = cli.iter().position(|arg| arg == "--").unwrap();
        let mut sandboxed = cli.clone();
        sandboxed.insert(separator, "read-only".to_string());
        sandboxed.insert(separator, "-s".to_string());
        assert!(assert_read_only("codex", &sandboxed, CodexSandbox::Profile).is_err());
        let writing: Vec<String> = cli
            .iter()
            .map(|arg| arg.replace("ledger-core\"=\"read\"", "ledger-core\"=\"write\""))
            .collect();
        assert!(assert_read_only("codex", &writing, CodexSandbox::Profile).is_err());
        let at = cli
            .iter()
            .position(|arg| arg.starts_with("permissions.goodboy-ask.filesystem="))
            .unwrap();
        let mut bare = cli.clone();
        bare.drain(at - 1..=at);
        assert!(assert_read_only("codex", &bare, CodexSandbox::Profile).is_err());
    }

    #[test]
    fn read_roots_are_quoted_as_toml_strings() {
        assert_eq!(
            codex_filesystem(&[
                "/code/acme \"edge\"\\api".to_string(),
                "/code/acme \"edge\"\\api".to_string(),
            ]),
            "permissions.goodboy-ask.filesystem={\":minimal\"=\"read\",\"/code/acme \\\"edge\\\"\\\\api\"=\"read\"}"
        );
    }

    #[test]
    fn a_session_without_a_worktree_asks_from_the_dossier_alone() {
        for provider in PROVIDERS {
            let prepared = prepare_ask(provider, &[]);
            assert_eq!(prepared.working_dir, DOSSIER, "{provider}");
            assert!(
                !prepared.cli.contains(&"--add-dir".to_string()),
                "{provider}"
            );
            let prompt = prepared.cli.last().unwrap();
            assert!(!prompt.contains(ASK_WORKTREES_HEADER), "{provider}");
        }
    }

    #[test]
    fn ask_refuses_providers_that_cannot_run_read_only_and_a_provider_the_thread_does_not_use() {
        for provider in ["cursor", "gemini", "opencode"] {
            let result = prepare_ask_turn(
                &ask_args_for(provider),
                &ask_scope_for(provider, &WORKTREES),
                Some(Path::new(HOME)),
                DOSSIER,
            );
            assert!(matches!(result, Err(ChatError::NotReadOnly(_))));
        }
        let mismatch = prepare_ask_turn(
            &ask_args_for("codex"),
            &ask_scope_for("anthropic", &WORKTREES),
            Some(Path::new(HOME)),
            DOSSIER,
        );
        assert!(matches!(mismatch, Err(ChatError::ProviderMismatch { .. })));
    }

    #[test]
    fn ask_never_reads_the_home_folder_or_a_parent_of_it() {
        let prepared = prepare_ask("anthropic", &["/Users", HOME, "relative/path"]);
        assert_eq!(prepared.working_dir, DOSSIER);
        assert!(!prepared.cli.contains(&"--add-dir".to_string()));
    }

    #[test]
    fn dossier_names_stay_inside_the_staged_root() {
        for name in ["session.md", "agents/A2.md", "runs/R1.md"] {
            assert!(is_safe_dossier_name(name), "{name}");
        }
        for name in [
            "../escape.md",
            "/etc/passwd.md",
            "agents/../../x.md",
            ".hidden.md",
            "a/b/c.md",
            "agents/A2.txt",
            "-flag.md",
            "",
        ] {
            assert!(!is_safe_dossier_name(name), "{name}");
        }
    }

    #[test]
    fn the_dossier_is_capped_in_files_and_bytes() {
        let many: Vec<AskDossierFile> = (0..=ASK_MAX_FILES)
            .map(|index| AskDossierFile {
                name: format!("f{index}.md"),
                content: String::new(),
            })
            .collect();
        assert!(matches!(
            check_dossier(&many),
            Err(ChatError::InvalidDossier(_))
        ));
        let big = vec![AskDossierFile {
            name: "session.md".to_string(),
            content: "x".repeat(ASK_MAX_BYTES + 1),
        }];
        assert!(matches!(
            check_dossier(&big),
            Err(ChatError::InvalidDossier(_))
        ));
        let twice = vec![
            AskDossierFile {
                name: "session.md".to_string(),
                content: String::new(),
            },
            AskDossierFile {
                name: "session.md".to_string(),
                content: String::new(),
            },
        ];
        assert!(matches!(
            check_dossier(&twice),
            Err(ChatError::InvalidDossier(_))
        ));
    }

    #[test]
    fn the_dossier_is_staged_read_only_and_removed_after_the_turn() {
        let temp = std::env::temp_dir().join(format!("goodboy-ask-test-{}", std::process::id()));
        let files = vec![
            AskDossierFile {
                name: "session.md".to_string(),
                content: "Fix webhook retries".to_string(),
            },
            AskDossierFile {
                name: "agents/A2.md".to_string(),
                content: "Implementer".to_string(),
            },
        ];
        let root = stage_ask_dossier_in(&temp, "run-7", &files).unwrap();
        assert_eq!(
            std::fs::read_to_string(root.join("agents/A2.md")).unwrap(),
            "Implementer"
        );
        assert!(std::fs::write(root.join("new.md"), "x").is_err());
        remove_staged_root(&root);
        assert!(!root.exists());
        let _ = std::fs::remove_dir_all(&temp);
        assert!(matches!(
            stage_ask_dossier_in(&temp, "../run", &files),
            Err(ChatError::InvalidValue { .. })
        ));
    }

    #[test]
    fn the_ask_scope_is_the_thread_of_this_session_and_its_attached_worktrees() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE chats (id TEXT PRIMARY KEY, provider TEXT, session_id TEXT);
             CREATE TABLE session_worktrees (id TEXT PRIMARY KEY, session_id TEXT,
               worktree_path TEXT, is_attached INTEGER, parallel_index INTEGER, created_at INTEGER);
             INSERT INTO chats VALUES ('ask-1', 'anthropic', 'session-1');
             INSERT INTO chats VALUES ('chat-1', 'anthropic', NULL);
             INSERT INTO session_worktrees VALUES ('w2', 'session-1', '/code/payments-api/wt', 1, 1, 1);
             INSERT INTO session_worktrees VALUES ('w1', 'session-1', '/code/notify-relay/wt', 1, 0, 2);
             INSERT INTO session_worktrees VALUES ('w3', 'session-1', '/code/old/wt', 0, 2, 0);
             INSERT INTO session_worktrees VALUES ('w4', 'session-1', NULL, 1, 3, 0);
             INSERT INTO session_worktrees VALUES ('w5', 'session-2', '/code/other/wt', 1, 0, 0);",
        )
        .unwrap();
        let scope = load_ask_scope(&conn, "ask-1", "session-1").unwrap();
        assert_eq!(scope.provider, "anthropic");
        assert_eq!(
            scope.worktrees,
            vec!["/code/notify-relay/wt", "/code/payments-api/wt"]
        );
        assert!(matches!(
            load_ask_scope(&conn, "ask-1", "session-2"),
            Err(ChatError::NotFound(_))
        ));
        assert!(matches!(
            load_ask_scope(&conn, "chat-1", "session-1"),
            Err(ChatError::NotFound(_))
        ));
    }
}
