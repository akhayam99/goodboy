use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use crate::pty_ring::RING_CAP;

const DIR_NAME: &str = "terminal-scrollback";
pub const STALE_AFTER: Duration = Duration::from_secs(7 * 24 * 60 * 60);
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

fn create_private_dir(dir: &Path) -> io::Result<()> {
    fs::create_dir_all(dir)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(dir, fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

fn write_private_file(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let mut options = OpenOptions::new();
    options.create(true).write(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(fs::Permissions::from_mode(0o600))?;
    }
    file.write_all(bytes)
}

pub fn save(dir: &Path, id: &str, bytes: &[u8]) -> io::Result<()> {
    if bytes.is_empty() {
        return forget(dir, id);
    }
    create_private_dir(dir)?;
    let tail = &bytes[bytes.len().saturating_sub(RING_CAP)..];
    write_private_file(&dir.join(file_name_of(id)), tail)
}

pub fn prune_stale(dir: &Path, now: SystemTime, max_age: Duration) -> usize {
    let Ok(entries) = fs::read_dir(dir) else {
        return 0;
    };
    let mut removed = 0;
    for entry in entries.flatten() {
        let Ok(modified) = entry.metadata().and_then(|metadata| metadata.modified()) else {
            continue;
        };
        let is_stale = now
            .duration_since(modified)
            .map(|age| age > max_age)
            .unwrap_or(false);
        if is_stale && fs::remove_file(entry.path()).is_ok() {
            removed += 1;
        }
    }
    removed
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

    #[cfg(unix)]
    #[test]
    fn a_saved_scrollback_is_private_to_the_owner() {
        use std::os::unix::fs::PermissionsExt;
        let dir = scratch("private");
        fs::create_dir_all(&dir).unwrap();
        fs::set_permissions(&dir, fs::Permissions::from_mode(0o755)).unwrap();
        let file = dir.join(file_name_of("s::t4"));
        fs::write(&file, b"old").unwrap();
        fs::set_permissions(&file, fs::Permissions::from_mode(0o644)).unwrap();

        save(&dir, "s::t4", b"secret token").unwrap();

        let dir_mode = fs::metadata(&dir).unwrap().permissions().mode();
        let file_mode = fs::metadata(&file).unwrap().permissions().mode();
        assert_eq!(dir_mode & 0o777, 0o700);
        assert_eq!(file_mode & 0o777, 0o600);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn prune_stale_removes_only_files_older_than_the_limit() {
        let dir = scratch("prune");
        save(&dir, "s::old", b"old").unwrap();
        save(&dir, "s::new", b"new").unwrap();
        let old = fs::File::options()
            .write(true)
            .open(dir.join(file_name_of("s::old")))
            .unwrap();
        old.set_modified(SystemTime::now() - STALE_AFTER - Duration::from_secs(60))
            .unwrap();

        let removed = prune_stale(&dir, SystemTime::now(), STALE_AFTER);

        assert_eq!(removed, 1);
        assert!(!dir.join(file_name_of("s::old")).exists());
        assert!(dir.join(file_name_of("s::new")).exists());
        let missing = dir.join("missing");
        assert_eq!(prune_stale(&missing, SystemTime::now(), STALE_AFTER), 0);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn distinct_ids_never_share_a_file() {
        assert_ne!(file_name_of("a::t1"), file_name_of("a::t2"));
        assert_ne!(file_name_of("ws:a::t1"), file_name_of("a::t1"));
    }
}
