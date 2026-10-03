use std::fs;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use rusqlite::{Connection, OptionalExtension};
use tauri::State;
use thiserror::Error;

use crate::attachment::sanitize_segment;
use crate::db::Db;

const STORE_DIR: &str = "chat-attachments";
const TURN_DIR: &str = "goodboy-chat";

pub(crate) const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;

#[derive(Debug, Error)]
pub enum ChatImageError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("invalid base64 payload: {0}")]
    Decode(#[from] base64::DecodeError),
    #[error("An image in Chat can be at most 10 MB.")]
    TooLarge,
    #[error("Chat reads PNG, JPEG, GIF and WebP images.")]
    NotAnImage,
    #[error("{0} is not a valid id")]
    InvalidId(String),
    #[error("image not found: {0}")]
    NotFound(String),
    #[error("goodboy folder unavailable: {0}")]
    Root(String),
    #[error("connection mutex poisoned")]
    Poisoned,
}

crate::util::impl_error_serialize!(ChatImageError);

impl ChatImageError {
    fn kind(&self) -> &'static str {
        match self {
            ChatImageError::Io(_) => "io",
            ChatImageError::Database(_) => "database",
            ChatImageError::Decode(_) => "decode",
            ChatImageError::TooLarge => "too_large",
            ChatImageError::NotAnImage => "not_an_image",
            ChatImageError::InvalidId(_) => "invalid_id",
            ChatImageError::NotFound(_) => "not_found",
            ChatImageError::Root(_) => "root",
            ChatImageError::Poisoned => "poisoned",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ChatImage {
    pub id: String,
    pub message_id: String,
    pub file_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TurnImage {
    pub path: String,
    pub file_name: String,
    pub is_current: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TurnImages {
    pub root: String,
    pub images: Vec<TurnImage>,
}

pub(crate) fn is_safe_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && !value.starts_with('-')
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
}

fn require_id(value: &str) -> Result<(), ChatImageError> {
    if is_safe_id(value) {
        return Ok(());
    }
    Err(ChatImageError::InvalidId(value.to_string()))
}

pub(crate) fn image_mime(file_name: &str) -> Option<&'static str> {
    let ext = Path::new(file_name)
        .extension()
        .and_then(|ext| ext.to_str())?
        .to_ascii_lowercase();
    match ext.as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}

fn stored_name(id: &str, file_name: &str) -> String {
    format!("{id}-{}", sanitize_segment(file_name))
}

fn store_root() -> Result<PathBuf, ChatImageError> {
    let db_path =
        crate::db::resolve_db_path().map_err(|error| ChatImageError::Root(error.to_string()))?;
    match db_path.parent() {
        Some(parent) => Ok(parent.join(STORE_DIR)),
        None => Err(ChatImageError::Root("db path has no parent".to_string())),
    }
}

#[cfg(unix)]
fn set_mode(path: &Path, mode: u32) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(mode))
}

#[cfg(not(unix))]
fn set_mode(path: &Path, mode: u32) -> std::io::Result<()> {
    let mut permissions = fs::metadata(path)?.permissions();
    permissions.set_readonly(mode & 0o200 == 0);
    fs::set_permissions(path, permissions)
}

pub(crate) fn write_image_in(
    store: &Path,
    chat_id: &str,
    attachment_id: &str,
    file_name: &str,
    bytes: &[u8],
) -> Result<u64, ChatImageError> {
    require_id(chat_id)?;
    require_id(attachment_id)?;
    if image_mime(file_name).is_none() {
        return Err(ChatImageError::NotAnImage);
    }
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(ChatImageError::TooLarge);
    }
    let dir = store.join(chat_id);
    fs::create_dir_all(&dir)?;
    let target = dir.join(stored_name(attachment_id, file_name));
    match fs::remove_file(&target) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.into()),
    }
    fs::write(&target, bytes)?;
    set_mode(&target, 0o444)?;
    Ok(bytes.len() as u64)
}

pub(crate) fn read_image_in(
    store: &Path,
    chat_id: &str,
    image: &ChatImage,
) -> Result<String, ChatImageError> {
    require_id(chat_id)?;
    require_id(&image.id)?;
    let Some(mime) = image_mime(&image.file_name) else {
        return Err(ChatImageError::NotAnImage);
    };
    let bytes = fs::read(
        store
            .join(chat_id)
            .join(stored_name(&image.id, &image.file_name)),
    )?;
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(ChatImageError::TooLarge);
    }
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(&bytes)))
}

pub(crate) fn remove_chat_in(store: &Path, chat_id: &str) -> Result<(), ChatImageError> {
    require_id(chat_id)?;
    match fs::remove_dir_all(store.join(chat_id)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

pub(crate) fn load_chat_images(
    conn: &Connection,
    chat_id: &str,
) -> Result<Vec<ChatImage>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, message_id, file_name FROM chat_message_attachments
         WHERE chat_id = ?1 ORDER BY created_at, message_id, position",
    )?;
    let rows = stmt.query_map([chat_id], |row| {
        Ok(ChatImage {
            id: row.get(0)?,
            message_id: row.get(1)?,
            file_name: row.get(2)?,
        })
    })?;
    rows.collect()
}

