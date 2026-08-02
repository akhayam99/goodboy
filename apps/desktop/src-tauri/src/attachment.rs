use std::fs;
use std::path::Path;

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use thiserror::Error;

/// Attachments live inside the worktree so the spawned provider CLI can read
/// them with a path relative to its cwd. `.goodboy/` is gitignored, so they
/// never pollute the diff.
const ATTACH_SUBDIR: &str = ".goodboy/attachments";

/// Hard ceiling on a single decoded attachment. Mirrors the composer-side
/// check — the second guard exists because `rel_path`/payloads also arrive
/// from persisted turn events, not just the live UI.
const MAX_BYTES: usize = 15 * 1024 * 1024;

#[derive(Debug, Error)]
pub enum AttachmentError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid base64 payload: {0}")]
    Decode(#[from] base64::DecodeError),
    #[error("attachment exceeds {0} byte limit")]
    TooLarge(usize),
    #[error("attachment path escapes the worktree attachment directory")]
    InvalidPath,
    #[error("unsupported attachment type: {0}")]
    UnsupportedMime(String),
}

impl serde::Serialize for AttachmentError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

/// Reduces an arbitrary file name to a flat, separator-free token. Drops any
/// directory component and replaces anything outside `[A-Za-z0-9._-]` — both a
/// path-traversal guard and a defense against shell-hostile names.
pub(crate) fn sanitize_segment(name: &str) -> String {
    let base = Path::new(name)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("image");
    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect();
    match cleaned.as_str() {
        "" | "." | ".." => "image".to_string(),
        _ => cleaned,
    }
}

fn mime_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("bmp") => "image/bmp",
        Some("pdf") => "application/pdf",
        Some("csv") => "text/csv",
        Some("tsv") => "text/tab-separated-values",
        Some("txt") | Some("log") => "text/plain",
        Some("md") | Some("markdown") => "text/markdown",
        Some("json") => "application/json",
        Some("xml") => "application/xml",
        Some("yaml") | Some("yml") => "application/yaml",
        Some("docx") => {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
        Some("xlsx") => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        _ => "application/octet-stream",
    }
}

/// Whitelist guard shared by the drag-drop path. Images plus a curated set of
/// document types the spawned agent can actually read (PDF/CSV/text) or parse
/// with its own tooling (office formats). Unknown binaries are rejected so a
/// stray drop never lands an unreadable blob in the worktree.
fn is_allowed_mime(mime: &str) -> bool {
    mime.starts_with("image/")
        || matches!(
            mime,
            "application/pdf"
                | "text/csv"
                | "text/tab-separated-values"
                | "text/plain"
                | "text/markdown"
                | "application/json"
                | "application/xml"
                | "application/yaml"
                | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
}

/// Writes a base64-encoded image into `<worktree>/.goodboy/attachments/` and
/// returns the worktree-relative path. The stored name is `<id>-<file_name>`,
/// both sanitized — `id` keeps names unique without a uuid crate.
#[tauri::command]
pub fn attachment_write(
    worktree_dir: String,
    attachment_id: String,
    file_name: String,
    data_base64: String,
) -> Result<String, AttachmentError> {
    let bytes = STANDARD.decode(data_base64.as_bytes())?;
    if bytes.len() > MAX_BYTES {
        return Err(AttachmentError::TooLarge(MAX_BYTES));
    }

    let dir = Path::new(&worktree_dir).join(ATTACH_SUBDIR);
    fs::create_dir_all(&dir)?;

    let stored = format!(
        "{}-{}",
        sanitize_segment(&attachment_id),
        sanitize_segment(&file_name)
    );
    fs::write(dir.join(&stored), &bytes)?;

    Ok(format!("{ATTACH_SUBDIR}/{stored}"))
}

/// Payload returned to the webview when the user drops a file onto the
/// composer. The frontend treats this as an `AttachmentInput` after camelCase
/// conversion, so it can flow through the same pipeline as a paste/pick.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DroppedAttachment {
    file_name: String,
    mime_type: String,
    data_base64: String,
}

/// Reads a file the user dragged from the OS into the composer and returns the
/// bytes as base64 so the frontend can reuse the existing attachment pipeline.
/// Accepts the same whitelist as the composer picker, mirroring its `accept`
/// filter — the second guard exists because OS drag-drop bypasses the picker.
#[tauri::command]
pub fn attachment_read_dropped(abs_path: String) -> Result<DroppedAttachment, AttachmentError> {
    let path = Path::new(&abs_path);
    let meta = fs::metadata(path)?;
    if !meta.is_file() {
        return Err(AttachmentError::InvalidPath);
    }
    if (meta.len() as usize) > MAX_BYTES {
        return Err(AttachmentError::TooLarge(MAX_BYTES));
    }

    let mime = mime_for(path);
    if !is_allowed_mime(mime) {
        return Err(AttachmentError::UnsupportedMime(mime.to_string()));
    }

    let bytes = fs::read(path)?;
    if bytes.len() > MAX_BYTES {
        return Err(AttachmentError::TooLarge(MAX_BYTES));
    }

    let file_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("file")
        .to_string();

    Ok(DroppedAttachment {
        file_name,
        mime_type: mime.to_string(),
        data_base64: STANDARD.encode(&bytes),
    })
}

