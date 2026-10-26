use std::io::Read;
use std::path::Path;

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use rusqlite::Connection;
use tauri::State;

use crate::db::Db;
use crate::util::scoped_path::{open_within, ScopedPathError};
use crate::util::MessageError;

use crate::util::limits::{format_limit, MAX_LOCAL_IMAGE_BYTES};

fn image_too_large() -> String {
    format!(
        "image exceeds the {} limit",
        format_limit(MAX_LOCAL_IMAGE_BYTES)
    )
}

#[tauri::command]
pub async fn local_image_read(
    state: State<'_, Db>,
    session_id: String,
    path: String,
) -> Result<String, MessageError> {
    let root = {
        let conn = state.0.lock().map_err(|_| "image root is unavailable")?;
        resolve_root(&conn, &session_id)?
    };
    tauri::async_runtime::spawn_blocking(move || read_image(Path::new(&root), Path::new(&path)))
        .await
        .map_err(|_| MessageError::Failed("could not read the image".to_string()))?
        .map_err(MessageError::Failed)
}

fn resolve_root(conn: &Connection, session_id: &str) -> Result<String, String> {
    let (active_mount_id, active_path, fallback_path) = conn
        .query_row(
            "SELECT
                s.active_mount_id,
                (SELECT sw.worktree_path FROM session_worktrees sw
                 WHERE sw.session_id = s.id AND sw.id = s.active_mount_id
                   AND sw.worktree_path IS NOT NULL AND sw.is_attached = 1
                 LIMIT 1),
                COALESCE(
                    (SELECT sw.worktree_path FROM session_worktrees sw
                     WHERE sw.session_id = s.id AND sw.project_id = s.active_project_id
                       AND sw.worktree_path IS NOT NULL AND sw.is_attached = 1
                     ORDER BY sw.parallel_index, sw.created_at, sw.id LIMIT 1),
                    (SELECT sw.worktree_path FROM session_worktrees sw
                     WHERE sw.session_id = s.id
                       AND sw.worktree_path IS NOT NULL AND sw.is_attached = 1
                     ORDER BY sw.parallel_index, sw.created_at, sw.id LIMIT 1),
                    (SELECT p.root_path FROM projects p
                     WHERE p.id = s.active_project_id AND p.workspace_id = s.workspace_id)
                )
             FROM sessions s WHERE s.id = ?1",
            [session_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .map_err(|_| "image root is unavailable".to_string())?;
    let usable = |value: Option<String>| value.filter(|root| !root.is_empty());
    if active_mount_id.is_some() {
        return usable(active_path).ok_or_else(|| "the active mount is unavailable".to_string());
    }
    usable(fallback_path).ok_or_else(|| "image root is unavailable".to_string())
}

fn read_image(root: &Path, path: &Path) -> Result<String, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let expected_mime = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => return Err("unsupported image type".to_string()),
    };
    let file = open_within(root, path).map_err(scoped_error_message)?;
    let metadata = file.metadata().map_err(|_| "image is unavailable")?;
    if !metadata.is_file() {
        return Err("image must be a regular file".to_string());
    }
    if metadata.len() > MAX_LOCAL_IMAGE_BYTES {
        return Err(image_too_large());
    }
    let mut bytes = Vec::new();
    file.take(MAX_LOCAL_IMAGE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "could not read the image")?;
    if bytes.len() as u64 > MAX_LOCAL_IMAGE_BYTES {
        return Err(image_too_large());
    }
    if crate::remote_image::sniff_image_mime(&bytes) != Some(expected_mime) {
        return Err("image content does not match its file type".to_string());
    }
    Ok(format!(
        "data:{expected_mime};base64,{}",
        STANDARD.encode(bytes)
    ))
}

fn scoped_error_message(error: ScopedPathError) -> String {
    match error {
        ScopedPathError::Escapes => "image path escapes the selected root".to_string(),
        ScopedPathError::Unsupported => "local images are unavailable on this platform".to_string(),
        ScopedPathError::Unavailable => "image is unavailable".to_string(),
    }
}

#[cfg(test)]
mod tests {
    #[cfg(not(unix))]
    use super::scoped_error_message;
    use super::{read_image, resolve_root, MAX_LOCAL_IMAGE_BYTES};
    #[cfg(not(unix))]
    use crate::util::scoped_path::ScopedPathError;
    use rusqlite::Connection;
    use std::fs;
    use std::path::PathBuf;

    const PNG: &[u8] = b"\x89PNG\r\n\x1a\n";

    struct Fixture(PathBuf);

