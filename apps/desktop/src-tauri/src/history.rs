use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Stdio};
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
const BATCHED_REPLAY_MIN: (u32, u32) = (2, 45);
const PREDICT_REF: &str = "refs/goodboy/predict";
const BACKUP_PREFIX: &str = "refs/goodboy/backup";
const BACKUP_KEEP_SECS: u64 = 30 * 24 * 60 * 60;
const KEPT_BACKUP_CAP: usize = 20;
const LEASE_HOLDER: &str = "history-rewrite";
const JOURNAL_FILE: &str = "goodboy-history.journal";
const COPY_PREFIX: &str = "goodboy-history-";
const TRIAL_SLUG_PREFIX: &str = "try-";
const COPY_DIR: &str = "copy";
const RESERVATIONS_DIR: &str = "history-copies";
const RESERVATION_FILE: &str = "goodboy-history-owner";
const RESERVATION_HEADER: &str = "goodboy history copy v1";
const RESERVATION_LOCK: &str = "goodboy-history.lock";
const STALE_TRIAL_SECS: u64 = 10 * 60;
const STALE_REWRITER_SECS: u64 = 24 * 60 * 60;

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
    #[serde(default)]
    pub onto: Option<String>,
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
    pub check: Option<TrialCheck>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TrialCheck {
    pub is_passed: bool,
    pub expects_same_code: bool,
    pub problems: Vec<String>,
    pub unexpected_files: Vec<String>,
    pub removed_files: Vec<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(tag = "stage", rename_all = "kebab-case")]
