use crate::config_export::apply::{apply_backup_file, ApplyFileRequest, ImportResult};
use crate::config_export::bundle::{is_supported_schema_version, SCHEMA_VERSION};
use crate::config_export::error::ConfigExportError;
use crate::config_export::export::{build_bundle, open_findings_for_groups};
use crate::config_export::file::{read_bundle_file, write_config_file};
use crate::config_export::groups::{ExportCounts, ExportGroups, ExportPreview};
use crate::config_export::preview::{build_import_preview, ImportPreview};
use crate::db::Db;
use std::collections::HashMap;
use std::collections::HashSet;
use tauri::AppHandle;
use tauri::Manager;

#[tauri::command]
pub async fn config_export_preview(
    app: AppHandle,
    groups: ExportGroups,
) -> Result<ExportPreview, ConfigExportError> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = app.state::<Db>();
        let conn = db.0.lock().map_err(|_| ConfigExportError::Poisoned)?;
        let left_out_findings = open_findings_for_groups(&conn, &groups)?;
        let bundle = build_bundle(&conn, &groups, &HashSet::new())?;
        Ok(ExportPreview {
            counts: ExportCounts {
                workspaces: bundle.workspaces.len(),
                projects: bundle.workspaces.iter().map(|w| w.projects.len()).sum(),
                skills: bundle.skills.len(),
                phase_templates: bundle.phase_templates.len(),
                permission_rules: bundle.permission_rules.len(),
                budget_rules: bundle.budget_rules.len(),
                scripts: bundle.scripts.len(),
                tool_bindings: bundle.tool_bindings.len(),
            },
            left_out_findings,
        })
    })
    .await
    .map_err(|e| ConfigExportError::Validation(e.to_string()))?
}

#[tauri::command]
pub async fn config_export_write(
    app: AppHandle,
    path: String,
    groups: ExportGroups,
    #[allow(non_snake_case)] leaveOut: Vec<String>,
) -> Result<(), ConfigExportError> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = app.state::<Db>();
        let conn = db.0.lock().map_err(|_| ConfigExportError::Poisoned)?;
        let leave_out: HashSet<String> = leaveOut.into_iter().collect();
        let bundle = build_bundle(&conn, &groups, &leave_out)?;
        drop(conn);
        let json = serde_json::to_string_pretty(&bundle)?;
        write_config_file(&path, &json)
    })
    .await
    .map_err(|e| ConfigExportError::Validation(e.to_string()))?
}

#[tauri::command]
pub async fn config_import_preview(
    app: AppHandle,
    path: String,
    #[allow(non_snake_case)] projectParent: Option<String>,
) -> Result<ImportPreview, ConfigExportError> {
    tauri::async_runtime::spawn_blocking(move || {
        let file = read_bundle_file(&path)?;
        let bundle = file.bundle;
        if !is_supported_schema_version(bundle.schema_version) {
            return Err(ConfigExportError::SchemaMismatch {
                got: bundle.schema_version,
                expected: SCHEMA_VERSION,
            });
        }
        let db = app.state::<Db>();
        let conn = db.0.lock().map_err(|_| ConfigExportError::Poisoned)?;
        build_import_preview(&conn, &bundle, &file.sha256, projectParent.as_deref())
    })
    .await
    .map_err(|e| ConfigExportError::Validation(e.to_string()))?
}

#[tauri::command]
pub async fn config_import_apply(
    app: AppHandle,
    path: String,
    #[allow(non_snake_case)] workspaceTargets: HashMap<String, String>,
    #[allow(non_snake_case)] resolvedProjectPaths: HashMap<String, String>,
    #[allow(non_snake_case)] expectedSha256: String,
    #[allow(non_snake_case)] acceptWildcardAllow: bool,
) -> Result<ImportResult, ConfigExportError> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = app.state::<Db>();
        let conn = db.0.lock().map_err(|_| ConfigExportError::Poisoned)?;
        apply_backup_file(
            &conn,
            ApplyFileRequest {
                path: &path,
                expected_sha256: &expectedSha256,
                workspace_targets: &workspaceTargets,
                resolved_project_paths: &resolvedProjectPaths,
                accept_wildcard_allow: acceptWildcardAllow,
            },
        )
    })
    .await
    .map_err(|e| ConfigExportError::Validation(e.to_string()))?
}
