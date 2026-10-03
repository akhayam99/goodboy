use crate::config_export::bundle::{
    editor_binary_to_import, is_supported_schema_version, json_value_to_text, ConfigBundle,
    SCHEMA_VERSION,
};
use crate::config_export::convert::{
    iso_to_ms, normalized_root_path, workspace_projects, workspace_slug,
};
use crate::config_export::error::ConfigExportError;
use crate::config_export::validate::{validate_bundle, ValidationError};
use rusqlite::OptionalExtension;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportStats {
    pub workspaces: usize,
    pub skills: usize,
    pub phase_templates: usize,
    pub permission_rules: usize,
    pub budget_rules: usize,
    pub scripts: usize,
    pub tool_bindings: usize,
    pub unresolved_projects: usize,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub ok: bool,
    pub errors: Vec<ValidationError>,
    pub stats: ImportStats,
}

pub(super) fn apply_bundle(
    conn: &rusqlite::Connection,
    mut bundle: ConfigBundle,
    workspace_targets: &HashMap<String, String>,
    resolved_project_paths: &HashMap<String, String>,
) -> Result<ImportResult, ConfigExportError> {
    if !is_supported_schema_version(bundle.schema_version) {
        return Err(ConfigExportError::SchemaMismatch {
            got: bundle.schema_version,
            expected: SCHEMA_VERSION,
        });
    }

    for workspace in &mut bundle.workspaces {
        if let Some(target) = workspace_targets.get(&workspace.id) {
            workspace.id = target.clone();
        }
    }

    let errors = validate_bundle(&bundle);
    if !errors.is_empty() {
        return Ok(ImportResult {
            ok: false,
            errors,
            stats: ImportStats::default(),
        });
    }

    conn.execute_batch("BEGIN")?;

    let result = (|| -> Result<ImportStats, rusqlite::Error> {
        let now_ms = crate::util::now_ms();
        let mut unresolved_projects = 0usize;
        let mut project_id_remap: HashMap<String, String> = HashMap::new();

        for w in &bundle.workspaces {
            let created_ms = iso_to_ms(&w.created_at).unwrap_or(now_ms);
            let updated_ms = iso_to_ms(&w.updated_at).unwrap_or(now_ms);
            conn.execute(
                "INSERT INTO workspaces
                   (id, name, slug, created_at, updated_at,
                    default_provider_id, default_branch_prefix, default_verbosity,
                    provider_bindings, task_models, role_models, parallel_agents,
                    provider_pool, attribution_footer, reply_voice, reply_style_note,
                    reply_template_fixed, reply_template_no_change, resolve_on_github,
                    resolve_commit_style, default_branch_template)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)
                 ON CONFLICT(id) DO UPDATE SET
                   name                      = excluded.name,
                   default_provider_id       = excluded.default_provider_id,
                   default_branch_prefix     = excluded.default_branch_prefix,
                   default_verbosity         = excluded.default_verbosity,
                   provider_bindings         = excluded.provider_bindings,
                   task_models               = excluded.task_models,
                   role_models               = excluded.role_models,
                   parallel_agents           = excluded.parallel_agents,
                   provider_pool             = excluded.provider_pool,
                   attribution_footer        = excluded.attribution_footer,
                   reply_voice               = excluded.reply_voice,
                   reply_style_note          = excluded.reply_style_note,
                   reply_template_fixed      = excluded.reply_template_fixed,
                   reply_template_no_change  = excluded.reply_template_no_change,
                   resolve_on_github         = excluded.resolve_on_github,
                   resolve_commit_style      = excluded.resolve_commit_style,
                   default_branch_template   = excluded.default_branch_template,
                   updated_at                = excluded.updated_at",
                rusqlite::params![
                    w.id,
                    w.name,
                    workspace_slug(&w.name, &w.id),
                    created_ms,
                    updated_ms,
                    w.overrides.default_provider_id,
                    w.overrides.default_branch_prefix,
                    w.overrides.default_verbosity,
                    json_value_to_text(&w.overrides.provider_bindings),
                    json_value_to_text(&w.overrides.task_models),
                    json_value_to_text(&w.overrides.role_models),
                    w.overrides.parallel_agents.map(|v| if v { 1 } else { 0 }),
                    json_value_to_text(&w.overrides.provider_pool),
                    w.overrides.attribution_footer.map(|v| if v { 1 } else { 0 }),
                    w.overrides.reply_voice,
                    w.overrides.reply_style_note,
                    w.overrides.reply_template_fixed,
                    w.overrides.reply_template_no_change,
                    w.overrides.resolve_on_github.map(|v| if v { 1 } else { 0 }),
                    w.overrides.resolve_commit_style,
                    w.overrides.default_branch_template,
                ],
            )?;

            if let Some(profile) = &w.profile {
                conn.execute(
                    "INSERT INTO workspace_profiles
                       (workspace_id, roles_json, about_work, working_rules, explain_more_json, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                     ON CONFLICT(workspace_id) DO UPDATE SET
                       roles_json = excluded.roles_json,
                       about_work = excluded.about_work,
                       working_rules = excluded.working_rules,
                       explain_more_json = excluded.explain_more_json,
                       updated_at = excluded.updated_at",
                    rusqlite::params![
                        w.id,
                        profile.roles_json,
                        profile.about_work,
                        profile.working_rules,
                        profile.explain_more_json,
                        now_ms,
                    ],
                )?;
            }

            for p in workspace_projects(w) {
                let updated_at_ms = iso_to_ms(&p.updated_at).unwrap_or(updated_ms);
                let root_path = match &p.root_path {
                    Some(path) => Some(path.clone()),
                    None => resolved_project_paths.get(&p.id).cloned(),
                };
                let Some(root_path) = root_path else {
                    unresolved_projects += 1;
                    continue;
                };
                let target_root_path = normalized_root_path(&root_path);
                let existing_id: Option<String> = {
                    let mut stmt = conn.prepare("SELECT id, root_path FROM projects")?;
                    let mut rows = stmt.query([])?;
                    let mut found = None;
                    while let Some(row) = rows.next()? {
                        let id: String = row.get(0)?;
                        let existing_root_path: String = row.get(1)?;
                        if normalized_root_path(&existing_root_path) == target_root_path {
                            found = Some(id);
                            break;
                        }
                    }
                    found
                };
                match existing_id {
                    Some(existing) if existing != p.id => {
                        conn.execute(
                            "UPDATE projects SET workspace_id = ?1, name = ?2, kind = ?3, updated_at = ?4,
                               description = ?5, starred_at = ?6, base_branch = ?7,
                               root_commit = ?8, remote_url = ?9
                             WHERE id = ?10",
                            rusqlite::params![
                                w.id, p.name, p.kind, updated_at_ms,
                                p.description, p.starred_at.as_deref().and_then(iso_to_ms),
                                p.base_branch, p.root_commit, p.remote_url,
                                existing,
                            ],
                        )?;
                        project_id_remap.insert(p.id.clone(), existing);
                    }
                    _ => {
                        conn.execute(
                            "INSERT INTO projects
                               (id, workspace_id, name, root_path, kind, created_at, updated_at,
                                description, starred_at, base_branch, root_commit, remote_url)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                             ON CONFLICT(id) DO UPDATE SET
                               name         = excluded.name,
                               root_path    = excluded.root_path,
                               kind         = excluded.kind,
                               updated_at   = excluded.updated_at,
                               description  = excluded.description,
                               starred_at   = excluded.starred_at,
                               base_branch  = excluded.base_branch,
                               root_commit  = excluded.root_commit,
                               remote_url   = excluded.remote_url",
                            rusqlite::params![
                                p.id,
                                w.id,
                                p.name,
                                root_path,
                                p.kind,
                                iso_to_ms(&p.created_at).unwrap_or(created_ms),
                                updated_at_ms,
                                p.description,
                                p.starred_at.as_deref().and_then(iso_to_ms),
                                p.base_branch,
                                p.root_commit,
                                p.remote_url,
                            ],
                        )?;
                    }
                }
            }
        }

        for s in &bundle.skills {
            conn.execute(
                "INSERT INTO skills
                   (id, workspace_id, name, description, file_path, body, frontmatter_json, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                 ON CONFLICT(id) DO UPDATE SET
                   name             = excluded.name,
                   description      = excluded.description,
                   file_path        = excluded.file_path,
                   body             = excluded.body,
                   frontmatter_json = excluded.frontmatter_json,
                   updated_at       = excluded.updated_at",
                rusqlite::params![
                    s.id, s.workspace_id, s.name, s.description,
                    s.file_path, s.body, s.frontmatter_json,
                    iso_to_ms(&s.created_at).unwrap_or(now_ms),
                    iso_to_ms(&s.updated_at).unwrap_or(now_ms),
                ],
            )?;
        }

        for t in &bundle.phase_templates {
            conn.execute(
                "INSERT INTO workflows
                   (id, workspace_id, name, description, created_at, updated_at,
                    is_preset, origin, goal, process_text)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                 ON CONFLICT(id) DO UPDATE SET
                   name        = excluded.name,
                   description = excluded.description,
                   updated_at  = excluded.updated_at,
                   is_preset   = excluded.is_preset,
                   origin      = excluded.origin,
                   goal        = excluded.goal,
                   process_text = excluded.process_text",
                rusqlite::params![
                    t.id,
                    t.workspace_id,
                    t.name,
                    t.description,
                    iso_to_ms(&t.created_at).unwrap_or(now_ms),
                    iso_to_ms(&t.updated_at).unwrap_or(now_ms),
                    if t.is_preset { 1 } else { 0 },
                    t.origin,
                    t.goal,
                    t.process_text,
                ],
            )?;
            for d in &t.steps {
                conn.execute(
                    "INSERT INTO steps
                       (id, workflow_id, ordinal, name, prompt_prefix, provider_override, model_override,
                        role, effort, expected_output, orchestrator_reason)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                     ON CONFLICT(id) DO UPDATE SET
                       ordinal          = excluded.ordinal,
                       name             = excluded.name,
                       prompt_prefix    = excluded.prompt_prefix,
                       provider_override = excluded.provider_override,
                       model_override   = excluded.model_override,
                       role             = excluded.role,
                       effort           = excluded.effort,
                       expected_output  = excluded.expected_output,
                       orchestrator_reason = excluded.orchestrator_reason",
                    rusqlite::params![
                        d.id, d.workflow_id, d.ordinal, d.name,
                        d.prompt_prefix, d.provider_override, d.model_override,
                        d.role, d.effort, d.expected_output, d.orchestrator_reason,
                    ],
                )?;
            }
        }

        for r in &bundle.permission_rules {
            conn.execute(
                "INSERT INTO permission_rules
                   (id, scope, workspace_id, session_id, pattern_tool, pattern_args_matcher,
                    decision, priority, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                 ON CONFLICT(id) DO UPDATE SET
                   scope                = excluded.scope,
                   workspace_id         = excluded.workspace_id,
                   pattern_tool         = excluded.pattern_tool,
                   pattern_args_matcher = excluded.pattern_args_matcher,
                   decision             = excluded.decision,
                   priority             = excluded.priority,
                   updated_at           = excluded.updated_at",
                rusqlite::params![
                    r.id,
                    r.scope,
                    r.workspace_id,
                    r.session_id,
                    r.pattern_tool,
                    r.pattern_args_matcher,
                    r.decision,
                    r.priority,
                    iso_to_ms(&r.created_at).unwrap_or(now_ms),
                    iso_to_ms(&r.updated_at).unwrap_or(now_ms),
                ],
            )?;
        }

        for b in &bundle.budget_rules {
            conn.execute(
                "INSERT INTO budget_rules (id, provider, period, cap_usd, alert_threshold_pct, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET
                   provider            = excluded.provider,
                   period              = excluded.period,
                   cap_usd             = excluded.cap_usd,
                   alert_threshold_pct = excluded.alert_threshold_pct",
                rusqlite::params![
                    b.id,
                    b.provider,
                    b.period,
                    b.cap_usd,
                    b.alert_threshold_pct,
                    iso_to_ms(&b.created_at).unwrap_or(now_ms),
                ],
            )?;
        }

        for s in &bundle.scripts {
            let project_id = project_id_remap
                .get(&s.project_id)
                .cloned()
                .unwrap_or_else(|| s.project_id.clone());
            conn.execute(
                "INSERT INTO project_scripts (id, project_id, name, body, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(id) DO UPDATE SET
                   project_id = excluded.project_id,
                   name       = excluded.name,
                   body       = excluded.body,
                   sort_order = excluded.sort_order,
                   updated_at = excluded.updated_at",
                rusqlite::params![
                    s.id,
                    project_id,
                    s.name,
                    s.body,
                    s.sort_order,
                    iso_to_ms(&s.created_at).unwrap_or(now_ms),
                    iso_to_ms(&s.updated_at).unwrap_or(now_ms),
                ],
            )?;
        }

        let mut credential_counter: u64 = 0;
        for t in &bundle.tool_bindings {
            let workspace_id = workspace_targets
                .get(&t.workspace_id)
                .cloned()
                .unwrap_or_else(|| t.workspace_id.clone());
            let project_id = t.project_id.as_ref().map(|id| {
                project_id_remap
                    .get(id)
                    .cloned()
                    .unwrap_or_else(|| id.clone())
            });

            let existing_credential_id: Option<String> = conn
                .query_row(
                    "SELECT credential_id FROM integration_bindings
                     WHERE workspace_id = ?1 AND COALESCE(project_id, '') = COALESCE(?2, '') AND provider = ?3",
                    rusqlite::params![workspace_id, project_id, t.provider],
                    |row| row.get(0),
                )
                .optional()?;
            let credential_id = match existing_credential_id {
                Some(id) => id,
                None => {
                    credential_counter += 1;
                    let id = format!("integration-credential-import-{now_ms}-{credential_counter}");
                    conn.execute(
                        "INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
                         VALUES (?1, ?2, ?3, '', ?4, ?4)",
                        rusqlite::params![
                            id,
                            t.provider,
                            format!("Imported {}", t.provider),
                            now_ms,
                        ],
                    )?;
                    id
                }
            };
            conn.execute(
                "INSERT INTO integration_bindings (id, workspace_id, project_id, provider, credential_id, config, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
                 ON CONFLICT (workspace_id, COALESCE(project_id, ''), provider) DO UPDATE SET
                   config     = excluded.config,
                   updated_at = excluded.updated_at",
                rusqlite::params![
                    format!(
                        "integration-binding:{workspace_id}:{}:{}",
                        project_id.clone().unwrap_or_default(),
                        t.provider
                    ),
                    workspace_id,
                    project_id,
                    t.provider,
                    credential_id,
                    t.config_json,
                    now_ms,
                ],
            )?;
        }

        let setting_pairs: &[(&str, Option<&str>)] = &[
            (
                "editor.binary",
                editor_binary_to_import(&bundle.app_preferences),
            ),
            (
                "providers.hiddenModels",
                bundle.app_preferences.hidden_models_json.as_deref(),
            ),
        ];
        for (key, val) in setting_pairs {
            if let Some(v) = val {
                conn.execute(
                    "INSERT INTO settings (key, value, updated_at)
                     VALUES (?1, ?2, ?3)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                    rusqlite::params![key, v, now_ms],
                )?;
            }
        }

        Ok(ImportStats {
            workspaces: bundle.workspaces.len(),
            skills: bundle.skills.len(),
            phase_templates: bundle.phase_templates.len(),
            permission_rules: bundle.permission_rules.len(),
            budget_rules: bundle.budget_rules.len(),
            scripts: bundle.scripts.len(),
            tool_bindings: bundle.tool_bindings.len(),
            unresolved_projects,
        })
    })();

    match result {
        Ok(stats) => {
            conn.execute_batch("COMMIT")?;
            Ok(ImportResult {
                ok: true,
                errors: vec![],
                stats,
            })
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(ConfigExportError::Db(e))
        }
    }
}

#[cfg(test)]
mod tests;
