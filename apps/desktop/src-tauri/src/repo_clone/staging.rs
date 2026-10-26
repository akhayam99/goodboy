use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};

use super::{CloneError, CloneRegistry};
use crate::util::lock_or_recover;

pub(crate) const MAX_CANCEL_MARKERS: usize = 32;
const MAX_ID_CHARS: usize = 64;

#[derive(Debug, Default)]
pub(crate) struct Admission {
    is_closed: bool,
    generation: u64,
    cancelled: VecDeque<String>,
    staging: HashMap<String, Staged>,
}

impl Admission {
    pub(crate) fn is_cancelled(&self, request_id: &str) -> bool {
        self.is_closed || self.cancelled.iter().any(|known| known == request_id)
    }

    pub(crate) fn mark_cancelled(&mut self, request_id: &str) {
        if self.cancelled.iter().any(|known| known == request_id) {
            return;
        }
        self.cancelled.push_back(request_id.to_string());
        while self.cancelled.len() > MAX_CANCEL_MARKERS {
            self.cancelled.pop_front();
        }
    }

    fn take_cancelled(&mut self, request_id: &str) -> bool {
        let before = self.cancelled.len();
        self.cancelled.retain(|known| known != request_id);
        self.cancelled.len() != before
    }

    #[cfg(test)]
    pub(crate) fn marker_count(&self) -> usize {
        self.cancelled.len()
    }

    #[cfg(test)]
    pub(crate) fn has_staging(&self, request_id: &str) -> bool {
        self.staging.contains_key(request_id)
    }

    pub(crate) fn finish(&mut self, request_id: &str) {
        self.staging.remove(request_id);
        self.take_cancelled(request_id);
    }

    pub(crate) fn close(&mut self) -> Vec<(String, Staged)> {
        self.is_closed = true;
        let staged: Vec<(String, Staged)> = self.staging.drain().collect();
        for (request_id, _) in &staged {
            self.mark_cancelled(request_id);
        }
        staged
    }

    pub(crate) fn reopen(&mut self) {
        self.is_closed = false;
        self.generation += 1;
    }

    pub(crate) fn generation(&self) -> u64 {
        self.generation
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Identity {
    device: u64,
    node: u64,
}

#[cfg(unix)]
fn identity_of(metadata: &std::fs::Metadata) -> Identity {
    use std::os::unix::fs::MetadataExt;
    Identity {
        device: metadata.dev(),
        node: metadata.ino(),
    }
}

#[cfg(not(unix))]
fn identity_of(_metadata: &std::fs::Metadata) -> Identity {
    Identity { device: 0, node: 0 }
}

#[derive(Debug, Clone)]
pub(crate) struct Staged {
    pub(crate) path: PathBuf,
    pub(crate) destination: PathBuf,
    pub(crate) parent: PathBuf,
    pub(crate) identity: Identity,
}

pub(crate) fn is_intact(staged: &Staged) -> bool {
    let Ok(parent) = staged.parent.canonicalize() else {
        return false;
    };
    if parent != staged.parent {
        return false;
    }
    let Ok(metadata) = std::fs::symlink_metadata(&staged.path) else {
        return false;
    };
    metadata.is_dir() && identity_of(&metadata) == staged.identity
}

fn staging_name(destination_name: &str, request_id: &str) -> String {
    let id: String = request_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
        .take(MAX_ID_CHARS)
        .collect();
    format!(".{destination_name}.clone-{id}")
}

pub(crate) fn check_destination(destination: &Path) -> Result<(), CloneError> {
    if !destination.is_absolute() {
        return Err(CloneError::DestinationNotAFolder);
    }
    match std::fs::symlink_metadata(destination) {
        Ok(metadata) if metadata.is_file() => Err(CloneError::DestinationNotAFolder),
        Ok(_) => Err(CloneError::DestinationNotEmpty),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(CloneError::Io(error)),
    }
}

pub(crate) fn admit(
    registry: &CloneRegistry,
    request_id: &str,
    destination: &Path,
    generation: u64,
) -> Result<Staged, CloneError> {
    check_destination(destination)?;
    let name = destination
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(CloneError::DestinationNotAFolder)?;
    let parent = destination
        .parent()
        .ok_or(CloneError::DestinationNotAFolder)?;
    std::fs::create_dir_all(parent)?;
    let parent = parent.canonicalize()?;
    let staging = parent.join(staging_name(name, request_id));
    let mut admission = lock_or_recover(&registry.admission);
    if admission.generation != generation || admission.is_cancelled(request_id) {
        admission.take_cancelled(request_id);
        return Err(CloneError::Cancelled);
    }
    std::fs::create_dir(&staging)?;
    let identity = identity_of(&std::fs::symlink_metadata(&staging)?);
    let staged = Staged {
        path: staging,
        destination: parent.join(name),
        parent,
        identity,
    };
    admission
        .staging
        .insert(request_id.to_string(), staged.clone());
    Ok(staged)
}

fn is_gone(staged: &Staged) -> bool {
    staged.parent.canonicalize().ok().as_ref() == Some(&staged.parent)
        && matches!(
            std::fs::symlink_metadata(&staged.path),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound
        )
}

pub(crate) fn discard_staging(staged: &Staged) -> bool {
    if is_gone(staged) {
        return true;
    }
    if !is_intact(staged) {
        log::warn!("[clone] a staging folder was left in place because its location changed");
        return false;
    }
    std::fs::remove_dir_all(&staged.path).is_ok()
}

pub(crate) struct StagingGuard<'a> {
    registry: &'a CloneRegistry,
    request_id: &'a str,
    staged: &'a Staged,
    is_published: bool,
}

impl<'a> StagingGuard<'a> {
    pub(crate) fn new(
        registry: &'a CloneRegistry,
        request_id: &'a str,
        staged: &'a Staged,
    ) -> Self {
        Self {
            registry,
            request_id,
            staged,
            is_published: false,
        }
    }

    pub(crate) fn mark_published(&mut self) {
        self.is_published = true;
    }
}

impl Drop for StagingGuard<'_> {
    fn drop(&mut self) {
        crate::live_child::kill_one(&self.registry.live, self.request_id);
        lock_or_recover(&self.registry.live).remove(self.request_id);
        if !self.is_published {
            discard_staging(self.staged);
        }
        lock_or_recover(&self.registry.admission).finish(self.request_id);
    }
}
