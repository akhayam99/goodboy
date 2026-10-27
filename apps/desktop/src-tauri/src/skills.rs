use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::db::{Db, DbError};
use crate::util::scoped_path::resolve_within;

fn goodboy_skills_dir(root: &Path) -> PathBuf {
    root.join(".goodboy").join("skills")
}

fn kay_skills_dir(root: &Path) -> PathBuf {
    root.join(".kay").join("skills")
}

fn script_skills_dirs(root: &Path) -> [PathBuf; 2] {
    [goodboy_skills_dir(root), kay_skills_dir(root)]
}

fn markdown_files_in(directory: &Path) -> Result<Vec<PathBuf>, SkillError> {
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let entries = std::fs::read_dir(directory).map_err(|e| SkillError::Io(e.to_string()))?;
    let mut files = Vec::new();
    for entry in entries {
        let path = entry.map_err(|e| SkillError::Io(e.to_string()))?.path();
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            files.push(path);
        }
    }
    files.sort();
    Ok(files)
}

fn claude_skill_files_in(directory: &Path) -> Result<Vec<PathBuf>, SkillError> {
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let entries = std::fs::read_dir(directory).map_err(|e| SkillError::Io(e.to_string()))?;
    let mut files = Vec::new();
    for entry in entries {
        let dir = entry.map_err(|e| SkillError::Io(e.to_string()))?.path();
        if !dir.is_dir() {
            continue;
        }
        let candidate = dir.join("SKILL.md");
        if candidate.exists() {
            files.push(candidate);
        }
    }
    files.sort();
    Ok(files)
}

