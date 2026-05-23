mod budget;
mod config_export;
mod db;
mod editor;
mod github;
mod parallel_groups;
mod path_env;
mod permissions;
mod planner;
mod workflows;
mod providers;
mod repo;
mod scripts;
mod secrets;
mod settings_overrides;
mod skills;
mod summarize;
mod turn;
mod worktree;

pub use secrets::read as read_secret;

use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let database = db::open().expect("failed to open Goodboy database");
  let provider_state = providers::ProviderState(Mutex::new(providers::detect_claude()));
  let cursor_state = providers::CursorState(Mutex::new(providers::detect_cursor()));
  let codex_state = providers::CodexState(Mutex::new(providers::detect_codex()));
  let turn_registry = turn::TurnRegistry::new();
  let script_registry = scripts::ScriptRegistry::new();

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .manage(database)
    .manage(provider_state)
    .manage(cursor_state)
    .manage(codex_state)
    .manage(turn_registry)
    .manage(script_registry)
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      secrets::secret_set,
      secrets::secret_delete,
      secrets::secret_has,
      secrets::secret_get,
      editor::detect_editors,
      editor::open_in_editor,
      editor::open_file_in_workspace,
      editor::open_url,
      db::db_exec,
      db::db_execute,
      db::db_select,
      db::db_wipe,
      worktree::worktree_create,
      worktree::worktree_remove,
      worktree::worktree_list,
      worktree::worktree_exists,
      worktree::worktree_diff,
      worktree::worktree_changed_files,
      worktree::worktree_commits,
      worktree::worktree_diff_commit,
      worktree::worktree_diff_working,
      worktree::worktree_status,
      worktree::worktree_list_local_branches,
      worktree::worktree_change_branch,
      providers::get_provider_status,
      providers::refresh_provider_status,
      providers::get_cursor_status,
      providers::refresh_cursor_status,
      providers::get_codex_status,
      providers::refresh_codex_status,
      providers::check_provider_auth,
      providers::provider_action,
      turn::turn_spawn,
      turn::turn_cancel,
      summarize::summarize_session,
      planner::planner_run,
      repo::validate_git_repo,
      budget::budget_rule_upsert,
      budget::budget_rule_list,
      budget::budget_rule_delete,
      budget::session_budget_set,
      budget::session_budget_get,
      budget::budget_alerts_list,
      budget::budget_alert_dismiss,
      budget::budget_emit_alerts,
      budget::check_provider_budget,
      budget::check_session_budget,
      skills::skill_list,
      skills::skill_get,
      skills::skill_upsert,
      skills::skill_delete,
      skills::skill_rescan,
      skills::skill_run_script,
      scripts::workspace_script_run,
      scripts::workspace_script_cancel,
      workflows::workflow_list,
      workflows::workflow_get,
      workflows::workflow_upsert,
      workflows::workflow_delete,
      workflows::agent_list_for_session,
      workflows::agent_insert,
      workflows::agent_update_status,
      workflows::agent_set_provider_session_id,
      workflows::agent_set_kind,
      workflows::agent_set_verbosity,
      workflows::agent_mark_viewed,
      workflows::workspaces_with_unread,
      parallel_groups::parallel_group_create,
      parallel_groups::parallel_group_list,
      parallel_groups::parallel_group_get,
      parallel_groups::parallel_group_delete,
      parallel_groups::parallel_group_update_completed_at,
      parallel_groups::parallel_agent_spawn,
      permissions::permission_rule_list,
      permissions::permission_rule_get,
      permissions::permission_rule_upsert,
      permissions::permission_rule_delete,
      permissions::permission_audit_insert,
      permissions::permission_audit_list,
      permissions::permission_audit_clear,
      permissions::permission_audit_retry_enqueue,
      permissions::permission_audit_retry_drain,
      permissions::permission_audit_retry_update,
      permissions::permission_audit_retry_delete,
      settings_overrides::get_workspace_overrides,
      settings_overrides::set_workspace_overrides,
      settings_overrides::get_session_overrides,
      settings_overrides::set_session_overrides,
      config_export::export_config,
      config_export::import_config,
      config_export::export_config_to_file,
      config_export::import_config_from_file,
      github::gh_status,
      github::gh_set_token,
      github::gh_clear_token,
      github::gh_run,
      github::gh_pr_diff,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
