use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::worktree::{git, in_progress_operation, WorktreeError};

const SETUP_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const SETUP_POLL: Duration = Duration::from_millis(100);
const OUTPUT_TAIL_BYTES: usize = 16 * 1024;
const MAX_WALKED_ENTRIES: usize = 2_000_000;
const LISTED_PATHS: usize = 5;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum CheckoutCleanliness {
    Clean {
        #[serde(rename = "headSha")]
        head_sha: String,
    },
    Dirty {
        #[serde(rename = "headSha")]
        head_sha: String,
        staged: u32,
        unstaged: u32,
        unmerged: u32,
        untracked: u32,
    },
    Unknown {
        reason: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckoutBaseline {
    pub head_sha: String,
    pub tree_sha: String,
    pub status_digest: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PreparationOutcome {
    Succeeded,
    Failed,
    SourceChanged,
    SharedDependencies,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckoutPreparation {
    pub outcome: PreparationOutcome,
    pub exit_code: Option<i32>,
    pub output: String,
    pub baseline: Option<CheckoutBaseline>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareCheckoutArgs {
    pub worktree_path: String,
    pub repo_root: String,
    pub command: Option<String>,
    pub expected_head_sha: String,
    #[serde(default)]
    pub sibling_roots: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteScopeArgs {
    pub repo_path: String,
    #[serde(default)]
    pub files: Vec<String>,
    #[serde(default)]
    pub directories: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct WriteScopeViolation {
    pub path: String,
    pub reason: String,
}

#[derive(Default)]
struct StatusCounts {
    staged: u32,
    unstaged: u32,
    unmerged: u32,
    untracked: u32,
    tracked_paths: Vec<String>,
    untracked_paths: Vec<String>,
}

impl StatusCounts {
    fn is_clean(&self) -> bool {
        self.staged == 0 && self.unstaged == 0 && self.unmerged == 0 && self.untracked == 0
    }
}

fn parse_status(raw: &str) -> StatusCounts {
    let mut counts = StatusCounts::default();
    for line in raw.lines() {
        let mut fields = line.splitn(2, ' ');
        let kind = fields.next().unwrap_or("");
        let rest = fields.next().unwrap_or("");
        match kind {
            "1" | "2" => {
                let xy = rest.get(0..2).unwrap_or("..");
                let mut chars = xy.chars();
                let staged = chars.next().unwrap_or('.');
                let unstaged = chars.next().unwrap_or('.');
                if staged != '.' {
                    counts.staged += 1;
                }
                if unstaged != '.' {
                    counts.unstaged += 1;
                }
                let path = match kind {
                    "2" => rest
                        .splitn(9, ' ')
                        .nth(8)
                        .and_then(|tail| tail.split('\t').next()),
                    _ => rest.splitn(8, ' ').nth(7),
                };
                if let Some(path) = path {
                    counts.tracked_paths.push(path.to_string());
                }
            }
            "u" => {
                counts.unmerged += 1;
                if let Some(path) = rest.splitn(10, ' ').nth(9) {
                    counts.tracked_paths.push(path.to_string());
                }
            }
            "?" => {
                counts.untracked += 1;
                counts.untracked_paths.push(rest.to_string());
            }
            _ => {}
        }
    }
    counts
}

fn status_of(cwd: &Path) -> Result<(String, StatusCounts), WorktreeError> {
    let raw = git(cwd, &["status", "--porcelain=v2", "--untracked-files=all"])?;
    let counts = parse_status(&raw);
    Ok((raw, counts))
}

fn head_of(cwd: &Path) -> Result<String, WorktreeError> {
    git(cwd, &["rev-parse", "--verify", "HEAD^{commit}"]).map(|out| out.trim().to_string())
}

pub fn checkout_cleanliness(path: &Path) -> CheckoutCleanliness {
    if !path.is_dir() {
        return CheckoutCleanliness::Unknown {
            reason: format!("{} is not a directory", path.to_string_lossy()),
        };
    }
    if let Some(operation) = in_progress_operation(path) {
        return CheckoutCleanliness::Unknown {
            reason: format!("a git {operation:?} is in progress").to_lowercase(),
        };
    }
    let head_sha = match head_of(path) {
        Ok(sha) => sha,
        Err(error) => {
            return CheckoutCleanliness::Unknown {
                reason: error.to_string(),
            }
        }
    };
    let counts = match status_of(path) {
        Ok((_, counts)) => counts,
        Err(error) => {
            return CheckoutCleanliness::Unknown {
                reason: error.to_string(),
            }
        }
    };
    match counts.is_clean() {
        true => CheckoutCleanliness::Clean { head_sha },
        false => CheckoutCleanliness::Dirty {
            head_sha,
            staged: counts.staged,
            unstaged: counts.unstaged,
            unmerged: counts.unmerged,
            untracked: counts.untracked,
        },
    }
}

fn digest(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn tail(raw: &[u8]) -> String {
    let start = raw.len().saturating_sub(OUTPUT_TAIL_BYTES);
    String::from_utf8_lossy(&raw[start..]).into_owned()
}

fn listed(paths: &[String]) -> String {
    let mut shown: Vec<&str> = paths
        .iter()
        .take(LISTED_PATHS)
        .map(String::as_str)
        .collect();
    if paths.len() > LISTED_PATHS {
        shown.push("...");
    }
    shown.join(", ")
}

struct SetupRun {
    exit_code: Option<i32>,
    output: String,
    failure: Option<String>,
}

fn run_setup(worktree: &Path, command: &str, timeout: Duration) -> SetupRun {
    let log_path = std::env::temp_dir().join(format!(
        "goodboy-setup-{}-{}.log",
        std::process::id(),
        crate::util::now_ms()
    ));
    let log = match std::fs::File::create(&log_path) {
        Ok(file) => file,
        Err(error) => {
            return SetupRun {
                exit_code: None,
                output: String::new(),
                failure: Some(format!("could not capture setup output: {error}")),
            }
        }
    };
    let log_err = match log.try_clone() {
        Ok(file) => file,
        Err(error) => {
            return SetupRun {
                exit_code: None,
                output: String::new(),
                failure: Some(format!("could not capture setup output: {error}")),
            }
        }
    };
    let shell = crate::path_env::login_shell();
    let spawned = crate::path_env::command_with_login_env(&shell)
        .args(["-c", command])
        .current_dir(worktree)
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_err))
        .spawn();
    let mut child = match spawned {
        Ok(child) => child,
        Err(error) => {
            let _ = std::fs::remove_file(&log_path);
            return SetupRun {
                exit_code: None,
                output: String::new(),
                failure: Some(format!("setup could not start: {error}")),
            };
        }
    };
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) if started.elapsed() >= timeout => {
                let _ = child.kill();
                let _ = child.wait();
                break Err(format!(
                    "setup ran longer than {} seconds",
                    timeout.as_secs()
                ));
            }
            Ok(None) => std::thread::sleep(SETUP_POLL),
            Err(error) => break Err(format!("setup could not be observed: {error}")),
        }
    };
    let mut captured = Vec::new();
    if let Ok(mut file) = std::fs::File::open(&log_path) {
        let _ = file.read_to_end(&mut captured);
    }
    let _ = std::fs::remove_file(&log_path);
    let output = tail(&captured);
    match status {
        Err(reason) => SetupRun {
            exit_code: None,
            output,
            failure: Some(reason),
        },
        Ok(status) if status.success() => SetupRun {
            exit_code: status.code(),
            output,
            failure: None,
        },
        Ok(status) => SetupRun {
            exit_code: status.code(),
            output,
            failure: Some(match status.code() {
                Some(code) => format!("setup exited with status {code}"),
                None => "setup was terminated by a signal".to_string(),
            }),
        },
    }
}

fn lexical_absolute(base: &Path, target: &Path) -> PathBuf {
    let joined = match target.is_absolute() {
        true => target.to_path_buf(),
        false => base.join(target),
    };
    let mut resolved = PathBuf::new();
    for component in joined.components() {
        match component {
            Component::ParentDir => {
                resolved.pop();
            }
            Component::CurDir => {}
            other => resolved.push(other.as_os_str()),
        }
    }
    resolved
}

fn resolve_link(link: &Path) -> Option<PathBuf> {
    if let Ok(canonical) = std::fs::canonicalize(link) {
        return Some(canonical);
    }
    let target = std::fs::read_link(link).ok()?;
    let parent = link.parent()?;
    let parent = std::fs::canonicalize(parent).unwrap_or_else(|_| parent.to_path_buf());
    Some(lexical_absolute(&parent, &target))
}

enum IsolationVerdict {
    Isolated,
    Shared(Vec<String>),
    Unverified(String),
}

fn dependency_isolation(
    worktree: &Path,
    repo_root: &Path,
    sibling_roots: &[PathBuf],
) -> IsolationVerdict {
    let own = std::fs::canonicalize(worktree).unwrap_or_else(|_| worktree.to_path_buf());
    let mut foreign: Vec<PathBuf> =
        vec![std::fs::canonicalize(repo_root).unwrap_or_else(|_| repo_root.to_path_buf())];
    for sibling in sibling_roots {
        foreign.push(std::fs::canonicalize(sibling).unwrap_or_else(|_| sibling.clone()));
    }
    let mut shared: Vec<String> = Vec::new();
    let mut pending: Vec<PathBuf> = vec![own.clone()];
    let mut walked: usize = 0;
    while let Some(dir) = pending.pop() {
        let entries = match std::fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(error) => {
                return IsolationVerdict::Unverified(format!(
                    "could not read {}: {error}",
                    dir.to_string_lossy()
                ))
            }
        };
        for entry in entries.flatten() {
            walked += 1;
            if walked > MAX_WALKED_ENTRIES {
                return IsolationVerdict::Unverified(
                    "the checkout holds too many files to verify dependency isolation".to_string(),
                );
            }
            let path = entry.path();
            if dir == own && entry.file_name() == ".git" {
                continue;
            }
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_dir() {
                pending.push(path);
                continue;
            }
            if !file_type.is_symlink() {
                continue;
            }
            let Some(target) = resolve_link(&path) else {
                continue;
            };
            if target.starts_with(&own) {
                continue;
            }
            if foreign.iter().any(|root| target.starts_with(root)) {
                let relative = path
                    .strip_prefix(&own)
                    .map(|rel| rel.to_string_lossy().into_owned())
                    .unwrap_or_else(|_| path.to_string_lossy().into_owned());
                shared.push(relative);
            }
        }
    }
    match shared.is_empty() {
        true => IsolationVerdict::Isolated,
        false => {
            shared.sort();
            IsolationVerdict::Shared(shared)
        }
    }
}

fn prepared(
    outcome: PreparationOutcome,
    run: &SetupRun,
    baseline: Option<CheckoutBaseline>,
    reason: Option<String>,
) -> CheckoutPreparation {
    CheckoutPreparation {
        outcome,
        exit_code: run.exit_code,
        output: run.output.clone(),
        baseline,
        reason,
    }
}

pub fn prepare_checkout(args: &PrepareCheckoutArgs, timeout: Duration) -> CheckoutPreparation {
    let worktree = PathBuf::from(&args.worktree_path);
    let repo_root = PathBuf::from(&args.repo_root);
    let idle = SetupRun {
        exit_code: None,
        output: String::new(),
        failure: None,
    };
    match checkout_cleanliness(&worktree) {
        CheckoutCleanliness::Clean { head_sha } if head_sha == args.expected_head_sha => {}
        CheckoutCleanliness::Clean { head_sha } => {
            return prepared(
                PreparationOutcome::Failed,
                &idle,
                None,
                Some(format!(
                    "the private checkout is at {head_sha}, not the pinned base {}",
                    args.expected_head_sha
                )),
            )
        }
        CheckoutCleanliness::Dirty { .. } => {
            return prepared(
                PreparationOutcome::Failed,
                &idle,
                None,
                Some("the private checkout was not clean before setup ran".to_string()),
            )
        }
        CheckoutCleanliness::Unknown { reason } => {
            return prepared(
                PreparationOutcome::Failed,
                &idle,
                None,
                Some(format!(
                    "the private checkout status could not be read: {reason}"
                )),
            )
        }
    }
    let command = args
        .command
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let run = match command {
        Some(command) => run_setup(&worktree, command, timeout),
        None => idle,
    };
    if let Some(failure) = run.failure.clone() {
        return prepared(PreparationOutcome::Failed, &run, None, Some(failure));
    }
    let head_sha = match head_of(&worktree) {
        Ok(sha) => sha,
        Err(error) => {
            return prepared(
                PreparationOutcome::Failed,
                &run,
                None,
                Some(format!(
                    "the private checkout head could not be read: {error}"
                )),
            )
        }
    };
    if head_sha != args.expected_head_sha {
        return prepared(
            PreparationOutcome::SourceChanged,
            &run,
            None,
            Some(format!("setup moved the checkout head to {head_sha}")),
        );
    }
    let (raw_status, counts) = match status_of(&worktree) {
        Ok(status) => status,
        Err(error) => {
            return prepared(
                PreparationOutcome::Failed,
                &run,
                None,
                Some(format!(
                    "the private checkout status could not be read: {error}"
                )),
            )
        }
    };
    if !counts.tracked_paths.is_empty() {
        return prepared(
            PreparationOutcome::SourceChanged,
            &run,
            None,
            Some(format!(
                "setup modified tracked files: {}",
                listed(&counts.tracked_paths)
            )),
        );
    }
    if !counts.untracked_paths.is_empty() {
        return prepared(
            PreparationOutcome::SourceChanged,
            &run,
            None,
            Some(format!(
                "setup left files git does not ignore: {}",
                listed(&counts.untracked_paths)
            )),
        );
    }
    let siblings: Vec<PathBuf> = args.sibling_roots.iter().map(PathBuf::from).collect();
    match dependency_isolation(&worktree, &repo_root, &siblings) {
        IsolationVerdict::Isolated => {}
        IsolationVerdict::Shared(paths) => {
            return prepared(
                PreparationOutcome::SharedDependencies,
                &run,
                None,
                Some(format!(
                    "setup linked dependencies into another checkout: {}",
                    listed(&paths)
                )),
            )
        }
        IsolationVerdict::Unverified(reason) => {
            return prepared(PreparationOutcome::Failed, &run, None, Some(reason))
        }
    }
    let tree_sha = match git(&worktree, &["rev-parse", "HEAD^{tree}"]) {
        Ok(sha) => sha.trim().to_string(),
        Err(error) => {
            return prepared(
                PreparationOutcome::Failed,
                &run,
                None,
                Some(format!("the checkout tree could not be read: {error}")),
            )
        }
    };
    let baseline = CheckoutBaseline {
        head_sha,
        tree_sha,
        status_digest: digest(&raw_status),
    };
    prepared(PreparationOutcome::Succeeded, &run, Some(baseline), None)
}

fn is_reserved(relative: &Path) -> bool {
    let Some(first) = relative.components().next() else {
        return false;
    };
    let name = first.as_os_str().to_string_lossy().to_lowercase();
    name == ".git" || name == ".goodboy"
}

fn scope_violation(
    root: &Path,
    canonical_root: &Path,
    entry: &str,
    is_file: bool,
) -> Option<String> {
    let relative = Path::new(entry);
    if relative.is_absolute()
        || relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Some("is not a plain path inside the repository".to_string());
    }
    if is_reserved(relative) {
        return Some("reaches into reserved repository storage".to_string());
    }
    let mut cursor = root.to_path_buf();
    for component in relative.components() {
        cursor.push(component.as_os_str());
        let Ok(metadata) = std::fs::symlink_metadata(&cursor) else {
            return None;
        };
        if metadata.file_type().is_symlink() {
            let Some(target) = resolve_link(&cursor) else {
                return Some("passes through a symlink that cannot be resolved".to_string());
            };
            if !target.starts_with(canonical_root) {
                return Some("resolves outside the repository through a symlink".to_string());
            }
            let inside = target.strip_prefix(canonical_root).unwrap_or(&target);
            if is_reserved(inside) {
                return Some(
                    "resolves into reserved repository storage through a symlink".to_string(),
                );
            }
        }
    }
    let Ok(metadata) = std::fs::metadata(&cursor) else {
        return None;
    };
    match (is_file, metadata.is_dir()) {
        (true, true) => Some("names a directory, not a file".to_string()),
        (false, false) => Some("names a file, not a directory".to_string()),
        _ => None,
    }
}

pub fn validate_write_scope(
    args: &WriteScopeArgs,
) -> Result<Vec<WriteScopeViolation>, WorktreeError> {
    let root = PathBuf::from(&args.repo_path);
    let canonical_root = std::fs::canonicalize(&root)?;
    let mut violations: Vec<WriteScopeViolation> = Vec::new();
    let entries = args
        .files
        .iter()
        .map(|entry| (entry, true))
        .chain(args.directories.iter().map(|entry| (entry, false)));
    for (entry, is_file) in entries {
        if let Some(reason) = scope_violation(&root, &canonical_root, entry, is_file) {
            violations.push(WriteScopeViolation {
                path: entry.clone(),
                reason,
            });
        }
    }
    Ok(violations)
}

#[tauri::command]
pub async fn worktree_checkout_cleanliness(path: String) -> CheckoutCleanliness {
    tauri::async_runtime::spawn_blocking(move || checkout_cleanliness(Path::new(&path)))
        .await
        .unwrap_or_else(|error| CheckoutCleanliness::Unknown {
            reason: error.to_string(),
        })
}

#[tauri::command]
pub async fn worktree_prepare_checkout(
    args: PrepareCheckoutArgs,
) -> Result<CheckoutPreparation, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || prepare_checkout(&args, SETUP_TIMEOUT))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))
}