fn load_one_image(
    conn: &Connection,
    chat_id: &str,
    attachment_id: &str,
) -> Result<Option<ChatImage>, rusqlite::Error> {
    conn.query_row(
        "SELECT id, message_id, file_name FROM chat_message_attachments
         WHERE chat_id = ?1 AND id = ?2",
        [chat_id, attachment_id],
        |row| {
            Ok(ChatImage {
                id: row.get(0)?,
                message_id: row.get(1)?,
                file_name: row.get(2)?,
            })
        },
    )
    .optional()
}

fn link_or_copy(source: &Path, target: &Path) -> std::io::Result<()> {
    if fs::hard_link(source, target).is_ok() {
        return Ok(());
    }
    fs::copy(source, target)?;
    set_mode(target, 0o444)
}

pub(crate) fn turn_root_in(temp: &Path, run_id: &str) -> PathBuf {
    temp.join(TURN_DIR).join(run_id)
}

pub(crate) fn prepare_turn_images_in(
    store: &Path,
    temp: &Path,
    chat_id: &str,
    run_id: &str,
    images: &[ChatImage],
    current_message: Option<&str>,
) -> Result<Option<TurnImages>, ChatImageError> {
    require_id(chat_id)?;
    require_id(run_id)?;
    if images.is_empty() {
        return Ok(None);
    }
    let root = turn_root_in(temp, run_id);
    remove_turn_root(&root);
    fs::create_dir_all(&root)?;
    let mut linked: Vec<(String, TurnImage)> = Vec::with_capacity(images.len());
    for (index, image) in images.iter().enumerate() {
        if !is_safe_id(&image.id) || image_mime(&image.file_name).is_none() {
            continue;
        }
        let source = store
            .join(chat_id)
            .join(stored_name(&image.id, &image.file_name));
        if !source.is_file() {
            continue;
        }
        let name = format!("{index}-{}", sanitize_segment(&image.file_name));
        link_or_copy(&source, &root.join(&name))?;
        linked.push((
            name,
            TurnImage {
                path: String::new(),
                file_name: image.file_name.clone(),
                is_current: current_message == Some(image.message_id.as_str()),
            },
        ));
    }
    if linked.is_empty() {
        remove_turn_root(&root);
        return Ok(None);
    }
    set_mode(&root, 0o555)?;
    let canonical = fs::canonicalize(&root)?;
    let images = linked
        .into_iter()
        .map(|(name, image)| TurnImage {
            path: canonical.join(name).to_string_lossy().into_owned(),
            ..image
        })
        .collect();
    Ok(Some(TurnImages {
        root: canonical.to_string_lossy().into_owned(),
        images,
    }))
}

pub(crate) fn remove_turn_root(root: &Path) {
    if !root.exists() {
        return;
    }
    let _ = set_mode(root, 0o755);
    let _ = fs::remove_dir_all(root);
}

pub(crate) fn prepare_turn_images(
    chat_id: &str,
    run_id: &str,
    images: &[ChatImage],
    current_message: Option<&str>,
) -> Result<Option<TurnImages>, ChatImageError> {
    prepare_turn_images_in(
        &store_root()?,
        &std::env::temp_dir(),
        chat_id,
        run_id,
        images,
        current_message,
    )
}

#[tauri::command]
pub async fn chat_attachment_write(
    chat_id: String,
    attachment_id: String,
    file_name: String,
    data_base64: String,
) -> Result<u64, ChatImageError> {
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = STANDARD.decode(data_base64.as_bytes())?;
        write_image_in(&store_root()?, &chat_id, &attachment_id, &file_name, &bytes)
    })
    .await
    .map_err(|e| ChatImageError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn chat_attachment_read(
    db: State<'_, Db>,
    chat_id: String,
    attachment_id: String,
) -> Result<String, ChatImageError> {
    require_id(&chat_id)?;
    require_id(&attachment_id)?;
    let image = {
        let conn = db.0.lock().map_err(|_| ChatImageError::Poisoned)?;
        load_one_image(&conn, &chat_id, &attachment_id)?
    };
    let Some(image) = image else {
        return Err(ChatImageError::NotFound(attachment_id));
    };
    tauri::async_runtime::spawn_blocking(move || read_image_in(&store_root()?, &chat_id, &image))
        .await
        .map_err(|e| ChatImageError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn chat_attachments_remove(chat_ids: Vec<String>) -> Result<(), ChatImageError> {
    tauri::async_runtime::spawn_blocking(move || {
        let store = store_root()?;
        for chat_id in chat_ids {
            remove_chat_in(&store, &chat_id)?;
        }
        Ok(())
    })
    .await
    .map_err(|e| ChatImageError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests;