/// Reads a previously written attachment back as a `data:` URL for display in
/// the webview. `rel_path` must be the worktree-relative path produced by
/// `attachment_write`; anything pointing outside the attachment dir is rejected.
#[tauri::command]
pub fn attachment_read(worktree_dir: String, rel_path: String) -> Result<String, AttachmentError> {
    if rel_path.contains("..") || !rel_path.starts_with(ATTACH_SUBDIR) {
        return Err(AttachmentError::InvalidPath);
    }

    let full = Path::new(&worktree_dir).join(&rel_path);
    let bytes = fs::read(&full)?;
    if bytes.len() > MAX_BYTES {
        return Err(AttachmentError::TooLarge(MAX_BYTES));
    }

    Ok(format!(
        "data:{};base64,{}",
        mime_for(&full),
        STANDARD.encode(&bytes)
    ))
}

#[tauri::command]
pub fn attachment_delete(worktree_dir: String, rel_path: String) -> Result<(), AttachmentError> {
    if rel_path.contains("..") || !rel_path.starts_with(ATTACH_SUBDIR) {
        return Err(AttachmentError::InvalidPath);
    }

    let full = Path::new(&worktree_dir).join(&rel_path);
    match fs::remove_file(&full) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(AttachmentError::Io(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_strips_path_separators() {
        assert_eq!(sanitize_segment("../../etc/passwd"), "passwd");
        assert_eq!(sanitize_segment("a/b/c.png"), "c.png");
        assert_eq!(sanitize_segment(".."), "image");
        assert_eq!(sanitize_segment(""), "image");
        assert_eq!(sanitize_segment("my shot!.PNG"), "my_shot_.PNG");
    }

    #[test]
    fn write_then_read_roundtrips() {
        let dir = std::env::temp_dir().join(format!("goodboy-attach-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        // 1x1 transparent PNG.
        let png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        let rel = attachment_write(
            dir.to_string_lossy().to_string(),
            "att-1".to_string(),
            "shot.png".to_string(),
            png_b64.to_string(),
        )
        .unwrap();
        assert_eq!(rel, ".goodboy/attachments/att-1-shot.png");

        let data_url = attachment_read(dir.to_string_lossy().to_string(), rel).unwrap();
        assert!(data_url.starts_with("data:image/png;base64,"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn delete_removes_file_and_rejects_traversal() {
        let dir = std::env::temp_dir().join(format!("goodboy-attach-del-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        let png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        let rel = attachment_write(
            dir.to_string_lossy().to_string(),
            "att-del".to_string(),
            "shot.png".to_string(),
            png_b64.to_string(),
        )
        .unwrap();
        let full = Path::new(&dir).join(&rel);
        assert!(full.exists());

        attachment_delete(dir.to_string_lossy().to_string(), rel.clone()).unwrap();
        assert!(!full.exists());

        attachment_delete(dir.to_string_lossy().to_string(), rel).unwrap();

        let err = attachment_delete("/tmp".to_string(), "../../etc/passwd".to_string());
        assert!(matches!(err, Err(AttachmentError::InvalidPath)));
        let err = attachment_delete("/tmp".to_string(), "etc/passwd".to_string());
        assert!(matches!(err, Err(AttachmentError::InvalidPath)));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_rejects_traversal() {
        let err = attachment_read("/tmp".to_string(), "../../etc/passwd".to_string());
        assert!(matches!(err, Err(AttachmentError::InvalidPath)));
        let err = attachment_read("/tmp".to_string(), "etc/passwd".to_string());
        assert!(matches!(err, Err(AttachmentError::InvalidPath)));
    }

    #[test]
    fn read_dropped_rejects_unsupported_type() {
        let dir = std::env::temp_dir().join(format!("goodboy-drop-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let blob = dir.join("payload.bin");
        fs::write(&blob, b"\x00\x01\x02").unwrap();
        let err = attachment_read_dropped(blob.to_string_lossy().to_string());
        assert!(matches!(err, Err(AttachmentError::UnsupportedMime(_))));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_dropped_accepts_documents() {
        let dir = std::env::temp_dir().join(format!("goodboy-drop-doc-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let csv = dir.join("data.csv");
        fs::write(&csv, b"a,b\n1,2\n").unwrap();
        let out = attachment_read_dropped(csv.to_string_lossy().to_string()).unwrap();
        assert_eq!(out.file_name, "data.csv");
        assert_eq!(out.mime_type, "text/csv");

        let pdf = dir.join("doc.pdf");
        fs::write(&pdf, b"%PDF-1.4\n").unwrap();
        let out = attachment_read_dropped(pdf.to_string_lossy().to_string()).unwrap();
        assert_eq!(out.mime_type, "application/pdf");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_dropped_returns_image_bytes() {
        let dir = std::env::temp_dir().join(format!("goodboy-drop-img-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let png = dir.join("shot.png");
        // 1x1 transparent PNG.
        let png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        fs::write(&png, STANDARD.decode(png_b64).unwrap()).unwrap();
        let out = attachment_read_dropped(png.to_string_lossy().to_string()).unwrap();
        assert_eq!(out.file_name, "shot.png");
        assert_eq!(out.mime_type, "image/png");
        assert_eq!(out.data_base64, png_b64);
        let _ = fs::remove_dir_all(&dir);
    }
}
