use std::path::{Path, PathBuf};

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
fn workspace_roots(
    conn: &rusqlite::Connection,
    workspace_id: &str,
) -> Result<Vec<PathBuf>, SkillError> {
    let mut stmt = conn.prepare(
        "SELECT root_path
         FROM projects
         WHERE workspace_id = ?1
         ORDER BY created_at ASC, id ASC",
    )?;
    let rows = stmt.query_map(rusqlite::params![workspace_id], |row| {
        row.get::<_, String>(0).map(PathBuf::from)
    })?;
    let roots = rows.collect::<Result<Vec<_>, _>>()?;
    if roots.is_empty() {
        return Err(SkillError::WorkspaceNotFound(workspace_id.to_string()));
    }
    Ok(roots)
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

crate::util::impl_error_serialize!(SkillError);

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
pub async fn skill_list(
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
            created_at: crate::util::ms_to_iso(row.get(7)?),
            updated_at: crate::util::ms_to_iso(row.get(8)?),
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(SkillError::Db)
}

#[tauri::command]
pub async fn skill_get(
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
            created_at: crate::util::ms_to_iso(row.get(7)?),
            updated_at: crate::util::ms_to_iso(row.get(8)?),
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row.map_err(SkillError::Db)?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn skill_upsert(
    state: State<'_, Db>,
    input: SkillUpsertInput,
) -> Result<SkillRow, SkillError> {
    let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;

    let roots = workspace_roots(&conn, &input.workspace_id)?;
    let skills_dirs = roots
        .iter()
        .map(|root| root.join(".kay").join("skills"))
        .collect::<Vec<_>>();
    let default_skills_dir = skills_dirs
        .first()
        .ok_or_else(|| SkillError::WorkspaceNotFound(input.workspace_id.clone()))?;

    // Derive file path if not provided.
    let raw_path = match &input.file_path {
        Some(fp) => PathBuf::from(fp),
        None => default_skills_dir.join(format!("{}.md", &input.name)),
    };

    let skills_dir = skills_dirs
        .iter()
        .find(|directory| raw_path.starts_with(directory))
        .ok_or_else(|| SkillError::PathTraversal(raw_path.to_string_lossy().to_string()))?;
    std::fs::create_dir_all(skills_dir).map_err(|e| SkillError::Io(e.to_string()))?;
    let canonical = guard_path(&raw_path, skills_dir)?;

    // Write pre-serialized markdown to disk.
    std::fs::write(&canonical, &input.markdown).map_err(|e| SkillError::Io(e.to_string()))?;

    let file_path_str = canonical.to_string_lossy().to_string();
    let now_ms = crate::util::now_ms();
    let now = crate::util::ms_to_iso(now_ms);

    // Upsert by (workspace_id, name); generate id if new.
    let existing_id: Option<String> = {
        let mut stmt =
            conn.prepare("SELECT id FROM skills WHERE workspace_id = ?1 AND name = ?2 LIMIT 1")?;
        let mut rows = stmt
            .query_map(rusqlite::params![input.workspace_id, input.name], |row| {
                row.get(0)
            })?;
        match rows.next() {
            Some(r) => Some(r.map_err(SkillError::Db)?),
            None => None,
        }
    };

    let id = existing_id.unwrap_or_else(crate::util::uuid_v4);
    let created_at_ms: i64 = {
        let mut stmt = conn.prepare("SELECT created_at FROM skills WHERE id = ?1 LIMIT 1")?;
        let mut rows = stmt.query_map(rusqlite::params![id], |row| row.get(0))?;
        match rows.next() {
            Some(r) => r.map_err(SkillError::Db)?,
            None => now_ms,
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
            created_at_ms,
            now_ms,
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
        created_at: crate::util::ms_to_iso(created_at_ms),
        updated_at: now,
    })
}

#[tauri::command]
pub async fn skill_delete(state: State<'_, Db>, skill_id: String) -> Result<(), SkillError> {
    let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;

    // Look up the row first to get file_path + workspace root for path guard.
    let row: Option<(String, String)> = {
        let mut stmt = conn.prepare(
            "SELECT s.file_path, s.workspace_id
             FROM skills s
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

    if let Some((file_path, workspace_id)) = row {
        let roots = workspace_roots(&conn, &workspace_id)?;
        let path = PathBuf::from(&file_path);
        let allowed_dirs = roots.iter().flat_map(|root| {
            [
                root.join(".kay").join("skills"),
                root.join(".claude").join("skills"),
            ]
        });
        let mut guarded_path = None;
        for directory in allowed_dirs {
            if !directory.exists() {
                continue;
            }
            if let Ok(canonical) = guard_path(&path, &directory) {
                guarded_path = Some(canonical);
                break;
            }
        }
        if let Some(canonical) = guarded_path {
            if canonical.exists() {
                std::fs::remove_file(canonical).map_err(|e| SkillError::Io(e.to_string()))?;
            }
        } else if path.exists() {
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
pub async fn skill_rescan(
    state: State<'_, Db>,
    workspace_id: String,
) -> Result<Vec<SkillRow>, SkillError> {
    let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;
    let roots = workspace_roots(&conn, &workspace_id)?;

    // Discover skill files from both layouts:
    //   - <root>/.kay/skills/*.md            (Goodboy native)
    //   - <root>/.claude/skills/<name>/SKILL.md  (claude-code convention)
    let mut md_files: Vec<PathBuf> = Vec::new();

    for root in roots {
        let kay_dir = root.join(".kay").join("skills");
        let claude_dir = root.join(".claude").join("skills");
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
    }

    let now_ms = crate::util::now_ms();

    // Existing skills in DB for this workspace.
    let existing: Vec<(String, String)> = {
        let mut stmt = conn.prepare("SELECT id, file_path FROM skills WHERE workspace_id = ?1")?;
        let rows = stmt.query_map(rusqlite::params![workspace_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(SkillError::Db)?
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
            .unwrap_or_else(crate::util::uuid_v4);

        let created_at_ms: i64 = {
            let mut stmt = conn.prepare("SELECT created_at FROM skills WHERE id = ?1 LIMIT 1")?;
            let mut rows = stmt.query_map(rusqlite::params![id], |row| row.get(0))?;
            match rows.next() {
                Some(r) => r.map_err(SkillError::Db)?,
                None => now_ms,
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
                created_at_ms,
                now_ms,
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
            created_at: crate::util::ms_to_iso(row.get(7)?),
            updated_at: crate::util::ms_to_iso(row.get(8)?),
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
    /// Project root, used to derive the allowed prefix for path guard.
    #[serde(rename = "projectRoot")]
    pub project_root: String,
}

#[tauri::command]
pub async fn skill_run_script(
    input: SkillRunScriptInput,
) -> Result<SkillRunScriptResult, SkillError> {
    tauri::async_runtime::spawn_blocking(move || skill_run_script_blocking(input))
        .await
        .map_err(|e| SkillError::Io(e.to_string()))?
}

fn skill_run_script_blocking(
    input: SkillRunScriptInput,
) -> Result<SkillRunScriptResult, SkillError> {
    let allowed_prefix = PathBuf::from(&input.project_root)
        .join(".kay")
        .join("skills");

    if !allowed_prefix.exists() {
        return Err(SkillError::PathTraversal(input.script_path.clone()));
    }

    let script_path = PathBuf::from(&input.script_path);
    let canonical = guard_path(&script_path, &allowed_prefix)?;

    let output = crate::path_env::command("bash")
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
fn parse_skill_markdown_rust(raw: &str) -> Result<(String, String, String, String), SkillError> {
    // Match opening/closing --- delimiters.
    let after_first = raw
        .strip_prefix("---")
        .and_then(|s| s.strip_prefix('\n').or_else(|| s.strip_prefix("\r\n")));

    let after_first = match after_first {
        Some(s) => s,
        None => return Err(SkillError::Io("missing frontmatter delimiters".to_string())),
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
        let arr: Vec<serde_json::Value> = args.into_iter().map(serde_json::Value::String).collect();
        fm_map.insert("args".to_string(), serde_json::Value::Array(arr));
    }

    if let Some(scripts_raw) = fields.get("scripts") {
        let scripts = parse_yaml_list(scripts_raw);
        let arr: Vec<serde_json::Value> =
            scripts.into_iter().map(serde_json::Value::String).collect();
        fm_map.insert("scripts".to_string(), serde_json::Value::Array(arr));
    }

    let frontmatter_json =
        serde_json::to_string(&fm_map).map_err(|e| SkillError::Io(e.to_string()))?;

    Ok((name, description, body, frontmatter_json))
}

fn unquote_str(s: &str) -> String {
    let s = s.trim();
    if (s.starts_with('"') && s.ends_with('"')) || (s.starts_with('\'') && s.ends_with('\'')) {
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
