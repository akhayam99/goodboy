use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde::{Deserialize, Serialize};

static SCAN_GENERATION: AtomicU64 = AtomicU64::new(0);

const WORKTREES_MARKER: &str = "--goodboy-worktrees-";

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum OtherToolId {
    ClaudeCode,
    Codex,
    Cursor,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OtherToolUsage {
    pub id: OtherToolId,
    pub path: String,
    pub display_path: String,
    pub bytes: u64,
    pub sessions: u64,
    pub goodboy_bytes: u64,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum OtherToolsScan {
    Ready { tools: Vec<OtherToolUsage> },
    Cancelled,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OtherToolsRequest {
    #[serde(default)]
    pub codex_thread_ids: Vec<String>,
    #[serde(default)]
    pub cursor_chat_ids: Vec<String>,
}

pub(crate) struct ToolRoots {
    pub claude: Option<PathBuf>,
    pub codex: Option<PathBuf>,
    pub cursor: Option<PathBuf>,
    pub goodboy: Option<PathBuf>,
    pub home: Option<PathBuf>,
}

struct Walked {
    bytes: u64,
}

fn walk_bytes(root: &Path, is_cancelled: &dyn Fn() -> bool) -> Option<Walked> {
    let mut bytes = 0_u64;
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        if is_cancelled() {
            return None;
        }
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let Ok(meta) = entry.metadata() else {
                continue;
            };
            if meta.is_dir() {
                stack.push(entry.path());
                continue;
            }
            bytes = bytes.saturating_add(meta.len());
        }
    }
    Some(Walked { bytes })
}

fn child_dirs(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter(|entry| entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
        .map(|entry| entry.path())
        .collect()
}

fn file_name(path: &Path) -> &str {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
}

pub(crate) fn encode_claude_project(path: &Path) -> String {
    path.to_string_lossy()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect()
}

fn is_goodboy_claude_project(name: &str, goodboy_prefix: Option<&str>) -> bool {
    if name.contains(WORKTREES_MARKER) {
        return true;
    }
    match goodboy_prefix {
        Some(prefix) => name == prefix || name.starts_with(&format!("{prefix}-")),
        None => false,
    }
}

fn scan_claude(
    root: &Path,
    goodboy: Option<&Path>,
    is_cancelled: &dyn Fn() -> bool,
) -> Option<(u64, u64, u64)> {
    let total = walk_bytes(root, is_cancelled)?.bytes;
    let prefix = goodboy.map(encode_claude_project);
    let mut sessions = 0_u64;
    let mut goodboy_bytes = 0_u64;
    for project in child_dirs(&root.join("projects")) {
        if is_cancelled() {
            return None;
        }
        let Ok(entries) = std::fs::read_dir(&project) else {
            continue;
        };
        sessions += entries
            .flatten()
            .filter(|entry| file_name(&entry.path()).ends_with(".jsonl"))
            .count() as u64;
        if is_goodboy_claude_project(file_name(&project), prefix.as_deref()) {
            goodboy_bytes += walk_bytes(&project, is_cancelled)?.bytes;
        }
    }
    Some((total, sessions, goodboy_bytes))
}

fn rollout_thread_id(name: &str) -> Option<&str> {
    let stem = name.strip_prefix("rollout-")?.strip_suffix(".jsonl")?;
    let start = stem.len().checked_sub(36)?;
    stem.get(start..)
}

fn scan_codex(
    root: &Path,
    thread_ids: &HashSet<String>,
    is_cancelled: &dyn Fn() -> bool,
) -> Option<(u64, u64, u64)> {
    let total = walk_bytes(root, is_cancelled)?.bytes;
    let mut sessions = 0_u64;
    let mut goodboy_bytes = 0_u64;
    let mut stack = vec![root.join("sessions")];
    while let Some(dir) = stack.pop() {
        if is_cancelled() {
            return None;
        }
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let Ok(meta) = entry.metadata() else {
                continue;
            };
            if meta.is_dir() {
                stack.push(entry.path());
                continue;
            }
            let path = entry.path();
            let Some(id) = rollout_thread_id(file_name(&path)) else {
                continue;
            };
            sessions += 1;
            if thread_ids.contains(id) {
                goodboy_bytes = goodboy_bytes.saturating_add(meta.len());
            }
        }
    }
    Some((total, sessions, goodboy_bytes))
}

fn scan_cursor(
    root: &Path,
    chat_ids: &HashSet<String>,
    is_cancelled: &dyn Fn() -> bool,
) -> Option<(u64, u64, u64)> {
    let total = walk_bytes(root, is_cancelled)?.bytes;
    let mut sessions = 0_u64;
    let mut goodboy_bytes = 0_u64;
    for workspace in child_dirs(&root.join("chats")) {
        for chat in child_dirs(&workspace) {
            if is_cancelled() {
                return None;
            }
            sessions += 1;
            if chat_ids.contains(file_name(&chat)) {
                goodboy_bytes += walk_bytes(&chat, is_cancelled)?.bytes;
            }
        }
    }
    Some((total, sessions, goodboy_bytes))
}

fn display_path(path: &Path, home: Option<&Path>) -> String {
    match home.and_then(|home| path.strip_prefix(home).ok()) {
        Some(rest) => format!("~/{}", rest.to_string_lossy()),
        None => path.to_string_lossy().into_owned(),
    }
}

pub(crate) fn scan_other_tools(
    roots: &ToolRoots,
    request: &OtherToolsRequest,
    is_cancelled: &dyn Fn() -> bool,
) -> OtherToolsScan {
    let codex_ids: HashSet<String> = request.codex_thread_ids.iter().cloned().collect();
    let cursor_ids: HashSet<String> = request.cursor_chat_ids.iter().cloned().collect();
    let plan: [(OtherToolId, Option<&PathBuf>); 3] = [
        (OtherToolId::ClaudeCode, roots.claude.as_ref()),
        (OtherToolId::Codex, roots.codex.as_ref()),
        (OtherToolId::Cursor, roots.cursor.as_ref()),
    ];
    let mut tools = Vec::new();
    for (id, root) in plan {
        let Some(root) = root.filter(|root| root.is_dir()) else {
            continue;
        };
        let measured = match id {
            OtherToolId::ClaudeCode => scan_claude(root, roots.goodboy.as_deref(), is_cancelled),
            OtherToolId::Codex => scan_codex(root, &codex_ids, is_cancelled),
            OtherToolId::Cursor => scan_cursor(root, &cursor_ids, is_cancelled),
        };
        let Some((bytes, sessions, goodboy_bytes)) = measured else {
            return OtherToolsScan::Cancelled;
        };
        tools.push(OtherToolUsage {
            id,
            path: root.to_string_lossy().into_owned(),
            display_path: display_path(root, roots.home.as_deref()),
            bytes,
            sessions,
            goodboy_bytes,
        });
    }
    OtherToolsScan::Ready { tools }
}

fn claude_home() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os("CLAUDE_CONFIG_DIR") {
        if !dir.is_empty() {
            return Some(PathBuf::from(dir));
        }
    }
    Some(dirs::home_dir()?.join(".claude"))
}

fn live_roots() -> ToolRoots {
    ToolRoots {
        claude: claude_home(),
        codex: crate::codex_rollout::codex_home(),
        cursor: crate::cursor_config::source_config_dir(),
        goodboy: crate::db::resolve_db_path()
            .ok()
            .and_then(|path| path.parent().map(Path::to_path_buf)),
        home: dirs::home_dir(),
    }
}

#[tauri::command]
pub async fn other_tools_scan(request: Option<OtherToolsRequest>) -> OtherToolsScan {
    let generation = SCAN_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let request = request.unwrap_or_default();
    tauri::async_runtime::spawn_blocking(move || {
        let is_cancelled = || SCAN_GENERATION.load(Ordering::SeqCst) != generation;
        scan_other_tools(&live_roots(), &request, &is_cancelled)
    })
    .await
    .unwrap_or(OtherToolsScan::Cancelled)
}

#[tauri::command]
pub async fn other_tools_cancel() {
    SCAN_GENERATION.fetch_add(1, Ordering::SeqCst);
}

#[cfg(all(test, unix))]
mod tests;
