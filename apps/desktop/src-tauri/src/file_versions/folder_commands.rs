use super::folder_prune::{
    folder_size, list_folder_sessions, prune_folder, FolderPruneArgs, FolderPruneResult, FolderSize,
};
use super::folder_restore::{
    check_folder_restore, read_folder_version, restore_folder_turn, FolderCheckArgs,
    FolderCheckResult, FolderReadArgs, FolderReadResult, FolderRestoreArgs, FolderRestoreResult,
};
use super::folder_store::Store;
use super::folder_turns::{
    begin_folder_turn, discard_folder_turn, finalize_folder_turn, folder_status, forget_folder,
    list_folder_turns, list_staged_folder_runs, prepare_folder, FolderBeginArgs, FolderBeginResult,
    FolderFinalizeResult, FolderPathArgs, FolderPrepareArgs, FolderRunArgs, FolderSessionArgs,
    FolderStatus, StagedFolderRun, TurnManifest,
};
use super::FileVersionsError;

async fn blocking<T, F>(job: F) -> Result<T, FileVersionsError>
where
    T: Send + 'static,
    F: FnOnce(&Store) -> Result<T, FileVersionsError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || {
        let store = Store::from_home()?;
        job(&store)
    })
    .await
    .map_err(|e| FileVersionsError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn file_versions_folder_prepare(
    args: FolderPrepareArgs,
) -> Result<FolderStatus, FileVersionsError> {
    blocking(move |store| prepare_folder(store, args)).await
}

#[tauri::command]
pub async fn file_versions_folder_status(
    args: FolderPathArgs,
) -> Result<FolderStatus, FileVersionsError> {
    blocking(move |store| folder_status(store, args)).await
}

#[tauri::command]
pub async fn file_versions_folder_begin(
    args: FolderBeginArgs,
) -> Result<FolderBeginResult, FileVersionsError> {
    blocking(move |store| begin_folder_turn(store, args)).await
}

#[tauri::command]
pub async fn file_versions_folder_finalize(
    args: FolderRunArgs,
) -> Result<FolderFinalizeResult, FileVersionsError> {
    blocking(move |store| finalize_folder_turn(store, args)).await
}

#[tauri::command]
pub async fn file_versions_folder_discard(args: FolderRunArgs) -> Result<bool, FileVersionsError> {
    blocking(move |store| discard_folder_turn(store, args)).await
}

#[tauri::command]
pub async fn file_versions_folder_list_staged() -> Result<Vec<StagedFolderRun>, FileVersionsError> {
    blocking(list_staged_folder_runs).await
}

#[tauri::command]
pub async fn file_versions_folder_list_turns(
    args: FolderSessionArgs,
) -> Result<Vec<TurnManifest>, FileVersionsError> {
    blocking(move |store| list_folder_turns(store, args)).await
}

#[tauri::command]
pub async fn file_versions_folder_check(
    args: FolderCheckArgs,
) -> Result<FolderCheckResult, FileVersionsError> {
    blocking(move |store| check_folder_restore(store, args)).await
}

#[tauri::command]
pub async fn file_versions_folder_restore(
    args: FolderRestoreArgs,
) -> Result<FolderRestoreResult, FileVersionsError> {
    blocking(move |store| restore_folder_turn(store, args)).await
}

#[tauri::command]
pub async fn file_versions_folder_read(
    args: FolderReadArgs,
) -> Result<FolderReadResult, FileVersionsError> {
    blocking(move |store| read_folder_version(store, args)).await
}

#[tauri::command]
pub async fn file_versions_folder_sessions(
    args: FolderPathArgs,
) -> Result<Vec<String>, FileVersionsError> {
    blocking(move |store| list_folder_sessions(store, args)).await
}

#[tauri::command]
pub async fn file_versions_folder_prune(
    args: FolderPruneArgs,
) -> Result<FolderPruneResult, FileVersionsError> {
    blocking(move |store| prune_folder(store, args)).await
}

#[tauri::command]
pub async fn file_versions_folder_size(
    args: FolderPathArgs,
) -> Result<FolderSize, FileVersionsError> {
    blocking(move |store| folder_size(store, args)).await
}

#[tauri::command]
pub async fn file_versions_folder_forget(args: FolderPathArgs) -> Result<(), FileVersionsError> {
    blocking(move |store| forget_folder(store, args)).await
}
