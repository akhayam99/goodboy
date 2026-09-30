use crate::worktree::sanitize_slug;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

pub(super) const COPY_PREFIX: &str = "goodboy-history-";

pub(super) const COPY_DIR: &str = "copy";

const RESERVATIONS_DIR: &str = "history-copies";

pub(super) const RESERVATION_FILE: &str = "goodboy-history-owner";

pub(super) const RESERVATION_HEADER: &str = "goodboy history copy v1";

pub(super) const RESERVATION_LOCK: &str = "goodboy-history.lock";

pub(crate) fn reservations_dir() -> PathBuf {
    dirs::home_dir()
        .map(|home| home.join(".goodboy").join(RESERVATIONS_DIR))
        .unwrap_or_default()
}

fn reservation_of(slug: &str) -> PathBuf {
    reservations_dir().join(format!("{COPY_PREFIX}{}", sanitize_slug(slug)))
}

pub(crate) fn copy_path_of(slug: &str) -> PathBuf {
    reservation_of(slug).join(COPY_DIR)
}

pub(super) fn held_locks() -> &'static std::sync::Mutex<HashMap<PathBuf, std::fs::File>> {
    static HELD: OnceLock<std::sync::Mutex<HashMap<PathBuf, std::fs::File>>> = OnceLock::new();
    HELD.get_or_init(|| std::sync::Mutex::new(HashMap::new()))
}

pub(super) fn take_held(root: &Path) -> Option<std::fs::File> {
    held_locks().lock().ok()?.remove(root)
}

pub(super) fn is_held(root: &Path) -> bool {
    held_locks()
        .lock()
        .map(|held| held.contains_key(root))
        .unwrap_or(true)
}

#[cfg(unix)]
pub(super) fn try_lock_exclusive(file: &std::fs::File) -> bool {
    use std::os::unix::io::AsRawFd;
    unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) == 0 }
}

#[cfg(not(unix))]
pub(super) fn try_lock_exclusive(file: &std::fs::File) -> bool {
    file.try_lock().is_ok()
}

pub(super) fn open_lock(root: &Path) -> Option<std::fs::File> {
    let file = std::fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(root.join(RESERVATION_LOCK))
        .ok()?;
    try_lock_exclusive(&file).then_some(file)
}

pub(super) fn reservation_root_of(copy: &Path) -> Option<PathBuf> {
    (copy.file_name()? == COPY_DIR).then(|| copy.parent().map(Path::to_path_buf))?
}

struct Owner {
    repo: PathBuf,
    admin: Option<PathBuf>,
}

fn read_owner(root: &Path) -> Option<Owner> {
    let owner = std::fs::read_to_string(root.join(RESERVATION_FILE)).ok()?;
    let mut lines = owner.lines();
    if lines.next()? != RESERVATION_HEADER {
        return None;
    }
    let repo = PathBuf::from(lines.next()?.trim());
    let _pid = lines.next();
    let admin = lines
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(PathBuf::from);
    Some(Owner { repo, admin })
}

pub(super) fn owner_repo(root: &Path) -> Option<PathBuf> {
    read_owner(root).map(|owner| owner.repo)
}

pub(super) fn owner_text(repo: &Path, admin: Option<&Path>) -> String {
    format!(
        "{RESERVATION_HEADER}\n{}\n{}\n{}\n",
        repo.to_string_lossy(),
        std::process::id(),
        admin
            .map(|dir| dir.to_string_lossy().to_string())
            .unwrap_or_default()
    )
}

pub(crate) fn is_owned_copy(copy: &Path) -> bool {
    reservation_root_of(copy).is_some_and(|root| owner_repo(&root).is_some())
}

pub(super) fn is_regular_file(path: &Path) -> bool {
    std::fs::symlink_metadata(path).is_ok_and(|meta| meta.file_type().is_file())
}

pub(super) fn is_real_dir(path: &Path) -> bool {
    std::fs::symlink_metadata(path).is_ok_and(|meta| meta.file_type().is_dir())
}

fn is_plain_name(name: &std::ffi::OsStr) -> bool {
    let text = name.to_string_lossy();
    !text.is_empty() && text != "." && text != ".." && !text.contains('/')
}

fn expected_gitdir(root: &Path) -> Option<String> {
    let root = std::fs::canonicalize(root).ok()?;
    Some(
        root.join(COPY_DIR)
            .join(".git")
            .to_string_lossy()
            .to_string(),
    )
}

pub(super) fn created_admin_dir(copy: &Path, repo: &Path) -> Option<PathBuf> {
    let pointer_file = copy.join(".git");
    if !is_regular_file(&pointer_file) {
        return None;
    }
    let pointer = std::fs::read_to_string(&pointer_file).ok()?;
    let named = PathBuf::from(pointer.trim().strip_prefix("gitdir:")?.trim());
    let admin = std::fs::canonicalize(copy.join(named)).ok()?;
    (admin.parent()? == repo.join("worktrees")).then_some(admin)
}

pub(super) fn recorded_admin_dir(root: &Path) -> Option<PathBuf> {
    let owner = read_owner(root)?;
    let recorded = owner.admin?;
    let name = recorded.file_name().filter(|name| is_plain_name(name))?;
    let admin = owner.repo.join("worktrees").join(name);
    if admin != recorded || !is_real_dir(&admin) {
        return None;
    }
    let gitdir_file = admin.join("gitdir");
    if !is_regular_file(&gitdir_file) {
        return None;
    }
    let gitdir = std::fs::read_to_string(&gitdir_file).ok()?;
    (gitdir.trim() == expected_gitdir(root)?).then_some(admin)
}

pub(super) fn remove_reservation(root: &Path, held: Option<std::fs::File>) -> bool {
    if owner_repo(root).is_none() {
        return false;
    }
    let Some(lock) = held.or_else(|| open_lock(root)) else {
        return false;
    };
    let admin = recorded_admin_dir(root);
    let removed = std::fs::remove_dir_all(root).is_ok();
    drop(lock);
    if let Some(admin) = admin.filter(|admin| admin.exists()) {
        let _ = std::fs::remove_dir_all(admin);
    }
    removed
}

pub(crate) fn discard_copy(path: &str) {
    let Some(root) = reservation_root_of(Path::new(path)) else {
        return;
    };
    let held = take_held(&root);
    remove_reservation(&root, held);
}
