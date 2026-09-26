use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::worktree::{
    git, git_dir_of, in_progress_operation, read_working_tree, resolve_commit, sanitize_slug,
    GitWorkingTree, WorktreeError,
};
use crate::worktree_writer::{
    acquire_lease, cancel_lease, release_lease, WriterLeaseRegistry, WriterLeases,
};

const MERGE_TREE_BASE_MIN: (u32, u32) = (2, 40);
const BACKUP_PREFIX: &str = "refs/goodboy/backup";
const BACKUP_KEEP_SECS: u64 = 30 * 24 * 60 * 60;
const LEASE_HOLDER: &str = "history-rewrite";
const JOURNAL_FILE: &str = "goodboy-history.journal";
const COPY_PREFIX: &str = "goodboy-history-";

#[derive(Debug, Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HistoryVerb {
    Pick,
    Reword,
    Squash,
    Fixup,
    Drop,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryStep {
    pub sha: String,
    pub verb: HistoryVerb,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub target: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPlanArgs {
    pub worktree_path: String,
    pub base: String,
    pub head: String,
    pub steps: Vec<HistoryStep>,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum StepOutcome {
    Clean,
    Conflict,
    Empty,
    Dropped,
    Blocked,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StepPrediction {
    pub sha: String,
    pub outcome: StepOutcome,
    pub files: Vec<String>,
    pub new_sha: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlanPrediction {
    pub is_supported: bool,
    pub steps: Vec<StepPrediction>,
    pub head: Option<String>,
    pub is_tree_equal: bool,
    pub changed_files: Vec<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShaMove {
    pub from: String,
    pub to: Option<String>,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum StopKind {
    Merge,
    Hook,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TrialStop {
    pub sha: String,
    pub index: usize,
    pub kind: StopKind,
    pub files: Vec<String>,
    pub message: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TrialResult {
    pub head: Option<String>,
    pub map: Vec<ShaMove>,
    pub is_tree_equal: bool,
    pub changed_files: Vec<String>,
    pub stop: Option<TrialStop>,
    pub copy_path: Option<String>,
    pub order: Vec<PlannedStep>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlannedStep {
    pub sha: String,
    pub verb: HistoryVerb,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveBranchArgs {
    pub worktree_path: String,
    pub branch: String,
    pub expected_head: String,
    pub new_head: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreArgs {
    pub worktree_path: String,
    pub branch: String,
    pub expected_head: String,
    pub backup_ref: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum MoveOutcome {
    Moved {
        head: String,
        #[serde(rename = "backupRef")]
        backup_ref: String,
    },
    Busy {
        holder: Option<String>,
    },
    HeadMoved {
        head: String,
    },
    Blocked {
        reason: String,
    },
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryBackup {
    pub ref_name: String,
    pub sha: String,
    pub subject: String,
    pub created_at: u64,
}

#[derive(Debug, Clone)]
struct CommitInfo {
    parents: Vec<String>,
    author_name: String,
    author_email: String,
    author_date: String,
    message: String,
}

#[derive(Debug, Clone)]
struct Author {
    name: String,
    email: String,
    date: String,
}

impl CommitInfo {
    fn author(&self) -> Author {
        Author {
            name: self.author_name.clone(),
            email: self.author_email.clone(),
            date: self.author_date.clone(),
        }
    }
}

struct GitRun {
    status: i32,
    stdout: String,
    stderr: String,
}

fn git_run(
    cwd: &Path,
    args: &[&str],
    author: Option<&Author>,
    input: Option<&str>,
) -> Result<GitRun, WorktreeError> {
    let mut command = crate::path_env::command("git");
    command
        .args(args)
        .current_dir(cwd)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_EDITOR", "true")
        .env("GIT_SEQUENCE_EDITOR", "true")
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(author) = author {
        command
            .env("GIT_AUTHOR_NAME", &author.name)
            .env("GIT_AUTHOR_EMAIL", &author.email)
            .env("GIT_AUTHOR_DATE", &author.date);
    }
    let mut child = command.spawn()?;
    if let Some(text) = input {
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(text.as_bytes())?;
        }
    }
    let output = child.wait_with_output()?;
    Ok(GitRun {
        status: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: crate::worktree::redact_credentials(&String::from_utf8_lossy(&output.stderr)),
    })
}

fn parse_git_version(raw: &str) -> Option<(u32, u32)> {
    let version = raw.trim().strip_prefix("git version ")?;
    let mut parts = version.split(|c: char| !c.is_ascii_digit());
    let major = parts.next()?.parse::<u32>().ok()?;
    let minor = parts.next()?.parse::<u32>().ok()?;
    Some((major, minor))
}

fn git_version() -> Option<(u32, u32)> {
    static VERSION: OnceLock<Option<(u32, u32)>> = OnceLock::new();
    *VERSION.get_or_init(|| {
        let output = crate::path_env::command("git")
            .arg("--version")
            .output()
            .ok()?;
        parse_git_version(&String::from_utf8_lossy(&output.stdout))
    })
}

pub(crate) fn supports_merge_tree_base() -> bool {
    git_version().is_some_and(|version| version >= MERGE_TREE_BASE_MIN)
}

fn read_commit(cwd: &Path, sha: &str) -> Result<CommitInfo, WorktreeError> {
    let raw = git(
        cwd,
        &[
            "show",
            "-s",
            "--date=raw",
            "--format=%P%x1f%an%x1f%ae%x1f%ad%x1f%B",
            sha,
        ],
    )?;
    Ok(parse_commit(&raw))
}

fn read_commits(cwd: &Path, shas: &[String]) -> Result<HashMap<String, CommitInfo>, WorktreeError> {
    if shas.is_empty() {
        return Ok(HashMap::new());
    }
    let mut args = vec![
        "show".to_string(),
        "-s".to_string(),
        "--date=raw".to_string(),
        "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%ad%x1f%B%x1e".to_string(),
    ];
    args.extend(shas.iter().cloned());
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let raw = git(cwd, &refs)?;
    Ok(raw
        .split('\u{1e}')
        .filter_map(|record| {
            let record = record.trim_start_matches('\n');
            let (sha, rest) = record.split_once('\u{1f}')?;
            Some((sha.trim().to_string(), parse_commit(rest)))
        })
        .collect())
}

fn parse_commit(raw: &str) -> CommitInfo {
    let mut parts = raw.splitn(5, '\u{1f}');
    let parents = parts
        .next()
        .unwrap_or_default()
        .split_whitespace()
        .map(str::to_string)
        .collect();
    let author_name = parts.next().unwrap_or_default().to_string();
    let author_email = parts.next().unwrap_or_default().to_string();
    let author_date = parts.next().unwrap_or_default().to_string();
    let message = parts.next().unwrap_or_default().trim_end().to_string();
    CommitInfo {
        parents,
        author_name,
        author_email,
        author_date,
        message,
    }
}

fn tree_of(cwd: &Path, sha: &str) -> Result<String, WorktreeError> {
    Ok(git(cwd, &["rev-parse", &format!("{sha}^{{tree}}")])?
        .trim()
        .to_string())
}

fn changed_files(cwd: &Path, from: &str, to: &str) -> Vec<String> {
    git(cwd, &["diff", "--name-only", from, to])
        .map(|raw| {
            raw.lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn plan_error(message: &str) -> WorktreeError {
    WorktreeError::Git {
        message: message.to_string(),
    }
}

fn resolve_all(cwd: &Path, names: &[&str]) -> Option<Vec<String>> {
    let args: Vec<String> = std::iter::once("rev-parse".to_string())
        .chain(
            names
                .iter()
                .map(|name| format!("{}^{{commit}}", name.trim())),
        )
        .collect();
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let raw = git(cwd, &refs).ok()?;
    let resolved: Vec<String> = raw
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect();
    (resolved.len() == names.len()).then_some(resolved)
}

fn resolved_steps(cwd: &Path, steps: &[HistoryStep]) -> Result<Vec<HistoryStep>, WorktreeError> {
    let names: Vec<&str> = steps
        .iter()
        .flat_map(|step| std::iter::once(step.sha.as_str()).chain(step.target.as_deref()))
        .collect();
    if let Some(resolved) = resolve_all(cwd, &names) {
        let mut next = resolved.into_iter();
        return Ok(steps
            .iter()
            .map(|step| HistoryStep {
                sha: next.next().unwrap_or_default(),
                verb: step.verb,
                message: step.message.clone(),
                target: step.target.as_ref().and_then(|_| next.next()),
            })
            .collect());
    }
    steps
        .iter()
        .map(|step| {
            let target = match step.target.as_deref() {
                Some(target) => Some(resolve_commit(cwd, target)?),
                None => None,
            };
            Ok(HistoryStep {
                sha: resolve_commit(cwd, &step.sha)?,
                verb: step.verb,
                message: step.message.clone(),
                target,
            })
        })
        .collect()
}

fn group_end(ordered: &[HistoryStep], start: usize) -> usize {
    let mut end = start + 1;
    while end < ordered.len()
        && matches!(ordered[end].verb, HistoryVerb::Squash | HistoryVerb::Fixup)
    {
        end += 1;
    }
    end
}

pub(crate) fn order_steps(steps: &[HistoryStep]) -> Result<Vec<HistoryStep>, WorktreeError> {
    let (folds, mut ordered): (Vec<HistoryStep>, Vec<HistoryStep>) = steps
        .iter()
        .cloned()
        .partition(|step| step.verb == HistoryVerb::Fixup && step.target.is_some());
    for fold in folds {
        let target = fold.target.clone().unwrap_or_default();
        let Some(index) = ordered.iter().position(|step| step.sha == target) else {
            return Err(plan_error(&format!(
                "{} folds into a commit that is not in the plan",
                short(&fold.sha)
            )));
        };
        if ordered[index].verb == HistoryVerb::Drop {
            return Err(plan_error(&format!(
                "{} folds into {}, which the plan drops",
                short(&fold.sha),
                short(&target)
            )));
        }
        let at = group_end(&ordered, index);
        ordered.insert(at, fold);
    }
    let mut has_commit = false;
    for step in &ordered {
        match step.verb {
            HistoryVerb::Drop => {}
            HistoryVerb::Squash | HistoryVerb::Fixup if !has_commit => {
                return Err(plan_error(&format!(
                    "{} has no older commit to merge into",
                    short(&step.sha)
                )));
            }
            HistoryVerb::Reword
                if step
                    .message
                    .as_deref()
                    .map(str::trim)
                    .unwrap_or_default()
                    .is_empty() =>
            {
                return Err(plan_error(&format!(
                    "{} needs a message to reword it",
                    short(&step.sha)
                )));
            }
            _ => has_commit = true,
        }
    }
    Ok(ordered)
}

fn short(sha: &str) -> String {
    sha.chars().take(7).collect()
}

fn message_of(step: &HistoryStep, info: &CommitInfo) -> String {
    step.message
        .as_deref()
        .map(str::trim)
        .filter(|message| !message.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| info.message.clone())
}

fn combined_message(step: &HistoryStep, group: &str, info: &CommitInfo) -> String {
    if let Some(message) = step
        .message
        .as_deref()
        .map(str::trim)
        .filter(|message| !message.is_empty())
    {
        return message.to_string();
    }
    if step.verb == HistoryVerb::Fixup {
        return group.to_string();
    }
    format!("{group}\n\n{}", info.message)
}

enum MergeResult {
    Tree(String),
    Conflict(Vec<String>),
}

fn merge_in_memory(
    cwd: &Path,
    merge_base: &str,
    ours: &str,
    theirs: &str,
) -> Result<MergeResult, WorktreeError> {
    let base_arg = format!("--merge-base={merge_base}");
    let run = git_run(
        cwd,
        &[
            "merge-tree",
            "--write-tree",
            "--name-only",
            "--no-messages",
            &base_arg,
            ours,
            theirs,
        ],
        None,
        None,
    )?;
    let mut lines = run.stdout.lines().map(str::trim);
    let tree = lines.next().unwrap_or_default().to_string();
    match run.status {
        0 => Ok(MergeResult::Tree(tree)),
        1 => Ok(MergeResult::Conflict(
            lines
                .take_while(|line| !line.is_empty())
                .map(str::to_string)
                .collect(),
        )),
        _ => Err(plan_error(&format!(
            "git merge-tree failed: {}",
            run.stderr.trim()
        ))),
    }
}

fn commit_tree(
    cwd: &Path,
    tree: &str,
    parent: &str,
    message: &str,
    author: &Author,
) -> Result<String, WorktreeError> {
    let run = git_run(
        cwd,
        &["commit-tree", tree, "-p", parent, "-F", "-"],
        Some(author),
        Some(message),
    )?;
    if run.status != 0 {
        return Err(plan_error(&format!(
            "git commit-tree failed: {}",
            run.stderr.trim()
        )));
    }
    Ok(run.stdout.trim().to_string())
}

fn single_parent(cwd: &Path, sha: &str) -> Result<CommitInfo, WorktreeError> {
    one_parent(sha, read_commit(cwd, sha)?)
}

fn one_parent(sha: &str, info: CommitInfo) -> Result<CommitInfo, WorktreeError> {
    if info.parents.len() != 1 {
        return Err(plan_error(&format!(
            "{} is a merge commit: Rewrite history only replays commits with one parent",
            short(sha)
        )));
    }
    Ok(info)
}

struct Group {
    message: String,
    author: Author,
    parent: String,
    members: Vec<String>,
}

fn finish_group(group: Option<Group>, tip: &str, map: &mut Vec<ShaMove>) {
    let Some(group) = group else {
        return;
    };
    for member in group.members {
        map.push(ShaMove {
            from: member,
            to: Some(tip.to_string()),
        });
    }
}

fn step_index(steps: &[HistoryStep], sha: &str) -> usize {
    steps
        .iter()
        .position(|step| step.sha == sha)
        .unwrap_or_default()
}

pub(crate) fn predict(args: &HistoryPlanArgs) -> Result<PlanPrediction, WorktreeError> {
    let cwd = Path::new(&args.worktree_path);
    if !cwd.exists() {
        return Err(WorktreeError::RepoNotFound(args.worktree_path.clone()));
    }
    if !supports_merge_tree_base() {
        return Ok(PlanPrediction {
            is_supported: false,
            steps: Vec::new(),
            head: None,
            is_tree_equal: false,
            changed_files: Vec::new(),
        });
    }
    let base = resolve_commit(cwd, &args.base)?;
    let old_head = resolve_commit(cwd, &args.head)?;
    let steps = resolved_steps(cwd, &args.steps)?;
    let ordered = order_steps(&steps)?;
    let replayed: Vec<String> = ordered
        .iter()
        .filter(|step| step.verb != HistoryVerb::Drop)
        .map(|step| step.sha.clone())
        .collect();
    let mut infos = read_commits(cwd, &replayed)?;
    let mut outcomes: HashMap<String, StepPrediction> = HashMap::new();
    let mut tip = base.clone();
    let mut tip_tree = tree_of(cwd, &base)?;
    let mut group: Option<Group> = None;
    let mut map = Vec::new();
    let mut stopped = false;
    for step in &ordered {
        if stopped {
            outcomes.insert(step.sha.clone(), blocked(&step.sha));
            continue;
        }
        if step.verb == HistoryVerb::Drop {
            outcomes.insert(
                step.sha.clone(),
                prediction(&step.sha, StepOutcome::Dropped),
            );
            continue;
        }
        let info = match infos.remove(&step.sha) {
            Some(found) => one_parent(&step.sha, found)?,
            None => single_parent(cwd, &step.sha)?,
        };
        let merge_base = info.parents[0].clone();
        match merge_in_memory(cwd, &merge_base, &tip, &step.sha)? {
            MergeResult::Conflict(files) => {
                outcomes.insert(
                    step.sha.clone(),
                    StepPrediction {
                        sha: step.sha.clone(),
                        outcome: StepOutcome::Conflict,
                        files,
                        new_sha: None,
                    },
                );
                stopped = true;
            }
            MergeResult::Tree(tree) => {
                let is_folding = matches!(step.verb, HistoryVerb::Squash | HistoryVerb::Fixup);
                if !is_folding && tree == tip_tree {
                    outcomes.insert(step.sha.clone(), prediction(&step.sha, StepOutcome::Empty));
                    continue;
                }
                if is_folding {
                    let Some(current) = group.as_mut() else {
                        return Err(plan_error("a squash has no commit to merge into"));
                    };
                    let message = combined_message(step, &current.message, &info);
                    let author = current.author.clone();
                    tip = commit_tree(cwd, &tree, &current.parent, &message, &author)?;
                    current.message = message;
                    current.members.push(step.sha.clone());
                    tip_tree = tree;
                } else {
                    finish_group(group.take(), &tip, &mut map);
                    let message = message_of(step, &info);
                    let author = info.author();
                    let parent = tip.clone();
                    tip = commit_tree(cwd, &tree, &parent, &message, &author)?;
                    tip_tree = tree;
                    group = Some(Group {
                        message,
                        author,
                        parent,
                        members: vec![step.sha.clone()],
                    });
                }
                outcomes.insert(step.sha.clone(), prediction(&step.sha, StepOutcome::Clean));
            }
        }
    }
    finish_group(group, &tip, &mut map);
    for moved in &map {
        if let Some(entry) = outcomes.get_mut(&moved.from) {
            entry.new_sha = moved.to.clone();
        }
    }
    let ordered_outcomes = steps
        .iter()
        .map(|step| {
            outcomes
                .remove(&step.sha)
                .unwrap_or_else(|| blocked(&step.sha))
        })
        .collect();
    if stopped {
        return Ok(PlanPrediction {
            is_supported: true,
            steps: ordered_outcomes,
            head: None,
            is_tree_equal: false,
            changed_files: Vec::new(),
        });
    }
    Ok(PlanPrediction {
        is_supported: true,
        steps: ordered_outcomes,
        is_tree_equal: tip_tree == tree_of(cwd, &old_head)?,
        changed_files: changed_files(cwd, &old_head, &tip),
        head: Some(tip),
    })
}

fn prediction(sha: &str, outcome: StepOutcome) -> StepPrediction {
    StepPrediction {
        sha: sha.to_string(),
        outcome,
        files: Vec::new(),
        new_sha: None,
    }
}

fn blocked(sha: &str) -> StepPrediction {
    prediction(sha, StepOutcome::Blocked)
}

pub(crate) fn copy_path_of(slug: &str) -> PathBuf {
    std::env::temp_dir().join(format!("{COPY_PREFIX}{}", sanitize_slug(slug)))
}

pub(crate) fn discard_copy(cwd: &Path, path: &str) {
    let _ = git(cwd, &["worktree", "remove", "--force", path]);
    if Path::new(path).exists() {
        let _ = std::fs::remove_dir_all(path);
    }
    let _ = git(cwd, &["worktree", "prune"]);
}

fn unmerged_files(copy: &Path) -> Vec<String> {
    git(copy, &["diff", "--name-only", "--diff-filter=U"])
        .map(|raw| {
            raw.lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn has_staged_changes(copy: &Path) -> Result<bool, WorktreeError> {
    let run = git_run(copy, &["diff", "--cached", "--quiet"], None, None)?;
    Ok(run.status != 0)
}

struct Replay {
    head: String,
    map: Vec<ShaMove>,
    stop: Option<TrialStop>,
}

fn stop_of(
    steps: &[HistoryStep],
    sha: &str,
    kind: StopKind,
    files: Vec<String>,
    message: String,
) -> TrialStop {
    TrialStop {
        sha: sha.to_string(),
        index: step_index(steps, sha),
        kind,
        files,
        message,
    }
}

fn replay_in_copy(
    copy: &Path,
    steps: &[HistoryStep],
    ordered: &[HistoryStep],
) -> Result<Replay, WorktreeError> {
    let mut group: Option<Group> = None;
    let mut map = Vec::new();
    let mut tip = resolve_commit(copy, "HEAD")?;
    for step in ordered {
        if step.verb == HistoryVerb::Drop {
            map.push(ShaMove {
                from: step.sha.clone(),
                to: None,
            });
            continue;
        }
        let info = single_parent(copy, &step.sha)?;
        let pick = git_run(copy, &["cherry-pick", "--no-commit", &step.sha], None, None)?;
        if pick.status != 0 {
            let files = unmerged_files(copy);
            let kind = if files.is_empty() {
                StopKind::Hook
            } else {
                StopKind::Merge
            };
            finish_group(group.take(), &tip, &mut map);
            return Ok(Replay {
                head: tip,
                map,
                stop: Some(stop_of(
                    steps,
                    &step.sha,
                    kind,
                    files,
                    pick.stderr.trim().to_string(),
                )),
            });
        }
        let is_folding = matches!(step.verb, HistoryVerb::Squash | HistoryVerb::Fixup);
        if !is_folding && !has_staged_changes(copy)? {
            map.push(ShaMove {
                from: step.sha.clone(),
                to: None,
            });
            continue;
        }
        let commit = if is_folding {
            let Some(current) = group.as_mut() else {
                return Err(plan_error("a squash has no commit to merge into"));
            };
            let message = combined_message(step, &current.message, &info);
            let run = git_run(
                copy,
                &["commit", "--amend", "--allow-empty", "-F", "-"],
                Some(&current.author),
                Some(&message),
            )?;
            current.message = message;
            current.members.push(step.sha.clone());
            run
        } else {
            finish_group(group.take(), &tip, &mut map);
            let message = message_of(step, &info);
            let author = info.author();
            let run = git_run(copy, &["commit", "-F", "-"], Some(&author), Some(&message))?;
            group = Some(Group {
                message,
                author,
                parent: tip.clone(),
                members: vec![step.sha.clone()],
            });
            run
        };
        if commit.status != 0 {
            let _ = git(copy, &["reset", "--hard", "--quiet", &tip]);
            return Ok(Replay {
                head: tip,
                map,
                stop: Some(stop_of(
                    steps,
                    &step.sha,
                    StopKind::Hook,
                    Vec::new(),
                    format!("{}{}", commit.stdout.trim(), commit.stderr.trim()),
                )),
            });
        }
        tip = resolve_commit(copy, "HEAD")?;
    }
    finish_group(group, &tip, &mut map);
    Ok(Replay {
        head: tip,
        map,
        stop: None,
    })
}

pub(crate) fn trial(
    args: &HistoryPlanArgs,
    slug: &str,
    keeps_copy_on_stop: bool,
) -> Result<TrialResult, WorktreeError> {
    let cwd = Path::new(&args.worktree_path);
    if !cwd.exists() {
        return Err(WorktreeError::RepoNotFound(args.worktree_path.clone()));
    }
    let base = resolve_commit(cwd, &args.base)?;
    let old_head = resolve_commit(cwd, &args.head)?;
    let steps = resolved_steps(cwd, &args.steps)?;
    let ordered = order_steps(&steps)?;
    let order = planned_order(cwd, &ordered)?;
    let copy = copy_path_of(slug);
    let copy_text = copy.to_string_lossy().to_string();
    discard_copy(cwd, &copy_text);
    git(
        cwd,
        &["worktree", "add", "--detach", "--quiet", &copy_text, &base],
    )?;
    let replay = match replay_in_copy(&copy, &steps, &ordered) {
        Ok(replay) => replay,
        Err(error) => {
            discard_copy(cwd, &copy_text);
            return Err(error);
        }
    };
    if replay.stop.is_some() {
        let copy_path = if keeps_copy_on_stop {
            Some(copy_text)
        } else {
            discard_copy(cwd, &copy_text);
            None
        };
        return Ok(TrialResult {
            head: None,
            map: replay.map,
            is_tree_equal: false,
            changed_files: Vec::new(),
            stop: replay.stop,
            copy_path,
            order,
        });
    }
    discard_copy(cwd, &copy_text);
    Ok(TrialResult {
        is_tree_equal: tree_of(cwd, &replay.head)? == tree_of(cwd, &old_head)?,
        changed_files: changed_files(cwd, &old_head, &replay.head),
        head: Some(replay.head),
        map: replay.map,
        stop: None,
        copy_path: None,
        order,
    })
}

fn planned_order(cwd: &Path, ordered: &[HistoryStep]) -> Result<Vec<PlannedStep>, WorktreeError> {
    let mut group_message: Option<String> = None;
    let mut planned = Vec::new();
    for step in ordered {
        if step.verb == HistoryVerb::Drop {
            planned.push(PlannedStep {
                sha: step.sha.clone(),
                verb: step.verb,
                message: String::new(),
            });
            continue;
        }
        let info = single_parent(cwd, &step.sha)?;
        let message = match (&group_message, step.verb) {
            (Some(current), HistoryVerb::Squash | HistoryVerb::Fixup) => {
                combined_message(step, current, &info)
            }
            _ => message_of(step, &info),
        };
        group_message = Some(message.clone());
        planned.push(PlannedStep {
            sha: step.sha.clone(),
            verb: step.verb,
            message,
        });
    }
    Ok(planned)
}

fn backup_namespace(branch: &str) -> String {
    format!("{BACKUP_PREFIX}/{}", sanitize_slug(branch))
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default()
}

fn journal_of(cwd: &Path) -> Option<PathBuf> {
    git_dir_of(cwd).map(|dir| dir.join(JOURNAL_FILE))
}

fn recover_journal(cwd: &Path) -> Result<(), WorktreeError> {
    let Some(journal) = journal_of(cwd) else {
        return Ok(());
    };
    if !journal.exists() {
        return Ok(());
    }
    let recorded = std::fs::read_to_string(&journal)?;
    let mut lines = recorded.lines().map(str::trim);
    let old = lines.next().unwrap_or_default().to_string();
    let new = lines.next().unwrap_or_default().to_string();
    let head = resolve_commit(cwd, "HEAD")?;
    let still_on_old_tree = git_run(cwd, &["diff", "--quiet", &old], None, None)?.status == 0;
    if head == new && head != old && still_on_old_tree {
        git(cwd, &["reset", "--hard", "--quiet", &new])?;
    }
    std::fs::remove_file(&journal)?;
    Ok(())
}

fn blocking_reason(cwd: &Path) -> Option<String> {
    if let Some(operation) = in_progress_operation(cwd) {
        return Some(format!(
            "A git {} is in progress in this worktree. Finish or abort it first.",
            match operation {
                crate::worktree::GitOperation::Merge => "merge",
                crate::worktree::GitOperation::Rebase => "rebase",
                crate::worktree::GitOperation::CherryPick => "cherry-pick",
                crate::worktree::GitOperation::Bisect => "bisect",
            }
        ));
    }
    match read_working_tree(cwd) {
        GitWorkingTree::Known {
            staged,
            unstaged,
            unmerged,
            ..
        } => {
            let pending = staged + unstaged + unmerged;
            if pending == 0 {
                return None;
            }
            Some(format!(
                "Commit or stash {pending} {} first.",
                if pending == 1 { "file" } else { "files" }
            ))
        }
        GitWorkingTree::Unknown { .. } => Some("Couldn't read the worktree status.".to_string()),
    }
}

pub(crate) fn move_branch_blocking(
    cwd: &Path,
    branch: &str,
    expected_head: &str,
    new_head: &str,
) -> Result<MoveOutcome, WorktreeError> {
    recover_journal(cwd)?;
    let current_branch = crate::worktree::current_branch_name(cwd).unwrap_or_default();
    if current_branch != branch {
        return Ok(MoveOutcome::Blocked {
            reason: format!("This worktree is on {current_branch}, not {branch}."),
        });
    }
    if let Some(reason) = blocking_reason(cwd) {
        return Ok(MoveOutcome::Blocked { reason });
    }
    let expected = resolve_commit(cwd, expected_head)?;
    let target = resolve_commit(cwd, new_head)?;
    let head = resolve_commit(cwd, "HEAD")?;
    if head != expected {
        return Ok(MoveOutcome::HeadMoved { head });
    }
    let backup_ref = format!("{}/{}", backup_namespace(branch), now_nanos());
    git(cwd, &["update-ref", &backup_ref, &expected])?;
    let journal = journal_of(cwd).ok_or_else(|| plan_error("the worktree has no git directory"))?;
    std::fs::write(&journal, format!("{expected}\n{target}\n{backup_ref}\n"))?;
    git(
        cwd,
        &[
            "update-ref",
            "-m",
            "goodboy: rewrite history",
            "HEAD",
            &target,
            &expected,
        ],
    )?;
    let reset = git(cwd, &["reset", "--hard", "--quiet", &target]);
    if let Err(error) = reset {
        let _ = git(cwd, &["update-ref", "HEAD", &expected, &target]);
        let _ = git(cwd, &["reset", "--hard", "--quiet", &expected]);
        let _ = std::fs::remove_file(&journal);
        return Err(error);
    }
    std::fs::remove_file(&journal)?;
    Ok(MoveOutcome::Moved {
        head: target,
        backup_ref,
    })
}

fn now_nanos() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or_default()
}

fn created_at_of(ref_name: &str) -> u64 {
    ref_name
        .rsplit('/')
        .next()
        .and_then(|stamp| stamp.parse::<u128>().ok())
        .map(|nanos| (nanos / 1_000_000_000) as u64)
        .unwrap_or_default()
}

pub(crate) fn list_backups(cwd: &Path, branch: &str) -> Result<Vec<HistoryBackup>, WorktreeError> {
    let namespace = backup_namespace(branch);
    let raw = git(
        cwd,
        &[
            "for-each-ref",
            "--format=%(refname)%1f%(objectname)%1f%(subject)",
            &namespace,
        ],
    )?;
    let mut backups: Vec<HistoryBackup> = raw
        .lines()
        .filter_map(|line| {
            let mut parts = line.split('\u{1f}');
            let ref_name = parts.next()?.trim().to_string();
            let sha = parts.next()?.trim().to_string();
            let subject = parts.next().unwrap_or_default().trim().to_string();
            Some(HistoryBackup {
                created_at: created_at_of(&ref_name),
                ref_name,
                sha,
                subject,
            })
        })
        .collect();
    backups.sort_by(|left, right| right.ref_name.cmp(&left.ref_name));
    Ok(backups)
}

pub(crate) fn prune_backups(cwd: &Path) {
    let Ok(raw) = git(cwd, &["for-each-ref", "--format=%(refname)", BACKUP_PREFIX]) else {
        return;
    };
    let cutoff = now_secs().saturating_sub(BACKUP_KEEP_SECS);
    for ref_name in raw.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let created = created_at_of(ref_name);
        if created > 0 && created < cutoff {
            let _ = git(cwd, &["update-ref", "-d", ref_name]);
        }
    }
}

fn with_lease(
    registry: &WriterLeaseRegistry,
    path: &str,
    run: impl FnOnce() -> Result<MoveOutcome, WorktreeError>,
) -> Result<MoveOutcome, WorktreeError> {
    let status = acquire_lease(registry, path, LEASE_HOLDER, None);
    if !status.is_granted {
        cancel_lease(registry, path, LEASE_HOLDER);
        return Ok(MoveOutcome::Busy {
            holder: status.holder,
        });
    }
    let outcome = run();
    release_lease(registry, path, LEASE_HOLDER, status.token.as_deref());
    outcome
}

#[tauri::command]
pub async fn history_plan_predict(args: HistoryPlanArgs) -> Result<PlanPrediction, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || predict(&args))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn history_plan_try(args: HistoryPlanArgs) -> Result<TrialResult, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let slug = format!("try-{}", now_nanos());
        trial(&args, &slug, false)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn history_plan_apply(
    leases: State<'_, WriterLeases>,
    args: MoveBranchArgs,
) -> Result<MoveOutcome, WorktreeError> {
    let registry = leases.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&args.worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(args.worktree_path));
        }
        with_lease(&registry, &args.worktree_path, || {
            move_branch_blocking(&cwd, &args.branch, &args.expected_head, &args.new_head)
        })
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn history_restore(
    leases: State<'_, WriterLeases>,
    args: RestoreArgs,
) -> Result<MoveOutcome, WorktreeError> {
    let registry = leases.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&args.worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(args.worktree_path));
        }
        if !args
            .backup_ref
            .starts_with(&format!("{}/", backup_namespace(&args.branch)))
        {
            return Err(plan_error("that backup belongs to another branch"));
        }
        let target = resolve_commit(&cwd, &args.backup_ref)?;
        with_lease(&registry, &args.worktree_path, || {
            move_branch_blocking(&cwd, &args.branch, &args.expected_head, &target)
        })
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn history_backups_list(
    worktree_path: String,
    branch: String,
) -> Result<Vec<HistoryBackup>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(worktree_path));
        }
        list_backups(&cwd, &branch)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub fn history_git_supported() -> bool {
    supports_merge_tree_base()
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RebaseCommit {
    pub sha: String,
    pub subject: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RebasePlan {
    pub onto: String,
    pub onto_ref: String,
    pub merge_base: String,
    pub head: String,
    pub commits: Vec<RebaseCommit>,
    pub behind: u32,
    pub fetch_error: Option<String>,
}

pub(crate) fn rebase_plan(
    cwd: &Path,
    base_branch: &str,
    fetches: bool,
) -> Result<RebasePlan, WorktreeError> {
    let base = base_branch.trim();
    if base.is_empty() {
        return Err(plan_error("the base branch is empty"));
    }
    let fetch_error = if fetches {
        git(cwd, &["fetch", "--quiet", "origin", base])
            .err()
            .map(|error| error.to_string())
    } else {
        None
    };
    let remote_ref = format!("origin/{base}");
    let (onto_ref, onto) = match resolve_commit(cwd, &remote_ref) {
        Ok(sha) => (remote_ref, sha),
        Err(_) => (base.to_string(), resolve_commit(cwd, base)?),
    };
    let head = resolve_commit(cwd, "HEAD")?;
    let merge_base = git(cwd, &["merge-base", "HEAD", &onto])?.trim().to_string();
    let range = format!("{merge_base}..{head}");
    let raw = git(
        cwd,
        &["log", "--reverse", "--format=%H%x1f%P%x1f%s", &range],
    )?;
    let mut commits = Vec::new();
    for line in raw.lines().filter(|line| !line.trim().is_empty()) {
        let mut parts = line.splitn(3, '\u{1f}');
        let sha = parts.next().unwrap_or_default().to_string();
        let parents = parts.next().unwrap_or_default().split_whitespace().count();
        if parents != 1 {
            return Err(plan_error(&format!(
                "{} is a merge commit: rebase it by hand",
                short(&sha)
            )));
        }
        commits.push(RebaseCommit {
            sha,
            subject: parts.next().unwrap_or_default().to_string(),
        });
    }
    let behind = git(cwd, &["rev-list", "--count", &format!("{head}..{onto}")])?
        .trim()
        .parse::<u32>()
        .unwrap_or_default();
    Ok(RebasePlan {
        onto,
        onto_ref,
        merge_base,
        head,
        commits,
        behind,
        fetch_error,
    })
}

#[tauri::command]
pub async fn history_rebase_plan(
    worktree_path: String,
    base_branch: String,
    fetches: bool,
) -> Result<RebasePlan, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(worktree_path));
        }
        rebase_plan(&cwd, &base_branch, fetches)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RewriterPrepareArgs {
    pub plan: HistoryPlanArgs,
    pub slug: String,
}

#[tauri::command]
pub async fn history_rewriter_prepare(
    args: RewriterPrepareArgs,
) -> Result<TrialResult, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || trial(&args.plan, &args.slug, true))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RewriterCollectArgs {
    pub plan: HistoryPlanArgs,
    pub copy_path: String,
    #[serde(default)]
    pub skipped: Vec<String>,
    #[serde(default)]
    pub keeps_copy: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RewriterCheck {
    pub head: Option<String>,
    pub map: Vec<ShaMove>,
    pub problems: Vec<String>,
    pub is_tree_equal: bool,
    pub changed_files: Vec<String>,
}

struct ExpectedGroup {
    members: Vec<String>,
    message: String,
    author: Author,
}

fn expected_groups(
    cwd: &Path,
    ordered: &[HistoryStep],
    skipped: &[String],
) -> Result<Vec<ExpectedGroup>, WorktreeError> {
    let mut groups: Vec<ExpectedGroup> = Vec::new();
    for step in ordered {
        if step.verb == HistoryVerb::Drop {
            continue;
        }
        let info = single_parent(cwd, &step.sha)?;
        let is_folding = matches!(step.verb, HistoryVerb::Squash | HistoryVerb::Fixup);
        if is_folding {
            if let Some(current) = groups.last_mut() {
                current.message = combined_message(step, &current.message, &info);
                current.members.push(step.sha.clone());
                continue;
            }
        }
        if skipped.iter().any(|sha| sha == &step.sha) {
            continue;
        }
        groups.push(ExpectedGroup {
            members: vec![step.sha.clone()],
            message: message_of(step, &info),
            author: info.author(),
        });
    }
    Ok(groups)
}

fn copy_problem(copy: &Path) -> Option<String> {
    if in_progress_operation(copy).is_some() {
        return Some("The copy still has a cherry-pick or merge in progress.".to_string());
    }
    match read_working_tree(copy) {
        GitWorkingTree::Known {
            staged,
            unstaged,
            unmerged,
            ..
        } if staged + unstaged + unmerged > 0 => {
            Some("The copy has changes that were never committed.".to_string())
        }
        GitWorkingTree::Known { .. } => None,
        GitWorkingTree::Unknown { .. } => Some("Couldn't read the copy.".to_string()),
    }
}

pub(crate) fn collect_rewrite(args: &RewriterCollectArgs) -> Result<RewriterCheck, WorktreeError> {
    let cwd = Path::new(&args.plan.worktree_path);
    let copy = Path::new(&args.copy_path);
    if !cwd.exists() {
        return Err(WorktreeError::RepoNotFound(args.plan.worktree_path.clone()));
    }
    if !copy.exists() {
        return Err(WorktreeError::RepoNotFound(args.copy_path.clone()));
    }
    let base = resolve_commit(cwd, &args.plan.base)?;
    let old_head = resolve_commit(cwd, &args.plan.head)?;
    let steps = resolved_steps(cwd, &args.plan.steps)?;
    let ordered = order_steps(&steps)?;
    let skipped: Vec<String> = args
        .skipped
        .iter()
        .filter_map(|sha| resolve_commit(cwd, sha).ok())
        .collect();
    let groups = expected_groups(cwd, &ordered, &skipped)?;
    let mut problems = Vec::new();
    if let Some(problem) = copy_problem(copy) {
        problems.push(problem);
    }
    let copy_head = resolve_commit(copy, "HEAD")?;
    let range = format!("{base}..{copy_head}");
    let made: Vec<String> = git(copy, &["rev-list", "--reverse", "--first-parent", &range])?
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect();
    if git(copy, &["merge-base", "--is-ancestor", &base, &copy_head]).is_err() {
        problems.push("The copy is no longer built on the plan base.".to_string());
    }
    if made.len() != groups.len() {
        problems.push(format!(
            "The rewriter made {} {}, the plan has {}.",
            made.len(),
            if made.len() == 1 { "commit" } else { "commits" },
            groups.len()
        ));
    }
    if !problems.is_empty() {
        return Ok(RewriterCheck {
            head: None,
            map: Vec::new(),
            problems,
            is_tree_equal: false,
            changed_files: Vec::new(),
        });
    }
    let mut tip = base.clone();
    let mut map = Vec::new();
    for (commit, group) in made.iter().zip(groups.iter()) {
        let tree = tree_of(copy, commit)?;
        tip = commit_tree(cwd, &tree, &tip, &group.message, &group.author)?;
        for member in &group.members {
            map.push(ShaMove {
                from: member.clone(),
                to: Some(tip.clone()),
            });
        }
    }
    for step in &ordered {
        if map.iter().any(|moved| moved.from == step.sha) {
            continue;
        }
        map.push(ShaMove {
            from: step.sha.clone(),
            to: None,
        });
    }
    if !args.keeps_copy {
        discard_copy(cwd, &args.copy_path);
    }
    Ok(RewriterCheck {
        is_tree_equal: tree_of(cwd, &tip)? == tree_of(cwd, &old_head)?,
        changed_files: changed_files(cwd, &old_head, &tip),
        head: Some(tip),
        map,
        problems,
    })
}

#[tauri::command]
pub async fn history_rewriter_collect(
    args: RewriterCollectArgs,
) -> Result<RewriterCheck, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || collect_rewrite(&args))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn history_copy_discard(
    worktree_path: String,
    copy_path: String,
) -> Result<(), WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(worktree_path));
        }
        if !copy_path.contains(COPY_PREFIX) {
            return Err(plan_error("that folder is not a history copy"));
        }
        discard_copy(&cwd, &copy_path);
        Ok(())
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn slug(name: &str) -> String {
        format!("{name}-{}-{}", std::process::id(), now_nanos())
    }

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-history-test-{name}-{}-{}",
            std::process::id(),
            now_nanos()
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

    fn init_repo(name: &str) -> PathBuf {
        let root = temp_root(name);
        git_ok(&root, &["init", "-b", "main"]);
        git_ok(&root, &["config", "user.email", "test@example.com"]);
        git_ok(&root, &["config", "user.name", "test"]);
        git_ok(&root, &["config", "commit.gpgsign", "false"]);
        root
    }

    fn commit(root: &Path, file: &str, body: &str, message: &str) -> String {
        std::fs::write(root.join(file), body).unwrap();
        git_ok(root, &["add", file]);
        git_ok(root, &["commit", "--no-verify", "-m", message]);
        git_ok(root, &["rev-parse", "HEAD"])
    }

    fn step(sha: &str, verb: HistoryVerb) -> HistoryStep {
        HistoryStep {
            sha: sha.to_string(),
            verb,
            message: None,
            target: None,
        }
    }

    fn plan(root: &Path, base: &str, head: &str, steps: Vec<HistoryStep>) -> HistoryPlanArgs {
        HistoryPlanArgs {
            worktree_path: root.to_string_lossy().into_owned(),
            base: base.to_string(),
            head: head.to_string(),
            steps,
        }
    }

    struct Branch {
        root: PathBuf,
        base: String,
        a: String,
        b: String,
        c: String,
    }

    fn branch(name: &str) -> Branch {
        let root = init_repo(name);
        let base = commit(&root, "policy.txt", "one\n", "base");
        git_ok(&root, &["checkout", "-b", "feature"]);
        let a = commit(&root, "policy.txt", "two\n", "A edits the policy");
        let b = commit(&root, "policy.txt", "three\n", "B edits the policy again");
        let c = commit(&root, "notes.txt", "notes\n", "C adds notes");
        Branch {
            root,
            base,
            a,
            b,
            c,
        }
    }

    fn subjects(root: &Path, range: &str) -> Vec<String> {
        git_ok(root, &["log", "--format=%s", range])
            .lines()
            .map(str::to_string)
            .collect()
    }

    #[test]
    fn git_versions_parse_with_vendor_suffixes() {
        assert_eq!(
            parse_git_version("git version 2.50.1 (Apple Git-155)"),
            Some((2, 50))
        );
        assert_eq!(parse_git_version("git version 2.39.0"), Some((2, 39)));
        assert!(Some((2, 39)) < Some(MERGE_TREE_BASE_MIN));
        assert_eq!(parse_git_version("nonsense"), None);
    }

    #[test]
    fn a_plan_without_moves_predicts_the_same_tree() {
        let b = branch("predict-same");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.a, HistoryVerb::Pick),
                step(&b.b, HistoryVerb::Pick),
                step(&b.c, HistoryVerb::Pick),
            ],
        );
        let prediction = predict(&args).unwrap();
        assert!(prediction.is_supported);
        assert!(prediction.is_tree_equal);
        assert!(prediction
            .steps
            .iter()
            .all(|step| step.outcome == StepOutcome::Clean));
        assert_eq!(git_ok(&b.root, &["status", "--porcelain"]), "");
    }

    #[test]
    fn moving_a_commit_above_its_neighbour_predicts_the_conflict() {
        let b = branch("predict-reorder");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.b, HistoryVerb::Pick),
                step(&b.a, HistoryVerb::Pick),
                step(&b.c, HistoryVerb::Pick),
            ],
        );
        let prediction = predict(&args).unwrap();
        assert_eq!(prediction.steps[0].outcome, StepOutcome::Conflict);
        assert_eq!(prediction.steps[0].files, vec!["policy.txt".to_string()]);
        assert_eq!(prediction.steps[1].outcome, StepOutcome::Blocked);
        assert_eq!(prediction.head, None);
    }

    #[test]
    fn dropping_a_commit_its_neighbour_builds_on_conflicts() {
        let b = branch("predict-drop");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.a, HistoryVerb::Drop),
                step(&b.b, HistoryVerb::Pick),
                step(&b.c, HistoryVerb::Pick),
            ],
        );
        let prediction = predict(&args).unwrap();
        assert_eq!(prediction.steps[0].outcome, StepOutcome::Dropped);
        assert_eq!(prediction.steps[1].outcome, StepOutcome::Conflict);
    }

    #[test]
    fn dropping_an_independent_commit_changes_the_code() {
        let b = branch("predict-drop-clean");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.a, HistoryVerb::Pick),
                step(&b.b, HistoryVerb::Pick),
                step(&b.c, HistoryVerb::Drop),
            ],
        );
        let prediction = predict(&args).unwrap();
        assert!(!prediction.is_tree_equal);
        assert_eq!(prediction.changed_files, vec!["notes.txt".to_string()]);
    }

    #[test]
    fn a_commit_whose_changes_are_already_there_predicts_empty() {
        let root = init_repo("predict-empty");
        let base = commit(&root, "a.txt", "one\n", "base");
        git_ok(&root, &["checkout", "-b", "feature"]);
        let first = commit(&root, "a.txt", "two\n", "first");
        let revert = commit(&root, "a.txt", "one\n", "revert");
        let again = commit(&root, "a.txt", "two\n", "again");
        let args = plan(
            &root,
            &base,
            &again,
            vec![
                step(&first, HistoryVerb::Pick),
                step(&revert, HistoryVerb::Drop),
                step(&again, HistoryVerb::Pick),
            ],
        );
        let prediction = predict(&args).unwrap();
        assert_eq!(prediction.steps[2].outcome, StepOutcome::Empty);
        assert!(prediction.is_tree_equal);
    }

    #[test]
    fn folding_moves_the_commit_under_its_target_and_keeps_the_target_message() {
        let b = branch("predict-fold");
        let mut fold = step(&b.c, HistoryVerb::Fixup);
        fold.target = Some(b.a.clone());
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.a, HistoryVerb::Pick),
                step(&b.b, HistoryVerb::Pick),
                fold,
            ],
        );
        let prediction = predict(&args).unwrap();
        assert!(prediction.is_tree_equal);
        let head = prediction.head.unwrap();
        assert_eq!(
            subjects(&b.root, &format!("{}..{head}", b.base)),
            vec!["B edits the policy again", "A edits the policy"]
        );
        assert_eq!(prediction.steps[0].new_sha, prediction.steps[2].new_sha);
    }

    #[test]
    fn squash_needs_an_older_commit() {
        let b = branch("predict-squash-first");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.a, HistoryVerb::Squash),
                step(&b.b, HistoryVerb::Pick),
            ],
        );
        assert!(predict(&args).is_err());
    }

    #[test]
    fn the_trial_replays_every_verb_and_keeps_authors() {
        let b = branch("trial-verbs");
        let mut reword = step(&b.c, HistoryVerb::Reword);
        reword.message = Some("C adds release notes".to_string());
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.a, HistoryVerb::Pick),
                step(&b.b, HistoryVerb::Squash),
                reword,
            ],
        );
        let trial_slug = slug("trial-verbs");
        let result = trial(&args, &trial_slug, false).unwrap();
        assert_eq!(result.stop, None);
        assert!(result.is_tree_equal);
        let head = result.head.unwrap();
        assert_eq!(
            subjects(&b.root, &format!("{}..{head}", b.base)),
            vec!["C adds release notes", "A edits the policy"]
        );
        let body = git_ok(&b.root, &["log", "-1", "--format=%B", &format!("{head}~1")]);
        assert!(body.contains("B edits the policy again"));
        assert_eq!(
            git_ok(&b.root, &["log", "-1", "--format=%an", &head]),
            "test"
        );
        assert_eq!(result.map.len(), 3);
        assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.c);
        assert!(!copy_path_of(&trial_slug).exists());
    }

    #[test]
    fn a_conflicting_trial_leaves_the_branch_untouched() {
        let b = branch("trial-conflict");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![step(&b.b, HistoryVerb::Pick), step(&b.a, HistoryVerb::Pick)],
        );
        let result = trial(&args, &slug("trial-conflict"), true).unwrap();
        let stop = result.stop.unwrap();
        assert_eq!(stop.kind, StopKind::Merge);
        assert_eq!(stop.files, vec!["policy.txt".to_string()]);
        assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.c);
        let copy = result.copy_path.unwrap();
        assert!(Path::new(&copy).exists());
        discard_copy(&b.root, &copy);
    }

    #[test]
    fn applying_backs_up_moves_the_branch_and_restore_brings_it_back() {
        let b = branch("apply-restore");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.a, HistoryVerb::Pick),
                step(&b.b, HistoryVerb::Squash),
                step(&b.c, HistoryVerb::Pick),
            ],
        );
        let result = trial(&args, &slug("apply-restore"), false).unwrap();
        let new_head = result.head.unwrap();
        let moved = move_branch_blocking(&b.root, "feature", &b.c, &new_head).unwrap();
        let MoveOutcome::Moved { head, backup_ref } = moved else {
            panic!("expected the branch to move");
        };
        assert_eq!(head, new_head);
        assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), new_head);
        assert_eq!(git_ok(&b.root, &["rev-parse", &backup_ref]), b.c);
        assert_eq!(git_ok(&b.root, &["status", "--porcelain"]), "");
        let backups = list_backups(&b.root, "feature").unwrap();
        assert_eq!(backups.len(), 1);
        assert_eq!(backups[0].sha, b.c);
        let restored = move_branch_blocking(&b.root, "feature", &new_head, &b.c).unwrap();
        assert!(matches!(restored, MoveOutcome::Moved { .. }));
        assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.c);
        assert_eq!(list_backups(&b.root, "feature").unwrap().len(), 2);
    }

    #[test]
    fn applying_refuses_when_the_head_moved_or_the_tree_is_dirty() {
        let b = branch("apply-refuse");
        let moved = move_branch_blocking(&b.root, "feature", &b.b, &b.a).unwrap();
        assert_eq!(moved, MoveOutcome::HeadMoved { head: b.c.clone() });
        std::fs::write(b.root.join("policy.txt"), "dirty\n").unwrap();
        let blocked = move_branch_blocking(&b.root, "feature", &b.c, &b.a).unwrap();
        assert!(matches!(blocked, MoveOutcome::Blocked { .. }));
        assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.c);
    }

    #[test]
    fn a_crash_between_moving_the_ref_and_the_files_recovers() {
        let b = branch("apply-journal");
        let journal = journal_of(&b.root).unwrap();
        git_ok(&b.root, &["update-ref", "HEAD", &b.b, &b.c]);
        std::fs::write(&journal, format!("{}\n{}\nref\n", b.c, b.b)).unwrap();
        recover_journal(&b.root).unwrap();
        assert!(!journal.exists());
        assert_eq!(git_ok(&b.root, &["status", "--porcelain"]), "");
        assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.b);
    }

    #[test]
    fn old_backups_are_pruned() {
        let b = branch("prune");
        let old = format!("{}/1000000000000000000", backup_namespace("feature"));
        let fresh = format!("{}/{}", backup_namespace("feature"), now_nanos());
        git_ok(&b.root, &["update-ref", &old, &b.a]);
        git_ok(&b.root, &["update-ref", &fresh, &b.b]);
        prune_backups(&b.root);
        let left = list_backups(&b.root, "feature").unwrap();
        assert_eq!(left.len(), 1);
        assert_eq!(left[0].ref_name, fresh);
    }
    #[test]
    fn the_lease_push_refuses_when_origin_moved() {
        let b = branch("lease-push");
        let remote = b.root.join("remote.git");
        git_ok(&b.root, &["init", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &b.root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git_ok(&b.root, &["push", "-u", "origin", "feature"]);
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.a, HistoryVerb::Pick),
                step(&b.b, HistoryVerb::Squash),
                step(&b.c, HistoryVerb::Pick),
            ],
        );
        let new_head = trial(&args, &slug("lease-push"), false)
            .unwrap()
            .head
            .unwrap();
        move_branch_blocking(&b.root, "feature", &b.c, &new_head).unwrap();
        let cwd = b.root.to_string_lossy().into_owned();
        let refspec = "refs/heads/feature:refs/heads/feature";
        let stale = crate::github::run_git_authenticated(
            &[
                "push",
                &crate::github::lease_argument("feature", Some(&b.b)),
                "origin",
                refspec,
            ],
            &cwd,
            None,
        )
        .unwrap();
        assert!(matches!(
            crate::github::lease_push_outcome(&stale),
            crate::github::LeasePushOutcome::Stale { .. }
        ));
        let fresh = crate::github::run_git_authenticated(
            &[
                "push",
                &crate::github::lease_argument("feature", Some(&b.c)),
                "origin",
                refspec,
            ],
            &cwd,
            None,
        )
        .unwrap();
        assert_eq!(
            crate::github::lease_push_outcome(&fresh),
            crate::github::LeasePushOutcome::Pushed
        );
        assert_eq!(
            git_ok(&remote, &["rev-parse", "refs/heads/feature"]),
            new_head
        );
    }

    fn with_remote(b: &Branch) -> PathBuf {
        let remote = b.root.join("remote.git");
        git_ok(&b.root, &["init", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &b.root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git_ok(&b.root, &["push", "origin", "main", "feature"]);
        remote
    }

    #[test]
    fn a_rebase_plan_lists_the_branch_commits_onto_origin() {
        let b = branch("rebase-plan");
        with_remote(&b);
        git_ok(&b.root, &["checkout", "main"]);
        let upstream = commit(&b.root, "readme.txt", "hello\n", "main moves on");
        git_ok(&b.root, &["push", "origin", "main"]);
        git_ok(&b.root, &["checkout", "feature"]);
        let plan = rebase_plan(&b.root, "main", true).unwrap();
        assert_eq!(plan.onto, upstream);
        assert_eq!(plan.onto_ref, "origin/main");
        assert_eq!(plan.merge_base, b.base);
        assert_eq!(plan.behind, 1);
        assert_eq!(
            plan.commits
                .iter()
                .map(|c| c.sha.clone())
                .collect::<Vec<_>>(),
            vec![b.a.clone(), b.b.clone(), b.c.clone()]
        );
        let args = plan_args_for_rebase(&b.root, &plan);
        let prediction = predict(&args).unwrap();
        assert!(prediction
            .steps
            .iter()
            .all(|step| step.outcome == StepOutcome::Clean));
    }

    fn plan_args_for_rebase(root: &Path, plan: &RebasePlan) -> HistoryPlanArgs {
        HistoryPlanArgs {
            worktree_path: root.to_string_lossy().into_owned(),
            base: plan.onto.clone(),
            head: plan.head.clone(),
            steps: plan
                .commits
                .iter()
                .map(|c| step(&c.sha, HistoryVerb::Pick))
                .collect(),
        }
    }

    #[test]
    fn the_engine_rebuilds_the_rewriter_result_with_the_plan_messages_and_authors() {
        let b = branch("rewriter-collect");
        let mut reword = step(&b.a, HistoryVerb::Reword);
        reword.message = Some("A edits the policy, reworded".to_string());
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![
                step(&b.b, HistoryVerb::Pick),
                reword,
                step(&b.c, HistoryVerb::Pick),
            ],
        );
        let prepared = trial(&args, &slug("rewriter-collect"), true).unwrap();
        let copy = PathBuf::from(prepared.copy_path.clone().unwrap());
        assert_eq!(prepared.stop.unwrap().files, vec!["policy.txt".to_string()]);
        std::fs::write(copy.join("policy.txt"), "three\n").unwrap();
        git_ok(&copy, &["add", "policy.txt"]);
        git_ok(
            &copy,
            &["commit", "--no-verify", "-m", "whatever the agent typed"],
        );
        let second = git_run(&copy, &["cherry-pick", "--no-commit", &b.a], None, None).unwrap();
        assert_ne!(second.status, 0);
        std::fs::write(copy.join("policy.txt"), "three\n").unwrap();
        git_ok(&copy, &["add", "policy.txt"]);
        git_ok(
            &copy,
            &["commit", "--no-verify", "--allow-empty", "-m", "second"],
        );
        git_ok(&copy, &["cherry-pick", &b.c]);
        let check = collect_rewrite(&RewriterCollectArgs {
            plan: args,
            copy_path: copy.to_string_lossy().into_owned(),
            skipped: Vec::new(),
            keeps_copy: false,
        })
        .unwrap();
        assert!(check.problems.is_empty(), "{:?}", check.problems);
        let head = check.head.unwrap();
        assert_eq!(
            subjects(&b.root, &format!("{}..{head}", b.base)),
            vec![
                "C adds notes",
                "A edits the policy, reworded",
                "B edits the policy again"
            ]
        );
        assert!(check.is_tree_equal);
        assert!(!copy.exists());
        assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.c);
    }

    #[test]
    fn the_engine_refuses_a_rewrite_with_the_wrong_number_of_commits() {
        let b = branch("rewriter-count");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![step(&b.b, HistoryVerb::Pick), step(&b.a, HistoryVerb::Pick)],
        );
        let prepared = trial(&args, &slug("rewriter-count"), true).unwrap();
        let copy = PathBuf::from(prepared.copy_path.unwrap());
        git_ok(&copy, &["checkout", "--theirs", "policy.txt"]);
        git_ok(&copy, &["add", "policy.txt"]);
        git_ok(&copy, &["commit", "--no-verify", "-m", "only one"]);
        let check = collect_rewrite(&RewriterCollectArgs {
            plan: args,
            copy_path: copy.to_string_lossy().into_owned(),
            skipped: Vec::new(),
            keeps_copy: false,
        })
        .unwrap();
        assert_eq!(check.head, None);
        assert_eq!(check.problems.len(), 1);
        discard_copy(&b.root, &copy.to_string_lossy());
    }

    #[test]
    fn a_turn_with_the_push_block_cannot_push_to_origin() {
        let b = branch("push-block");
        let remote = with_remote(&b);
        commit(&b.root, "extra.txt", "extra\n", "extra");
        let mut command = crate::path_env::command("git");
        command
            .args(["push", "origin", "feature"])
            .current_dir(&b.root)
            .env("GIT_TERMINAL_PROMPT", "0");
        crate::turn::apply_push_block(&mut command);
        let output = command.output().unwrap();
        assert!(!output.status.success());
        let mut bare = crate::path_env::command("git");
        bare.args(["push"])
            .current_dir(&b.root)
            .env("GIT_TERMINAL_PROMPT", "0");
        crate::turn::apply_push_block(&mut bare);
        assert!(!bare.output().unwrap().status.success());
        assert_eq!(git_ok(&remote, &["rev-parse", "refs/heads/feature"]), b.c);
    }

    #[test]
    #[ignore = "timing spike, run with --ignored --nocapture on an idle machine"]
    fn predicting_a_thirty_commit_plan_stays_inside_the_budget() {
        let root = init_repo("predict-timing");
        for dir in 0..40 {
            let folder = root.join(format!("src/module{dir}"));
            std::fs::create_dir_all(&folder).unwrap();
            for file in 0..50 {
                std::fs::write(
                    folder.join(format!("file{file}.ts")),
                    format!("export const value{dir}_{file} = {file};\n"),
                )
                .unwrap();
            }
        }
        git_ok(&root, &["add", "."]);
        git_ok(
            &root,
            &["commit", "--no-verify", "-m", "base with 2000 files"],
        );
        let base = git_ok(&root, &["rev-parse", "HEAD"]);
        git_ok(&root, &["checkout", "-b", "feature"]);
        let shas: Vec<String> = (0..30)
            .map(|index| {
                commit(
                    &root,
                    &format!("src/module{}/file{}.ts", index % 40, index),
                    &format!("export const changed{index} = true;\n"),
                    &format!("change {index}"),
                )
            })
            .collect();
        let head = shas.last().unwrap().clone();
        let mut steps: Vec<HistoryStep> = shas
            .iter()
            .map(|sha| step(sha, HistoryVerb::Pick))
            .collect();
        steps.swap(3, 4);
        steps[10].verb = HistoryVerb::Squash;
        steps[20].verb = HistoryVerb::Drop;
        let mut fold = step(&shas[25], HistoryVerb::Fixup);
        fold.target = Some(shas[12].clone());
        steps[25] = fold;
        let args = plan(&root, &base, &head, steps);

        let started = std::time::Instant::now();
        let prediction = predict(&args).unwrap();
        let elapsed = started.elapsed().as_millis();

        let probe = std::time::Instant::now();
        for _ in 0..10 {
            git_ok(&root, &["rev-parse", "HEAD"]);
        }
        let per_spawn = probe.elapsed().as_millis() / 10;
        eprintln!(
            "history prediction of a 30 commit plan over 2000 files: {elapsed} ms, one git spawn: {per_spawn} ms"
        );
        assert!(prediction.head.is_some());
        assert!(elapsed < 5_000, "prediction took {elapsed} ms");
    }
}