    impl Fixture {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("goodboy-local-image-{}", rand::random::<u64>()));
            fs::create_dir_all(root.join("out")).unwrap();
            fs::write(root.join("out/chart.png"), PNG).unwrap();
            Self(root)
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[cfg(unix)]
    #[test]
    fn reads_relative_and_absolute_images_inside_root() {
        let fixture = Fixture::new();
        for path in [
            PathBuf::from("out/chart.png"),
            fixture.0.join("out/chart.png"),
        ] {
            assert_eq!(
                read_image(&fixture.0, &path).unwrap(),
                "data:image/png;base64,iVBORw0KGgo="
            );
        }
    }

    #[test]
    fn rejects_absolute_images_outside_root() {
        let fixture = Fixture::new();
        let outside = Fixture::new();
        assert!(read_image(&fixture.0, &outside.0.join("out/chart.png")).is_err());
    }

    #[test]
    fn rejects_parent_traversal_even_when_it_stays_inside_root() {
        let fixture = Fixture::new();
        assert!(read_image(&fixture.0, &PathBuf::from("out/../out/chart.png")).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_file_and_directory_symlink_escapes() {
        let fixture = Fixture::new();
        let outside = Fixture::new();
        std::os::unix::fs::symlink(
            outside.0.join("out/chart.png"),
            fixture.0.join("escape.png"),
        )
        .unwrap();
        std::os::unix::fs::symlink(&outside.0, fixture.0.join("escape")).unwrap();
        assert!(read_image(&fixture.0, &PathBuf::from("escape.png")).is_err());
        assert!(read_image(&fixture.0, &PathBuf::from("escape/out/chart.png")).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_oversize_files() {
        let fixture = Fixture::new();
        let path = fixture.0.join("out/chart.png");
        fs::OpenOptions::new()
            .write(true)
            .open(&path)
            .unwrap()
            .set_len(MAX_LOCAL_IMAGE_BYTES + 1)
            .unwrap();
        assert!(read_image(&fixture.0, &path)
            .unwrap_err()
            .contains("15 MiB"));
    }

    #[test]
    fn rejects_svg_and_disguised_markup() {
        let fixture = Fixture::new();
        fs::write(fixture.0.join("shape.svg"), b"<svg/>").unwrap();
        fs::write(fixture.0.join("shape.png"), b"<svg/>").unwrap();
        assert!(read_image(&fixture.0, &PathBuf::from("shape.svg")).is_err());
        assert!(read_image(&fixture.0, &PathBuf::from("shape.png")).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn accepts_each_supported_raster_format() {
        let fixture = Fixture::new();
        for (name, bytes, mime) in [
            ("a.JPG", b"\xff\xd8\xff".as_slice(), "image/jpeg"),
            ("a.jpeg", b"\xff\xd8\xff".as_slice(), "image/jpeg"),
            ("a.gif", b"GIF89a".as_slice(), "image/gif"),
            ("a.webp", b"RIFF\0\0\0\0WEBP".as_slice(), "image/webp"),
        ] {
            let path = fixture.0.join(name);
            fs::write(&path, bytes).unwrap();
            assert!(read_image(&fixture.0, &path)
                .unwrap()
                .starts_with(&format!("data:{mime};base64,")));
        }
    }

    #[test]
    fn rejects_directories_and_relative_roots() {
        let fixture = Fixture::new();
        fs::create_dir(fixture.0.join("directory.png")).unwrap();
        assert!(read_image(&fixture.0, &PathBuf::from("directory.png")).is_err());
        assert!(read_image(&PathBuf::from("."), &PathBuf::from("out/chart.png")).is_err());
    }

    fn session_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE sessions (id TEXT, workspace_id TEXT, active_project_id TEXT, active_mount_id TEXT);
             CREATE TABLE projects (id TEXT, workspace_id TEXT, root_path TEXT);
             CREATE TABLE session_worktrees (
                id TEXT, session_id TEXT, project_id TEXT, worktree_path TEXT,
                parallel_index INTEGER, created_at TEXT, is_attached INTEGER
             );
             INSERT INTO sessions VALUES ('session', 'workspace', 'active', NULL);
             INSERT INTO projects VALUES ('active', 'workspace', '/project');",
        )
        .unwrap();
        conn
    }

    #[test]
    fn resolves_the_active_project_root_without_a_worktree() {
        assert_eq!(resolve_root(&session_db(), "session").unwrap(), "/project");
    }

    #[test]
    fn prefers_the_active_project_worktree_over_other_mounts_and_project_root() {
        let conn = session_db();
        conn.execute_batch(
            "INSERT INTO session_worktrees VALUES
             ('first', 'session', 'other', '/other-mount', 0, '1', 1),
             ('active', 'session', 'active', '/active-mount', 1, '2', 1);",
        )
        .unwrap();
        assert_eq!(resolve_root(&conn, "session").unwrap(), "/active-mount");
    }

    #[test]
    fn falls_back_to_the_first_session_worktree() {
        let conn = session_db();
        conn.execute_batch(
            "INSERT INTO session_worktrees VALUES
             ('later', 'session', 'other', '/later-mount', 1, '1', 1),
             ('first', 'session', 'other', '/first-mount', 0, '2', 1);",
        )
        .unwrap();
        assert_eq!(resolve_root(&conn, "session").unwrap(), "/first-mount");
    }

    #[test]
    fn prefers_the_active_mount_and_excludes_removed_mounts() {
        let conn = session_db();
        conn.execute_batch(
            "INSERT INTO session_worktrees VALUES
             ('first', 'session', 'active', '/first-mount', 0, '1', 1),
             ('active', 'session', 'active', '/active-mount', 1, '2', 1),
             ('removed', 'session', 'active', NULL, 2, '3', 0);
             UPDATE sessions SET active_mount_id = 'active' WHERE id = 'session';",
        )
        .unwrap();
        assert_eq!(resolve_root(&conn, "session").unwrap(), "/active-mount");
    }

    #[test]
    fn refuses_to_read_a_sibling_mount_when_the_active_one_is_gone() {
        let conn = session_db();
        conn.execute_batch(
            "INSERT INTO session_worktrees VALUES
             ('first', 'session', 'active', '/first-mount', 0, '1', 1),
             ('active', 'session', 'active', NULL, 1, '2', 0);
             UPDATE sessions SET active_mount_id = 'active' WHERE id = 'session';",
        )
        .unwrap();
        assert_eq!(
            resolve_root(&conn, "session").unwrap_err(),
            "the active mount is unavailable"
        );
    }

    #[test]
    fn refuses_unknown_sessions_and_sessions_without_a_root() {
        let conn = session_db();
        conn.execute_batch("INSERT INTO sessions VALUES ('empty', 'workspace', NULL, NULL);")
            .unwrap();
        assert!(resolve_root(&conn, "unknown").is_err());
        assert!(resolve_root(&conn, "empty").is_err());
    }

    #[test]
    fn refuses_a_project_from_another_workspace() {
        let conn = session_db();
        conn.execute_batch("UPDATE projects SET workspace_id = 'other';")
            .unwrap();
        assert!(resolve_root(&conn, "session").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_an_image_named_fifo_without_blocking() {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;

        let fixture = Fixture::new();
        let path = fixture.0.join("pipe.png");
        let name = CString::new(path.as_os_str().as_bytes()).unwrap();
        assert_eq!(unsafe { libc::mkfifo(name.as_ptr(), 0o600) }, 0);
        assert_eq!(
            read_image(&fixture.0, &path).unwrap_err(),
            "image must be a regular file"
        );
    }

    #[cfg(unix)]
    #[test]
    fn accepts_an_in_root_hardlink_to_an_image_outside_root() {
        let fixture = Fixture::new();
        let outside = Fixture::new();
        let path = fixture.0.join("hardlink.png");
        fs::hard_link(outside.0.join("out/chart.png"), &path).unwrap();
        assert_eq!(
            read_image(&fixture.0, &path).unwrap(),
            "data:image/png;base64,iVBORw0KGgo="
        );
    }

    #[cfg(unix)]
    #[test]
    fn rejects_non_image_content_in_an_in_root_hardlink() {
        let fixture = Fixture::new();
        let outside = Fixture::new();
        let source = outside.0.join("out/chart.png");
        fs::write(&source, b"not an image").unwrap();
        let path = fixture.0.join("hardlink.png");
        fs::hard_link(&source, &path).unwrap();
        assert_eq!(
            read_image(&fixture.0, &path).unwrap_err(),
            "image content does not match its file type"
        );
    }

    #[cfg(not(unix))]
    #[test]
    fn refuses_local_image_reads_on_unsupported_platforms() {
        let fixture = Fixture::new();
        assert_eq!(
            scoped_error_message(ScopedPathError::Unsupported),
            "local images are unavailable on this platform"
        );
        assert_eq!(
            read_image(&fixture.0, &PathBuf::from("out/chart.png")).unwrap_err(),
            "local images are unavailable on this platform"
        );
    }
}
