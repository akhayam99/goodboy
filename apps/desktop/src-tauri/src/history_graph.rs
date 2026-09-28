use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::branch_remote::{branch_remote, ConfiguredUpstream};
use crate::worktree::{git, resolve_base, resolve_upstream, GitDistance, WorktreeError};

const MAIN_COMMIT_LIMIT: usize = 50;
const COMMIT_FORMAT: &str = "--format=%H%x1f%s%x1f%an%x1f%ct";

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphCommit {
    pub sha: String,
    pub subject: String,
    pub author: String,
    pub timestamp: i64,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommitFiles {
    pub sha: String,
    pub files: Vec<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryGraph {
    pub base_ref: String,
    pub merge_base: GraphCommit,
    pub main_head: String,
    pub main_commits: Vec<GraphCommit>,
    pub behind: u32,
    pub remote_sha: Option<String>,
    pub files: Vec<CommitFiles>,
}

fn parse_commit(line: &str) -> Option<GraphCommit> {
    let mut parts = line.splitn(4, '\u{1f}');
    let sha = parts.next()?.trim().to_string();
    if sha.is_empty() {
        return None;
    }
    Some(GraphCommit {
        sha,
        subject: parts.next().unwrap_or_default().to_string(),
        author: parts.next().unwrap_or_default().to_string(),
        timestamp: parts
            .next()
            .unwrap_or_default()
            .trim()
            .parse::<i64>()
            .unwrap_or_default(),
    })
}

fn remote_sha_of(cwd: &Path, branch: &str) -> Option<String> {
    let configured = resolve_upstream(cwd);
    let remote = branch_remote(
        cwd,
        Some(branch),
        configured.as_deref().map(|name| ConfiguredUpstream {
            name,
            distance: None,
        }),
    );
    let tracking = match remote.distance {
        GitDistance::Known { .. } => remote.tracking?,
        GitDistance::Unknown { .. } => return None,
    };
    git(
        cwd,
        &[
            "rev-parse",
            "--verify",
            "--quiet",
            &format!("refs/remotes/{tracking}"),
        ],
    )
    .ok()
    .map(|raw| raw.trim().to_string())
    .filter(|sha| !sha.is_empty())
}

fn files_per_commit(cwd: &Path, range: &str) -> Vec<CommitFiles> {
    let Ok(raw) = git(cwd, &["log", "--format=%x1e%H", "--name-only", range]) else {
        return Vec::new();
    };
    raw.split('\u{1e}')
        .filter_map(|record| {
            let mut lines = record
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty());
            let sha = lines.next()?.to_string();
            Some(CommitFiles {
                sha,
                files: lines.map(str::to_string).collect(),
            })
        })
        .collect()
}

pub(crate) fn history_graph_of(
    cwd: &Path,
    base_branch: &str,
    branch: &str,
) -> Result<HistoryGraph, WorktreeError> {
    let configured = Some(base_branch.trim()).filter(|name| !name.is_empty());
    let (base_ref, merge_base) =
        resolve_base(cwd, configured).ok_or_else(|| WorktreeError::Git {
            message: format!(
                "Couldn't find where this branch left {}",
                configured.unwrap_or("main")
            ),
        })?;
    let main_head = git(cwd, &["rev-parse", &base_ref])?.trim().to_string();
    let main_range = format!("{merge_base}..{main_head}");
    let behind = git(cwd, &["rev-list", "--count", "--first-parent", &main_range])?
        .trim()
        .parse::<u32>()
        .unwrap_or_default();
    let limit = format!("-n{MAIN_COMMIT_LIMIT}");
    let main_commits = git(
        cwd,
        &["log", "--first-parent", &limit, COMMIT_FORMAT, &main_range],
    )?
    .lines()
    .filter_map(parse_commit)
    .collect();
    let fork = git(cwd, &["show", "-s", COMMIT_FORMAT, &merge_base])?;
    let merge_base_commit =
        fork.lines()
            .find_map(parse_commit)
            .ok_or_else(|| WorktreeError::Git {
                message: "Couldn't read the commit your branch starts from".to_string(),
            })?;
    Ok(HistoryGraph {
        base_ref,
        merge_base: merge_base_commit,
        main_head,
        main_commits,
        behind,
        remote_sha: remote_sha_of(cwd, branch),
        files: files_per_commit(cwd, &format!("{merge_base}..HEAD")),
    })
}

#[tauri::command]
pub async fn history_graph(
    worktree_path: String,
    base_branch: String,
    branch: String,
) -> Result<HistoryGraph, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(worktree_path));
        }
        history_graph_of(&cwd, &base_branch, &branch)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn git_ok(cwd: &Path, args: &[&str]) -> String {
        git(cwd, args)
            .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
            .trim()
            .to_string()
    }

    fn commit(root: &Path, file: &str, body: &str, message: &str) -> String {
        std::fs::write(root.join(file), body).unwrap();
        git_ok(root, &["add", file]);
        git_ok(root, &["commit", "--no-verify", "-q", "-m", message]);
        git_ok(root, &["rev-parse", "HEAD"])
    }

    fn repo(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-graph-test-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|elapsed| elapsed.as_nanos())
                .unwrap_or_default()
        ));
        std::fs::create_dir_all(&root).unwrap();
        git_ok(&root, &["init", "-q", "-b", "main"]);
        git_ok(&root, &["config", "user.email", "lena@harborline.test"]);
        git_ok(&root, &["config", "user.name", "Lena Arkwright"]);
        git_ok(&root, &["config", "commit.gpgsign", "false"]);
        root
    }

    #[test]
    fn the_graph_names_the_fork_what_main_gained_and_the_files_of_each_commit() {
        let root = repo("fork");
        let fork = commit(&root, "ledger.ts", "one\n", "Release 2.14");
        git_ok(&root, &["checkout", "-q", "-b", "hl/ledger-export"]);
        let export = commit(&root, "export.ts", "export\n", "Add ledger export endpoint");
        let batch = commit(
            &root,
            "batch.ts",
            "batch\n",
            "Stream rows in batches of 500",
        );
        git_ok(&root, &["checkout", "-q", "main"]);
        commit(&root, "keys.ts", "keys\n", "Rotate Acme sandbox keys");
        let newest = commit(&root, "rounding.ts", "round\n", "Cascadia rounding rules");
        git_ok(&root, &["checkout", "-q", "hl/ledger-export"]);

        let graph = history_graph_of(&root, "main", "hl/ledger-export").unwrap();

        assert_eq!(graph.merge_base.sha, fork);
        assert_eq!(graph.merge_base.subject, "Release 2.14");
        assert_eq!(graph.main_head, newest);
        assert_eq!(graph.behind, 2);
        assert_eq!(
            graph
                .main_commits
                .iter()
                .map(|commit| commit.subject.as_str())
                .collect::<Vec<_>>(),
            vec!["Cascadia rounding rules", "Rotate Acme sandbox keys"]
        );
        assert_eq!(graph.remote_sha, None);
        assert_eq!(
            graph.files,
            vec![
                CommitFiles {
                    sha: batch,
                    files: vec!["batch.ts".to_string()],
                },
                CommitFiles {
                    sha: export,
                    files: vec!["export.ts".to_string()],
                },
            ]
        );
    }

    #[test]
    fn the_graph_reads_the_online_copy_from_the_branch_own_remote_ref() {
        let root = repo("remote");
        commit(&root, "ledger.ts", "one\n", "Release 2.14");
        let remote = root.join("remote.git");
        git_ok(&root, &["init", "-q", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git_ok(&root, &["push", "-q", "origin", "main"]);
        git_ok(&root, &["fetch", "-q", "origin"]);
        git_ok(&root, &["checkout", "-q", "-b", "hl/ledger-export"]);
        let pushed = commit(&root, "export.ts", "export\n", "Add ledger export endpoint");
        git_ok(&root, &["push", "-q", "-u", "origin", "hl/ledger-export"]);
        commit(
            &root,
            "batch.ts",
            "batch\n",
            "Stream rows in batches of 500",
        );

        let graph = history_graph_of(&root, "main", "hl/ledger-export").unwrap();

        assert_eq!(graph.remote_sha, Some(pushed));
        assert_eq!(graph.base_ref, "origin/main");
        assert_eq!(graph.behind, 0);
    }
}
