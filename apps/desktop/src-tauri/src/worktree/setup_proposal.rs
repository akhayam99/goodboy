use super::error::WorktreeError;
use serde::Serialize;
use std::path::Path;

const LOCKFILES: [(&str, &str, &str); 6] = [
    ("pnpm-lock.yaml", "package.json", "pnpm install"),
    ("yarn.lock", "package.json", "yarn install"),
    ("package-lock.json", "package.json", "npm install"),
    ("bun.lock", "package.json", "bun install"),
    ("bun.lockb", "package.json", "bun install"),
    ("composer.lock", "composer.json", "composer install"),
];

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SetupProposal {
    pub command: String,
    pub source: String,
}

pub(super) fn setup_proposal_blocking(
    repo_path: String,
) -> Result<Option<SetupProposal>, WorktreeError> {
    let repo = Path::new(&repo_path);
    if !repo.is_dir() {
        return Err(WorktreeError::RepoNotFound(repo_path));
    }
    Ok(LOCKFILES
        .iter()
        .find(|(lockfile, manifest, _)| {
            repo.join(lockfile).is_file() && repo.join(manifest).is_file()
        })
        .map(|(lockfile, _, command)| SetupProposal {
            command: (*command).to_string(),
            source: (*lockfile).to_string(),
        }))
}

#[tauri::command]
pub async fn worktree_setup_proposal(
    repo_path: String,
) -> Result<Option<SetupProposal>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || setup_proposal_blocking(repo_path))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn folder(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-setup-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|elapsed| elapsed.as_nanos())
                .unwrap_or_default()
        ));
        std::fs::create_dir_all(&dir).expect("dir");
        dir
    }

    fn proposal(dir: &Path) -> Option<SetupProposal> {
        setup_proposal_blocking(dir.to_string_lossy().into_owned()).expect("ok")
    }

    #[test]
    fn a_lockfile_with_its_manifest_proposes_its_own_install() {
        for (lockfile, manifest, command) in LOCKFILES {
            let dir = folder("lock");
            std::fs::write(dir.join(lockfile), "x").expect("write");
            std::fs::write(dir.join(manifest), "{}").expect("write");

            let found = proposal(&dir).expect("a proposal");

            assert_eq!(found.command, command);
            assert_eq!(found.source, lockfile);
            std::fs::remove_dir_all(&dir).expect("cleanup");
        }
    }

    #[test]
    fn the_first_package_manager_wins_and_nothing_is_proposed_without_a_pair() {
        let dir = folder("both");
        std::fs::write(dir.join("package.json"), "{}").expect("write");
        std::fs::write(dir.join("yarn.lock"), "x").expect("write");
        std::fs::write(dir.join("package-lock.json"), "x").expect("write");
        assert_eq!(proposal(&dir).expect("a proposal").command, "yarn install");
        std::fs::remove_dir_all(&dir).expect("cleanup");

        let lone = folder("lone");
        std::fs::write(lone.join("pnpm-lock.yaml"), "x").expect("write");
        assert!(proposal(&lone).is_none());
        std::fs::remove_dir_all(&lone).expect("cleanup");
    }

    #[test]
    fn a_missing_folder_is_an_error() {
        assert!(setup_proposal_blocking("/no/such/repo".to_string()).is_err());
    }
}
