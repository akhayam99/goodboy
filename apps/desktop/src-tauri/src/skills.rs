use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct SkillRow {
    pub id: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub body: String,
    #[serde(rename = "frontmatterJson")]
    pub frontmatter_json: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct SkillUpsertInput {
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "frontmatterJson")]
    pub frontmatter_json: String,
    pub body: String,
    /// Pre-serialized markdown (frontmatter + body). Written verbatim to disk.
    pub markdown: String,
    /// Optional explicit file path; if absent, derived from workspace root.
    #[serde(rename = "filePath")]
    pub file_path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SkillRunScriptResult {
    pub stdout: String,
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/// Returns the workspace root_path for a given workspace id.
fn workspace_root(conn: &rusqlite::Connection, workspace_id: &str) -> Result<String, SkillError> {
    let root: String = conn
        .query_row(
            "SELECT root_path FROM workspaces WHERE id = ?1 LIMIT 1",
            rusqlite::params![workspace_id],
            |row| row.get(0),
        )
        .map_err(|_| SkillError::WorkspaceNotFound(workspace_id.to_string()))?;
    Ok(root)
}

/// Canonicalize `path` and verify it sits under `allowed_prefix`.
/// Returns the canonical path string.
fn guard_path(path: &Path, allowed_prefix: &Path) -> Result<PathBuf, SkillError> {
    // Ensure the parent directory exists so canonicalize works on the file too.
    // For files that don't yet exist we canonicalize the parent and then re-append.
    let canonical = if path.exists() {
        path.canonicalize()
            .map_err(|e| SkillError::Io(e.to_string()))?
    } else {
        let parent = path.parent().unwrap_or(Path::new("."));
        let canon_parent = parent
            .canonicalize()
            .map_err(|e| SkillError::Io(e.to_string()))?;
        let file_name = path
            .file_name()
            .ok_or_else(|| SkillError::PathTraversal(path.to_string_lossy().to_string()))?;
        canon_parent.join(file_name)
    };

    let canon_prefix = allowed_prefix
        .canonicalize()
        .map_err(|e| SkillError::Io(e.to_string()))?;

    if !canonical.starts_with(&canon_prefix) {
        return Err(SkillError::PathTraversal(
            canonical.to_string_lossy().to_string(),
        ));
    }
    Ok(canonical)
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum SkillError {
    #[error("db error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("db mutex poisoned")]
    Poisoned,
    #[error("workspace not found: {0}")]
    WorkspaceNotFound(String),
    #[error("skill not found: {0}")]
    NotFound(String),
    #[error("path traversal detected: {0}")]
    PathTraversal(String),
    #[error("io error: {0}")]
    Io(String),
    #[error("script error (exit {exit_code}): {stderr}")]
    Script { exit_code: i32, stderr: String },
}

impl Serialize for SkillError {
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

impl SkillError {
    fn kind(&self) -> &'static str {
        match self {
            SkillError::Db(_) => "db",
            SkillError::Poisoned => "poisoned",
            SkillError::WorkspaceNotFound(_) => "workspace_not_found",
            SkillError::NotFound(_) => "not_found",
            SkillError::PathTraversal(_) => "path_traversal",
            SkillError::Io(_) => "io",
            SkillError::Script { .. } => "script",
        }
    }
}

impl From<DbError> for SkillError {
    fn from(e: DbError) -> Self {
        match e {
            DbError::Sqlite(inner) => SkillError::Db(inner),
            DbError::Poisoned => SkillError::Poisoned,
            _ => SkillError::Io(e.to_string()),
        }
    }
}

// ---------------------------------------------------------------------------
// Commands — CRUD
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn skill_list(
    state: State<'_, Db>,
    workspace_id: String,
) -> Result<Vec<SkillRow>, SkillError> {
    let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, name, description, file_path, body, frontmatter_json,
                created_at, updated_at
         FROM skills
         WHERE workspace_id = ?1
         ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(rusqlite::params![workspace_id], |row| {
        Ok(SkillRow {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            file_path: row.get(4)?,
            body: row.get(5)?,
            frontmatter_json: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(SkillError::Db)
}

#[tauri::command]
pub fn skill_get(
    state: State<'_, Db>,
    skill_id: String,
) -> Result<Option<SkillRow>, SkillError> {
    let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, name, description, file_path, body, frontmatter_json,
                created_at, updated_at
         FROM skills
         WHERE id = ?1
         LIMIT 1",
    )?;
    let mut rows = stmt.query_map(rusqlite::params![skill_id], |row| {
        Ok(SkillRow {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            file_path: row.get(4)?,
            body: row.get(5)?,
            frontmatter_json: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row.map_err(SkillError::Db)?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn skill_upsert(
    state: State<'_, Db>,
    input: SkillUpsertInput,
) -> Result<SkillRow, SkillError> {
    let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;

    let root = workspace_root(&conn, &input.workspace_id)?;
    let skills_dir = PathBuf::from(&root).join(".kay").join("skills");

    // Derive file path if not provided.
    let raw_path = match &input.file_path {
        Some(fp) => PathBuf::from(fp),
        None => skills_dir.join(format!("{}.md", &input.name)),
    };

    // Ensure skills dir exists before guarding (guard needs dir to canonicalize).
    std::fs::create_dir_all(&skills_dir).map_err(|e| SkillError::Io(e.to_string()))?;

    let canonical = guard_path(&raw_path, &skills_dir)?;

    // Write pre-serialized markdown to disk.
    std::fs::write(&canonical, &input.markdown).map_err(|e| SkillError::Io(e.to_string()))?;

    let file_path_str = canonical.to_string_lossy().to_string();
    let now = iso_now();

    // Upsert by (workspace_id, name); generate id if new.
    let existing_id: Option<String> = {
        let mut stmt = conn.prepare(
            "SELECT id FROM skills WHERE workspace_id = ?1 AND name = ?2 LIMIT 1",
        )?;
        let mut rows =
            stmt.query_map(rusqlite::params![input.workspace_id, input.name], |row| {
                row.get(0)
            })?;
        match rows.next() {
            Some(r) => Some(r.map_err(SkillError::Db)?),
            None => None,
        }
    };

    let id = existing_id.unwrap_or_else(uuid_v4);
    let created_at: String = {
        let mut stmt = conn.prepare(
            "SELECT created_at FROM skills WHERE id = ?1 LIMIT 1",
        )?;
        let mut rows =
            stmt.query_map(rusqlite::params![id], |row| row.get(0))?;
        match rows.next() {
            Some(r) => r.map_err(SkillError::Db)?,
            None => now.clone(),
        }
    };

    conn.execute(
        "INSERT INTO skills
           (id, workspace_id, name, description, file_path, body, frontmatter_json,
            created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(id) DO UPDATE SET
           name            = excluded.name,
           description     = excluded.description,
           file_path       = excluded.file_path,
           body            = excluded.body,
           frontmatter_json = excluded.frontmatter_json,
           updated_at      = excluded.updated_at",
        rusqlite::params![
            id,
            input.workspace_id,
            input.name,
            input.description,
            file_path_str,
            input.body,
            input.frontmatter_json,
            created_at,
            now,
        ],
    )?;

    Ok(SkillRow {
        id,
        workspace_id: input.workspace_id,
        name: input.name,
        description: input.description,
        file_path: file_path_str,
        body: input.body,
        frontmatter_json: input.frontmatter_json,
        created_at,
        updated_at: now,
    })
}

#[tauri::command]
pub fn skill_delete(state: State<'_, Db>, skill_id: String) -> Result<(), SkillError> {
    let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;

    // Look up the row first to get file_path + workspace root for path guard.
    let row: Option<(String, String)> = {
        let mut stmt = conn.prepare(
            "SELECT s.file_path, w.root_path
             FROM skills s
             JOIN workspaces w ON w.id = s.workspace_id
             WHERE s.id = ?1
             LIMIT 1",
        )?;
        let mut rows = stmt.query_map(rusqlite::params![skill_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        match rows.next() {
            Some(r) => Some(r.map_err(SkillError::Db)?),
            None => None,
        }
    };

    if let Some((file_path, root_path)) = row {
        let skills_dir = PathBuf::from(&root_path).join(".kay").join("skills");
        let path = PathBuf::from(&file_path);

        // Only guard if the skills dir exists; if it's gone we skip file removal.
        if skills_dir.exists() {
            let canonical = guard_path(&path, &skills_dir)?;
            if canonical.exists() {
                std::fs::remove_file(&canonical)
                    .map_err(|e| SkillError::Io(e.to_string()))?;
            }
        } else if path.exists() {
            // skills_dir gone — refuse to remove arbitrary path without guard
            return Err(SkillError::PathTraversal(file_path));
        }
    } else {
        return Err(SkillError::NotFound(skill_id));
    }

    conn.execute(
        "DELETE FROM skills WHERE id = ?1",
        rusqlite::params![skill_id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn skill_rescan(
    state: State<'_, Db>,
    workspace_id: String,
) -> Result<Vec<SkillRow>, SkillError> {
    let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;
    let root = workspace_root(&conn, &workspace_id)?;
    let root_path = PathBuf::from(&root);
    let kay_dir = root_path.join(".kay").join("skills");
    let claude_dir = root_path.join(".claude").join("skills");

    // Discover skill files from both layouts:
    //   - <root>/.kay/skills/*.md            (kay-am native)
    //   - <root>/.claude/skills/<name>/SKILL.md  (claude-code convention)
    let mut md_files: Vec<PathBuf> = Vec::new();

    if kay_dir.exists() {
        let entries = std::fs::read_dir(&kay_dir).map_err(|e| SkillError::Io(e.to_string()))?;
        for entry in entries {
            let entry = entry.map_err(|e| SkillError::Io(e.to_string()))?;
            let p = entry.path();
            if p.extension().and_then(|s| s.to_str()) == Some("md") {
                md_files.push(p);
            }
        }
    }

    if claude_dir.exists() {
        let entries =
            std::fs::read_dir(&claude_dir).map_err(|e| SkillError::Io(e.to_string()))?;
        for entry in entries {
            let entry = entry.map_err(|e| SkillError::Io(e.to_string()))?;
            let dir = entry.path();
            if !dir.is_dir() {
                continue;
            }
            let candidate = dir.join("SKILL.md");
            if candidate.exists() {
                md_files.push(candidate);
            }
        }
    }

    let now = iso_now();

    // Existing skills in DB for this workspace.
    let existing: Vec<(String, String)> = {
        let mut stmt =
            conn.prepare("SELECT id, file_path FROM skills WHERE workspace_id = ?1")?;
        let rows = stmt.query_map(rusqlite::params![workspace_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(SkillError::Db)?
    };

    let existing_by_path: std::collections::HashMap<String, String> = existing
        .iter()
        .map(|(id, fp)| (fp.clone(), id.clone()))
        .collect();

    let mut scanned_paths = std::collections::HashSet::new();

    for file_path in &md_files {
        let canonical = match file_path.canonicalize() {
            Ok(c) => c,
            Err(e) => return Err(SkillError::Io(e.to_string())),
        };
        let fp_str = canonical.to_string_lossy().to_string();
        scanned_paths.insert(fp_str.clone());

        let content =
            std::fs::read_to_string(&canonical).map_err(|e| SkillError::Io(e.to_string()))?;

        // Extract name/description from frontmatter naively (no TS parser available).
        let (name, description, body, frontmatter_json) = parse_skill_markdown_rust(&content)?;

        let id = existing_by_path
            .get(&fp_str)
            .cloned()
            .unwrap_or_else(uuid_v4);

        let created_at: String = {
            let mut stmt =
                conn.prepare("SELECT created_at FROM skills WHERE id = ?1 LIMIT 1")?;
            let mut rows = stmt.query_map(rusqlite::params![id], |row| row.get(0))?;
            match rows.next() {
                Some(r) => r.map_err(SkillError::Db)?,
                None => now.clone(),
            }
        };

        conn.execute(
            "INSERT INTO skills
               (id, workspace_id, name, description, file_path, body, frontmatter_json,
                created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(id) DO UPDATE SET
               name             = excluded.name,
               description      = excluded.description,
               file_path        = excluded.file_path,
               body             = excluded.body,
               frontmatter_json = excluded.frontmatter_json,
               updated_at       = excluded.updated_at",
            rusqlite::params![
                id,
                workspace_id,
                name,
                description,
                fp_str,
                body,
                frontmatter_json,
                created_at,
                now,
            ],
        )?;
    }

    // Delete DB rows whose files are no longer on disk.
    for (id, fp) in &existing {
        if !scanned_paths.contains(fp) {
            conn.execute("DELETE FROM skills WHERE id = ?1", rusqlite::params![id])?;
        }
    }

    // Return updated list.
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, name, description, file_path, body, frontmatter_json,
                created_at, updated_at
         FROM skills
         WHERE workspace_id = ?1
         ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(rusqlite::params![workspace_id], |row| {
        Ok(SkillRow {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            file_path: row.get(4)?,
            body: row.get(5)?,
            frontmatter_json: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(SkillError::Db)
}

// ---------------------------------------------------------------------------
// Command — script runner (for TS SkillExecutor)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct SkillRunScriptInput {
    #[serde(rename = "scriptPath")]
    pub script_path: String,
    pub args: Vec<String>,
    #[serde(rename = "workingDir")]
    pub working_dir: String,
    /// Workspace root — used to derive the allowed prefix for path guard.
    #[serde(rename = "workspaceRoot")]
    pub workspace_root: String,
}

#[tauri::command]
pub fn skill_run_script(input: SkillRunScriptInput) -> Result<SkillRunScriptResult, SkillError> {
    let allowed_prefix = PathBuf::from(&input.workspace_root)
        .join(".kay")
        .join("skills");

    if !allowed_prefix.exists() {
        return Err(SkillError::PathTraversal(input.script_path.clone()));
    }

    let script_path = PathBuf::from(&input.script_path);
    let canonical = guard_path(&script_path, &allowed_prefix)?;

    let output = Command::new("bash")
        .arg(&canonical)
        .args(&input.args)
        .current_dir(&input.working_dir)
        .output()
        .map_err(|e| SkillError::Io(e.to_string()))?;

    if !output.status.success() {
        let exit_code = output.status.code().unwrap_or(-1);
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(SkillError::Script { exit_code, stderr });
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(SkillRunScriptResult { stdout })
}

// ---------------------------------------------------------------------------
// Minimal frontmatter parser (mirrors TS parser, subset)
// ---------------------------------------------------------------------------

/// Returns (name, description, body, frontmatter_json).
fn parse_skill_markdown_rust(
    raw: &str,
) -> Result<(String, String, String, String), SkillError> {
    // Match opening/closing --- delimiters.
    let after_first = raw
        .strip_prefix("---")
        .and_then(|s| s.strip_prefix('\n').or_else(|| s.strip_prefix("\r\n")));

    let after_first = match after_first {
        Some(s) => s,
        None => {
            return Err(SkillError::Io(
                "missing frontmatter delimiters".to_string(),
            ))
        }
    };

    // Find closing ---
    let close_marker = "\n---";
    let close_pos = after_first
        .find(close_marker)
        .ok_or_else(|| SkillError::Io("missing closing frontmatter delimiter".to_string()))?;

    let frontmatter_block = &after_first[..close_pos];
    let after_close = &after_first[close_pos + close_marker.len()..];
    // Trim leading newlines from body.
    let body = after_close.trim_start_matches('\n').to_string();

    // Parse key: value lines.
    let mut fields: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for line in frontmatter_block.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some(colon) = trimmed.find(':') {
            let key = trimmed[..colon].trim().to_string();
            let val = trimmed[colon + 1..].trim().to_string();
            fields.insert(key, val);
        }
    }

    let name = fields
        .get("name")
        .map(|s| unquote_str(s.as_str()))
        .filter(|s| !s.is_empty())
        .ok_or_else(|| SkillError::Io("frontmatter missing required field: name".to_string()))?;

    let description = fields
        .get("description")
        .map(|s| unquote_str(s.as_str()))
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            SkillError::Io("frontmatter missing required field: description".to_string())
        })?;

    // Build frontmatter_json from parsed fields.
    let mut fm_map = serde_json::Map::new();
    fm_map.insert("name".to_string(), serde_json::Value::String(name.clone()));
    fm_map.insert(
        "description".to_string(),
        serde_json::Value::String(description.clone()),
    );

    if let Some(args_raw) = fields.get("args") {
        let args = parse_yaml_list(args_raw);
        let arr: Vec<serde_json::Value> =
            args.into_iter().map(serde_json::Value::String).collect();
        fm_map.insert("args".to_string(), serde_json::Value::Array(arr));
    }

    if let Some(scripts_raw) = fields.get("scripts") {
        let scripts = parse_yaml_list(scripts_raw);
        let arr: Vec<serde_json::Value> = scripts
            .into_iter()
            .map(serde_json::Value::String)
            .collect();
        fm_map.insert("scripts".to_string(), serde_json::Value::Array(arr));
    }

    let frontmatter_json = serde_json::to_string(&fm_map)
        .map_err(|e| SkillError::Io(e.to_string()))?;

    Ok((name, description, body, frontmatter_json))
}

fn unquote_str(s: &str) -> String {
    let s = s.trim();
    if (s.starts_with('"') && s.ends_with('"'))
        || (s.starts_with('\'') && s.ends_with('\''))
    {
        s[1..s.len() - 1].to_string()
    } else {
        s.to_string()
    }
}

fn parse_yaml_list(raw: &str) -> Vec<String> {
    let trimmed = raw.trim();
    if trimmed.starts_with('[') {
        let inner = &trimmed[1..trimmed.rfind(']').unwrap_or(trimmed.len())];
        return inner
            .split(',')
            .map(|s| unquote_str(s.trim()))
            .filter(|s| !s.is_empty())
            .collect();
    }
    // Inline YAML list on single line (shouldn't happen for multiline here, but handle gracefully)
    trimmed
        .split(',')
        .map(|s| unquote_str(s.trim()))
        .filter(|s| !s.is_empty())
        .collect()
}

// ---------------------------------------------------------------------------
// Utilities (duplicated from budget.rs to keep modules independent)
// ---------------------------------------------------------------------------

fn uuid_v4() -> String {
    use sha2::{Digest, Sha256};
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let pid = std::process::id();
    static COUNTER: std::sync::atomic::AtomicU64 =
        std::sync::atomic::AtomicU64::new(0);
    let seq = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let input = format!("{}-{}-{}", t.as_nanos(), pid, seq);
    let hash = Sha256::digest(input.as_bytes());
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-4{:01x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        hash[0], hash[1], hash[2], hash[3],
        hash[4], hash[5],
        hash[6] & 0x0f, hash[7],
        (hash[8] & 0x3f) | 0x80, hash[9],
        hash[10], hash[11], hash[12], hash[13], hash[14], hash[15],
    )
}

fn iso_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let (year, month, day, hour, min, sec) = epoch_secs_to_datetime(secs);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, min, sec
    )
}

fn is_leap_year(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

fn days_in_month(y: i64, m: u32) -> i64 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap_year(y) {
                29
            } else {
                28
            }
        }
        _ => unreachable!(),
    }
}

fn epoch_secs_to_datetime(mut s: i64) -> (i64, u32, u32, u32, u32, u32) {
    let sec = (s % 60) as u32;
    s /= 60;
    let min = (s % 60) as u32;
    s /= 60;
    let hour = (s % 24) as u32;
    s /= 24;
    let mut year: i64 = 1970;
    loop {
        let days = if is_leap_year(year) { 366 } else { 365 };
        if s < days {
            break;
        }
        s -= days;
        year += 1;
    }
    let mut month: u32 = 1;
    loop {
        let d = days_in_month(year, month);
        if s < d {
            break;
        }
        s -= d;
        month += 1;
    }
    let day = s as u32 + 1;
    (year, month, day, hour, min, sec)
}
