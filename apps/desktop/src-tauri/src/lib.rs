mod budget;
mod db;
mod editor;
mod parallel_phases;
mod permissions;
mod phases;
mod providers;
mod repo;
mod secrets;
mod skills;
mod summarize;
mod turn;
mod worktree;

pub use secrets::read as read_secret;

use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let database = db::open().expect("failed to open kay-am database");
  let provider_state = providers::ProviderState(Mutex::new(providers::detect_claude()));
  let cursor_state = providers::CursorState(Mutex::new(providers::detect_cursor()));
  let codex_state = providers::CodexState(Mutex::new(providers::detect_codex()));
  let turn_registry = turn::TurnRegistry::new();

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .manage(database)
    .manage(provider_state)
    .manage(cursor_state)
    .manage(codex_state)
    .manage(turn_registry)
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
      editor::open_in_editor,
      editor::open_url,
      db::db_exec,
      db::db_execute,
      db::db_select,
      worktree::worktree_create,
      worktree::worktree_remove,
      worktree::worktree_list,
      worktree::worktree_exists,
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
      phases::phase_template_list,
      phases::phase_template_get,
      phases::phase_template_upsert,
      phases::phase_template_delete,
      phases::phase_run_list_for_session,
      phases::phase_run_insert,
      phases::phase_run_update_status,
      parallel_phases::parallel_phase_group_create,
      parallel_phases::parallel_phase_group_list,
      parallel_phases::parallel_phase_group_get,
      parallel_phases::parallel_phase_group_delete,
      parallel_phases::parallel_phase_group_update_completed_at,
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
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
