use crate::config_export::bundle::{
    json_text_to_value, AppPreferencesBundle, BudgetRuleBundle, ConfigBundle, PermissionRuleBundle,
    PhaseDefinitionBundle, PhaseTemplateBundle, ProfileBundle, ProjectBundle, ScriptBundle,
    SkillBundle, ToolBindingBundle, WorkspaceBundle, WorkspaceOverridesBundle, SCHEMA_VERSION,
};
use crate::config_export::convert::ms_col_to_iso;
use crate::config_export::error::ConfigExportError;
use crate::config_export::groups::{ExportGroups, LeftOutFinding};
use std::collections::HashSet;

pub(super) fn open_findings_for_groups(
    conn: &rusqlite::Connection,
    groups: &ExportGroups,
) -> Result<Vec<LeftOutFinding>, ConfigExportError> {
    let mut allowed_kinds: Vec<&str> = Vec::new();
    if groups.scripts {
        allowed_kinds.push("script");
    }
    if groups.workflows_yours || groups.workflows_orchestrated {
        allowed_kinds.push("workflow-step");
    }
    if groups.profile {
        allowed_kinds.push("profile");
    }
    if groups.workspaces {
        allowed_kinds.push("reply-template");
    }
    if groups.permission_rules {
        allowed_kinds.push("permission-rule");
    }
    if allowed_kinds.is_empty() {
        return Ok(Vec::new());
    }
    let placeholders = allowed_kinds
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "SELECT fingerprint, subject_kind, subject_id, secret_kind, last4
         FROM security_findings
         WHERE dismissed_at IS NULL AND resolved_at IS NULL
           AND subject_kind IN ({placeholders})
         ORDER BY first_seen_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let params = rusqlite::params_from_iter(allowed_kinds.iter());
    let rows = stmt.query_map(params, |row| {
        Ok(LeftOutFinding {
            fingerprint: row.get(0)?,
            subject_kind: row.get(1)?,
            subject_id: row.get(2)?,
            secret_kind: row.get(3)?,
            last4: row.get(4)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub(super) fn build_bundle(
    conn: &rusqlite::Connection,
    groups: &ExportGroups,
    leave_out: &HashSet<String>,
) -> Result<ConfigBundle, ConfigExportError> {
    let excluded_scripts: HashSet<String> = leave_out_subject_ids(conn, "script", leave_out)?;
    let excluded_rules: HashSet<String> =
        leave_out_subject_ids(conn, "permission-rule", leave_out)?;
    let profile_excluded_workspaces: HashSet<String> =
        leave_out_subject_ids(conn, "profile", leave_out)?;

    let workspaces = if groups.workspaces {
        let mut stmt = conn.prepare(
            "SELECT id, name, created_at, updated_at,
                    default_provider_id, default_branch_prefix, default_verbosity,
                    provider_bindings, task_models, role_models, parallel_agents,
                    provider_pool, attribution_footer, reply_voice, reply_style_note,
                    reply_template_fixed, reply_template_no_change, resolve_on_github,
                    resolve_commit_style, default_branch_template
             FROM workspaces
             WHERE deleted_at IS NULL AND disconnected_at IS NULL
             ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(WorkspaceBundle {
                id: row.get(0)?,
                name: row.get(1)?,
                root_path: None,
                projects: Vec::new(),
                created_at: ms_col_to_iso(row.get::<_, i64>(2).unwrap_or(0)),
                updated_at: ms_col_to_iso(row.get::<_, i64>(3).unwrap_or(0)),
                overrides: WorkspaceOverridesBundle {
                    default_provider_id: row.get(4)?,
                    default_branch_prefix: row.get(5)?,
                    default_verbosity: row.get(6)?,
                    provider_bindings: json_text_to_value(row.get(7)?),
                    task_models: json_text_to_value(row.get(8)?),
                    role_models: json_text_to_value(row.get(9)?),
                    parallel_agents: row.get::<_, Option<i64>>(10)?.map(|v| v != 0),
                    provider_pool: json_text_to_value(row.get(11)?),
                    attribution_footer: row.get::<_, Option<i64>>(12)?.map(|v| v != 0),
                    reply_voice: row.get(13)?,
                    reply_style_note: row.get(14)?,
                    reply_template_fixed: row.get(15)?,
                    reply_template_no_change: row.get(16)?,
                    resolve_on_github: row.get::<_, Option<i64>>(17)?.map(|v| v != 0),
                    resolve_commit_style: row.get(18)?,
                    default_branch_template: row.get(19)?,
                },
                profile: None,
            })
        })?;
        let mut workspaces = rows.collect::<Result<Vec<_>, _>>()?;

        if groups.projects {
            let mut project_stmt = conn.prepare(
                "SELECT id, name, root_path, kind, created_at, updated_at,
                        description, starred_at, base_branch, root_commit, remote_url
                 FROM projects
                 WHERE workspace_id = ?1 AND disconnected_at IS NULL
                 ORDER BY created_at ASC, id ASC",
            )?;
            for workspace in &mut workspaces {
                let project_rows =
                    project_stmt.query_map(rusqlite::params![workspace.id], |row| {
                        Ok(ProjectBundle {
                            id: row.get(0)?,
                            name: row.get(1)?,
                            root_path: if groups.folder_paths {
                                row.get(2)?
                            } else {
                                None
                            },
                            kind: row
                                .get::<_, Option<String>>(3)?
                                .unwrap_or_else(|| "repo".to_string()),
                            created_at: ms_col_to_iso(row.get::<_, i64>(4).unwrap_or(0)),
                            updated_at: ms_col_to_iso(row.get::<_, i64>(5).unwrap_or(0)),
                            description: row.get(6)?,
                            starred_at: row.get::<_, Option<i64>>(7)?.map(ms_col_to_iso),
                            base_branch: row.get(8)?,
                            root_commit: row.get(9)?,
                            remote_url: row.get(10)?,
                        })
                    })?;
                workspace.projects = project_rows.collect::<Result<Vec<_>, _>>()?;
            }
        }

        if groups.profile {
            let mut profile_stmt = conn.prepare(
                "SELECT roles_json, about_work, working_rules, explain_more_json
                 FROM workspace_profiles WHERE workspace_id = ?1",
            )?;
            for workspace in &mut workspaces {
                if profile_excluded_workspaces.contains(&workspace.id) {
                    continue;
                }
                let found = profile_stmt
                    .query_row(rusqlite::params![workspace.id], |row| {
                        Ok(ProfileBundle {
                            roles_json: row.get(0)?,
                            about_work: row.get(1)?,
                            working_rules: row.get(2)?,
                            explain_more_json: row.get(3)?,
                        })
                    })
                    .ok();
                workspace.profile = found;
            }
        }
        workspaces
    } else {
        Vec::new()
    };

    let live_workspace_ids: HashSet<String> = workspaces.iter().map(|w| w.id.clone()).collect();

    let live_project_ids: HashSet<String> = {
        let mut stmt =
            conn.prepare("SELECT id, workspace_id FROM projects WHERE disconnected_at IS NULL")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut set = HashSet::new();
        for row in rows {
            let (id, workspace_id) = row?;
            if live_workspace_ids.contains(&workspace_id) {
                set.insert(id);
            }
        }
        set
    };

    let skills = if groups.workspaces {
        let mut stmt = conn.prepare(
            "SELECT id, workspace_id, name, description, file_path, body, frontmatter_json,
                    created_at, updated_at
             FROM skills
             WHERE workspace_id IN (
               SELECT id FROM workspaces WHERE deleted_at IS NULL AND disconnected_at IS NULL
             )
             ORDER BY workspace_id, created_at ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(SkillBundle {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                file_path: row.get(4)?,
                body: row.get(5)?,
                frontmatter_json: row.get(6)?,
                created_at: ms_col_to_iso(row.get(7)?),
                updated_at: ms_col_to_iso(row.get(8)?),
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .filter(|skill| live_workspace_ids.contains(&skill.workspace_id))
            .collect()
    } else {
        Vec::new()
    };

    let phase_templates = if groups.workflows_yours || groups.workflows_orchestrated {
        let mut stmt = conn.prepare(
            "SELECT id, workspace_id, name, description, created_at, updated_at,
                    is_preset, origin, goal, process_text
             FROM workflows
             WHERE deleted_at IS NULL
               AND workspace_id IN (
                 SELECT id FROM workspaces WHERE deleted_at IS NULL AND disconnected_at IS NULL
               )
             ORDER BY workspace_id, created_at ASC",
        )?;
        let template_rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, Option<String>>(9)?,
            ))
        })?;
        let mut templates: Vec<PhaseTemplateBundle> = Vec::new();
        for row in template_rows {
            let (
                id,
                workspace_id,
                name,
                description,
                created_at_ms,
                updated_at_ms,
                is_preset_raw,
                origin,
                goal,
                process_text,
            ) = row?;
            if !live_workspace_ids.contains(&workspace_id) {
                continue;
            }
            let is_orchestrated = origin.as_deref() == Some("orchestrated");
            if is_orchestrated && !groups.workflows_orchestrated {
                continue;
            }
            if !is_orchestrated && !groups.workflows_yours {
                continue;
            }
            let mut def_stmt = conn.prepare(
                "SELECT id, workflow_id, ordinal, name, prompt_prefix, provider_override, model_override,
                        role, effort, expected_output, orchestrator_reason
                 FROM steps
                 WHERE workflow_id = ?1 AND deleted_at IS NULL
                 ORDER BY ordinal ASC",
            )?;
            let defs = def_stmt
                .query_map(rusqlite::params![id], |r| {
                    Ok(PhaseDefinitionBundle {
                        id: r.get(0)?,
                        workflow_id: r.get(1)?,
                        ordinal: r.get(2)?,
                        name: r.get(3)?,
                        prompt_prefix: r.get(4)?,
                        provider_override: r.get(5)?,
                        model_override: r.get(6)?,
                        role: r.get(7)?,
                        effort: r.get(8)?,
                        expected_output: r.get(9)?,
                        orchestrator_reason: r.get(10)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            templates.push(PhaseTemplateBundle {
                id,
                workspace_id,
                name,
                description,
                steps: defs,
                created_at: ms_col_to_iso(created_at_ms),
                updated_at: ms_col_to_iso(updated_at_ms),
                is_preset: is_preset_raw != 0,
                origin,
                goal,
                process_text,
            });
        }
        templates
    } else {
        Vec::new()
    };

    let permission_rules = if groups.permission_rules {
        let mut stmt = conn.prepare(
            "SELECT id, scope, workspace_id, session_id, pattern_tool, pattern_args_matcher,
                    decision, priority, created_at, updated_at
             FROM permission_rules
             WHERE scope IN ('global', 'workspace')
               AND (
                 workspace_id IS NULL
                 OR workspace_id IN (
                   SELECT id FROM workspaces WHERE deleted_at IS NULL AND disconnected_at IS NULL
                 )
               )
             ORDER BY scope, priority DESC, created_at ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(PermissionRuleBundle {
                id: row.get(0)?,
                scope: row.get(1)?,
                workspace_id: row.get(2)?,
                session_id: row.get(3)?,
                pattern_tool: row.get(4)?,
                pattern_args_matcher: row.get(5)?,
                decision: row.get(6)?,
                priority: row.get(7)?,
                created_at: ms_col_to_iso(row.get(8)?),
                updated_at: ms_col_to_iso(row.get(9)?),
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .filter(|rule| match &rule.workspace_id {
                Some(id) => live_workspace_ids.contains(id),
                None => true,
            })
            .filter(|rule| !excluded_rules.contains(&rule.id))
            .collect()
    } else {
        Vec::new()
    };

    let budget_rules = if groups.budget_rules {
        let mut stmt = conn.prepare(
            "SELECT id, provider, period, cap_usd, alert_threshold_pct, created_at
             FROM budget_rules
             ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(BudgetRuleBundle {
                id: row.get(0)?,
                provider: row.get(1)?,
                period: row.get(2)?,
                cap_usd: row.get(3)?,
                alert_threshold_pct: row.get(4)?,
                created_at: ms_col_to_iso(row.get(5)?),
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    } else {
        Vec::new()
    };

    let scripts = if groups.scripts {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, body, sort_order, created_at, updated_at
             FROM project_scripts
             ORDER BY project_id, sort_order ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ScriptBundle {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                body: row.get(3)?,
                sort_order: row.get(4)?,
                created_at: ms_col_to_iso(row.get(5)?),
                updated_at: ms_col_to_iso(row.get(6)?),
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .filter(|script| live_project_ids.contains(&script.project_id))
            .filter(|script| !excluded_scripts.contains(&script.id))
            .collect()
    } else {
        Vec::new()
    };

    let tool_bindings = if groups.integrations {
        let mut stmt = conn.prepare(
            "SELECT workspace_id, project_id, provider, config
             FROM integration_bindings
             WHERE workspace_id IN (
               SELECT id FROM workspaces WHERE deleted_at IS NULL AND disconnected_at IS NULL
             )
             ORDER BY workspace_id, provider",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ToolBindingBundle {
                workspace_id: row.get(0)?,
                project_id: row.get(1)?,
                provider: row.get(2)?,
                config_json: row
                    .get::<_, Option<String>>(3)?
                    .unwrap_or_else(|| "{}".to_string()),
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .filter(|binding| live_workspace_ids.contains(&binding.workspace_id))
            .collect()
    } else {
        Vec::new()
    };

    let app_preferences = if groups.app_preferences {
        fn get_setting(conn: &rusqlite::Connection, key: &str) -> Option<String> {
            conn.query_row(
                "SELECT value FROM settings WHERE key = ?1 LIMIT 1",
                rusqlite::params![key],
                |row| row.get(0),
            )
            .ok()
        }
        AppPreferencesBundle {
            editor_binary: get_setting(conn, "editor.binary"),
            editor_default: None,
            hidden_models_json: get_setting(conn, "providers.hiddenModels"),
        }
    } else {
        AppPreferencesBundle::default()
    };

    Ok(ConfigBundle {
        schema_version: SCHEMA_VERSION,
        exported_at: crate::util::iso_now(),
        workspaces,
        skills,
        phase_templates,
        permission_rules,
        budget_rules,
        scripts,
        tool_bindings,
        app_preferences,
    })
}

fn leave_out_subject_ids(
    conn: &rusqlite::Connection,
    subject_kind: &str,
    leave_out: &HashSet<String>,
) -> Result<HashSet<String>, ConfigExportError> {
    if leave_out.is_empty() {
        return Ok(HashSet::new());
    }
    let mut stmt = conn
        .prepare("SELECT subject_id, fingerprint FROM security_findings WHERE subject_kind = ?1")?;
    let rows = stmt.query_map(rusqlite::params![subject_kind], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    let mut excluded = HashSet::new();
    for row in rows {
        let (subject_id, fingerprint) = row?;
        if leave_out.contains(&fingerprint) {
            excluded.insert(subject_id);
        }
    }
    Ok(excluded)
}

#[cfg(test)]
mod tests;
