mod db;
mod editor;
mod providers;
mod secrets;
mod worktree;

pub use secrets::read as read_secret;

use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let database = db::open().expect("failed to open kay-am database");
  let provider_state = providers::ProviderState(Mutex::new(providers::detect_claude()));

  tauri::Builder::default()
    .manage(database)
    .manage(provider_state)
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
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
