use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::pty_ring::RING_CAP;

const DIR_NAME: &str = "terminal-scrollback";
const RESTORED_MARK: &[u8] = b"\r\n\x1b[2mSession restored. The previous process ended.\x1b[0m\r\n";

pub fn dir_in(app_data: &Path) -> PathBuf {
    app_data.join(DIR_NAME)
}

fn file_name_of(id: &str) -> String {
    let safe: String = id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                return c;
            }
            '_'
        })
        .collect();
    format!("{safe}.bin")
}

pub fn save(dir: &Path, id: &str, bytes: &[u8]) -> io::Result<()> {
    if bytes.is_empty() {
        return forget(dir, id);
    }
    fs::create_dir_all(dir)?;
    let tail = &bytes[bytes.len().saturating_sub(RING_CAP)..];
    fs::write(dir.join(file_name_of(id)), tail)
}

pub fn take(dir: &Path, id: &str) -> Option<Vec<u8>> {
    let path = dir.join(file_name_of(id));
    let mut bytes = fs::read(&path).ok()?;
    let _ = fs::remove_file(&path);
    if bytes.is_empty() {
        return None;
    }
    bytes.extend_from_slice(RESTORED_MARK);
    Some(bytes)
}

pub fn forget(dir: &Path, id: &str) -> io::Result<()> {
    match fs::remove_file(dir.join(file_name_of(id))) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("gb-scrollback-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn a_saved_scrollback_is_taken_once_with_a_restored_mark() {
        let dir = scratch("take");
        save(&dir, "ws:acme::t1", b"hello\r\n").unwrap();

        let first = take(&dir, "ws:acme::t1").unwrap();
        assert!(first.starts_with(b"hello\r\n"));
        assert!(first.ends_with(RESTORED_MARK));
        assert!(take(&dir, "ws:acme::t1").is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_saved_scrollback_keeps_only_the_ring_cap() {
        let dir = scratch("cap");
        let big = vec![b'x'; RING_CAP + 4096];
        save(&dir, "s::t1", &big).unwrap();

        let written = fs::read(dir.join(file_name_of("s::t1"))).unwrap();
        assert_eq!(written.len(), RING_CAP);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn forget_removes_the_file_and_tolerates_a_missing_one() {
        let dir = scratch("forget");
        save(&dir, "s::t2", b"data").unwrap();

        forget(&dir, "s::t2").unwrap();
        forget(&dir, "s::t2").unwrap();
        assert!(take(&dir, "s::t2").is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn saving_nothing_clears_a_previous_file() {
        let dir = scratch("empty");
        save(&dir, "s::t3", b"old").unwrap();

        save(&dir, "s::t3", b"").unwrap();
        assert!(take(&dir, "s::t3").is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn distinct_ids_never_share_a_file() {
        assert_ne!(file_name_of("a::t1"), file_name_of("a::t2"));
        assert_ne!(file_name_of("ws:a::t1"), file_name_of("a::t1"));
    }
}
