use std::fs;
use std::path::PathBuf;

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

const APP_DIR: &str = ".kay-am";
const ATTACHMENTS_SUBDIR: &str = "attachments";

#[derive(Debug, Error)]
pub enum AttachmentError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("home directory not available")]
    NoHomeDir,
    #[error("invalid base64 payload: {0}")]
    InvalidBase64(String),
    #[error("attachment not found: {0}")]
    NotFound(String),
    #[error("unsupported mime: {0}")]
    UnsupportedMime(String),
}

impl Serialize for AttachmentError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serde_json::Map::new();
        map.insert(
            "kind".to_string(),
            serde_json::Value::String(self.kind().to_string()),
        );
        map.insert(
            "message".to_string(),
            serde_json::Value::String(self.to_string()),
        );
        serde_json::Value::Object(map).serialize(serializer)
    }
}

impl AttachmentError {
    fn kind(&self) -> &'static str {
        match self {
            AttachmentError::Io(_) => "io",
            AttachmentError::NoHomeDir => "no_home_dir",
            AttachmentError::InvalidBase64(_) => "invalid_base64",
            AttachmentError::NotFound(_) => "not_found",
            AttachmentError::UnsupportedMime(_) => "unsupported_mime",
        }
    }
}

fn ext_for_mime(mime: &str) -> Result<&'static str, AttachmentError> {
    match mime {
        "image/png" => Ok("png"),
        "image/jpeg" => Ok("jpg"),
        "image/webp" => Ok("webp"),
        "image/gif" => Ok("gif"),
        other => Err(AttachmentError::UnsupportedMime(other.to_string())),
    }
}

fn attachments_dir() -> Result<PathBuf, AttachmentError> {
    let home = dirs::home_dir().ok_or(AttachmentError::NoHomeDir)?;
    let dir = home.join(APP_DIR).join(ATTACHMENTS_SUBDIR);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn resolve_path(sha256: &str, mime: &str) -> Result<PathBuf, AttachmentError> {
    let ext = ext_for_mime(mime)?;
    Ok(attachments_dir()?.join(format!("{}.{}", sha256, ext)))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentSaveResult {
    pub sha256: String,
    pub size_bytes: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentSaveArgs {
    pub mime: String,
    pub base64_data: String,
}

#[tauri::command]
pub fn attachment_save(args: AttachmentSaveArgs) -> Result<AttachmentSaveResult, AttachmentError> {
    let bytes = B64
        .decode(args.base64_data.as_bytes())
        .map_err(|e| AttachmentError::InvalidBase64(e.to_string()))?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let sha256 = format!("{:x}", hasher.finalize());
    let path = resolve_path(&sha256, &args.mime)?;
    // Content-addressed: identical bytes hash to the same path; skip rewriting
    // if the file already exists with the right size.
    let needs_write = match fs::metadata(&path) {
        Ok(meta) => meta.len() as usize != bytes.len(),
        Err(_) => true,
    };
    if needs_write {
        fs::write(&path, &bytes)?;
    }
    Ok(AttachmentSaveResult {
        sha256,
        size_bytes: bytes.len() as u64,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentLoadArgs {
    pub sha256: String,
    pub mime: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentLoadResult {
    pub base64_data: String,
}

#[tauri::command]
pub fn attachment_load(args: AttachmentLoadArgs) -> Result<AttachmentLoadResult, AttachmentError> {
    let path = resolve_path(&args.sha256, &args.mime)?;
    let bytes =
        fs::read(&path).map_err(|_| AttachmentError::NotFound(args.sha256.clone()))?;
    Ok(AttachmentLoadResult {
        base64_data: B64.encode(&bytes),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ext_for_mime_known() {
        assert_eq!(ext_for_mime("image/png").unwrap(), "png");
        assert_eq!(ext_for_mime("image/jpeg").unwrap(), "jpg");
        assert_eq!(ext_for_mime("image/webp").unwrap(), "webp");
        assert_eq!(ext_for_mime("image/gif").unwrap(), "gif");
    }

    #[test]
    fn ext_for_mime_rejects_other() {
        assert!(matches!(
            ext_for_mime("application/pdf"),
            Err(AttachmentError::UnsupportedMime(_))
        ));
    }
}
