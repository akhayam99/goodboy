mod db;
mod editor;
mod providers;
mod repo;
mod secrets;
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
      turn::turn_spawn,
      turn::turn_cancel,
      repo::validate_git_repo,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