#[tauri::command]
pub async fn worktree_validate_write_scope(
    args: WriteScopeArgs,
) -> Result<Vec<WriteScopeViolation>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || validate_write_scope(&args))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-attempt-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::canonicalize(&root).unwrap()
    }

    fn git_ok(cwd: &Path, args: &[&str]) -> String {
        git(cwd, args)
            .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
            .trim()
            .to_string()
    }

    fn init_repo(name: &str) -> PathBuf {
        let root = temp_root(name);
        git_ok(&root, &["init", "-b", "main"]);
        git_ok(&root, &["config", "user.email", "test@example.com"]);
        git_ok(&root, &["config", "user.name", "test"]);
        git_ok(&root, &["config", "commit.gpgsign", "false"]);
        std::fs::write(
            root.join(".gitignore"),
            "node_modules/\n.cache/\n.goodboy/\n",
        )
        .unwrap();
        std::fs::write(root.join("package.json"), "{}\n").unwrap();
        std::fs::write(root.join("pnpm-lock.yaml"), "lockfileVersion: 9\n").unwrap();
        git_ok(&root, &["add", "."]);
        git_ok(&root, &["commit", "--no-verify", "-m", "base"]);
        root
    }

    fn add_checkout(root: &Path, name: &str) -> PathBuf {
        let path = root.join(".goodboy/worktrees").join(name);
        git_ok(
            root,
            &[
                "worktree",
                "add",
                "-b",
                &format!("attempt/{name}"),
                path.to_string_lossy().as_ref(),
                "HEAD",
            ],
        );
        path
    }

    fn prepare(root: &Path, checkout: &Path, command: Option<&str>) -> CheckoutPreparation {
        prepare_checkout(
            &PrepareCheckoutArgs {
                worktree_path: checkout.to_string_lossy().into_owned(),
                repo_root: root.to_string_lossy().into_owned(),
                command: command.map(str::to_string),
                expected_head_sha: git_ok(checkout, &["rev-parse", "HEAD"]),
                sibling_roots: Vec::new(),
            },
            Duration::from_secs(60),
        )
    }

    #[test]
    fn a_clean_checkout_reports_its_head() {
        let root = init_repo("clean");
        let head = git_ok(&root, &["rev-parse", "HEAD"]);
        assert_eq!(
            checkout_cleanliness(&root),
            CheckoutCleanliness::Clean { head_sha: head }
        );
    }

    #[test]
    fn ignored_files_do_not_make_a_checkout_dirty() {
        let root = init_repo("ignored");
        std::fs::create_dir_all(root.join("node_modules/dep")).unwrap();
        std::fs::write(root.join("node_modules/dep/index.js"), "x").unwrap();
        assert!(matches!(
            checkout_cleanliness(&root),
            CheckoutCleanliness::Clean { .. }
        ));
    }

    #[test]
    fn tracked_and_untracked_changes_make_a_checkout_dirty() {
        let root = init_repo("dirty");
        std::fs::write(root.join("package.json"), "{\"changed\":true}\n").unwrap();
        std::fs::write(root.join("notes.txt"), "draft").unwrap();
        std::fs::write(root.join("staged.txt"), "staged").unwrap();
        git_ok(&root, &["add", "staged.txt"]);
        match checkout_cleanliness(&root) {
            CheckoutCleanliness::Dirty {
                staged,
                unstaged,
                untracked,
                unmerged,
                ..
            } => {
                assert_eq!((staged, unstaged, untracked, unmerged), (1, 1, 1, 0));
            }
            other => panic!("expected dirty, got {other:?}"),
        }
    }

    #[test]
    fn an_untracked_file_alone_makes_a_checkout_dirty() {
        let root = init_repo("untracked");
        std::fs::write(root.join("scratch.md"), "draft").unwrap();
        assert!(matches!(
            checkout_cleanliness(&root),
            CheckoutCleanliness::Dirty { untracked: 1, .. }
        ));
    }

    #[test]
    fn an_unreadable_status_is_unknown() {
        let root = temp_root("not-a-repo");
        assert!(matches!(
            checkout_cleanliness(&root),
            CheckoutCleanliness::Unknown { .. }
        ));
        assert!(matches!(
            checkout_cleanliness(&root.join("missing")),
            CheckoutCleanliness::Unknown { .. }
        ));
    }

    #[test]
    fn an_explicit_no_op_setup_records_a_baseline() {
        let root = init_repo("noop");
        let checkout = add_checkout(&root, "one");
        let prepared = prepare(&root, &checkout, None);
        assert_eq!(prepared.outcome, PreparationOutcome::Succeeded);
        let baseline = prepared.baseline.expect("baseline");
        assert_eq!(baseline.head_sha, git_ok(&checkout, &["rev-parse", "HEAD"]));
        assert_eq!(
            baseline.tree_sha,
            git_ok(&checkout, &["rev-parse", "HEAD^{tree}"])
        );
    }

    #[test]
    fn a_failing_setup_is_recorded_with_its_status_and_output() {
        let root = init_repo("failing");
        let checkout = add_checkout(&root, "one");
        let prepared = prepare(&root, &checkout, Some("echo resolving; exit 3"));
        assert_eq!(prepared.outcome, PreparationOutcome::Failed);
        assert_eq!(prepared.exit_code, Some(3));
        assert!(prepared.output.contains("resolving"));
        assert!(prepared.baseline.is_none());
        assert!(prepared.reason.unwrap_or_default().contains("status 3"));
    }

    #[test]
    fn a_setup_that_rewrites_the_lockfile_changes_source() {
        let root = init_repo("lockfile");
        let checkout = add_checkout(&root, "one");
        let prepared = prepare(
            &root,
            &checkout,
            Some("echo 'lockfileVersion: 10' > pnpm-lock.yaml"),
        );
        assert_eq!(prepared.outcome, PreparationOutcome::SourceChanged);
        assert!(prepared
            .reason
            .unwrap_or_default()
            .contains("pnpm-lock.yaml"));
    }

    #[test]
    fn a_setup_that_leaves_unignored_files_changes_source() {
        let root = init_repo("unignored");
        let checkout = add_checkout(&root, "one");
        let prepared = prepare(&root, &checkout, Some("echo generated > generated.ts"));
        assert_eq!(prepared.outcome, PreparationOutcome::SourceChanged);
        assert!(prepared.reason.unwrap_or_default().contains("generated.ts"));
    }

    #[test]
    fn a_setup_that_moves_head_changes_source() {
        let root = init_repo("moved-head");
        let checkout = add_checkout(&root, "one");
        let prepared = prepare(
            &root,
            &checkout,
            Some("git -c commit.gpgsign=false commit --allow-empty --no-verify -m moved"),
        );
        assert_eq!(prepared.outcome, PreparationOutcome::SourceChanged);
    }

    #[test]
    fn two_prepared_checkouts_keep_private_dependencies_and_caches() {
        let root = init_repo("isolation");
        let first = add_checkout(&root, "one");
        let second = add_checkout(&root, "two");
        let setup = "mkdir -p node_modules/dep .cache && echo \"$PWD\" > node_modules/dep/owner && echo warm > .cache/state";
        assert_eq!(
            prepare(&root, &first, Some(setup)).outcome,
            PreparationOutcome::Succeeded
        );
        assert_eq!(
            prepare(&root, &second, Some(setup)).outcome,
            PreparationOutcome::Succeeded
        );
        std::fs::write(first.join(".cache/state"), "mutated by the first attempt").unwrap();
        std::fs::write(first.join("node_modules/dep/owner"), "mutated").unwrap();
        assert_eq!(
            std::fs::read_to_string(second.join(".cache/state")).unwrap(),
            "warm\n"
        );
        assert_eq!(
            std::fs::read_to_string(second.join("node_modules/dep/owner"))
                .unwrap()
                .trim(),
            second.to_string_lossy()
        );
        assert!(!std::fs::symlink_metadata(second.join("node_modules"))
            .unwrap()
            .file_type()
            .is_symlink());
    }

    #[test]
    fn a_setup_that_links_dependencies_into_a_sibling_checkout_is_refused() {
        let root = init_repo("shared-links");
        let first = add_checkout(&root, "one");
        let second = add_checkout(&root, "two");
        std::fs::create_dir_all(first.join("node_modules/dep")).unwrap();
        let setup = format!(
            "mkdir -p node_modules && ln -s {} node_modules/dep",
            first.join("node_modules/dep").to_string_lossy()
        );
        let prepared = prepare(&root, &second, Some(&setup));
        assert_eq!(prepared.outcome, PreparationOutcome::SharedDependencies);
        assert!(prepared
            .reason
            .unwrap_or_default()
            .contains("node_modules/dep"));
        std::fs::create_dir_all(root.join("node_modules/common")).unwrap();
        let common = prepare(
            &root,
            &add_checkout(&root, "three"),
            Some(&format!(
                "mkdir -p node_modules && ln -s {}/node_modules/common node_modules/common",
                root.to_string_lossy()
            )),
        );
        assert_eq!(common.outcome, PreparationOutcome::SharedDependencies);
    }

    #[test]
    fn a_setup_with_internal_links_stays_isolated() {
        let root = init_repo("internal-links");
        let checkout = add_checkout(&root, "one");
        let prepared = prepare(
            &root,
            &checkout,
            Some("mkdir -p node_modules/.pnpm/dep && ln -s .pnpm/dep node_modules/dep"),
        );
        assert_eq!(prepared.outcome, PreparationOutcome::Succeeded);
    }

    #[test]
    fn a_dirty_private_checkout_is_not_prepared() {
        let root = init_repo("dirty-private");
        let checkout = add_checkout(&root, "one");
        std::fs::write(checkout.join("stray.txt"), "stray").unwrap();
        let prepared = prepare(&root, &checkout, None);
        assert_eq!(prepared.outcome, PreparationOutcome::Failed);
    }

    #[test]
    fn a_write_scope_through_a_symlink_that_escapes_the_repository_is_a_violation() {
        let root = init_repo("scope-escape");
        let outside = temp_root("scope-outside");
        std::os::unix::fs::symlink(&outside, root.join("vendor")).unwrap();
        std::os::unix::fs::symlink(root.join(".git"), root.join("meta")).unwrap();
        std::fs::create_dir_all(root.join("src")).unwrap();
        let violations = validate_write_scope(&WriteScopeArgs {
            repo_path: root.to_string_lossy().into_owned(),
            files: vec![
                "vendor/lib.ts".to_string(),
                "meta/config".to_string(),
                "src/new.ts".to_string(),
                "package.json".to_string(),
                "src".to_string(),
            ],
            directories: vec![
                "src".to_string(),
                "package.json".to_string(),
                "../up".to_string(),
            ],
        })
        .expect("validated");
        let flagged: Vec<&str> = violations.iter().map(|v| v.path.as_str()).collect();
        assert_eq!(
            flagged,
            vec![
                "vendor/lib.ts",
                "meta/config",
                "src",
                "package.json",
                "../up"
            ]
        );
        assert!(violations[0].reason.contains("outside the repository"));
    }

    #[test]
    fn porcelain_paths_with_spaces_are_kept_whole() {
        let counts = parse_status(
            "1 .M N... 100644 100644 100644 abc abc src/a file.ts\n2 R. N... 100644 100644 100644 abc abc R100 new name.ts\told name.ts\n? un tracked.txt\n",
        );
        assert_eq!(
            counts.tracked_paths,
            vec!["src/a file.ts".to_string(), "new name.ts".to_string()]
        );
        assert_eq!(counts.untracked_paths, vec!["un tracked.txt".to_string()]);
    }
}
