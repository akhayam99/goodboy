use std::path::Path;

use crate::worktree::git;

pub(crate) const REMOTE_NAME: &str = "origin";

pub(crate) fn resolve(root: &Path) -> Option<String> {
    git(root, &["remote", "get-url", REMOTE_NAME])
        .ok()
        .filter(|url| !url.trim().is_empty())
        .map(|_| REMOTE_NAME.to_string())
}

pub(crate) fn lease_ref(branch: &str) -> String {
    format!("refs/heads/{branch}")
}

#[cfg(test)]
mod tests {
    use super::{lease_ref, resolve, REMOTE_NAME};
    use crate::worktree::git;
    use std::path::{Path, PathBuf};

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-remote-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        root
    }

    fn git_ok(cwd: &Path, args: &[&str]) -> String {
        git(cwd, args)
            .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
            .trim()
            .to_string()
    }

    fn repo(name: &str) -> PathBuf {
        let root = temp_root(name);
        git_ok(&root, &["init", "-b", "main"]);
        root
    }

    #[test]
    fn a_repository_without_remotes_has_none() {
        let root = repo("none");

        assert_eq!(resolve(&root), None);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn origin_is_the_remote_whatever_else_is_configured() {
        let root = repo("origin");
        git_ok(
            &root,
            &[
                "remote",
                "add",
                "upstream",
                "https://harborline.test/up.git",
            ],
        );
        git_ok(
            &root,
            &[
                "remote",
                "add",
                "origin",
                "https://harborline.test/ledger-core.git",
            ],
        );

        assert_eq!(resolve(&root).as_deref(), Some(REMOTE_NAME));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_remote_named_upstream_alone_is_not_a_remote() {
        let root = repo("upstream-only");
        git_ok(
            &root,
            &[
                "remote",
                "add",
                "upstream",
                "https://harborline.test/up.git",
            ],
        );

        assert_eq!(resolve(&root), None);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_lease_ref_is_the_qualified_branch_ref() {
        assert_eq!(lease_ref("goodboy/fx-rates"), "refs/heads/goodboy/fx-rates");
    }
}