pub enum TrialProgress {
    Copy,
    Step {
        index: usize,
        total: usize,
        sha: String,
    },
    Check,
    Cleanup,
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
    pub is_legacy: bool,
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

fn supports_batched_replay() -> bool {
    git_version().is_some_and(|version| version >= BATCHED_REPLAY_MIN)
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

fn rev_parse_all(cwd: &Path, revs: &[String]) -> Option<Vec<String>> {
    let args: Vec<&str> = std::iter::once("rev-parse")
        .chain(revs.iter().map(String::as_str))
        .collect();
    let raw = git(cwd, &args).ok()?;
    let resolved: Vec<String> = raw
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect();
    (resolved.len() == revs.len()).then_some(resolved)
}

fn commit_rev(name: &str) -> String {
    format!("{}^{{commit}}", name.trim())
}

fn step_revs(steps: &[HistoryStep]) -> Vec<String> {
    steps
        .iter()
        .flat_map(|step| std::iter::once(step.sha.as_str()).chain(step.target.as_deref()))
        .map(commit_rev)
        .collect()
}

fn steps_from(steps: &[HistoryStep], resolved: Vec<String>) -> Vec<HistoryStep> {
    let mut next = resolved.into_iter();
    steps
        .iter()
        .map(|step| HistoryStep {
            sha: next.next().unwrap_or_default(),
            verb: step.verb,
            message: step.message.clone(),
            target: step.target.as_ref().and_then(|_| next.next()),
        })
        .collect()
}

struct ResolvedPlan {
    start: String,
    start_tree: String,
    head_tree: String,
    steps: Vec<HistoryStep>,
}

fn start_of(args: &HistoryPlanArgs) -> &str {
    args.onto
        .as_deref()
        .map(str::trim)
        .filter(|onto| !onto.is_empty())
        .unwrap_or(args.base.trim())
}

fn resolve_plan(cwd: &Path, args: &HistoryPlanArgs) -> Result<ResolvedPlan, WorktreeError> {
    let head_commit = commit_rev(&args.head);
    let start = start_of(args);
    let mut revs = vec![
        commit_rev(start),
        format!("{start}^{{tree}}"),
        format!("{head_commit}^{{tree}}"),
    ];
    revs.extend(step_revs(&args.steps));
    if let Some(mut resolved) = rev_parse_all(cwd, &revs) {
        let rest = resolved.split_off(3);
        let mut ends = resolved.into_iter();
        return Ok(ResolvedPlan {
            start: ends.next().unwrap_or_default(),
            start_tree: ends.next().unwrap_or_default(),
            head_tree: ends.next().unwrap_or_default(),
            steps: steps_from(&args.steps, rest),
        });
    }
    let start = resolve_commit(cwd, start)?;
    let head = resolve_commit(cwd, &args.head)?;
    Ok(ResolvedPlan {
        start_tree: tree_of(cwd, &start)?,
        head_tree: tree_of(cwd, &head)?,
        steps: resolved_steps(cwd, &args.steps)?,
        start,
    })
}

fn resolved_steps(cwd: &Path, steps: &[HistoryStep]) -> Result<Vec<HistoryStep>, WorktreeError> {
    if let Some(resolved) = rev_parse_all(cwd, &step_revs(steps)) {
        return Ok(steps_from(steps, resolved));
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

fn is_targeted_fold(step: &HistoryStep) -> bool {
    matches!(step.verb, HistoryVerb::Fixup | HistoryVerb::Squash) && step.target.is_some()
}

pub(crate) fn order_steps(steps: &[HistoryStep]) -> Result<Vec<HistoryStep>, WorktreeError> {
    let (mut pending, mut ordered): (Vec<HistoryStep>, Vec<HistoryStep>) =
        steps.iter().cloned().partition(is_targeted_fold);
    while !pending.is_empty() {
        let before = pending.len();
        let mut waiting = Vec::new();
        for fold in pending {
            let target = fold.target.clone().unwrap_or_default();
            let Some(index) = ordered.iter().position(|step| step.sha == target) else {
                waiting.push(fold);
                continue;
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
        if waiting.len() == before {
            let fold = &waiting[0];
            return Err(plan_error(&format!(
                "{} folds into a commit that is not in the plan",
                short(&fold.sha)
            )));
        }
        pending = waiting;
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

struct MergeStream {
    child: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
}

impl MergeStream {
    fn start(cwd: &Path) -> Result<Self, WorktreeError> {
        let mut child = crate::path_env::command("git")
            .args([
                "merge-tree",
                "--stdin",
                "--name-only",
                "--no-messages",
                "-z",
            ])
            .current_dir(cwd)
            .env("GIT_TERMINAL_PROMPT", "0")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()?;
        let input = child.stdin.take();
        let output = child.stdout.take();
        let (Some(input), Some(output)) = (input, output) else {
            let _ = child.kill();
            let _ = child.wait();
            return Err(plan_error("git merge-tree did not open its pipes"));
        };
        Ok(Self {
            child,
            input,
            output: BufReader::new(output),
        })
    }

    fn token(&mut self) -> Result<String, WorktreeError> {
        let mut raw = Vec::new();
        self.output.read_until(0, &mut raw)?;
        if raw.pop() != Some(0) {
            return Err(plan_error("git merge-tree stopped answering"));
        }
        Ok(String::from_utf8_lossy(&raw).into_owned())
    }

    fn merge(
        &mut self,
        merge_base: &str,
        ours: &str,
        theirs: &str,
    ) -> Result<MergeResult, WorktreeError> {
        writeln!(self.input, "{merge_base} -- {ours} {theirs}")?;
        self.input.flush()?;
        let status = self.token()?;
        let tree = self.token()?;
        let mut files = Vec::new();
        loop {
            let file = self.token()?;
            if file.is_empty() {
                break;
            }
            files.push(file);
        }
        match status.as_str() {
            "1" => Ok(MergeResult::Tree(tree)),
            "0" => Ok(MergeResult::Conflict(files)),
            _ => Err(plan_error("git merge-tree answered with an unknown status")),
        }
    }
}

impl Drop for MergeStream {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

struct PendingCommit {
    tree: String,
    parent: String,
    message: String,
    author: Author,
}

enum Replayer {
    Batched {
        merges: MergeStream,
        commits: Vec<PendingCommit>,
    },
    Direct,
}

impl Replayer {
    fn start(cwd: &Path, batched: bool) -> Result<Self, WorktreeError> {
        if !batched {
            return Ok(Self::Direct);
        }
        Ok(Self::Batched {
            merges: MergeStream::start(cwd)?,
            commits: Vec::new(),
        })
    }

    fn merge(
        &mut self,
        cwd: &Path,
        merge_base: &str,
        tip: &str,
        tip_tree: &str,
        theirs: &str,
    ) -> Result<MergeResult, WorktreeError> {
        match self {
            Self::Batched { merges, .. } => merges.merge(merge_base, tip_tree, theirs),
            Self::Direct => merge_in_memory(cwd, merge_base, tip, theirs),
        }
    }

    fn commit(
        &mut self,
        cwd: &Path,
        tree: &str,
        parent: &str,
        message: &str,
        author: &Author,
    ) -> Result<String, WorktreeError> {
        match self {
            Self::Batched { commits, .. } => {
                commits.push(PendingCommit {
                    tree: tree.to_string(),
                    parent: parent.to_string(),
                    message: message.to_string(),
                    author: author.clone(),
                });
                Ok(format!(":{}", commits.len()))
            }
            Self::Direct => commit_tree(cwd, tree, parent, message, author),
        }
    }

    fn finish(self, cwd: &Path) -> Result<HashMap<String, String>, WorktreeError> {
        match self {
            Self::Batched { merges, commits } => {
                drop(merges);
                write_commits(cwd, &commits)
            }
            Self::Direct => Ok(HashMap::new()),
        }
    }
}

fn import_script(commits: &[PendingCommit], committer: &str) -> String {
    let mut script = String::new();
    for (index, pending) in commits.iter().enumerate() {
        script.push_str(&format!(
            "commit {PREDICT_REF}\nmark :{}\nauthor {} <{}> {}\ncommitter {committer}\ndata {}\n{}\nfrom {}\nM 040000 {} \"\"\n\n",
            index + 1,
            pending.author.name,
            pending.author.email,
            pending.author.date,
            pending.message.len(),
            pending.message,
            pending.parent,
            pending.tree,
        ));
    }
    for index in 1..=commits.len() {
        script.push_str(&format!("get-mark :{index}\n"));
    }
    script.push_str(&format!("reset {PREDICT_REF}\n\ndone\n"));
    script
}

fn write_commits(
    cwd: &Path,
    commits: &[PendingCommit],
) -> Result<HashMap<String, String>, WorktreeError> {
    if commits.is_empty() {
        return Ok(HashMap::new());
    }
    let committer = git(cwd, &["var", "GIT_COMMITTER_IDENT"])?
        .trim()
        .to_string();
    let script = import_script(commits, &committer);
    let mut child = crate::path_env::command("git")
        .args(["fast-import", "--quiet", "--done", "--cat-blob-fd=1"])
        .current_dir(cwd)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let input = child.stdin.take();
    let writer = std::thread::spawn(move || {
        input.map_or(Ok(()), |mut input| input.write_all(script.as_bytes()))
    });
    let output = child.wait_with_output()?;
    let written = writer.join().unwrap_or(Ok(()));
    if !output.status.success() {
        return Err(plan_error(&format!(
            "git fast-import failed: {}",
            crate::worktree::redact_credentials(&String::from_utf8_lossy(&output.stderr)).trim()
        )));
    }
    written?;
    let shas: Vec<String> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect();
    if shas.len() != commits.len() {
        return Err(plan_error(
            "git fast-import returned the wrong number of commits",
        ));
    }
    Ok(shas
        .into_iter()
        .enumerate()
        .map(|(index, sha)| (format!(":{}", index + 1), sha))
        .collect())
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
    let resolved = resolve_plan(cwd, args)?;
    let ordered = order_steps(&resolved.steps)?;
    if supports_batched_replay() {
        if let Ok(found) = predict_with(cwd, &resolved, &ordered, true) {
            return Ok(found);
        }
    }
    predict_with(cwd, &resolved, &ordered, false)
}

fn predict_with(
    cwd: &Path,
    resolved: &ResolvedPlan,
    ordered: &[HistoryStep],
    batched: bool,
) -> Result<PlanPrediction, WorktreeError> {
    let steps = &resolved.steps;
    let replayed: Vec<String> = ordered
        .iter()
        .filter(|step| step.verb != HistoryVerb::Drop)
        .map(|step| step.sha.clone())
        .collect();
    let mut infos = read_commits(cwd, &replayed)?;
    let mut replayer = Replayer::start(cwd, batched)?;
    let mut outcomes: HashMap<String, StepPrediction> = HashMap::new();
    let mut tip = resolved.start.clone();
    let mut tip_tree = resolved.start_tree.clone();
    let mut group: Option<Group> = None;
    let mut map = Vec::new();
    let mut stopped = false;
    for step in ordered {
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
        if step.verb == HistoryVerb::Pick && info.parents[0] == tip {
            finish_group(group.take(), &tip, &mut map);
            group = Some(Group {
                message: info.message.clone(),
                author: info.author(),
                parent: tip.clone(),
                members: vec![step.sha.clone()],
            });
            tip = step.sha.clone();
            tip_tree = tree_of(cwd, &tip)?;
            outcomes.insert(step.sha.clone(), prediction(&step.sha, StepOutcome::Clean));
            continue;
        }
        let merge_base = info.parents[0].clone();
        match replayer.merge(cwd, &merge_base, &tip, &tip_tree, &step.sha)? {
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
                let is_empty = !is_folding && tree == tip_tree;
                if is_folding {
                    let Some(current) = group.as_mut() else {
                        return Err(plan_error("a squash has no commit to merge into"));
                    };
                    let message = combined_message(step, &current.message, &info);
                    let author = current.author.clone();
                    tip = replayer.commit(cwd, &tree, &current.parent, &message, &author)?;
                    current.message = message;
                    current.members.push(step.sha.clone());
                    tip_tree = tree;
                } else {
                    finish_group(group.take(), &tip, &mut map);
                    let message = message_of(step, &info);
                    let author = info.author();
                    let parent = tip.clone();
                    tip = replayer.commit(cwd, &tree, &parent, &message, &author)?;
                    tip_tree = tree;
                    group = Some(Group {
                        message,
                        author,
                        parent,
                        members: vec![step.sha.clone()],
                    });
                }
                let outcome = if is_empty {
                    StepOutcome::Empty
                } else {
                    StepOutcome::Clean
                };
                outcomes.insert(step.sha.clone(), prediction(&step.sha, outcome));
            }
        }
    }
    finish_group(group, &tip, &mut map);
    let written = replayer.finish(cwd)?;
    let sha_of = |handle: &str| {
        written
            .get(handle)
            .cloned()
            .unwrap_or_else(|| handle.to_string())
    };
    for moved in &map {
        if let Some(entry) = outcomes.get_mut(&moved.from) {
            entry.new_sha = moved.to.as_deref().map(sha_of);
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
        is_tree_equal: tip_tree == resolved.head_tree,
        changed_files: changed_files(cwd, &resolved.head_tree, &tip_tree),
        head: Some(sha_of(&tip)),
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

fn reservations_dir() -> PathBuf {
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

fn held_locks() -> &'static std::sync::Mutex<HashMap<PathBuf, std::fs::File>> {
    static HELD: OnceLock<std::sync::Mutex<HashMap<PathBuf, std::fs::File>>> = OnceLock::new();
    HELD.get_or_init(|| std::sync::Mutex::new(HashMap::new()))
}

fn take_held(root: &Path) -> Option<std::fs::File> {
    held_locks().lock().ok()?.remove(root)
}

fn is_held(root: &Path) -> bool {
    held_locks()
        .lock()
        .map(|held| held.contains_key(root))
        .unwrap_or(true)
}

#[cfg(unix)]
fn try_lock_exclusive(file: &std::fs::File) -> bool {
    use std::os::unix::io::AsRawFd;
    unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) == 0 }
}

#[cfg(not(unix))]
fn try_lock_exclusive(file: &std::fs::File) -> bool {
    file.try_lock().is_ok()
}

fn open_lock(root: &Path) -> Option<std::fs::File> {
    let file = std::fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(root.join(RESERVATION_LOCK))
        .ok()?;
    try_lock_exclusive(&file).then_some(file)
}

fn reservation_root_of(copy: &Path) -> Option<PathBuf> {
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

fn owner_repo(root: &Path) -> Option<PathBuf> {
    read_owner(root).map(|owner| owner.repo)
}

fn owner_text(repo: &Path, admin: Option<&Path>) -> String {
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

fn is_regular_file(path: &Path) -> bool {
    std::fs::symlink_metadata(path).is_ok_and(|meta| meta.file_type().is_file())
}

fn is_real_dir(path: &Path) -> bool {
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

fn created_admin_dir(copy: &Path, repo: &Path) -> Option<PathBuf> {
    let pointer_file = copy.join(".git");
    if !is_regular_file(&pointer_file) {
        return None;
    }
    let pointer = std::fs::read_to_string(&pointer_file).ok()?;
    let named = PathBuf::from(pointer.trim().strip_prefix("gitdir:")?.trim());
    let admin = std::fs::canonicalize(copy.join(named)).ok()?;
    (admin.parent()? == repo.join("worktrees")).then_some(admin)
}

fn recorded_admin_dir(root: &Path) -> Option<PathBuf> {
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

fn remove_reservation(root: &Path, held: Option<std::fs::File>) -> bool {
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
    progress: &dyn Fn(TrialProgress),
) -> Result<Replay, WorktreeError> {
    let mut group: Option<Group> = None;
    let mut map = Vec::new();
    let mut tip = resolve_commit(copy, "HEAD")?;
    for (position, step) in ordered.iter().enumerate() {
        progress(TrialProgress::Step {
            index: position + 1,
            total: ordered.len(),
            sha: step.sha.clone(),
        });
        if step.verb == HistoryVerb::Drop {
            map.push(ShaMove {
                from: step.sha.clone(),
                to: None,
            });
            continue;
        }
        let info = single_parent(copy, &step.sha)?;
        if step.verb == HistoryVerb::Pick && info.parents[0] == tip {
            git(copy, &["reset", "--hard", "--quiet", &step.sha])?;
            finish_group(group.take(), &tip, &mut map);
            group = Some(Group {
                message: info.message.clone(),
                author: info.author(),
                parent: tip.clone(),
                members: vec![step.sha.clone()],
            });
            tip = step.sha.clone();
            continue;
        }
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
            let run = git_run(
                copy,
                &["commit", "--allow-empty", "-F", "-"],
                Some(&author),
                Some(&message),
            )?;
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

struct CopyGuard {
    root: PathBuf,
    lock: Option<std::fs::File>,
    is_kept: bool,
}

impl Drop for CopyGuard {
    fn drop(&mut self) {
        let lock = self.lock.take();
        if !self.is_kept {
            remove_reservation(&self.root, lock);
            return;
        }
        if let (Some(lock), Ok(mut held)) = (lock, held_locks().lock()) {
            held.insert(self.root.clone(), lock);
        }
    }
}

fn common_dir_of(cwd: &Path) -> Result<PathBuf, WorktreeError> {
    let raw = git(cwd, &["rev-parse", "--git-common-dir"])?;
    let path = PathBuf::from(raw.trim());
    let absolute = if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    };
    Ok(std::fs::canonicalize(absolute)?)
}

fn create_copy(cwd: &Path, copy: &Path, start: &str) -> Result<CopyGuard, WorktreeError> {
    let root = reservation_root_of(copy)
        .filter(|root| root.is_absolute())
        .ok_or_else(|| plan_error("the temporary copy has no reserved folder"))?;
    let repo = common_dir_of(cwd)?;
    if let Some(parent) = root.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::create_dir(&root).map_err(|_| {
        plan_error("a folder already sits where the temporary copy goes, so nothing was changed")
    })?;
    let written = std::fs::write(root.join(RESERVATION_FILE), owner_text(&repo, None));
    let lock = open_lock(&root);
    if written.is_err() || lock.is_none() {
        let _ = std::fs::remove_dir_all(&root);
        return Err(plan_error("couldn't reserve the temporary copy"));
    }
    let guard = CopyGuard {
        root,
        lock,
        is_kept: false,
    };
    let copy_text = copy.to_string_lossy().to_string();
    let added = git(
        cwd,
        &[
            "-c",
            "worktree.useRelativePaths=false",
            "worktree",
            "add",
            "--detach",
            "--quiet",
            &copy_text,
            start,
        ],
    );
    let recorded = created_admin_dir(copy, &repo).is_some_and(|admin| {
        let staged = guard.root.join(format!("{RESERVATION_FILE}.next"));
        std::fs::write(&staged, owner_text(&repo, Some(&admin))).is_ok()
            && std::fs::rename(&staged, guard.root.join(RESERVATION_FILE)).is_ok()
            && recorded_admin_dir(&guard.root).as_deref() == Some(admin.as_path())
    });
    if !recorded {
        let _ = git(cwd, &["worktree", "remove", "--force", &copy_text]);
    }
    added?;
    if !recorded {
        return Err(plan_error("couldn't record the temporary copy"));
    }
    Ok(guard)
}

pub(crate) fn trial(
    args: &HistoryPlanArgs,
    slug: &str,
    keeps_copy_on_stop: bool,
) -> Result<TrialResult, WorktreeError> {
    trial_with(args, slug, keeps_copy_on_stop, &|_| {})
}

pub(crate) fn trial_with(
    args: &HistoryPlanArgs,
    slug: &str,
    keeps_copy_on_stop: bool,
    progress: &dyn Fn(TrialProgress),
) -> Result<TrialResult, WorktreeError> {
    let cwd = Path::new(&args.worktree_path);
    if !cwd.exists() {
        return Err(WorktreeError::RepoNotFound(args.worktree_path.clone()));
    }
    let base = resolve_commit(cwd, &args.base)?;
    let start = resolve_commit(cwd, start_of(args))?;
    let old_head = resolve_commit(cwd, &args.head)?;
    let steps = resolved_steps(cwd, &args.steps)?;
    let ordered = order_steps(&steps)?;
    let order = planned_order(cwd, &ordered)?;
    let copy = copy_path_of(slug);
    let copy_text = copy.to_string_lossy().to_string();
    progress(TrialProgress::Copy);
    let mut guard = create_copy(cwd, &copy, &start)?;
    let replay = replay_in_copy(&copy, &steps, &ordered, progress)?;
    if replay.stop.is_some() {
        progress(TrialProgress::Cleanup);
        guard.is_kept = keeps_copy_on_stop;
        drop(guard);
        return Ok(TrialResult {
            head: None,
            map: replay.map,
            is_tree_equal: false,
            changed_files: Vec::new(),
            stop: replay.stop,
            copy_path: keeps_copy_on_stop.then_some(copy_text),
            order,
            check: None,
        });
    }
    progress(TrialProgress::Check);
    let made = ordered
        .iter()
        .filter(|step| {
            !matches!(
                step.verb,
                HistoryVerb::Drop | HistoryVerb::Squash | HistoryVerb::Fixup
            )
        })
        .count();
    let check = check_trial(
        cwd,
        Some(&copy),
        &CheckInput {
            base: &base,
            start: &start,
            old_head: &old_head,
            new_head: &replay.head,
            steps: &steps,
            ordered: &ordered,
            made: Some(made),
        },
    );
    progress(TrialProgress::Cleanup);
    drop(guard);
    Ok(TrialResult {
        is_tree_equal: tree_of(cwd, &replay.head)? == tree_of(cwd, &old_head)?,
        changed_files: changed_files(cwd, &old_head, &replay.head),
        head: Some(replay.head),
        map: replay.map,
        stop: None,
        copy_path: None,
        order,
        check: Some(check),
    })
}

struct CheckInput<'a> {
    base: &'a str,
    start: &'a str,
    old_head: &'a str,
    new_head: &'a str,
    steps: &'a [HistoryStep],
    ordered: &'a [HistoryStep],
    made: Option<usize>,
}

fn lines_of(raw: &str) -> Vec<String> {
    raw.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect()
}

fn files_of_commit(cwd: &Path, sha: &str) -> Vec<String> {
    git(
        cwd,
        &[
            "diff-tree",
            "--no-commit-id",
            "--name-only",
            "-r",
            "--root",
            sha,
        ],
    )
    .map(|raw| lines_of(&raw))
    .unwrap_or_default()
}

fn count_of(cwd: &Path, args: &[&str]) -> Option<usize> {
    git(cwd, args).ok()?.trim().parse::<usize>().ok()
}

fn is_ancestor(cwd: &Path, older: &str, newer: &str) -> bool {
    git_run(
        cwd,
        &["merge-base", "--is-ancestor", older, newer],
        None,
        None,
    )
    .is_ok_and(|run| run.status == 0)
}

fn plural_files(count: usize) -> &'static str {
    if count == 1 {
        "file"
    } else {
        "files"
    }
}

fn check_trial(cwd: &Path, copy: Option<&Path>, input: &CheckInput<'_>) -> TrialCheck {
    let mut problems = Vec::new();
    if let Some(problem) = copy.and_then(copy_problem) {
        problems.push(problem);
    }
    if !is_ancestor(cwd, input.start, input.new_head) {
        problems.push("The result is not built on the commit it should start from.".to_string());
    }
    let range = format!("{}..{}", input.start, input.new_head);
    let merges = count_of(cwd, &["rev-list", "--count", "--min-parents=2", &range]);
    if merges != Some(0) {
        problems.push("The result contains a merge commit.".to_string());
    }
    if let Some(made) = input.made {
        let counted = count_of(cwd, &["rev-list", "--count", "--first-parent", &range]);
        if counted != Some(made) {
            problems.push(format!(
                "The result has {} commits, the plan makes {made}.",
                counted.map_or_else(|| "an unknown number of".to_string(), |n| n.to_string())
            ));
        }
    }
    let dropped: Vec<&HistoryStep> = input
        .ordered
        .iter()
        .filter(|step| step.verb == HistoryVerb::Drop)
        .collect();
    let mut removed_files: Vec<String> = dropped
        .iter()
        .flat_map(|step| files_of_commit(cwd, &step.sha))
        .collect();
    removed_files.sort();
    removed_files.dedup();
    let own: std::collections::HashSet<String> = git(
        cwd,
        &["rev-list", &format!("{}..{}", input.base, input.old_head)],
    )
    .map(|raw| lines_of(&raw).into_iter().collect())
    .unwrap_or_default();
    let planned: std::collections::HashSet<String> =
        input.steps.iter().map(|step| step.sha.clone()).collect();
    let is_rewrite = !own.is_empty() && own == planned;
    let is_rebase = input.start != input.base;
    let mut unexpected_files = Vec::new();
    if is_rewrite {
        let new_tree = tree_of(cwd, input.new_head).unwrap_or_default();
        let (expected, main_files) = if is_rebase {
            let merged = supports_merge_tree_base()
                .then(|| merge_in_memory(cwd, input.base, input.start, input.old_head).ok())
                .flatten();
            match merged {
                Some(MergeResult::Tree(tree)) => (Some(tree), Vec::new()),
                _ => (None, changed_files(cwd, input.base, input.start)),
            }
        } else {
            (tree_of(cwd, input.old_head).ok(), Vec::new())
        };
        let differing = match expected {
            Some(tree) => changed_files(cwd, &tree, &new_tree),
            None => changed_files(cwd, input.old_head, &new_tree),
        };
        unexpected_files = differing
            .into_iter()
            .filter(|file| !removed_files.contains(file) && !main_files.contains(file))
            .collect();
        if !unexpected_files.is_empty() {
            problems.push(format!(
                "The result differs from what the plan should make in {} {}: {}.",
                unexpected_files.len(),
                plural_files(unexpected_files.len()),
                unexpected_files.join(", ")
            ));
        }
    }
    TrialCheck {
        is_passed: problems.is_empty(),
        expects_same_code: is_rewrite && !is_rebase && dropped.is_empty(),
        problems,
        unexpected_files,
        removed_files,
    }
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
    let encoded: String = branch.bytes().map(|byte| format!("{byte:02x}")).collect();
    format!("{BACKUP_PREFIX}/b-{encoded}")
}

const KEPT_STAMP: &str = "keep-";

fn is_stamp(stamp: &str) -> bool {
    let digits = stamp.strip_prefix(KEPT_STAMP).unwrap_or(stamp);
    !digits.is_empty() && digits.bytes().all(|byte| byte.is_ascii_digit())
}

pub(crate) fn is_backup_of(branch: &str, ref_name: &str) -> bool {
    ref_name
        .strip_prefix(&format!("{}/", backup_namespace(branch)))
        .is_some_and(is_stamp)
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

fn matches_tree(cwd: &Path, commit: &str) -> bool {
    let index = git_run(cwd, &["diff", "--cached", "--quiet", commit], None, None);
    let files = git_run(cwd, &["diff", "--quiet", commit], None, None);
    index.is_ok_and(|run| run.status == 0) && files.is_ok_and(|run| run.status == 0)
}

fn branch_ref(branch: &str) -> String {
    format!("refs/heads/{branch}")
}

fn is_on_branch(cwd: &Path, branch: &str) -> bool {
    git(cwd, &["symbolic-ref", "-q", "HEAD"]).is_ok_and(|raw| raw.trim() == branch_ref(branch))
}

fn branch_tip(cwd: &Path, branch: &str) -> Option<String> {
    rev_parse_all(cwd, &[format!("{}^{{commit}}", branch_ref(branch))])?
        .into_iter()
        .next()
}

fn is_consistent(cwd: &Path) -> bool {
    matches_tree(cwd, "HEAD")
}

fn pending_notice(journal: &Path, detail: &str) -> String {
    format!(
        "An earlier rewrite here was interrupted and {detail} Goodboy changes nothing until it is settled: check git status, then delete {} to go on.",
        journal.display()
    )
}

pub(crate) fn recover_journal(cwd: &Path) -> Result<Option<String>, WorktreeError> {
    let Some(journal) = journal_of(cwd) else {
        return Ok(None);
    };
    if !journal.exists() {
        return Ok(None);
    }
    let recorded = std::fs::read_to_string(&journal)?;
    let lines: Vec<&str> = recorded.lines().map(str::trim).collect();
    let [old, new, _backup, branch, ..] = lines.as_slice() else {
        return Ok(Some(pending_notice(
            &journal,
            "it was written by an older Goodboy that did not record its branch, so it will not be guessed.",
        )));
    };
    let (old, new, branch) = (old.to_string(), new.to_string(), branch.to_string());
    if branch.is_empty() {
        return Ok(Some(pending_notice(
            &journal,
            "it does not name its branch.",
        )));
    }
    let is_ours = is_on_branch(cwd, &branch) && old != new;
    let tip = branch_tip(cwd, &branch);
    if is_ours && tip.as_deref() == Some(old.as_str()) && matches_tree(cwd, &new) {
        let finished = git_run(
            cwd,
            &[
                "update-ref",
                "-m",
                "goodboy: finish rewrite",
                &branch_ref(&branch),
                &new,
                &old,
            ],
            None,
            None,
        )?;
        if finished.status == 0 && is_consistent(cwd) {
            std::fs::remove_file(&journal)?;
            return Ok(None);
        }
        return Ok(Some(pending_notice(
            &journal,
            &format!("finishing it failed: {}", finished.stderr.trim()),
        )));
    }
    if is_ours && tip.as_deref() == Some(new.as_str()) && matches_tree(cwd, &old) {
        let finished = git_run(cwd, &["read-tree", "-m", "-u", &old, &new], None, None)?;
        if finished.status == 0 && is_consistent(cwd) {
            std::fs::remove_file(&journal)?;
            return Ok(None);
        }
        return Ok(Some(pending_notice(
            &journal,
            &format!("finishing it failed: {}", finished.stderr.trim()),
        )));
    }
    if is_consistent(cwd) {
        std::fs::remove_file(&journal)?;
        return Ok(None);
    }
    if !is_on_branch(cwd, &branch) {
        return Ok(Some(pending_notice(
            &journal,
            &format!("belongs to {branch}, which is not checked out here."),
        )));
    }
    Ok(Some(pending_notice(
        &journal,
        "the branch and the files no longer match either side of it.",
    )))
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
                "{pending} {} here {} changes that are not committed. Commit or stash {} first: rewriting needs a clean worktree.",
                if pending == 1 { "file" } else { "files" },
                if pending == 1 { "has" } else { "have" },
                if pending == 1 { "it" } else { "them" }
            ))
        }
        GitWorkingTree::Unknown { .. } => Some("Couldn't read the worktree status.".to_string()),
    }
}

fn nul_paths(raw: &str) -> Vec<String> {
    raw.split('\0')
        .filter(|path| !path.is_empty())
        .map(|path| path.trim_end_matches('/').to_string())
        .collect()
}

fn parents_of(path: &str) -> impl Iterator<Item = &str> {
    path.match_indices('/')
        .map(move |(index, _)| &path[..index])
}

pub(crate) fn untracked_in_the_way(cwd: &Path, target: &str) -> Option<String> {
    let Ok(raw_untracked) = git(cwd, &["ls-files", "-z", "--others", "--directory"]) else {
        return Some("Couldn't list the untracked files here, so nothing was changed.".to_string());
    };
    let untracked = nul_paths(&raw_untracked);
    if untracked.is_empty() {
        return None;
    }
    let Ok(raw_tracked) = git(cwd, &["ls-tree", "-r", "-z", "--name-only", target]) else {
        return Some("Couldn't read the rewritten files, so nothing was changed.".to_string());
    };
    let files: std::collections::HashSet<String> = nul_paths(&raw_tracked).into_iter().collect();
    let dirs: std::collections::HashSet<&str> =
        files.iter().flat_map(|file| parents_of(file)).collect();
    let blocking: Vec<String> = untracked
        .into_iter()
        .filter(|path| {
            files.contains(path)
                || dirs.contains(path.as_str())
                || parents_of(path).any(|parent| files.contains(parent))
        })
        .collect();
    if blocking.is_empty() {
        return None;
    }
    Some(format!(
        "{} untracked or ignored {} would be overwritten: {}. Move or commit {} first. Nothing was changed.",
        blocking.len(),
        if blocking.len() == 1 { "path" } else { "paths" },
        blocking.join(", "),
        if blocking.len() == 1 { "it" } else { "them" }
    ))
}

pub(crate) fn preflight(cwd: &Path, branch: &str, expected_head: &str) -> Option<String> {
    let current_branch = crate::worktree::current_branch_name(cwd).unwrap_or_default();
    if current_branch != branch {
        return Some(format!(
            "This worktree is on {current_branch}, not {branch}. Nothing was changed."
        ));
    }
    if let Some(reason) = blocking_reason(cwd) {
        return Some(reason);
    }
    let head = resolve_commit(cwd, "HEAD").ok()?;
    let expected = resolve_commit(cwd, expected_head).ok()?;
    if head != expected {
        return Some(
            "The branch moved since this plan was made. Refresh to plan on the new commits."
                .to_string(),
        );
    }
    None
}

pub(crate) fn move_branch_blocking(
    cwd: &Path,
    branch: &str,
    expected_head: &str,
    new_head: &str,
) -> Result<MoveOutcome, WorktreeError> {
    move_branch_with(cwd, branch, expected_head, new_head, false)
}

pub(crate) fn restore_blocking(
    cwd: &Path,
    branch: &str,
    expected_head: &str,
    backup_ref: &str,
) -> Result<MoveOutcome, WorktreeError> {
    if !is_backup_of(branch, backup_ref) {
        return Err(plan_error("that backup belongs to another branch"));
    }
    let target = resolve_commit(cwd, backup_ref)?;
    move_branch_with(cwd, branch, expected_head, &target, true)
}

fn move_branch_with(
    cwd: &Path,
    branch: &str,
    expected_head: &str,
    new_head: &str,
    keeps_backup: bool,
) -> Result<MoveOutcome, WorktreeError> {
    if let Some(reason) = recover_journal(cwd)? {
        return Ok(MoveOutcome::Blocked { reason });
    }
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
    if let Some(reason) = untracked_in_the_way(cwd, &target) {
        return Ok(MoveOutcome::Blocked { reason });
    }
    let backup_ref = format!(
        "{}/{}{}",
        backup_namespace(branch),
        if keeps_backup { KEPT_STAMP } else { "" },
        now_nanos()
    );
    git(cwd, &["update-ref", &backup_ref, &expected])?;
    let journal = journal_of(cwd).ok_or_else(|| plan_error("the worktree has no git directory"))?;
    std::fs::write(
        &journal,
        format!("{expected}\n{target}\n{backup_ref}\n{branch}\n"),
    )?;
    let outcome = apply_move(cwd, branch, &expected, &target, &backup_ref);
    if is_consistent(cwd) {
        let _ = std::fs::remove_file(&journal);
    }
    outcome
}

pub(crate) fn apply_move(
    cwd: &Path,
    branch: &str,
    expected: &str,
    target: &str,
    backup_ref: &str,
) -> Result<MoveOutcome, WorktreeError> {
    if !is_on_branch(cwd, branch) {
        return Ok(MoveOutcome::Blocked {
            reason: format!("This worktree is no longer on {branch}, so nothing was changed."),
        });
    }
    let tip = branch_tip(cwd, branch).unwrap_or_default();
    if tip != expected {
        return Ok(MoveOutcome::HeadMoved { head: tip });
    }
    let files = git_run(
        cwd,
        &["read-tree", "-m", "-u", expected, target],
        None,
        None,
    )?;
    if files.status != 0 {
        return Ok(MoveOutcome::Blocked {
            reason: format!(
                "Git refused to update the files without losing work, so nothing was changed. {}",
                files.stderr.trim()
            ),
        });
    }
    let reference = branch_ref(branch);
    let moved = git_run(
        cwd,
        &[
            "update-ref",
            "-m",
            "goodboy: rewrite history",
            &reference,
            target,
            expected,
        ],
        None,
        None,
    )?;
    if moved.status == 0 && is_on_branch(cwd, branch) {
        return Ok(MoveOutcome::Moved {
            head: target.to_string(),
            backup_ref: backup_ref.to_string(),
        });
    }
    if moved.status == 0 {
        let _ = git_run(
            cwd,
            &["update-ref", &reference, expected, target],
            None,
            None,
        );
    }
    let head = resolve_commit(cwd, "HEAD")?;
    let back = git_run(cwd, &["read-tree", "-m", "-u", target, &head], None, None)?;
    if back.status == 0 {
        return Ok(MoveOutcome::HeadMoved { head });
    }
    Ok(MoveOutcome::Blocked {
        reason: format!(
            "The branch changed while the files were updated. Nothing was reset; the files now match the rewrite and the previous history is kept as {backup_ref}."
        ),
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
        .map(|stamp| stamp.strip_prefix(KEPT_STAMP).unwrap_or(stamp))
        .and_then(|stamp| stamp.parse::<u128>().ok())
        .map(|nanos| (nanos / 1_000_000_000) as u64)
        .unwrap_or_default()
}

fn legacy_backup_of(ref_name: &str) -> Option<(&str, &str)> {
    let rest = ref_name.strip_prefix(&format!("{BACKUP_PREFIX}/"))?;
    let (slug, stamp) = rest.split_once('/')?;
    let is_legacy = !slug.starts_with("b-")
        && !stamp.is_empty()
        && stamp.bytes().all(|byte| byte.is_ascii_digit());
    is_legacy.then_some((slug, stamp))
}

fn backup_refs(cwd: &Path) -> Result<Vec<(String, String, String)>, WorktreeError> {
    let raw = git(
        cwd,
        &[
            "for-each-ref",
            "--format=%(refname)%1f%(objectname)%1f%(subject)",
            BACKUP_PREFIX,
        ],
    )?;
    Ok(raw
        .lines()
        .filter_map(|line| {
            let mut parts = line.split('\u{1f}');
            let ref_name = parts.next()?.trim().to_string();
            let sha = parts.next()?.trim().to_string();
            let subject = parts.next().unwrap_or_default().trim().to_string();
            Some((ref_name, sha, subject))
        })
        .collect())
}

pub(crate) fn list_backups(cwd: &Path, branch: &str) -> Result<Vec<HistoryBackup>, WorktreeError> {
    let slug = sanitize_slug(branch);
    let mut backups: Vec<HistoryBackup> = backup_refs(cwd)?
        .into_iter()
        .filter_map(|(ref_name, sha, subject)| {
            let is_legacy = legacy_backup_of(&ref_name).is_some_and(|(legacy, _)| legacy == slug);
            if !is_legacy && !is_backup_of(branch, &ref_name) {
                return None;
            }
            Some(HistoryBackup {
                created_at: created_at_of(&ref_name),
                ref_name,
                sha,
                subject,
                is_legacy,
            })
        })
        .collect();
    backups.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(backups)
}

pub(crate) fn prune_backups(cwd: &Path) {
    prune_backups_before(cwd, now_secs().saturating_sub(BACKUP_KEEP_SECS));
}

fn stamp_of(ref_name: &str) -> Option<(bool, u128)> {
    let stamp = ref_name.rsplit('/').next()?;
    let digits = stamp.strip_prefix(KEPT_STAMP);
    let nanos = digits.unwrap_or(stamp).parse::<u128>().ok()?;
    Some((digits.is_some(), nanos))
}

fn is_kept_elsewhere(cwd: &Path, ref_name: &str, sha: &str) -> bool {
    git(
        cwd,
        &[
            "for-each-ref",
            "--format=%(refname)",
            "--contains",
            sha,
            "refs/heads",
            "refs/remotes",
            "refs/tags",
            BACKUP_PREFIX,
        ],
    )
    .is_ok_and(|raw| raw.lines().any(|line| line.trim() != ref_name))
}

fn prune_backups_before(cwd: &Path, cutoff: u64) {
    let Ok(refs) = backup_refs(cwd) else {
        return;
    };
    let mut spaces: HashMap<String, Vec<(bool, u128, String, String)>> = HashMap::new();
    for (ref_name, sha, _) in refs {
        if legacy_backup_of(&ref_name).is_some() || !ref_name.contains("/b-") {
            continue;
        }
        let (Some((space, _)), Some((is_kept, nanos))) =
            (ref_name.rsplit_once('/'), stamp_of(&ref_name))
        else {
            continue;
        };
        spaces
            .entry(space.to_string())
            .or_default()
            .push((is_kept, nanos, ref_name.clone(), sha));
    }
    for backups in spaces.values_mut() {
        backups.sort_by(|left, right| right.1.cmp(&left.1));
        let mut kept_seen = 0;
        for (index, (is_kept, _, ref_name, sha)) in backups.iter().enumerate() {
            if *is_kept {
                kept_seen += 1;
            }
            let is_prunable = if *is_kept {
                kept_seen > KEPT_BACKUP_CAP && is_kept_elsewhere(cwd, ref_name, sha)
            } else {
                let created = created_at_of(ref_name);
                created > 0 && created < cutoff
            };
            if index > 0 && is_prunable {
                let _ = git_run(cwd, &["update-ref", "-d", ref_name, sha], None, None);
            }
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
        let slug = format!("{TRIAL_SLUG_PREFIX}{}", now_nanos());
        trial(&args, &slug, false)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryRunArgs {
    pub plan: HistoryPlanArgs,
    pub branch: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum RunOutcome {
    Blocked { reason: String },
    Tried { result: TrialResult },
}

pub(crate) fn run_plan(
    args: &HistoryRunArgs,
    slug: &str,
    progress: &dyn Fn(TrialProgress),
) -> Result<RunOutcome, WorktreeError> {
    let cwd = Path::new(&args.plan.worktree_path);
    if !cwd.exists() {
        return Err(WorktreeError::RepoNotFound(args.plan.worktree_path.clone()));
    }
    if let Some(reason) = recover_journal(cwd)? {
        return Ok(RunOutcome::Blocked { reason });
    }
    if let Some(reason) = preflight(cwd, &args.branch, &args.plan.head) {
        return Ok(RunOutcome::Blocked { reason });
    }
    let result = trial_with(&args.plan, slug, false, progress)?;
    Ok(RunOutcome::Tried { result })
}

#[tauri::command]
pub async fn history_plan_run(
    leases: State<'_, WriterLeases>,
    args: HistoryRunArgs,
    on_progress: tauri::ipc::Channel<TrialProgress>,
) -> Result<RunOutcome, WorktreeError> {
    let registry = leases.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&args.plan.worktree_path);
        if journal_of(&cwd).is_some_and(|journal| journal.exists()) {
            let path = args.plan.worktree_path.clone();
            let status = acquire_lease(&registry, &path, LEASE_HOLDER, None);
            if !status.is_granted {
                cancel_lease(&registry, &path, LEASE_HOLDER);
                return Ok(RunOutcome::Blocked {
                    reason: "An agent is writing here, so an interrupted rewrite cannot be settled yet. Try again when it finishes.".to_string(),
                });
            }
            let recovered = recover_journal(&cwd);
            release_lease(&registry, &path, LEASE_HOLDER, status.token.as_deref());
            if let Some(reason) = recovered? {
                return Ok(RunOutcome::Blocked { reason });
            }
        }
        let slug = format!("{TRIAL_SLUG_PREFIX}{}", now_nanos());
        run_plan(&args, &slug, &|event| {
            let _ = on_progress.send(event);
        })
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn age_secs(path: &Path) -> u64 {
    std::fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|modified| modified.elapsed().ok())
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default()
}

pub(crate) fn clean_stale_copies_in(
    dir: &Path,
    trial_after_secs: u64,
    other_after_secs: u64,
) -> usize {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return 0;
    };
    let mut cleaned = 0;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let Some(slug) = name.strip_prefix(COPY_PREFIX) else {
            continue;
        };
        let root = entry.path();
        if owner_repo(&root).is_none() || is_held(&root) {
            continue;
        }
        let limit = if slug.starts_with(TRIAL_SLUG_PREFIX) {
            trial_after_secs
        } else {
            other_after_secs
        };
        if age_secs(&root.join(RESERVATION_FILE)) < limit {
            continue;
        }
        let Some(lock) = open_lock(&root) else {
            continue;
        };
        if remove_reservation(&root, Some(lock)) {
            cleaned += 1;
        }
    }
    cleaned
}

pub(crate) fn clean_stale_copies() {
    let dir = reservations_dir();
    if dir.is_absolute() {
        clean_stale_copies_in(&dir, STALE_TRIAL_SECS, STALE_REWRITER_SECS);
    }
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
        if !is_backup_of(&args.branch, &args.backup_ref) {
            return Err(plan_error("that backup belongs to another branch"));
        }
        with_lease(&registry, &args.worktree_path, || {
            restore_blocking(&cwd, &args.branch, &args.expected_head, &args.backup_ref)
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

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OriginAhead {
    pub remote_sha: String,
    pub commits: Vec<RebaseCommit>,
    pub fetch_error: Option<String>,
}

pub(crate) fn origin_ahead(
    cwd: &Path,
    branch: &str,
    since: Option<&str>,
    token: Option<&str>,
) -> Result<OriginAhead, WorktreeError> {
    let fetch_error = crate::branch_remote::fetch_branch_ref(cwd, "origin", branch, token);
    let remote_sha = resolve_commit(cwd, &format!("origin/{branch}"))?;
    let from = match since.map(str::trim).filter(|sha| !sha.is_empty()) {
        Some(sha) => resolve_commit(cwd, sha)?,
        None => resolve_commit(cwd, "HEAD")?,
    };
    let range = format!("{from}..{remote_sha}");
    let raw = git(
        cwd,
        &["log", "--reverse", "--format=%H%x1f%P%x1f%s", &range],
    )?;
    let mut commits = Vec::new();
    for line in raw.lines().filter(|line| !line.trim().is_empty()) {
        let mut parts = line.splitn(3, '\u{1f}');
        let sha = parts.next().unwrap_or_default().to_string();
        if parts.next().unwrap_or_default().split_whitespace().count() != 1 {
            return Err(plan_error(&format!(
                "{} on origin is a merge commit: bring it in by hand",
                short(&sha)
            )));
        }
        commits.push(RebaseCommit {
            sha,
            subject: parts.next().unwrap_or_default().to_string(),
        });
    }
    Ok(OriginAhead {
        remote_sha,
        commits,
        fetch_error,
    })
}

#[tauri::command]
pub async fn history_origin_ahead(
    worktree_path: String,
    branch: String,
    since: Option<String>,
    workspace_id: Option<String>,
    project_id: Option<String>,
) -> Result<OriginAhead, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(worktree_path));
        }
        let token = crate::github::read_token(workspace_id.as_deref(), project_id.as_deref());
        origin_ahead(&cwd, &branch, since.as_deref(), token.as_deref())
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum RemoteLease {
    Absent,
    Included { sha: String },
    NotIncluded { sha: String },
    Unknown { reason: String },
}

pub(crate) fn remote_lease(
    cwd: &Path,
    branch: &str,
    expected_head: &str,
    incorporated: Option<&str>,
    incorporated_since: Option<&str>,
    token: Option<&str>,
) -> RemoteLease {
    let reference = format!("refs/heads/{branch}");
    let cwd_text = cwd.to_string_lossy().to_string();
    let run = match crate::github::run_git_authenticated(
        &["ls-remote", "origin", &reference],
        &cwd_text,
        token,
    ) {
        Ok(run) if run.exit_code == 0 => run,
        Ok(run) => {
            return RemoteLease::Unknown {
                reason: run.stderr.trim().to_string(),
            }
        }
        Err(error) => {
            return RemoteLease::Unknown {
                reason: error.to_string(),
            }
        }
    };
    let found = run.stdout.lines().find_map(|line| {
        let (sha, name) = line.split_once('\t')?;
        (name.trim() == reference).then(|| sha.trim().to_string())
    });
    let Some(sha) = found else {
        return RemoteLease::Absent;
    };
    let Ok(expected) = resolve_commit(cwd, expected_head) else {
        return RemoteLease::Unknown {
            reason: "the branch head the plan started from is missing".to_string(),
        };
    };
    let is_incorporated = incorporated.map(str::trim) == Some(sha.as_str())
        && incorporated_since
            .map(str::trim)
            .is_none_or(|since| is_ancestor(cwd, since, &expected));
    if is_incorporated || is_ancestor(cwd, &sha, &expected) {
        return RemoteLease::Included { sha };
    }
    RemoteLease::NotIncluded { sha }
}

#[tauri::command]
pub async fn history_remote_lease(
    worktree_path: String,
    branch: String,
    expected_head: String,
    incorporated: Option<String>,
    incorporated_since: Option<String>,
    workspace_id: Option<String>,
    project_id: Option<String>,
) -> Result<RemoteLease, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(worktree_path));
        }
        let token = crate::github::read_token(workspace_id.as_deref(), project_id.as_deref());
        Ok(remote_lease(
            &cwd,
            &branch,
            &expected_head,
            incorporated.as_deref(),
            incorporated_since.as_deref(),
            token.as_deref(),
        ))
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
    let start = resolve_commit(cwd, start_of(&args.plan))?;
    let old_head = resolve_commit(cwd, &args.plan.head)?;
    let steps = resolved_steps(cwd, &args.plan.steps)?;
    let ordered = order_steps(&steps)?;
    let groups = expected_groups(cwd, &ordered)?;
    let mut problems = Vec::new();
    if !args.skipped.is_empty() {
        problems.push(format!(
            "The rewriter skipped {} that the plan keeps; every planned commit must stay, even an empty one.",
            args.skipped
                .iter()
                .map(|sha| short(sha))
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }
    if let Some(problem) = copy_problem(copy) {
        problems.push(problem);
    }
    let copy_head = resolve_commit(copy, "HEAD")?;
    let range = format!("{start}..{copy_head}");
    let made: Vec<String> = git(copy, &["rev-list", "--reverse", "--first-parent", &range])?
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect();
    if !is_ancestor(copy, &start, &copy_head) {
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
    let mut tip = start.clone();
    let mut map = Vec::new();
    for (commit, group) in made.iter().zip(groups.iter()) {
        let is_original = group.members.len() == 1
            && group.members.first() == Some(commit)
            && rev_parse_all(cwd, &[format!("{commit}^")]).as_deref() == Some(&[tip.clone()][..]);
        if is_original {
            tip = commit.clone();
            map.push(ShaMove {
                from: commit.clone(),
                to: Some(tip.clone()),
            });
            continue;
        }
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
    let check = check_trial(
        cwd,
        None,
        &CheckInput {
            base: &base,
            start: &start,
            old_head: &old_head,
            new_head: &tip,
            steps: &steps,
            ordered: &ordered,
            made: Some(groups.len()),
        },
    );
    if !check.is_passed {
        return Ok(RewriterCheck {
            head: None,
            map: Vec::new(),
            problems: check.problems,
            is_tree_equal: false,
            changed_files: Vec::new(),
        });
    }
    if !args.keeps_copy {
        discard_copy(&args.copy_path);
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

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CopyGitDirs {
    pub git_dir: String,
    pub objects_dir: String,
    pub packed_refs_lock: String,
}

pub(crate) fn copy_git_dirs(copy: &Path) -> Option<CopyGitDirs> {
    let root = reservation_root_of(copy)?;
    let repo = owner_repo(&root)?;
    if !is_regular_file(&copy.join(".git")) {
        return None;
    }
    let admin = recorded_admin_dir(&root)?;
    let objects = repo.join("objects");
    if !is_real_dir(&objects) {
        return None;
    }
    Some(CopyGitDirs {
        git_dir: admin.to_string_lossy().to_string(),
        objects_dir: objects.to_string_lossy().to_string(),
        packed_refs_lock: repo.join("packed-refs.lock").to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn history_copy_git_dirs(copy_path: String) -> Option<CopyGitDirs> {
    tauri::async_runtime::spawn_blocking(move || copy_git_dirs(Path::new(&copy_path)))
        .await
        .ok()
        .flatten()
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
        if !is_owned_copy(Path::new(&copy_path)) {
            return Err(plan_error("that folder is not a history copy Goodboy made"));
        }
        discard_copy(&copy_path);
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
            onto: None,
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
        discard_copy(&copy);
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
        std::fs::write(&journal, format!("{}\n{}\nref\nfeature\n", b.c, b.b)).unwrap();
        assert_eq!(recover_journal(&b.root).unwrap(), None);
        assert!(!journal.exists());
        assert_eq!(git_ok(&b.root, &["status", "--porcelain"]), "");
        assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.b);
    }

    #[test]
    fn a_legacy_journal_without_a_branch_is_kept_and_never_acted_on() {
        let b = branch("apply-journal-legacy");
        git_ok(&b.root, &["checkout", "-q", "-b", "other"]);
        let journal = journal_of(&b.root).unwrap();
        git_ok(&b.root, &["update-ref", "HEAD", &b.b, &b.c]);
        std::fs::write(&journal, format!("{}\n{}\nref\n", b.c, b.b)).unwrap();
        let notice = recover_journal(&b.root).unwrap().unwrap();
        assert!(notice.contains("older Goodboy"), "{notice}");
        assert!(journal.exists());
        assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.b);
        assert_eq!(
            std::fs::read_to_string(b.root.join("policy.txt")).unwrap(),
            "three\n"
        );
        let blocked = move_branch_blocking(&b.root, "other", &b.b, &b.a).unwrap();
        assert!(matches!(blocked, MoveOutcome::Blocked { .. }));
    }

    #[test]
    fn a_repair_that_fails_keeps_the_journal() {
        let l = ledger("apply-journal-locked");
        let mut steps = picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
        ]);
        steps.push(fold(&l.typo, &l.export, HistoryVerb::Fixup));
        let head = run_ok(&l, steps, "apply-journal-locked").head.unwrap();
        git_ok(&l.root, &["read-tree", "-m", "-u", &l.typo, &head]);
        let journal = journal_of(&l.root).unwrap();
        std::fs::write(&journal, format!("{}\n{head}\nref\nfeature\n", l.typo)).unwrap();
        let lock = l
            .root
            .join(".git")
            .join("refs")
            .join("heads")
            .join("feature.lock");
        std::fs::write(&lock, "").unwrap();
        let notice = recover_journal(&l.root).unwrap();
        assert!(notice.is_some());
        assert!(journal.exists());
        assert_eq!(
            git_ok(&l.root, &["rev-parse", "refs/heads/feature"]),
            l.typo
        );
        std::fs::remove_file(&lock).unwrap();
        assert_eq!(recover_journal(&l.root).unwrap(), None);
        assert!(!journal.exists());
        assert_eq!(git_ok(&l.root, &["rev-parse", "refs/heads/feature"]), head);
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
    fn commits_origin_gained_after_the_apply_come_into_the_plan_and_push_with_lease() {
        let b = branch("origin-ahead");
        let remote = b.root.join("remote.git");
        git_ok(&b.root, &["init", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &b.root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git_ok(&b.root, &["push", "-u", "origin", "feature"]);
        let other = b.root.join("other");
        git_ok(
            &b.root,
            &[
                "clone",
                "-q",
                "-b",
                "feature",
                remote.to_str().unwrap(),
                other.to_str().unwrap(),
            ],
        );
        git_ok(&other, &["config", "user.email", "test@example.com"]);
        git_ok(&other, &["config", "user.name", "teammate"]);
        let theirs = commit(&other, "teammate.txt", "hello\n", "Teammate adds a note");
        git_ok(&other, &["push", "-q", "origin", "feature"]);
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
        let rewritten = trial(&args, &slug("origin-ahead"), false)
            .unwrap()
            .head
            .unwrap();
        move_branch_blocking(&b.root, "feature", &b.c, &rewritten).unwrap();

        let ahead = origin_ahead(&b.root, "feature", Some(&b.c), None).unwrap();
        assert_eq!(ahead.remote_sha, theirs);
        assert_eq!(
            ahead
                .commits
                .iter()
                .map(|c| c.sha.clone())
                .collect::<Vec<_>>(),
            vec![theirs.clone()]
        );
        let bring = plan(
            &b.root,
            &rewritten,
            &rewritten,
            vec![step(&theirs, HistoryVerb::Pick)],
        );
        let joined = trial(&bring, &slug("origin-bring"), false)
            .unwrap()
            .head
            .unwrap();
        move_branch_blocking(&b.root, "feature", &rewritten, &joined).unwrap();
        let cwd = b.root.to_string_lossy().into_owned();
        let pushed = crate::github::run_git_authenticated(
            &[
                "push",
                &crate::github::lease_argument("feature", Some(&ahead.remote_sha)),
                "origin",
                "refs/heads/feature:refs/heads/feature",
            ],
            &cwd,
            None,
        )
        .unwrap();
        assert_eq!(
            crate::github::lease_push_outcome(&pushed),
            crate::github::LeasePushOutcome::Pushed
        );
        assert_eq!(
            subjects(&b.root, &format!("{}..feature", b.base)),
            vec!["Teammate adds a note", "C adds notes", "A edits the policy"]
        );
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
            base: plan.merge_base.clone(),
            head: plan.head.clone(),
            steps: plan
                .commits
                .iter()
                .map(|c| step(&c.sha, HistoryVerb::Pick))
                .collect(),
            onto: Some(plan.onto.clone()),
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
        discard_copy(&copy.to_string_lossy());
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
    fn predicting_a_thirty_commit_plan_stays_inside_the_budget() {
        let root = init_repo("predict-timing");
        for dir in 0..40 {
            let folder = root.join(format!("src/module{dir}"));
            std::fs::create_dir_all(&folder).unwrap();
            for file in 0..10 {
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
            &["commit", "--no-verify", "-m", "base with 400 files"],
        );
        let base = git_ok(&root, &["rev-parse", "HEAD"]);
        git_ok(&root, &["checkout", "-b", "feature"]);
        let shas: Vec<String> = (0..30)
            .map(|index| {
                commit(
                    &root,
                    &format!("src/module{}/file{}.ts", index % 40, index % 10),
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

        let resolved = resolve_plan(&root, &args).unwrap();
        let ordered = order_steps(&resolved.steps).unwrap();
        let direct_started = std::time::Instant::now();
        let direct = predict_with(&root, &resolved, &ordered, false).unwrap();
        let direct_elapsed = direct_started.elapsed().as_millis();

        let probe = std::time::Instant::now();
        for _ in 0..10 {
            git_ok(&root, &["rev-parse", "HEAD"]);
        }
        let per_spawn = probe.elapsed().as_millis() / 10;
        eprintln!(
            "history prediction of a 30 commit plan over 400 files: {elapsed} ms batched, {direct_elapsed} ms one spawn per commit, one git spawn: {per_spawn} ms"
        );
        let outcomes = |found: &PlanPrediction| {
            found
                .steps
                .iter()
                .map(|step| (step.sha.clone(), step.outcome, step.files.clone()))
                .collect::<Vec<_>>()
        };
        assert_eq!(outcomes(&prediction), outcomes(&direct));
        assert_eq!(prediction.changed_files, direct.changed_files);
        assert_eq!(prediction.is_tree_equal, direct.is_tree_equal);
        let head = prediction.head.unwrap();
        assert_eq!(
            git_ok(&root, &["rev-parse", &format!("{head}^{{tree}}")]),
            git_ok(
                &root,
                &["rev-parse", &format!("{}^{{tree}}", direct.head.unwrap())]
            )
        );
        assert_eq!(git_ok(&root, &["for-each-ref", PREDICT_REF]), "");
        if supports_batched_replay() {
            assert!(
                elapsed < 1_000 || elapsed < per_spawn * 12,
                "prediction took {elapsed} ms with {per_spawn} ms per git spawn"
            );
        }
    }

    struct Ledger {
        root: PathBuf,
        base: String,
        export: String,
        batch: String,
        webhook: String,
        retries: String,
        logging: String,
        tests: String,
        typo: String,
    }

    fn ledger(name: &str) -> Ledger {
        let root = init_repo(name);
        let base = commit(&root, "ledger.ts", "ledger\n", "Release 2.14");
        git_ok(&root, &["checkout", "-q", "-b", "feature"]);
        let export = commit(
            &root,
            "export.ts",
            "export v1\n",
            "Add ledger export endpoint",
        );
        let batch = commit(
            &root,
            "batch.ts",
            "batch 500\n",
            "Stream rows in batches of 500",
        );
        let webhook = commit(
            &root,
            "webhook.ts",
            "verify\n",
            "Fix webhook signature check",
        );
        let retries = commit(
            &root,
            "retries.ts",
            "retry 3\n",
            "Add retries to the export job",
        );
        let logging = commit(
            &root,
            "logger.ts",
            "debug\n",
            "Add debug logging to the export",
        );
        let tests = commit(&root, "export.test.ts", "tests\n", "wip export tests");
        let typo = commit(&root, "export.ts", "export v2\n", "Fix typo in CSV header");
        Ledger {
            root,
            base,
            export,
            batch,
            webhook,
            retries,
            logging,
            tests,
            typo,
        }
    }

    fn picks(shas: &[&String]) -> Vec<HistoryStep> {
        shas.iter()
            .map(|sha| step(sha, HistoryVerb::Pick))
            .collect()
    }

    fn fold(sha: &str, target: &str, verb: HistoryVerb) -> HistoryStep {
        HistoryStep {
            sha: sha.to_string(),
            verb,
            message: None,
            target: Some(target.to_string()),
        }
    }

    fn run_args(root: &Path, plan: HistoryPlanArgs) -> HistoryRunArgs {
        let _ = root;
        HistoryRunArgs {
            plan,
            branch: "feature".to_string(),
        }
    }

    fn tried(outcome: RunOutcome) -> TrialResult {
        match outcome {
            RunOutcome::Tried { result } => result,
            RunOutcome::Blocked { reason } => panic!("the run was blocked: {reason}"),
        }
    }

    fn worktree_count(root: &Path) -> usize {
        git_ok(root, &["worktree", "list", "--porcelain"])
            .lines()
            .filter(|line| line.starts_with("worktree "))
            .count()
    }

    fn ledger_plan(l: &Ledger, steps: Vec<HistoryStep>) -> HistoryPlanArgs {
        plan(&l.root, &l.base, &l.typo, steps)
    }

    fn run_ok(l: &Ledger, steps: Vec<HistoryStep>, name: &str) -> TrialResult {
        let result = tried(
            run_plan(
                &run_args(&l.root, ledger_plan(l, steps)),
                &slug(name),
                &|_| {},
            )
            .unwrap(),
        );
        assert_eq!(result.stop, None);
        let check = result.check.clone().unwrap();
        assert!(check.is_passed, "{:?}", check.problems);
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
        assert_eq!(worktree_count(&l.root), 1);
        assert!(!copy_path_of(&slug(name)).exists());
        result
    }

    #[test]
    fn reordering_independent_commits_keeps_the_same_code_and_passes_the_check() {
        let l = ledger("run-reorder");
        let result = run_ok(
            &l,
            picks(&[
                &l.export, &l.webhook, &l.batch, &l.retries, &l.logging, &l.tests, &l.typo,
            ]),
            "run-reorder",
        );
        assert!(result.is_tree_equal);
        assert!(result.check.unwrap().expects_same_code);
        let head = result.head.unwrap();
        assert_eq!(
            subjects(&l.root, &format!("{}..{head}", l.base))[5],
            "Fix webhook signature check"
        );
    }

    #[test]
    fn folding_into_an_older_commit_keeps_only_the_target_title() {
        let l = ledger("run-fixup-older");
        let mut steps = picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
        ]);
        steps.push(fold(&l.typo, &l.export, HistoryVerb::Fixup));
        let result = run_ok(&l, steps, "run-fixup-older");
        assert!(result.is_tree_equal);
        let head = result.head.unwrap();
        let listed = subjects(&l.root, &format!("{}..{head}", l.base));
        assert_eq!(listed.len(), 6);
        assert_eq!(listed[5], "Add ledger export endpoint");
        assert!(!listed.iter().any(|s| s == "Fix typo in CSV header"));
        let first = git_ok(
            &l.root,
            &["rev-list", "--reverse", &format!("{}..{head}", l.base)],
        );
        let oldest = first.lines().next().unwrap();
        assert_eq!(
            git_ok(&l.root, &["log", "-1", "--format=%B", oldest]),
            "Add ledger export endpoint"
        );
    }

    #[test]
    fn folding_into_a_newer_commit_moves_it_up_and_keeps_the_newer_title() {
        let l = ledger("run-fixup-newer");
        let steps = vec![
            fold(&l.export, &l.batch, HistoryVerb::Fixup),
            step(&l.batch, HistoryVerb::Pick),
            step(&l.webhook, HistoryVerb::Pick),
            step(&l.retries, HistoryVerb::Pick),
            step(&l.logging, HistoryVerb::Pick),
            step(&l.tests, HistoryVerb::Pick),
            step(&l.typo, HistoryVerb::Pick),
        ];
        let result = run_ok(&l, steps, "run-fixup-newer");
        assert!(result.is_tree_equal);
        let head = result.head.unwrap();
        let listed = subjects(&l.root, &format!("{}..{head}", l.base));
        assert_eq!(listed.last().unwrap(), "Stream rows in batches of 500");
        assert_eq!(listed.len(), 6);
    }

    #[test]
    fn combining_with_a_target_keeps_both_messages() {
        let l = ledger("run-squash-target");
        let mut steps = picks(&[&l.export, &l.batch, &l.webhook, &l.retries, &l.logging]);
        steps.push(fold(&l.tests, &l.retries, HistoryVerb::Squash));
        steps.push(step(&l.typo, HistoryVerb::Pick));
        let result = run_ok(&l, steps, "run-squash-target");
        let head = result.head.unwrap();
        let listed = subjects(&l.root, &format!("{}..{head}", l.base));
        assert_eq!(listed.len(), 6);
        let combined = git_ok(&l.root, &["log", "-1", "--format=%B", &format!("{head}~2")]);
        assert!(combined.starts_with("Add retries to the export job"));
        assert!(combined.contains("wip export tests"));
        assert!(result.is_tree_equal);
    }

    #[test]
    fn a_fold_into_a_commit_that_folds_elsewhere_follows_the_chain() {
        let l = ledger("run-chain");
        let steps = vec![
            step(&l.export, HistoryVerb::Pick),
            step(&l.batch, HistoryVerb::Pick),
            step(&l.webhook, HistoryVerb::Pick),
            step(&l.retries, HistoryVerb::Pick),
            fold(&l.logging, &l.tests, HistoryVerb::Fixup),
            fold(&l.tests, &l.retries, HistoryVerb::Squash),
            step(&l.typo, HistoryVerb::Pick),
        ];
        let result = run_ok(&l, steps, "run-chain");
        assert!(result.is_tree_equal);
        let head = result.head.unwrap();
        assert_eq!(subjects(&l.root, &format!("{}..{head}", l.base)).len(), 5);
    }

    #[test]
    fn renaming_changes_only_the_message() {
        let l = ledger("run-reword");
        let mut steps = picks(&[&l.export, &l.batch]);
        let mut reword = step(&l.webhook, HistoryVerb::Reword);
        reword.message = Some("Verify webhook signatures before crediting".to_string());
        steps.push(reword);
        steps.extend(picks(&[&l.retries, &l.logging, &l.tests, &l.typo]));
        let result = run_ok(&l, steps, "run-reword");
        assert!(result.is_tree_equal);
        let head = result.head.unwrap();
        assert!(subjects(&l.root, &format!("{}..{head}", l.base))
            .contains(&"Verify webhook signatures before crediting".to_string()));
    }

    #[test]
    fn removing_a_commit_changes_only_its_own_files() {
        let l = ledger("run-drop");
        let mut steps = picks(&[&l.export, &l.batch, &l.webhook, &l.retries]);
        steps.push(step(&l.logging, HistoryVerb::Drop));
        steps.extend(picks(&[&l.tests, &l.typo]));
        let result = run_ok(&l, steps, "run-drop");
        assert!(!result.is_tree_equal);
        assert_eq!(result.changed_files, vec!["logger.ts".to_string()]);
        let check = result.check.unwrap();
        assert_eq!(check.removed_files, vec!["logger.ts".to_string()]);
        assert!(!check.expects_same_code);
    }

    #[test]
    fn starting_from_today_main_replays_the_branch_on_top_of_it() {
        let l = ledger("run-onto");
        git_ok(&l.root, &["checkout", "-q", "main"]);
        commit(&l.root, "rounding.ts", "round\n", "Cascadia rounding rules");
        let main = commit(&l.root, "keys.ts", "keys\n", "Rotate Acme sandbox keys");
        git_ok(&l.root, &["checkout", "-q", "feature"]);
        let mut args = ledger_plan(
            &l,
            picks(&[
                &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
            ]),
        );
        args.onto = Some(main.clone());
        let prediction = predict(&args).unwrap();
        assert!(prediction.head.is_some());
        let result = tried(run_plan(&run_args(&l.root, args), &slug("run-onto"), &|_| {}).unwrap());
        let check = result.check.unwrap();
        assert!(check.is_passed, "{:?}", check.problems);
        let head = result.head.unwrap();
        assert!(is_ancestor(&l.root, &main, &head));
        assert_eq!(subjects(&l.root, &format!("{main}..{head}")).len(), 7);
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
    }

    #[test]
    fn a_mixed_plan_of_every_action_passes_the_check() {
        let l = ledger("run-mixed");
        let mut reword = step(&l.webhook, HistoryVerb::Reword);
        reword.message = Some("Verify webhook signatures before crediting".to_string());
        let steps = vec![
            step(&l.export, HistoryVerb::Pick),
            step(&l.batch, HistoryVerb::Pick),
            step(&l.retries, HistoryVerb::Pick),
            reword,
            step(&l.logging, HistoryVerb::Drop),
            fold(&l.tests, &l.retries, HistoryVerb::Squash),
            fold(&l.typo, &l.export, HistoryVerb::Fixup),
        ];
        let result = run_ok(&l, steps, "run-mixed");
        let head = result.head.unwrap();
        assert_eq!(
            subjects(&l.root, &format!("{}..{head}", l.base)),
            vec![
                "Verify webhook signatures before crediting",
                "Add retries to the export job",
                "Stream rows in batches of 500",
                "Add ledger export endpoint",
            ]
        );
        assert_eq!(result.changed_files, vec!["logger.ts".to_string()]);
    }

    #[test]
    fn a_conflict_stops_names_the_step_discards_the_copy_and_leaves_the_branch() {
        let l = ledger("run-conflict");
        let events = std::sync::Mutex::new(Vec::new());
        let steps = vec![
            step(&l.typo, HistoryVerb::Pick),
            step(&l.export, HistoryVerb::Pick),
            step(&l.batch, HistoryVerb::Pick),
            step(&l.webhook, HistoryVerb::Pick),
            step(&l.retries, HistoryVerb::Pick),
            step(&l.logging, HistoryVerb::Pick),
            step(&l.tests, HistoryVerb::Pick),
        ];
        let result = tried(
            run_plan(
                &run_args(&l.root, ledger_plan(&l, steps)),
                &slug("run-conflict"),
                &|event| events.lock().unwrap().push(event),
            )
            .unwrap(),
        );
        let stop = result.stop.unwrap();
        assert_eq!(stop.sha, l.typo);
        assert_eq!(stop.kind, StopKind::Merge);
        assert_eq!(stop.files, vec!["export.ts".to_string()]);
        assert_eq!(result.head, None);
        assert_eq!(result.check, None);
        assert_eq!(result.copy_path, None);
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
        assert_eq!(git_ok(&l.root, &["status", "--porcelain"]), "");
        assert_eq!(worktree_count(&l.root), 1);
        assert!(!copy_path_of(&slug("run-conflict")).exists());
        assert_eq!(events.lock().unwrap().last(), Some(&TrialProgress::Cleanup));
    }

    #[test]
    fn progress_reports_the_copy_every_step_the_check_and_the_cleanup() {
        let l = ledger("run-progress");
        let events = std::sync::Mutex::new(Vec::new());
        let steps = picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
        ]);
        tried(
            run_plan(
                &run_args(&l.root, ledger_plan(&l, steps)),
                &slug("run-progress"),
                &|event| events.lock().unwrap().push(event),
            )
            .unwrap(),
        );
        let seen = events.lock().unwrap().clone();
        assert_eq!(seen.first(), Some(&TrialProgress::Copy));
        assert_eq!(
            seen[1],
            TrialProgress::Step {
                index: 1,
                total: 7,
                sha: l.export.clone()
            }
        );
        assert_eq!(seen.len(), 10);
        assert_eq!(seen[8], TrialProgress::Check);
        assert_eq!(seen[9], TrialProgress::Cleanup);
    }

    #[test]
    fn a_dirty_worktree_blocks_the_run_before_any_copy_is_made() {
        let l = ledger("run-dirty");
        std::fs::write(l.root.join("export.ts"), "half done\n").unwrap();
        let outcome = run_plan(
            &run_args(&l.root, ledger_plan(&l, picks(&[&l.export]))),
            &slug("run-dirty"),
            &|_| panic!("a blocked run must not start"),
        )
        .unwrap();
        let RunOutcome::Blocked { reason } = outcome else {
            panic!("expected the dirty worktree to block the run");
        };
        assert!(reason.contains("not committed"), "{reason}");
        assert_eq!(worktree_count(&l.root), 1);
        assert_eq!(
            std::fs::read_to_string(l.root.join("export.ts")).unwrap(),
            "half done\n"
        );
    }

    #[test]
    fn a_moved_head_or_another_branch_blocks_the_run() {
        let l = ledger("run-moved");
        let stale = plan(&l.root, &l.base, &l.tests, picks(&[&l.export]));
        let RunOutcome::Blocked { reason } =
            run_plan(&run_args(&l.root, stale), &slug("run-moved"), &|_| {}).unwrap()
        else {
            panic!("expected the moved head to block");
        };
        assert!(reason.contains("moved"), "{reason}");
        git_ok(&l.root, &["checkout", "-q", "-b", "other"]);
        let RunOutcome::Blocked { reason } = run_plan(
            &run_args(&l.root, ledger_plan(&l, picks(&[&l.export]))),
            &slug("run-branch"),
            &|_| {},
        )
        .unwrap() else {
            panic!("expected the other branch to block");
        };
        assert!(reason.contains("not feature"), "{reason}");
    }

    #[test]
    fn a_failing_commit_hook_stops_the_trial_and_discards_the_copy() {
        let l = ledger("run-hook");
        let hooks = l.root.join(".git").join("hooks");
        std::fs::create_dir_all(&hooks).unwrap();
        let hook = hooks.join("commit-msg");
        std::fs::write(&hook, "#!/bin/sh\necho refused by policy\nexit 1\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        let mut reword = step(&l.export, HistoryVerb::Reword);
        reword.message = Some("Add the ledger export endpoint".to_string());
        let mut steps = vec![reword];
        steps.extend(picks(&[
            &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
        ]));
        let result = tried(
            run_plan(
                &run_args(&l.root, ledger_plan(&l, steps)),
                &slug("run-hook"),
                &|_| {},
            )
            .unwrap(),
        );
        let stop = result.stop.unwrap();
        assert_eq!(stop.kind, StopKind::Hook);
        assert!(stop.message.contains("refused by policy"));
        assert_eq!(worktree_count(&l.root), 1);
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
    }

    #[test]
    fn the_check_names_files_that_differ_when_no_removed_commit_explains_them() {
        let l = ledger("check-mismatch");
        let steps = picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
        ]);
        let ordered = order_steps(&steps).unwrap();
        git_ok(&l.root, &["checkout", "-q", "-b", "tampered"]);
        let tampered = commit(
            &l.root,
            "webhook.ts",
            "skip verify\n",
            "Fix typo in CSV header",
        );
        git_ok(&l.root, &["checkout", "-q", "feature"]);
        let check = check_trial(
            &l.root,
            None,
            &CheckInput {
                base: &l.base,
                start: &l.base,
                old_head: &l.typo,
                new_head: &tampered,
                steps: &steps,
                ordered: &ordered,
                made: Some(8),
            },
        );
        assert!(!check.is_passed);
        assert_eq!(check.unexpected_files, vec!["webhook.ts".to_string()]);
        assert!(check.problems.iter().any(|p| p.contains("webhook.ts")));
    }

    #[test]
    fn the_check_refuses_a_result_with_the_wrong_number_of_commits() {
        let l = ledger("check-count");
        let steps = picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
        ]);
        let ordered = order_steps(&steps).unwrap();
        let check = check_trial(
            &l.root,
            None,
            &CheckInput {
                base: &l.base,
                start: &l.base,
                old_head: &l.typo,
                new_head: &l.typo,
                steps: &steps,
                ordered: &ordered,
                made: Some(3),
            },
        );
        assert!(!check.is_passed);
        assert!(check.problems[0].contains("7 commits"));
    }

    #[test]
    fn apply_backs_up_to_the_branch_namespace_and_restore_returns_exactly() {
        let l = ledger("run-apply-restore");
        let mut steps = picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
        ]);
        steps.push(fold(&l.typo, &l.export, HistoryVerb::Fixup));
        let head = run_ok(&l, steps, "run-apply-restore").head.unwrap();
        let MoveOutcome::Moved { backup_ref, .. } =
            move_branch_blocking(&l.root, "feature", &l.typo, &head).unwrap()
        else {
            panic!("expected the branch to move");
        };
        assert!(is_backup_of("feature", &backup_ref));
        assert!(backup_ref.starts_with("refs/goodboy/backup/b-66656174757265/"));
        assert_eq!(git_ok(&l.root, &["rev-parse", &backup_ref]), l.typo);
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), head);
        let restored = move_branch_blocking(&l.root, "feature", &head, &backup_ref).unwrap();
        assert!(matches!(restored, MoveOutcome::Moved { .. }));
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
        assert_eq!(git_ok(&l.root, &["status", "--porcelain"]), "");
    }

    #[test]
    fn apply_refuses_to_overwrite_an_untracked_file() {
        let l = ledger("apply-untracked");
        git_ok(&l.root, &["rm", "-q", "logger.ts"]);
        git_ok(
            &l.root,
            &["commit", "-q", "--no-verify", "-m", "Stop logging"],
        );
        let now = git_ok(&l.root, &["rev-parse", "HEAD"]);
        std::fs::write(l.root.join("logger.ts"), "mine\n").unwrap();
        let blocked = move_branch_blocking(&l.root, "feature", &now, &l.typo).unwrap();
        let MoveOutcome::Blocked { reason } = blocked else {
            panic!("expected the untracked file to block");
        };
        assert!(reason.contains("logger.ts"), "{reason}");
        assert_eq!(
            std::fs::read_to_string(l.root.join("logger.ts")).unwrap(),
            "mine\n"
        );
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), now);
    }

    #[test]
    fn after_apply_the_lease_push_stops_when_someone_else_pushed() {
        let l = ledger("run-remote-moved");
        let remote = l.root.join("remote.git");
        git_ok(&l.root, &["init", "-q", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &l.root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git_ok(&l.root, &["push", "-q", "-u", "origin", "feature"]);
        let other = l.root.join("other");
        git_ok(
            &l.root,
            &[
                "clone",
                "-q",
                "-b",
                "feature",
                remote.to_str().unwrap(),
                other.to_str().unwrap(),
            ],
        );
        git_ok(&other, &["config", "user.email", "tomas@harborline.test"]);
        git_ok(&other, &["config", "user.name", "Tomas Vey"]);
        let theirs = commit(&other, "teammate.ts", "hi\n", "Teammate change");
        git_ok(&other, &["push", "-q", "origin", "feature"]);
        let mut steps = picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
        ]);
        steps.push(fold(&l.typo, &l.export, HistoryVerb::Fixup));
        let head = run_ok(&l, steps, "run-remote-moved").head.unwrap();
        move_branch_blocking(&l.root, "feature", &l.typo, &head).unwrap();
        let cwd = l.root.to_string_lossy().into_owned();
        let pushed = crate::github::run_git_authenticated(
            &[
                "push",
                &crate::github::lease_argument("feature", Some(&l.typo)),
                "origin",
                "refs/heads/feature:refs/heads/feature",
            ],
            &cwd,
            None,
        )
        .unwrap();
        assert!(matches!(
            crate::github::lease_push_outcome(&pushed),
            crate::github::LeasePushOutcome::Stale { .. }
        ));
        assert_eq!(
            git_ok(&remote, &["rev-parse", "refs/heads/feature"]),
            theirs
        );
    }

    fn clean_released(dir: &Path, trial_after: u64, other_after: u64) -> usize {
        for _ in 0..40 {
            let cleaned = clean_stale_copies_in(dir, trial_after, other_after);
            if cleaned > 0 {
                return cleaned;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        0
    }

    #[test]
    fn stale_copies_are_cleaned_and_real_repositories_are_left_alone() {
        let l = ledger("stale");
        let scratch = l.root.join("scratch");
        std::fs::create_dir_all(&scratch).unwrap();
        let trial_root = scratch.join(format!("{COPY_PREFIX}{TRIAL_SLUG_PREFIX}1"));
        let rewriter_root = scratch.join(format!("{COPY_PREFIX}mount-1"));
        for root in [&trial_root, &rewriter_root] {
            let mut guard = create_copy(&l.root, &root.join(COPY_DIR), &l.base).unwrap();
            guard.is_kept = true;
        }
        let users = scratch.join(format!("{COPY_PREFIX}{TRIAL_SLUG_PREFIX}mine"));
        git_ok(
            &l.root,
            &[
                "worktree",
                "add",
                "--detach",
                "--quiet",
                users.to_str().unwrap(),
                &l.base,
            ],
        );
        std::fs::write(users.join("work.txt"), "my work\n").unwrap();
        let lookalike = scratch.join(format!("{COPY_PREFIX}test-repo"));
        std::fs::create_dir_all(lookalike.join(".git")).unwrap();
        assert_eq!(worktree_count(&l.root), 4);

        assert_eq!(clean_stale_copies_in(&scratch, 0, 0), 0);
        assert!(trial_root.join(COPY_DIR).exists());

        drop(take_held(&trial_root));
        drop(take_held(&rewriter_root));
        assert_eq!(clean_released(&scratch, 0, u64::MAX), 1);
        assert!(!trial_root.exists());
        assert!(rewriter_root.exists());
        assert_eq!(worktree_count(&l.root), 3);
        assert_eq!(clean_released(&scratch, 0, 0), 1);
        assert!(!rewriter_root.exists());
        assert!(lookalike.exists());
        assert_eq!(
            std::fs::read_to_string(users.join("work.txt")).unwrap(),
            "my work\n"
        );
        assert_eq!(worktree_count(&l.root), 2);
    }

    #[test]
    fn copies_are_reserved_in_the_app_folder_and_never_in_tmp() {
        let copy = copy_path_of(&slug("tmp-check"));
        let tmp = std::env::temp_dir();
        for outside in [
            tmp.clone(),
            std::fs::canonicalize(&tmp).unwrap(),
            PathBuf::from("/tmp"),
            PathBuf::from("/private/tmp"),
        ] {
            assert!(!copy.starts_with(&outside), "{}", copy.display());
        }
        assert!(copy.starts_with(dirs::home_dir().unwrap().join(".goodboy")));
    }

    fn forged_owner(l: &Ledger, name: &str) -> (PathBuf, PathBuf, String) {
        let other = temp_root(&format!("{name}-other")).join("review");
        git_ok(
            &l.root,
            &[
                "worktree",
                "add",
                "--detach",
                "--quiet",
                other.to_str().unwrap(),
                &l.base,
            ],
        );
        let review_admin =
            std::fs::canonicalize(git_ok(&other, &["rev-parse", "--absolute-git-dir"])).unwrap();
        let review_gitdir = std::fs::read_to_string(review_admin.join("gitdir"))
            .unwrap()
            .trim()
            .to_string();
        let common = std::fs::canonicalize(l.root.join(".git")).unwrap();
        let text = format!(
            "{RESERVATION_HEADER}\n{}\n1\n{}\n{review_gitdir}\n",
            common.to_string_lossy(),
            review_admin.to_string_lossy()
        );
        (other, review_admin, text)
    }

    #[test]
    fn a_forged_owner_file_never_reaches_another_worktree() {
        let l = ledger("forged-owner");
        let (other, review_admin, forged) = forged_owner(&l, "forged-owner");
        let root = temp_root("forged-owner-copies").join(format!("{COPY_PREFIX}forged"));
        let copy = root.join(COPY_DIR);
        let mut guard = create_copy(&l.root, &copy, &l.base).unwrap();
        guard.is_kept = true;
        std::fs::write(root.join(RESERVATION_FILE), forged).unwrap();
        assert!(copy_git_dirs(&copy).is_none_or(|dirs| PathBuf::from(dirs.git_dir) != review_admin));
        drop(guard);
        discard_copy(&copy.to_string_lossy());
        assert!(review_admin.join("gitdir").exists());
        assert_eq!(git_ok(&other, &["rev-parse", "HEAD"]), l.base);
    }

    #[test]
    fn a_planted_old_reservation_never_removes_another_worktree() {
        let l = ledger("planted-owner");
        let (other, review_admin, forged) = forged_owner(&l, "planted-owner");
        let scratch = temp_root("planted-owner-copies");
        let root = scratch.join(format!("{COPY_PREFIX}{TRIAL_SLUG_PREFIX}planted"));
        std::fs::create_dir_all(root.join(COPY_DIR)).unwrap();
        std::fs::write(root.join(RESERVATION_FILE), forged).unwrap();
        clean_stale_copies_in(&scratch, 0, 0);
        assert!(review_admin.join("gitdir").exists());
        assert_eq!(git_ok(&other, &["rev-parse", "HEAD"]), l.base);
    }

    #[test]
    fn a_copy_another_process_holds_is_never_cleaned() {
        let l = ledger("stale-held");
        let scratch = l.root.join("scratch");
        std::fs::create_dir_all(&scratch).unwrap();
        let root = scratch.join(format!("{COPY_PREFIX}{TRIAL_SLUG_PREFIX}active"));
        let mut guard = create_copy(&l.root, &root.join(COPY_DIR), &l.base).unwrap();
        guard.is_kept = true;
        drop(guard);
        let active = take_held(&root).unwrap();
        let other_process = std::fs::OpenOptions::new()
            .write(true)
            .open(root.join(RESERVATION_LOCK))
            .unwrap();
        assert!(!try_lock_exclusive(&other_process));
        drop(other_process);
        assert_eq!(clean_stale_copies_in(&scratch, 0, 0), 0);
        assert!(root.join(COPY_DIR).exists());
        drop(active);
        assert_eq!(clean_released(&scratch, 0, 0), 1);
        assert!(!root.exists());
    }

    #[test]
    fn discard_never_deletes_a_folder_goodboy_did_not_reserve() {
        let scratch = temp_root("not-reserved");
        let root = scratch.join(format!("{COPY_PREFIX}{TRIAL_SLUG_PREFIX}theirs"));
        std::fs::create_dir_all(root.join(COPY_DIR)).unwrap();
        std::fs::write(root.join(COPY_DIR).join("work.txt"), "theirs\n").unwrap();
        discard_copy(&root.join(COPY_DIR).to_string_lossy());
        assert_eq!(
            std::fs::read_to_string(root.join(COPY_DIR).join("work.txt")).unwrap(),
            "theirs\n"
        );
        assert_eq!(clean_stale_copies_in(&scratch, 0, 0), 0);
        assert!(root.exists());
        let l = ledger("reserved-by-someone");
        let name = slug("reserved-by-someone");
        let taken = copy_path_of(&name);
        std::fs::create_dir_all(taken.parent().unwrap()).unwrap();
        std::fs::write(taken.parent().unwrap().join("note.txt"), "mine\n").unwrap();
        let args = ledger_plan(&l, picks(&[&l.export]));
        assert!(trial(&args, &name, false).is_err());
        assert_eq!(
            std::fs::read_to_string(taken.parent().unwrap().join("note.txt")).unwrap(),
            "mine\n"
        );
        std::fs::remove_dir_all(taken.parent().unwrap()).unwrap();
    }

    #[test]
    fn a_failing_post_checkout_hook_leaves_no_copy_registered() {
        let l = ledger("copy-hook");
        let hooks = l.root.join(".git").join("hooks");
        std::fs::create_dir_all(&hooks).unwrap();
        let hook = hooks.join("post-checkout");
        std::fs::write(&hook, "#!/bin/sh\nexit 1\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        let args = ledger_plan(
            &l,
            picks(&[
                &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
            ]),
        );
        assert!(trial(&args, &slug("copy-hook"), false).is_err());
        assert_eq!(worktree_count(&l.root), 1);
        assert!(!copy_path_of(&slug("copy-hook")).exists());
    }

    #[test]
    fn starting_from_a_main_that_changed_the_same_lines_stops_and_leaves_the_branch() {
        let l = ledger("run-onto-conflict");
        git_ok(&l.root, &["checkout", "-q", "main"]);
        let main = commit(
            &l.root,
            "export.ts",
            "export from main\n",
            "Cascadia rounding rules",
        );
        git_ok(&l.root, &["checkout", "-q", "feature"]);
        let mut args = ledger_plan(
            &l,
            picks(&[
                &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
            ]),
        );
        args.onto = Some(main);
        let prediction = predict(&args).unwrap();
        assert_eq!(prediction.steps[0].outcome, StepOutcome::Conflict);
        let result = tried(
            run_plan(
                &run_args(&l.root, args),
                &slug("run-onto-conflict"),
                &|_| {},
            )
            .unwrap(),
        );
        assert_eq!(result.stop.unwrap().sha, l.export);
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
        assert_eq!(worktree_count(&l.root), 1);
    }

    #[test]
    fn commits_before_the_first_change_keep_their_shas() {
        let l = ledger("run-keep-prefix");
        let mut steps = picks(&[&l.export, &l.batch, &l.webhook, &l.retries]);
        steps.push(step(&l.logging, HistoryVerb::Drop));
        steps.extend(picks(&[&l.tests, &l.typo]));
        let prediction = predict(&ledger_plan(&l, steps.clone())).unwrap();
        assert_eq!(
            prediction.steps[3].new_sha.as_deref(),
            Some(l.retries.as_str())
        );
        assert_ne!(
            prediction.steps[5].new_sha.as_deref(),
            Some(l.tests.as_str())
        );
        let result = run_ok(&l, steps, "run-keep-prefix");
        let head = result.head.clone().unwrap();
        assert!(is_ancestor(&l.root, &l.retries, &head));
        assert!(!is_ancestor(&l.root, &l.tests, &head));
    }

    #[test]
    fn apply_refuses_to_replace_an_untracked_folder_or_an_ignored_file() {
        let l = ledger("apply-untracked-folder");
        std::fs::write(l.root.join(".gitignore"), "build.log\n").unwrap();
        git_ok(&l.root, &["add", ".gitignore"]);
        git_ok(
            &l.root,
            &["commit", "-q", "--no-verify", "-m", "Ignore the build log"],
        );
        let ignored = git_ok(&l.root, &["rev-parse", "HEAD"]);
        git_ok(&l.root, &["rm", "-q", "--cached", "logger.ts"]);
        std::fs::remove_file(l.root.join("logger.ts")).unwrap();
        git_ok(
            &l.root,
            &["commit", "-q", "--no-verify", "-m", "Drop the logger file"],
        );
        let now = git_ok(&l.root, &["rev-parse", "HEAD"]);
        std::fs::create_dir_all(l.root.join("logger.ts")).unwrap();
        std::fs::write(l.root.join("logger.ts").join("notes.txt"), "mine\n").unwrap();
        let blocked = move_branch_blocking(&l.root, "feature", &now, &ignored).unwrap();
        let MoveOutcome::Blocked { reason } = blocked else {
            panic!("expected the untracked folder to block");
        };
        assert!(reason.contains("logger.ts"), "{reason}");
        assert_eq!(
            std::fs::read_to_string(l.root.join("logger.ts").join("notes.txt")).unwrap(),
            "mine\n"
        );
        std::fs::remove_dir_all(l.root.join("logger.ts")).unwrap();
        std::fs::write(l.root.join("build.log"), "tracked log\n").unwrap();
        git_ok(&l.root, &["add", "-f", "build.log"]);
        git_ok(
            &l.root,
            &["commit", "-q", "--no-verify", "-m", "Track the build log"],
        );
        let tracked_log = git_ok(&l.root, &["rev-parse", "HEAD"]);
        git_ok(&l.root, &["reset", "-q", "--hard", &now]);
        std::fs::write(l.root.join("build.log"), "my local log\n").unwrap();
        let blocked = move_branch_blocking(&l.root, "feature", &now, &tracked_log).unwrap();
        assert!(matches!(blocked, MoveOutcome::Blocked { .. }));
        assert_eq!(
            std::fs::read_to_string(l.root.join("build.log")).unwrap(),
            "my local log\n"
        );
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), now);
    }

    #[test]
    fn a_file_where_the_rewrite_needs_a_folder_blocks_too() {
        let l = ledger("apply-untracked-parent");
        git_ok(&l.root, &["rm", "-q", "export.test.ts"]);
        git_ok(
            &l.root,
            &["commit", "-q", "--no-verify", "-m", "No tests yet"],
        );
        let now = git_ok(&l.root, &["rev-parse", "HEAD"]);
        std::fs::create_dir_all(l.root.join("assets")).unwrap();
        std::fs::write(l.root.join("assets").join("logo.svg"), "<svg/>\n").unwrap();
        git_ok(&l.root, &["add", "assets/logo.svg"]);
        git_ok(
            &l.root,
            &["commit", "-q", "--no-verify", "-m", "Add the logo"],
        );
        let with_assets = git_ok(&l.root, &["rev-parse", "HEAD"]);
        git_ok(&l.root, &["reset", "-q", "--hard", &now]);
        std::fs::write(l.root.join("assets"), "a note, not a folder\n").unwrap();
        let blocked = move_branch_blocking(&l.root, "feature", &now, &with_assets).unwrap();
        assert!(matches!(blocked, MoveOutcome::Blocked { .. }));
        assert_eq!(
            std::fs::read_to_string(l.root.join("assets")).unwrap(),
            "a note, not a folder\n"
        );
    }

    #[test]
    fn a_local_edit_that_appears_after_the_checks_is_kept_and_nothing_moves() {
        let l = ledger("apply-late-edit");
        let mut steps = picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
        ]);
        steps.push(step(&l.typo, HistoryVerb::Drop));
        let head = run_ok(&l, steps, "apply-late-edit").head.unwrap();
        std::fs::write(l.root.join("export.ts"), "edited while applying\n").unwrap();
        let outcome = apply_move(
            &l.root,
            "feature",
            &l.typo,
            &head,
            "refs/goodboy/backup/feature/1",
        )
        .unwrap();
        assert!(
            matches!(outcome, MoveOutcome::Blocked { .. }),
            "{outcome:?}"
        );
        assert_eq!(
            std::fs::read_to_string(l.root.join("export.ts")).unwrap(),
            "edited while applying\n"
        );
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
    }

    #[test]
    fn a_commit_that_lands_during_the_move_is_never_reset_away() {
        let l = ledger("apply-late-commit");
        let mut steps = picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
        ]);
        steps.push(fold(&l.typo, &l.export, HistoryVerb::Fixup));
        let head = run_ok(&l, steps, "apply-late-commit").head.unwrap();
        let late = commit(
            &l.root,
            "late.txt",
            "late\n",
            "Late commit from another tool",
        );
        let outcome = apply_move(
            &l.root,
            "feature",
            &l.typo,
            &head,
            "refs/goodboy/backup/feature/1",
        )
        .unwrap();
        assert!(!matches!(outcome, MoveOutcome::Moved { .. }), "{outcome:?}");
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), late);
        assert_eq!(
            std::fs::read_to_string(l.root.join("late.txt")).unwrap(),
            "late\n"
        );
    }

    #[test]
    fn a_crash_after_the_files_moved_finishes_the_ref_move() {
        let l = ledger("apply-journal-forward");
        let mut steps = picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
        ]);
        steps.push(fold(&l.typo, &l.export, HistoryVerb::Fixup));
        let head = run_ok(&l, steps, "apply-journal-forward").head.unwrap();
        git_ok(&l.root, &["read-tree", "-m", "-u", &l.typo, &head]);
        let journal = journal_of(&l.root).unwrap();
        std::fs::write(&journal, format!("{}\n{head}\nref\nfeature\n", l.typo)).unwrap();
        assert_eq!(recover_journal(&l.root).unwrap(), None);
        assert!(!journal.exists());
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), head);
        assert_eq!(git_ok(&l.root, &["status", "--porcelain"]), "");
    }

    #[test]
    fn an_agent_rewrite_keeps_the_shas_of_the_untouched_older_commits() {
        let root = init_repo("rewriter-prefix");
        let base = commit(&root, "policy.txt", "one\n", "base");
        git_ok(&root, &["checkout", "-q", "-b", "feature"]);
        std::fs::write(root.join("keep.txt"), "keep\n").unwrap();
        git_ok(&root, &["add", "keep.txt"]);
        let dated = crate::path_env::command("git")
            .args([
                "commit",
                "-q",
                "--no-verify",
                "-m",
                "Keep the settlement key",
            ])
            .current_dir(&root)
            .env("GIT_COMMITTER_DATE", "2001-01-01T00:00:00Z")
            .output()
            .unwrap();
        assert!(dated.status.success());
        let kept = git_ok(&root, &["rev-parse", "HEAD"]);
        let a = commit(&root, "policy.txt", "two\n", "A edits the policy");
        let b = commit(&root, "policy.txt", "three\n", "B edits the policy again");
        let args = plan(
            &root,
            &base,
            &b,
            vec![
                step(&kept, HistoryVerb::Pick),
                step(&b, HistoryVerb::Pick),
                step(&a, HistoryVerb::Pick),
            ],
        );
        let prepared = trial(&args, &slug("rewriter-prefix"), true).unwrap();
        let copy = PathBuf::from(prepared.copy_path.clone().unwrap());
        std::fs::write(copy.join("policy.txt"), "three\n").unwrap();
        git_ok(&copy, &["add", "policy.txt"]);
        git_ok(&copy, &["commit", "--no-verify", "-m", "b"]);
        let second = git_run(&copy, &["cherry-pick", "--no-commit", &a], None, None).unwrap();
        assert_ne!(second.status, 0);
        std::fs::write(copy.join("policy.txt"), "three\n").unwrap();
        git_ok(&copy, &["add", "policy.txt"]);
        git_ok(
            &copy,
            &["commit", "--no-verify", "--allow-empty", "-m", "a"],
        );
        let check = collect_rewrite(&RewriterCollectArgs {
            plan: args,
            copy_path: copy.to_string_lossy().into_owned(),
            skipped: Vec::new(),
            keeps_copy: false,
        })
        .unwrap();
        assert!(check.problems.is_empty(), "{:?}", check.problems);
        let head = check.head.unwrap();
        let oldest = git_ok(
            &root,
            &["rev-list", "--reverse", &format!("{base}..{head}")],
        )
        .lines()
        .next()
        .unwrap()
        .to_string();
        assert_eq!(oldest, kept);
        assert!(check.map.contains(&ShaMove {
            from: kept.clone(),
            to: Some(kept.clone()),
        }));
        assert!(!copy.exists());
    }

    #[test]
    fn the_lease_is_the_online_sha_the_plan_includes_and_never_a_later_push() {
        let l = ledger("lease-bound");
        let remote = l.root.join("remote.git");
        git_ok(&l.root, &["init", "-q", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &l.root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        assert_eq!(
            remote_lease(&l.root, "feature", &l.typo, None, None, None),
            RemoteLease::Absent
        );
        git_ok(
            &l.root,
            &[
                "push",
                "-q",
                "origin",
                &format!("{}:refs/heads/feature", l.webhook),
            ],
        );
        assert_eq!(
            remote_lease(&l.root, "feature", &l.typo, None, None, None),
            RemoteLease::Included {
                sha: l.webhook.clone()
            }
        );
        let other = l.root.join("other");
        git_ok(
            &l.root,
            &[
                "clone",
                "-q",
                "-b",
                "feature",
                remote.to_str().unwrap(),
                other.to_str().unwrap(),
            ],
        );
        git_ok(&other, &["config", "user.email", "tomas@harborline.test"]);
        git_ok(&other, &["config", "user.name", "Tomas Vey"]);
        let theirs = commit(
            &other,
            "teammate.ts",
            "hi\n",
            "Teammate change during the trial",
        );
        git_ok(&other, &["push", "-q", "origin", "feature"]);
        assert_eq!(
            remote_lease(&l.root, "feature", &l.typo, None, None, None),
            RemoteLease::NotIncluded {
                sha: theirs.clone()
            }
        );
        assert_eq!(
            remote_lease(&l.root, "feature", &l.typo, Some(&theirs), None, None),
            RemoteLease::Included { sha: theirs }
        );
    }

    #[test]
    fn restoring_an_older_backup_never_counts_a_later_push_that_carried_a_teammate() {
        let l = ledger("restore-lease-teammate");
        let remote = l.root.join("remote.git");
        git_ok(&l.root, &["init", "-q", "--bare", remote.to_str().unwrap()]);
        git_ok(
            &l.root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        let push = |sha: &str| {
            git_ok(
                &l.root,
                &[
                    "push",
                    "-q",
                    "-f",
                    "origin",
                    &format!("{sha}:refs/heads/feature"),
                ],
            )
        };
        let tree_of = |sha: &str| git_ok(&l.root, &["rev-parse", &format!("{sha}^{{tree}}")]);
        let first_backup = l.webhook.clone();
        push(&first_backup);
        let first_rewrite = git_ok(
            &l.root,
            &[
                "commit-tree",
                &tree_of(&first_backup),
                "-p",
                &l.base,
                "-m",
                "Rewrite one",
            ],
        );
        push(&first_rewrite);
        let teammate = git_ok(
            &l.root,
            &[
                "commit-tree",
                &tree_of(&l.retries),
                "-p",
                &first_rewrite,
                "-m",
                "Teammate retries",
            ],
        );
        push(&teammate);
        let second_backup = teammate.clone();
        let second_rewrite = git_ok(
            &l.root,
            &[
                "commit-tree",
                &tree_of(&l.retries),
                "-p",
                &l.base,
                "-m",
                "Rewrite two with the teammate",
            ],
        );
        push(&second_rewrite);

        assert_eq!(
            remote_lease(
                &l.root,
                "feature",
                &first_backup,
                Some(&second_rewrite),
                Some(&teammate),
                None
            ),
            RemoteLease::NotIncluded {
                sha: second_rewrite.clone()
            }
        );
        assert_eq!(
            remote_lease(
                &l.root,
                "feature",
                &second_backup,
                Some(&second_rewrite),
                Some(&teammate),
                None
            ),
            RemoteLease::Included {
                sha: second_rewrite.clone()
            }
        );
        assert_eq!(
            remote_lease(
                &l.root,
                "feature",
                &first_backup,
                Some(&second_rewrite),
                None,
                None
            ),
            RemoteLease::Included {
                sha: second_rewrite
            }
        );
    }

    #[test]
    fn a_hook_that_changes_the_content_fails_the_check_of_a_clean_replay() {
        let l = ledger("hook-changes-content");
        let hooks = l.root.join(".git").join("hooks");
        std::fs::create_dir_all(&hooks).unwrap();
        let hook = hooks.join("pre-commit");
        std::fs::write(
            &hook,
            "#!/bin/sh\necho injected >> hook.txt\ngit add hook.txt\n",
        )
        .unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        let mut reword = step(&l.export, HistoryVerb::Reword);
        reword.message = Some("Add the ledger export endpoint".to_string());
        let mut steps = vec![reword];
        steps.extend(picks(&[
            &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
        ]));
        let prepared = trial(&ledger_plan(&l, steps), &slug("hook-changes-content"), true).unwrap();
        assert_eq!(prepared.stop, None);
        assert!(prepared.head.is_some());
        let check = prepared.check.unwrap();
        assert!(!check.is_passed);
        assert_eq!(check.unexpected_files, vec!["hook.txt".to_string()]);
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
        assert_eq!(worktree_count(&l.root), 1);
    }

    #[test]
    fn switching_to_another_branch_at_the_same_commit_never_rewrites_it() {
        let l = ledger("apply-other-branch");
        let mut steps = picks(&[
            &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
        ]);
        steps.push(fold(&l.typo, &l.export, HistoryVerb::Fixup));
        let head = run_ok(&l, steps, "apply-other-branch").head.unwrap();
        git_ok(&l.root, &["checkout", "-q", "-b", "release"]);
        let outcome = apply_move(
            &l.root,
            "feature",
            &l.typo,
            &head,
            "refs/goodboy/backup/feature/1",
        )
        .unwrap();
        assert!(!matches!(outcome, MoveOutcome::Moved { .. }), "{outcome:?}");
        assert_eq!(
            git_ok(&l.root, &["rev-parse", "refs/heads/release"]),
            l.typo
        );
        assert_eq!(
            git_ok(&l.root, &["rev-parse", "refs/heads/feature"]),
            l.typo
        );
        assert_eq!(git_ok(&l.root, &["status", "--porcelain"]), "");
        let journal = journal_of(&l.root).unwrap();
        git_ok(&l.root, &["read-tree", "-m", "-u", &l.typo, &head]);
        std::fs::write(&journal, format!("{}\n{head}\nref\nfeature\n", l.typo)).unwrap();
        recover_journal(&l.root).unwrap();
        assert_eq!(
            git_ok(&l.root, &["rev-parse", "refs/heads/release"]),
            l.typo
        );
        assert_eq!(
            git_ok(&l.root, &["rev-parse", "refs/heads/feature"]),
            l.typo
        );
    }

    #[test]
    fn backups_of_branches_whose_names_look_alike_never_mix() {
        let b = branch("backup-namespace");
        let slash = format!("{}/{}", backup_namespace("feature/a"), now_nanos());
        let dash = format!("{}/{}", backup_namespace("feature-a"), now_nanos());
        git_ok(&b.root, &["update-ref", &slash, &b.a]);
        git_ok(&b.root, &["update-ref", &dash, &b.b]);
        git_ok(
            &b.root,
            &["update-ref", "refs/goodboy/backup/feature-a/1000", &b.c],
        );
        let listed: Vec<String> = list_backups(&b.root, "feature-a")
            .unwrap()
            .into_iter()
            .filter(|backup| !backup.is_legacy)
            .map(|backup| backup.ref_name)
            .collect();
        assert_eq!(listed, vec![dash.clone()]);
        assert!(is_backup_of("feature-a", &dash));
        assert!(!is_backup_of("feature-a", &slash));
        assert!(!is_backup_of(
            "feature-a",
            "refs/goodboy/backup/feature-a/1000"
        ));
        assert!(!is_backup_of("feature-a", &format!("{dash}/../x")));
    }

    #[test]
    fn an_empty_commit_is_kept_and_a_redundant_one_is_never_dropped_silently() {
        let root = init_repo("empty-commits");
        let base = commit(&root, "a.txt", "one\n", "base");
        git_ok(&root, &["checkout", "-q", "-b", "feature"]);
        let first = commit(&root, "a.txt", "two\n", "first");
        git_ok(
            &root,
            &[
                "commit",
                "-q",
                "--no-verify",
                "--allow-empty",
                "-m",
                "Mark the release",
            ],
        );
        let marker = git_ok(&root, &["rev-parse", "HEAD"]);
        let revert = commit(&root, "a.txt", "one\n", "revert");
        let again = commit(&root, "a.txt", "two\n", "again");
        let mut reword = step(&marker, HistoryVerb::Reword);
        reword.message = Some("Mark the ledger release".to_string());
        let args = plan(
            &root,
            &base,
            &again,
            vec![
                step(&first, HistoryVerb::Pick),
                reword,
                step(&revert, HistoryVerb::Drop),
                step(&again, HistoryVerb::Pick),
            ],
        );
        let result = trial(&args, &slug("empty-commits"), false).unwrap();
        let check = result.check.clone().unwrap();
        assert!(check.is_passed, "{:?}", check.problems);
        let head = result.head.unwrap();
        assert_eq!(
            subjects(&root, &format!("{base}..{head}")),
            vec!["again", "Mark the ledger release", "first"]
        );
        let prediction = predict(&args).unwrap();
        assert_eq!(prediction.steps[3].outcome, StepOutcome::Empty);
        assert!(prediction.steps[3].new_sha.is_some());
    }

    #[test]
    fn removing_a_copy_never_prunes_the_other_worktrees_of_the_repo() {
        let l = ledger("no-global-prune");
        let elsewhere = temp_root("unmounted-drive").join("ledger-review");
        git_ok(
            &l.root,
            &[
                "worktree",
                "add",
                "--detach",
                "--quiet",
                elsewhere.to_str().unwrap(),
                &l.base,
            ],
        );
        let admin = l.root.join(".git").join("worktrees").join("ledger-review");
        assert!(admin.exists());
        std::fs::remove_dir_all(&elsewhere).unwrap();
        let args = ledger_plan(
            &l,
            picks(&[
                &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests, &l.typo,
            ]),
        );
        trial(&args, &slug("no-global-prune"), false).unwrap();
        assert!(
            admin.exists(),
            "the other worktree's registration was pruned"
        );
        assert!(!copy_path_of(&slug("no-global-prune")).exists());
    }

    #[test]
    fn a_crash_after_the_files_moved_is_settled_before_the_next_run_checks_cleanliness() {
        let l = ledger("run-after-crash");
        let mut steps = picks(&[&l.export, &l.batch, &l.webhook, &l.retries, &l.logging]);
        steps.push(step(&l.tests, HistoryVerb::Drop));
        steps.push(step(&l.typo, HistoryVerb::Pick));
        let head = run_ok(&l, steps, "run-after-crash").head.unwrap();
        git_ok(&l.root, &["read-tree", "-m", "-u", &l.typo, &head]);
        let journal = journal_of(&l.root).unwrap();
        std::fs::write(&journal, format!("{}\n{head}\nref\nfeature\n", l.typo)).unwrap();
        let outcome = run_plan(
            &run_args(&l.root, ledger_plan(&l, picks(&[&l.export]))),
            &slug("run-after-crash-next"),
            &|_| {},
        )
        .unwrap();
        let RunOutcome::Blocked { reason } = outcome else {
            panic!("the plan was made before the finished rewrite, so it should not run");
        };
        assert!(!reason.contains("not committed"), "{reason}");
        assert!(!journal.exists());
        assert_eq!(git_ok(&l.root, &["rev-parse", "refs/heads/feature"]), head);
        assert_eq!(git_ok(&l.root, &["status", "--porcelain"]), "");
    }

    #[test]
    fn an_agent_that_skips_a_planned_commit_is_refused() {
        let b = branch("rewriter-skip");
        let args = plan(
            &b.root,
            &b.base,
            &b.c,
            vec![step(&b.b, HistoryVerb::Pick), step(&b.a, HistoryVerb::Pick)],
        );
        let prepared = trial(&args, &slug("rewriter-skip"), true).unwrap();
        let copy = PathBuf::from(prepared.copy_path.unwrap());
        std::fs::write(copy.join("policy.txt"), "three\n").unwrap();
        git_ok(&copy, &["add", "policy.txt"]);
        git_ok(
            &copy,
            &["commit", "--no-verify", "-m", "B edits the policy again"],
        );
        let check = collect_rewrite(&RewriterCollectArgs {
            plan: args,
            copy_path: copy.to_string_lossy().into_owned(),
            skipped: vec![b.a.clone()],
            keeps_copy: false,
        })
        .unwrap();
        assert_eq!(check.head, None);
        assert!(!check.problems.is_empty());
        discard_copy(&copy.to_string_lossy());
    }

    #[test]
    fn the_copy_git_dirs_are_its_own_admin_folder_and_the_objects_only() {
        let l = ledger("copy-git-dirs");
        let other = temp_root("copy-git-dirs-other").join("review");
        git_ok(
            &l.root,
            &[
                "worktree",
                "add",
                "--detach",
                "--quiet",
                other.to_str().unwrap(),
                &l.base,
            ],
        );
        let copy = copy_path_of(&slug("copy-git-dirs"));
        let guard = create_copy(&l.root, &copy, &l.base).unwrap();
        let dirs = copy_git_dirs(&copy).unwrap();
        let common = std::fs::canonicalize(l.root.join(".git")).unwrap();
        assert_eq!(PathBuf::from(&dirs.objects_dir), common.join("objects"));
        assert!(PathBuf::from(&dirs.git_dir).starts_with(common.join("worktrees")));
        assert_ne!(
            PathBuf::from(&dirs.git_dir),
            common.join("worktrees").join("review")
        );
        assert!(!common.join("refs").join("heads").starts_with(&dirs.git_dir));
        assert_eq!(
            PathBuf::from(&dirs.packed_refs_lock),
            common.join("packed-refs.lock")
        );
        drop(guard);
        assert_eq!(copy_git_dirs(&l.root.join("copy")), None);
    }

    #[cfg(unix)]
    #[test]
    fn a_copy_whose_git_file_becomes_a_link_never_reaches_another_worktree() {
        let l = ledger("copy-git-link");
        let other = temp_root("copy-git-link-other").join("review");
        git_ok(
            &l.root,
            &[
                "worktree",
                "add",
                "--detach",
                "--quiet",
                other.to_str().unwrap(),
                &l.base,
            ],
        );
        let review_admin =
            std::fs::canonicalize(git_ok(&other, &["rev-parse", "--absolute-git-dir"])).unwrap();
        let copy = copy_path_of(&slug("copy-git-link"));
        let mut guard = create_copy(&l.root, &copy, &l.base).unwrap();
        guard.is_kept = true;
        let own_admin = PathBuf::from(copy_git_dirs(&copy).unwrap().git_dir);

        std::fs::remove_file(copy.join(".git")).unwrap();
        std::os::unix::fs::symlink(other.join(".git"), copy.join(".git")).unwrap();
        assert_eq!(copy_git_dirs(&copy), None);

        drop(guard);
        discard_copy(&copy.to_string_lossy());
        assert!(!copy.exists());
        assert!(review_admin.join("gitdir").exists());
        assert_eq!(git_ok(&other, &["rev-parse", "HEAD"]), l.base);
        assert!(!own_admin.exists());
    }

    #[test]
    fn a_copy_whose_git_file_names_another_admin_dir_keeps_its_recorded_one() {
        let l = ledger("copy-git-retarget");
        let other = temp_root("copy-git-retarget-other").join("review");
        git_ok(
            &l.root,
            &[
                "worktree",
                "add",
                "--detach",
                "--quiet",
                other.to_str().unwrap(),
                &l.base,
            ],
        );
        let review_admin =
            std::fs::canonicalize(git_ok(&other, &["rev-parse", "--absolute-git-dir"])).unwrap();
        let copy = copy_path_of(&slug("copy-git-retarget"));
        let mut guard = create_copy(&l.root, &copy, &l.base).unwrap();
        guard.is_kept = true;
        let own_admin = PathBuf::from(copy_git_dirs(&copy).unwrap().git_dir);
        std::fs::write(
            copy.join(".git"),
            format!("gitdir: {}\n", review_admin.to_string_lossy()),
        )
        .unwrap();
        assert_eq!(
            copy_git_dirs(&copy).map(|dirs| PathBuf::from(dirs.git_dir)),
            Some(own_admin.clone())
        );
        drop(guard);
        discard_copy(&copy.to_string_lossy());
        assert!(review_admin.join("gitdir").exists());
        assert!(!own_admin.exists());
    }

    #[test]
    fn an_older_backup_stays_read_only_and_never_moves_onto_a_later_branch_with_its_slug() {
        let b = branch("legacy-backups");
        let deleted = "refs/goodboy/backup/feature-ledger/1000000000000000000";
        git_ok(&b.root, &["update-ref", deleted, &b.a]);
        git_ok(&b.root, &["checkout", "-q", "-b", "feature-ledger"]);
        git_ok(&b.root, &["branch", "team/other"]);

        for owner in ["feature-ledger", "Feature/Ledger"] {
            let listed = list_backups(&b.root, owner).unwrap();
            assert_eq!(listed.len(), 1, "{owner}");
            assert!(listed[0].is_legacy);
            assert_eq!(listed[0].ref_name, deleted);
        }
        assert!(list_backups(&b.root, "team/other").unwrap().is_empty());
        assert!(restore_blocking(&b.root, "feature-ledger", &b.c, deleted).is_err());
        assert_eq!(git_ok(&b.root, &["rev-parse", "HEAD"]), b.c);
        prune_backups_before(&b.root, u64::MAX);
        assert_eq!(git_ok(&b.root, &["rev-parse", deleted]), b.a);
        assert_eq!(
            git_ok(
                &b.root,
                &["for-each-ref", "--format=%(refname)", BACKUP_PREFIX]
            ),
            deleted
        );
    }

    #[test]
    fn pruning_keeps_twenty_restore_backups_and_always_the_newest_backup_of_a_branch() {
        let b = branch("prune-caps");
        let kept_space = backup_namespace("feature");
        let stamp = |index: u128| 1_000_000_000_000_000_000u128 + index * 1_000_000_000;
        for index in 0..22 {
            git_ok(
                &b.root,
                &[
                    "update-ref",
                    &format!("{kept_space}/{KEPT_STAMP}{}", stamp(index)),
                    &b.a,
                ],
            );
        }
        let lone = format!("{}/{}", backup_namespace("team/lone"), stamp(1));
        git_ok(&b.root, &["update-ref", &lone, &b.b]);
        let older = format!("{}/{}", backup_namespace("team/pair"), stamp(1));
        let newer = format!("{}/{}", backup_namespace("team/pair"), stamp(2));
        git_ok(&b.root, &["update-ref", &older, &b.b]);
        git_ok(&b.root, &["update-ref", &newer, &b.c]);

        prune_backups_before(&b.root, u64::MAX);

        let left = lines_of(&git_ok(
            &b.root,
            &["for-each-ref", "--format=%(refname)", BACKUP_PREFIX],
        ));
        let kept: Vec<&String> = left
            .iter()
            .filter(|name| name.starts_with(&kept_space))
            .collect();
        assert_eq!(kept.len(), 20);
        assert!(left.contains(&format!("{kept_space}/{KEPT_STAMP}{}", stamp(21))));
        assert!(!left.contains(&format!("{kept_space}/{KEPT_STAMP}{}", stamp(0))));
        assert!(!left.contains(&format!("{kept_space}/{KEPT_STAMP}{}", stamp(1))));
        assert!(left.contains(&lone));
        assert!(left.contains(&newer));
        assert!(!left.contains(&older));
    }

    #[test]
    fn the_restore_backup_cap_never_drops_the_only_ref_to_its_commits() {
        let b = branch("prune-only-ref");
        let space = backup_namespace("feature");
        let stamp = |index: u128| 1_000_000_000_000_000_000u128 + index * 1_000_000_000;
        let tree = git_ok(&b.root, &["rev-parse", &format!("{}^{{tree}}", b.b)]);
        let dangling = git_ok(
            &b.root,
            &[
                "commit-tree",
                &tree,
                "-p",
                &b.a,
                "-m",
                "Only kept by a backup",
            ],
        );
        let oldest = format!("{space}/{KEPT_STAMP}{}", stamp(0));
        let second = format!("{space}/{KEPT_STAMP}{}", stamp(1));
        git_ok(&b.root, &["update-ref", &oldest, &dangling]);
        git_ok(&b.root, &["update-ref", &second, &b.a]);
        for index in 2..22 {
            git_ok(
                &b.root,
                &[
                    "update-ref",
                    &format!("{space}/{KEPT_STAMP}{}", stamp(index)),
                    &b.c,
                ],
            );
        }

        prune_backups_before(&b.root, u64::MAX);

        assert_eq!(git_ok(&b.root, &["rev-parse", &oldest]), dangling);
        assert!(
            git_run(
                &b.root,
                &["rev-parse", "--verify", "--quiet", &second],
                None,
                None
            )
            .unwrap()
            .status
                != 0
        );
    }

    #[test]
    fn the_backup_a_restore_leaves_is_never_pruned() {
        let l = ledger("restore-backup-kept");
        let mut steps = picks(&[&l.export, &l.batch, &l.webhook, &l.retries, &l.logging]);
        steps.push(step(&l.tests, HistoryVerb::Drop));
        steps.push(step(&l.typo, HistoryVerb::Pick));
        let head = run_ok(&l, steps, "restore-backup-kept").head.unwrap();
        let MoveOutcome::Moved {
            backup_ref: rewrite_backup,
            ..
        } = move_branch_blocking(&l.root, "feature", &l.typo, &head).unwrap()
        else {
            panic!("expected the rewrite to move the branch");
        };
        let MoveOutcome::Moved {
            backup_ref: restore_backup,
            ..
        } = restore_blocking(&l.root, "feature", &head, &rewrite_backup).unwrap()
        else {
            panic!("expected the restore to move the branch");
        };
        assert_eq!(git_ok(&l.root, &["rev-parse", "HEAD"]), l.typo);
        prune_backups_before(&l.root, u64::MAX);
        assert_eq!(git_ok(&l.root, &["rev-parse", &restore_backup]), head);
        assert!(
            git_run(
                &l.root,
                &["rev-parse", "--verify", "--quiet", &rewrite_backup],
                None,
                None
            )
            .unwrap()
            .status
                != 0
        );
        let listed = list_backups(&l.root, "feature").unwrap();
        assert!(listed
            .iter()
            .any(|backup| backup.ref_name == restore_backup));
    }

    #[cfg(unix)]
    struct WritableAgain(PathBuf);

    #[cfg(unix)]
    impl Drop for WritableAgain {
        fn drop(&mut self) {
            set_writable(&self.0, true, &[]);
        }
    }

    #[cfg(unix)]
    fn set_writable(path: &Path, is_writable: bool, keep: &[PathBuf]) {
        use std::os::unix::fs::PermissionsExt;
        if keep.iter().any(|kept| path.starts_with(kept)) {
            return;
        }
        let Ok(meta) = std::fs::symlink_metadata(path) else {
            return;
        };
        if meta.file_type().is_symlink() {
            return;
        }
        if meta.is_dir() {
            if is_writable {
                let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755));
            }
            if let Ok(entries) = std::fs::read_dir(path) {
                for entry in entries.flatten() {
                    set_writable(&entry.path(), is_writable, keep);
                }
            }
            if !is_writable {
                let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o555));
            }
            return;
        }
        let mode = meta.permissions().mode();
        let next = if is_writable {
            mode | 0o200
        } else {
            mode & !0o222
        };
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(next));
    }

    fn snapshot(root: &Path, paths: &[PathBuf]) -> std::collections::BTreeMap<PathBuf, Vec<u8>> {
        let mut found = std::collections::BTreeMap::new();
        let mut pending: Vec<PathBuf> = paths.to_vec();
        while let Some(path) = pending.pop() {
            let Ok(meta) = std::fs::symlink_metadata(&path) else {
                continue;
            };
            if meta.is_dir() {
                if let Ok(entries) = std::fs::read_dir(&path) {
                    pending.extend(entries.flatten().map(|entry| entry.path()));
                }
                continue;
            }
            let relative = path.strip_prefix(root).unwrap_or(&path).to_path_buf();
            found.insert(relative, std::fs::read(&path).unwrap_or_default());
        }
        found
    }

    fn git_in(copy: &Path, args: &[&str], todo: Option<&str>) -> std::process::Output {
        let mut command = crate::path_env::command("git");
        command
            .args(args)
            .current_dir(copy)
            .env("GIT_EDITOR", "true")
            .env("GIT_TERMINAL_PROMPT", "0");
        if let Some(todo) = todo {
            command.env("GIT_SEQUENCE_EDITOR", format!("cp {todo}"));
        }
        command.output().unwrap()
    }

    #[cfg(unix)]
    #[test]
    fn the_rewriter_git_sequence_works_inside_its_roots_and_leaves_the_user_refs_untouched() {
        let l = ledger("rewriter-roots");
        let other = temp_root("rewriter-roots-other").join("ledger-review");
        git_ok(
            &l.root,
            &[
                "worktree",
                "add",
                "-q",
                "-b",
                "review",
                other.to_str().unwrap(),
                &l.base,
            ],
        );
        std::fs::write(l.root.join("export.ts"), "work in progress\n").unwrap();
        git_ok(&l.root, &["stash", "push", "-q", "-m", "keep this"]);
        git_ok(&l.root, &["pack-refs", "--all"]);
        let copy = copy_path_of(&slug("rewriter-roots"));
        let mut guard = create_copy(&l.root, &copy, &l.base).unwrap();
        guard.is_kept = true;
        let dirs = copy_git_dirs(&copy).unwrap();
        let root = std::fs::canonicalize(&l.root).unwrap();
        let common = root.join(".git");
        let watched = vec![
            common.join("refs"),
            common.join("packed-refs"),
            common.join("logs"),
            common.join("worktrees").join("ledger-review"),
            root.join("export.ts"),
            root.join("ledger.ts"),
        ];
        let before = snapshot(&root, &watched);
        assert!(before
            .keys()
            .any(|path| path.ends_with("refs/stash") || path.ends_with("logs/refs/stash")));

        let todo = temp_root("rewriter-roots-todo").join("todo");
        std::fs::write(
            &todo,
            [
                &l.typo, &l.export, &l.batch, &l.webhook, &l.retries, &l.logging, &l.tests,
            ]
            .iter()
            .map(|sha| format!("pick {sha}\n"))
            .collect::<String>(),
        )
        .unwrap();
        let keep = vec![
            PathBuf::from(&dirs.objects_dir),
            PathBuf::from(&dirs.git_dir),
        ];
        set_writable(&root, false, &keep);
        let restore = WritableAgain(root.clone());
        let lock = PathBuf::from(&dirs.packed_refs_lock);
        assert_eq!(lock.parent(), Some(common.as_path()));
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&common, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        let names = |dir: &Path| -> Vec<String> {
            let mut found: Vec<String> = std::fs::read_dir(dir)
                .unwrap()
                .flatten()
                .map(|entry| entry.file_name().to_string_lossy().to_string())
                .collect();
            found.sort();
            found
        };
        let common_names = names(&common);

        let todo_text = todo.to_string_lossy().to_string();
        let started = git_in(
            &copy,
            &["rebase", "-i", "--onto", "HEAD", &l.base, &l.tests],
            Some(&todo_text),
        );
        assert!(
            !started.status.success(),
            "the planned conflict should stop the rebase"
        );
        std::fs::write(copy.join("export.ts"), "export v2\n").unwrap();
        let added = git_in(&copy, &["add", "export.ts"], None);
        assert!(
            added.status.success(),
            "{}",
            String::from_utf8_lossy(&added.stderr)
        );
        let next = git_in(&copy, &["rebase", "--continue"], None);
        assert!(
            !next.status.success(),
            "the second step should conflict too"
        );
        std::fs::write(copy.join("export.ts"), "export v2\n").unwrap();
        git_in(&copy, &["add", "export.ts"], None);
        let empty = git_in(
            &copy,
            &[
                "commit",
                "--allow-empty",
                "-m",
                "Add ledger export endpoint",
            ],
            None,
        );
        assert!(
            empty.status.success(),
            "{}",
            String::from_utf8_lossy(&empty.stderr)
        );
        let finished = git_in(&copy, &["rebase", "--continue"], None);
        assert!(
            finished.status.success(),
            "{}",
            String::from_utf8_lossy(&finished.stderr)
        );
        let amended = git_in(
            &copy,
            &["commit", "--amend", "-m", "Add the export test fixtures"],
            None,
        );
        assert!(
            amended.status.success(),
            "{}",
            String::from_utf8_lossy(&amended.stderr)
        );

        assert_eq!(names(&common), common_names);
        assert!(!lock.exists());
        drop(restore);
        assert_eq!(
            git_ok(&copy, &["log", "-1", "--format=%s"]),
            "Add the export test fixtures"
        );
        assert_eq!(
            git_ok(
                &copy,
                &["rev-list", "--count", &format!("{}..HEAD", l.base)]
            ),
            "7"
        );
        assert_eq!(snapshot(&root, &watched), before);
        drop(guard);
        discard_copy(&copy.to_string_lossy());
    }
}
