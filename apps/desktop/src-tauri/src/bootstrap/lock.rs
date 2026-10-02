use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};

use super::BootstrapError;

const LOCK_FILE: &str = "goodboy-bootstrap.lock";

#[cfg(not(unix))]
const STALE_AFTER: std::time::Duration = std::time::Duration::from_secs(15 * 60);

pub(crate) struct MoveLock {
    path: PathBuf,
}

#[cfg(unix)]
fn is_alive(pid: i32) -> bool {
    let rc = unsafe { libc::kill(pid, 0) };
    rc == 0 || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

#[cfg(not(unix))]
fn is_alive(_pid: i32) -> bool {
    true
}

#[cfg(unix)]
fn aged_out(_path: &Path) -> bool {
    false
}

#[cfg(not(unix))]
fn aged_out(path: &Path) -> bool {
    std::fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|modified| modified.elapsed().ok())
        .is_some_and(|age| age > STALE_AFTER)
}

fn holder_is_gone(path: &Path) -> bool {
    aged_out(path)
        || std::fs::read_to_string(path)
            .ok()
            .and_then(|raw| raw.trim().parse::<i32>().ok())
            .is_some_and(|pid| !is_alive(pid))
}

fn create(path: &Path) -> std::io::Result<()> {
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)?;
    file.write_all(std::process::id().to_string().as_bytes())
}

impl MoveLock {
    pub(crate) fn acquire(git_dir: &Path) -> Result<Self, BootstrapError> {
        let path = git_dir.join(LOCK_FILE);
        match create(&path) {
            Ok(()) => Ok(Self { path }),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                if !holder_is_gone(&path) {
                    return Err(BootstrapError::Locked);
                }
                std::fs::remove_file(&path)?;
                create(&path).map_err(|_| BootstrapError::Locked)?;
                Ok(Self { path })
            }
            Err(error) => Err(BootstrapError::Io(error)),
        }
    }
}

impl Drop for MoveLock {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}