fn skill_files_of(roots: &[PathBuf]) -> Result<Vec<PathBuf>, SkillError> {
    let mut files = Vec::new();
    for root in roots {
        files.extend(markdown_files_in(&goodboy_skills_dir(root))?);
        files.extend(markdown_files_in(&kay_skills_dir(root))?);
        files.extend(claude_skill_files_in(&root.join(".claude").join("skills"))?);
    }
    Ok(files)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillRow {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub file_path: String,
    pub body: String,
    pub frontmatter_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillUpsertInput {
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub frontmatter_json: String,
    pub body: String,
    pub markdown: String,
    pub file_path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SkillRunScriptResult {
    pub stdout: String,
}

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

fn guard_path(path: &Path, allowed_prefix: &Path) -> Result<PathBuf, SkillError> {
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
    #[error("Scripts run only from {root}/.goodboy/skills; skills discovered under .claude/skills are prompt-only")]
    PromptOnlySkill { root: String },
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
            SkillError::PromptOnlySkill { .. } => "prompt_only_skill",
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
pub async fn skill_upsert(app: AppHandle, input: SkillUpsertInput) -> Result<SkillRow, SkillError> {
    tauri::async_runtime::spawn_blocking(move || skill_upsert_blocking(&app.state::<Db>(), input))
        .await
        .map_err(|e| SkillError::Io(e.to_string()))?
}

fn skill_upsert_blocking(state: &Db, input: SkillUpsertInput) -> Result<SkillRow, SkillError> {
    let roots = {
        let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;
        workspace_roots(&conn, &input.workspace_id)?
    };

    let skills_dirs = roots
        .iter()
        .flat_map(|root| script_skills_dirs(root))
        .collect::<Vec<_>>();
    let default_skills_dir = skills_dirs
        .first()
        .ok_or_else(|| SkillError::WorkspaceNotFound(input.workspace_id.clone()))?;

    let raw_path = match &input.file_path {
        Some(fp) => PathBuf::from(fp),
        None => default_skills_dir.join(format!("{}.md", input.name)),
    };

    let skills_dir = skills_dirs
        .iter()
        .find(|directory| raw_path.starts_with(directory))
        .ok_or_else(|| SkillError::PathTraversal(raw_path.to_string_lossy().to_string()))?;
    std::fs::create_dir_all(skills_dir).map_err(|e| SkillError::Io(e.to_string()))?;
    let canonical = guard_path(&raw_path, skills_dir)?;

    std::fs::write(&canonical, &input.markdown).map_err(|e| SkillError::Io(e.to_string()))?;

    let file_path_str = canonical.to_string_lossy().to_string();
    let now_ms = crate::util::now_ms();
    let now = crate::util::ms_to_iso(now_ms);

    let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;

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
pub async fn skill_delete(app: AppHandle, skill_id: String) -> Result<(), SkillError> {
    tauri::async_runtime::spawn_blocking(move || {
        skill_delete_blocking(&app.state::<Db>(), skill_id)
    })
    .await
    .map_err(|e| SkillError::Io(e.to_string()))?
}

fn skill_delete_blocking(state: &Db, skill_id: String) -> Result<(), SkillError> {
    let (file_path, roots) = {
        let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;
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
        match row {
            Some((file_path, workspace_id)) => {
                let roots = workspace_roots(&conn, &workspace_id)?;
                (file_path, roots)
            }
            None => return Err(SkillError::NotFound(skill_id)),
        }
    };

    let path = PathBuf::from(&file_path);
    let allowed_dirs = roots.iter().flat_map(|root| {
        [
            goodboy_skills_dir(root),
            kay_skills_dir(root),
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

    let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;
    conn.execute(
        "DELETE FROM skills WHERE id = ?1",
        rusqlite::params![skill_id],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn skill_rescan(
    app: AppHandle,
    workspace_id: String,
) -> Result<Vec<SkillRow>, SkillError> {
    tauri::async_runtime::spawn_blocking(move || {
        skill_rescan_blocking(&app.state::<Db>(), workspace_id)
    })
    .await
    .map_err(|e| SkillError::Io(e.to_string()))?
}

fn skill_rescan_blocking(state: &Db, workspace_id: String) -> Result<Vec<SkillRow>, SkillError> {
    let roots = {
        let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;
        workspace_roots(&conn, &workspace_id)?
    };

    let md_files = skill_files_of(&roots)?;

    let now_ms = crate::util::now_ms();

    let existing: Vec<(String, String)> = {
        let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;
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
    let mut seen_names = std::collections::HashSet::new();
    let mut parsed_entries: Vec<(String, String, String, String, String, String)> = Vec::new();

    for file_path in &md_files {
        let canonical = match file_path.canonicalize() {
            Ok(c) => c,
            Err(e) => return Err(SkillError::Io(e.to_string())),
        };
        let fp_str = canonical.to_string_lossy().to_string();
        scanned_paths.insert(fp_str.clone());

        let content =
            std::fs::read_to_string(&canonical).map_err(|e| SkillError::Io(e.to_string()))?;

        let (name, description, body, frontmatter_json) = parse_skill_markdown_rust(&content)?;
        if !seen_names.insert(name.clone()) {
            continue;
        }

        let id = existing_by_path
            .get(&fp_str)
            .cloned()
            .unwrap_or_else(crate::util::uuid_v4);

        parsed_entries.push((id, fp_str, name, description, body, frontmatter_json));
    }

    let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;

    for (id, fp_str, name, description, body, frontmatter_json) in &parsed_entries {
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

    for (id, fp) in &existing {
        if !scanned_paths.contains(fp) {
            conn.execute("DELETE FROM skills WHERE id = ?1", rusqlite::params![id])?;
        }
    }

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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillRunScriptInput {
    pub script_path: String,
    pub args: Vec<String>,
    pub working_dir: String,
    pub skill_id: String,
}

fn skill_workspace_roots(
    conn: &rusqlite::Connection,
    skill_id: &str,
) -> Result<Vec<PathBuf>, SkillError> {
    let workspace_id: String = conn
        .query_row(
            "SELECT workspace_id FROM skills WHERE id = ?1",
            rusqlite::params![skill_id],
            |row| row.get(0),
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => SkillError::NotFound(skill_id.to_string()),
            other => SkillError::Db(other),
        })?;
    workspace_roots(conn, &workspace_id)
}

#[tauri::command]
pub async fn skill_run_script(
    state: State<'_, Db>,
    input: SkillRunScriptInput,
) -> Result<SkillRunScriptResult, SkillError> {
    let roots = {
        let conn = state.0.lock().map_err(|_| SkillError::Poisoned)?;
        skill_workspace_roots(&conn, &input.skill_id)?
    };
    tauri::async_runtime::spawn_blocking(move || skill_run_script_blocking(&roots, input))
        .await
        .map_err(|e| SkillError::Io(e.to_string()))?
}

fn skill_run_script_blocking(
    roots: &[PathBuf],
    input: SkillRunScriptInput,
) -> Result<SkillRunScriptResult, SkillError> {
    let script_path = PathBuf::from(&input.script_path);
    if let Some(root) = roots
        .iter()
        .find(|root| script_path.starts_with(root.join(".claude").join("skills")))
    {
        return Err(SkillError::PromptOnlySkill {
            root: root.to_string_lossy().to_string(),
        });
    }

    let canonical = roots
        .iter()
        .flat_map(|root| script_skills_dirs(root))
        .find_map(|prefix| resolve_within(&prefix, &script_path).ok())
        .ok_or_else(|| SkillError::PathTraversal(input.script_path.clone()))?;

    let output = skill_script_command(&canonical)
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

fn skill_script_command(script: &Path) -> std::process::Command {
    let mut command = crate::path_env::command_with_login_env("bash");
    command.arg(script);
    command
}

fn parse_skill_markdown_rust(raw: &str) -> Result<(String, String, String, String), SkillError> {
    let after_first = raw
        .strip_prefix("---")
        .and_then(|s| s.strip_prefix('\n').or_else(|| s.strip_prefix("\r\n")));

    let after_first = match after_first {
        Some(s) => s,
        None => return Err(SkillError::Io("missing frontmatter delimiters".to_string())),
    };

    let close_marker = "\n---";
    let close_pos = after_first
        .find(close_marker)
        .ok_or_else(|| SkillError::Io("missing closing frontmatter delimiter".to_string()))?;

    let frontmatter_block = &after_first[..close_pos];
    let after_close = &after_first[close_pos + close_marker.len()..];
    let body = after_close.trim_start_matches('\n').to_string();

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
    trimmed
        .split(',')
        .map(|s| unquote_str(s.trim()))
        .filter(|s| !s.is_empty())
        .collect()
}

#[cfg(test)]
mod wire_shape;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skill_script_command_replays_the_login_env() {
        let command = skill_script_command(Path::new("/repo/.kay/skills/run.sh"));
        let keys: Vec<String> = command
            .get_envs()
            .map(|(key, _)| key.to_string_lossy().into_owned())
            .collect();
        assert!(keys.iter().any(|key| key == "PATH"));
        for (key, _) in crate::path_env::resolved_env() {
            assert!(keys.contains(key), "missing login env key {key}");
        }
        assert_eq!(command.get_program(), "bash");
    }

    #[test]
    fn claude_skill_scripts_are_refused_with_the_rule() {
        let result = skill_run_script_blocking(
            &[PathBuf::from("/repo")],
            script_input("/repo/.claude/skills/deploy/run.sh"),
        );
        let Err(error) = result else {
            panic!("a .claude/skills script must be refused");
        };
        assert_eq!(
            error.to_string(),
            "Scripts run only from /repo/.goodboy/skills; skills discovered under .claude/skills are prompt-only"
        );
    }

    fn script_input(script_path: &str) -> SkillRunScriptInput {
        SkillRunScriptInput {
            script_path: script_path.to_string(),
            args: Vec::new(),
            working_dir: "/".to_string(),
            skill_id: "skill".to_string(),
        }
    }

    fn skills_root(name: &str) -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("goodboy-skills-{name}-{}", rand::random::<u64>()));
        std::fs::create_dir_all(root.join(".kay").join("skills")).unwrap();
        std::fs::canonicalize(root).unwrap()
    }

    #[test]
    fn a_script_inside_the_skills_root_runs() {
        let root = skills_root("inside");
        let script = root.join(".kay").join("skills").join("hello.sh");
        std::fs::write(&script, "echo harborline").unwrap();
        let result = skill_run_script_blocking(
            std::slice::from_ref(&root),
            script_input(script.to_str().unwrap()),
        )
        .unwrap();
        assert_eq!(result.stdout.trim(), "harborline");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_script_outside_the_skills_root_is_refused() {
        let root = skills_root("outside");
        let other = skills_root("other");
        let sibling = root.join("run.sh");
        let foreign = other.join(".kay").join("skills").join("run.sh");
        std::fs::write(&sibling, "echo no").unwrap();
        std::fs::write(&foreign, "echo no").unwrap();
        for path in [
            sibling.to_str().unwrap(),
            foreign.to_str().unwrap(),
            "/bin/sh",
        ] {
            let result = skill_run_script_blocking(std::slice::from_ref(&root), script_input(path));
            assert!(matches!(result, Err(SkillError::PathTraversal(_))));
        }
        std::fs::remove_dir_all(root).unwrap();
        std::fs::remove_dir_all(other).unwrap();
    }

    #[test]
    fn a_script_in_the_goodboy_folder_runs_and_so_does_one_in_the_old_kay_folder() {
        let root = skills_root("both");
        let goodboy = root.join(".goodboy").join("skills");
        std::fs::create_dir_all(&goodboy).unwrap();
        let new_script = goodboy.join("new.sh");
        let old_script = root.join(".kay").join("skills").join("old.sh");
        std::fs::write(&new_script, "echo northwind").unwrap();
        std::fs::write(&old_script, "echo harborline").unwrap();
        for (script, expected) in [(&new_script, "northwind"), (&old_script, "harborline")] {
            let result = skill_run_script_blocking(
                std::slice::from_ref(&root),
                script_input(script.to_str().unwrap()),
            )
            .unwrap();
            assert_eq!(result.stdout.trim(), expected);
        }
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn the_scan_reads_goodboy_skills_first_then_kay_then_claude() {
        let root = skills_root("scan");
        let goodboy = root.join(".goodboy").join("skills");
        let claude = root.join(".claude").join("skills").join("deploy");
        std::fs::create_dir_all(&goodboy).unwrap();
        std::fs::create_dir_all(&claude).unwrap();
        std::fs::write(goodboy.join("release.md"), "---\nname: release\n---\n").unwrap();
        std::fs::write(
            root.join(".kay").join("skills").join("release.md"),
            "---\nname: release\n---\n",
        )
        .unwrap();
        std::fs::write(claude.join("SKILL.md"), "---\nname: deploy\n---\n").unwrap();
        let files = skill_files_of(std::slice::from_ref(&root)).unwrap();
        let places: Vec<String> = files
            .iter()
            .map(|file| {
                file.strip_prefix(&root)
                    .unwrap()
                    .to_string_lossy()
                    .replace('\\', "/")
            })
            .collect();
        assert_eq!(
            places,
            vec![
                ".goodboy/skills/release.md",
                ".kay/skills/release.md",
                ".claude/skills/deploy/SKILL.md"
            ]
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_workspace_with_only_the_old_kay_folder_still_lists_its_skills() {
        let root = skills_root("old-form");
        std::fs::write(
            root.join(".kay").join("skills").join("release.md"),
            "---\nname: release\n---\n",
        )
        .unwrap();
        let files = skill_files_of(std::slice::from_ref(&root)).unwrap();
        assert_eq!(files.len(), 1);
        assert!(files[0].ends_with(".kay/skills/release.md"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_script_symlinked_out_of_the_skills_root_is_refused() {
        let root = skills_root("link");
        let other = skills_root("link-target");
        let target = other.join("run.sh");
        std::fs::write(&target, "echo no").unwrap();
        let link = root.join(".kay").join("skills").join("run.sh");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        let result = skill_run_script_blocking(
            std::slice::from_ref(&root),
            script_input(link.to_str().unwrap()),
        );
        assert!(matches!(result, Err(SkillError::PathTraversal(_))));
        std::fs::remove_dir_all(root).unwrap();
        std::fs::remove_dir_all(other).unwrap();
    }

    #[test]
    fn the_skills_root_comes_from_the_registered_skill() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE skills (id TEXT, workspace_id TEXT);
             CREATE TABLE projects (id TEXT, workspace_id TEXT, root_path TEXT, created_at INTEGER);
             INSERT INTO skills VALUES ('skill-1', 'ws-1');
             INSERT INTO projects VALUES ('p1', 'ws-1', '/work/harborline', 1);
             INSERT INTO projects VALUES ('p2', 'ws-2', '/work/northwind', 1);",
        )
        .unwrap();
        assert_eq!(
            skill_workspace_roots(&conn, "skill-1").unwrap(),
            vec![PathBuf::from("/work/harborline")]
        );
        assert!(matches!(
            skill_workspace_roots(&conn, "unknown"),
            Err(SkillError::NotFound(_))
        ));
    }
}
