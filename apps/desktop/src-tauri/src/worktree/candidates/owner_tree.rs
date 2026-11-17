use super::branch_move::{after_files_moved, ensure_nothing_untracked_in_the_way, BranchTarget};
use crate::proc::git::Git;
use crate::worktree::error::WorktreeError;
use crate::worktree::git::{git, is_ancestor, resolve_commit, short_of};
use crate::worktree::slug::sanitize_slug;
use std::collections::{BTreeSet, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

pub(crate) const OWNER_TREE_SUBJECT: &str = "goodboy: your working tree before the fix";

const SNAPSHOT_NAME: &str = "Goodboy";
const SNAPSHOT_EMAIL: &str = "goodboy@localhost";
const APPLYING: &str = "applying-to-working-tree";
const APPLIED: &str = "applied-to-working-tree";
const GITLINK_MODE: &str = "160000";
const NO_LONGER_APPLIES: &str = "the fix no longer applies on the branch";
const READY_FIX_FIRST: &str =
    "apply or skip the ready fix first: a note fix starts only on your branch as it is";
const ONE_AT_A_TIME: &str =
    "this fix is built on another fix that waits for review: apply or skip the ready fix first";
const SUBMODULE: &str =
    "the fix changes a submodule, and Goodboy never lands a submodule in your working tree: nothing was changed";
const MERGED: &str =
    "the fix holds a merge commit, and Goodboy never lands a merge in your working tree: nothing was changed";
const MOVED_WHILE_LANDING: &str =
    "your branch changed while Goodboy was landing the fix, so nothing more was changed";
const CHANGED_WHILE_LANDING: &str =
    "files of the fix changed while Goodboy was landing it, so they were left as they are";
const LANDED_THEN_CHANGED: &str =
    "the fix landed in your working tree, but your branch or its files changed since: check them before you accept again";
const PARTLY_LANDED: &str =
    "the fix was only partly written to your working tree: accept again to finish it";

static NEXT_INDEX: AtomicU64 = AtomicU64::new(0);

fn git_failure(error: impl ToString) -> WorktreeError {
    WorktreeError::Git {
        message: error.to_string(),
    }
}

pub(super) struct TempIndex {
    path: PathBuf,
}

impl TempIndex {
    pub(super) fn new(cwd: &Path, label: &str) -> Result<Self, WorktreeError> {
        let git_dir = git(cwd, &["rev-parse", "--absolute-git-dir"])?;
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|elapsed| elapsed.as_nanos())
            .unwrap_or_default();
        let path = Path::new(git_dir.trim()).join(format!(
            "goodboy-{label}-{}-{}-{nanos}.index",
            std::process::id(),
            NEXT_INDEX.fetch_add(1, Ordering::Relaxed)
        ));
        Ok(Self { path })
    }

    pub(super) fn run(&self, cwd: &Path, args: &[&str]) -> Result<String, WorktreeError> {
        Git::new()
            .cwd(cwd)
            .index_file(&self.path)
            .args(args)
            .stdout()
            .map_err(git_failure)
    }

    fn feed(&self, cwd: &Path, args: &[&str], input: Vec<u8>) -> Result<String, WorktreeError> {
        Git::new()
            .cwd(cwd)
            .index_file(&self.path)
            .args(args)
            .input(input)
            .stdout()
            .map_err(git_failure)
    }

    pub(super) fn take_from_disk(&self, cwd: &Path, paths: &[String]) -> Result<(), WorktreeError> {
        if paths.is_empty() {
            return Ok(());
        }
        self.feed(
            cwd,
            &["update-index", "--add", "--remove", "-z", "--stdin"],
            nul_joined(paths),
        )
        .map(|_| ())
    }

    fn apply(&self, cwd: &Path, patch: &str) -> Result<(), WorktreeError> {
        self.feed(
            cwd,
            &["apply", "--cached", "--whitespace=nowarn", "-"],
            patch.as_bytes().to_vec(),
        )
        .map(|_| ())
    }

    pub(super) fn write_tree(&self, cwd: &Path) -> Result<String, WorktreeError> {
        Ok(self.run(cwd, &["write-tree"])?.trim().to_string())
    }
}

impl Drop for TempIndex {
    fn drop(&mut self) {
        if self.path.exists() {
            crate::logging::note_failure(
                "temporary index delete",
                std::fs::remove_file(&self.path),
            );
        }
    }
}

fn nul_joined(paths: &[String]) -> Vec<u8> {
    paths.iter().fold(Vec::new(), |mut bytes, path| {
        bytes.extend_from_slice(path.as_bytes());
        bytes.push(0);
        bytes
    })
}

pub(super) struct Change {
    pub(super) path: String,
    is_gitlink: bool,
}

pub(super) fn changes_between(
    cwd: &Path,
    from: &str,
    to: &str,
) -> Result<Vec<Change>, WorktreeError> {
    let raw = git(
        cwd,
        &["diff-tree", "-r", "-z", "--raw", "--no-renames", from, to],
    )?;
    let mut tokens = raw.split('\0').filter(|token| !token.is_empty());
    let mut changes = Vec::new();
    while let Some(header) = tokens.next() {
        let Some(path) = tokens.next() else {
            break;
        };
        let modes: Vec<&str> = header
            .trim_start_matches(':')
            .split_whitespace()
            .take(2)
            .collect();
        changes.push(Change {
            path: path.to_string(),
            is_gitlink: modes.contains(&GITLINK_MODE),
        });
    }
    Ok(changes)
}

fn paths_between(cwd: &Path, from: &str, to: &str) -> Result<Vec<String>, WorktreeError> {
    Ok(changes_between(cwd, from, to)?
        .into_iter()
        .map(|change| change.path)
        .collect())
}

fn diff_of(cwd: &Path, from: &str, to: &str) -> Result<String, WorktreeError> {
    git(
        cwd,
        &["diff-tree", "-p", "--binary", "--no-renames", from, to],
    )
}

fn is_owner_tree_commit(email: &str, subject: &str) -> bool {
    email.trim() == SNAPSHOT_EMAIL && subject.trim() == OWNER_TREE_SUBJECT
}

pub(super) fn is_owner_tree_message(email: &str, message: &str) -> bool {
    is_owner_tree_commit(email, message.lines().next().unwrap_or_default())
}

pub(super) struct Listed {
    pub(super) sha: String,
    pub(super) is_merge: bool,
    pub(super) is_owner_tree: bool,
}

pub(super) fn commits_between(
    cwd: &Path,
    base: &str,
    tip: &str,
) -> Result<Vec<Listed>, WorktreeError> {
    let listed = git(
        cwd,
        &[
            "log",
            "--no-show-signature",
            "--reverse",
            "--format=%H%x1f%P%x1f%ae%x1f%s",
            &format!("{base}..{tip}"),
        ],
    )?;
    let mut commits = Vec::new();
    for line in listed.lines().filter(|line| !line.trim().is_empty()) {
        let fields: Vec<&str> = line.split('\u{1f}').collect();
        if fields.len() < 4 {
            return Err(git_failure("the history of the fix is unreadable"));
        }
        commits.push(Listed {
            sha: fields[0].trim().to_string(),
            is_merge: fields[1].split_whitespace().count() > 1,
            is_owner_tree: is_owner_tree_commit(fields[2], fields[3]),
        });
    }
    Ok(commits)
}

pub(super) fn holds_only_owner_tree(
    cwd: &Path,
    base: &str,
    tip: &str,
) -> Result<bool, WorktreeError> {
    let commits = commits_between(cwd, base, tip)?;
    Ok(!commits.is_empty() && commits.iter().all(|commit| commit.is_owner_tree))
}

pub(super) fn carries_owner_tree(cwd: &Path, base: &str, tip: &str) -> Result<bool, WorktreeError> {
    Ok(commits_between(cwd, base, tip)?
        .iter()
        .any(|commit| commit.is_owner_tree))
}

pub(crate) fn owner_tree_base(cwd: &Path, base: &str, tip: &str) -> Result<String, WorktreeError> {
    Ok(commits_between(cwd, base, tip)?
        .into_iter()
        .filter(|commit| commit.is_owner_tree)
        .map(|commit| commit.sha)
        .next_back()
        .unwrap_or_else(|| base.to_string()))
}

fn commit_owner_tree(cwd: &Path, tree: &str, parent: &str) -> Result<String, WorktreeError> {
    let created = Git::new()
        .cwd(cwd)
        .args(["commit-tree", tree, "-p", parent])
        .env("GIT_AUTHOR_NAME", SNAPSHOT_NAME)
        .env("GIT_AUTHOR_EMAIL", SNAPSHOT_EMAIL)
        .env("GIT_COMMITTER_NAME", SNAPSHOT_NAME)
        .env("GIT_COMMITTER_EMAIL", SNAPSHOT_EMAIL)
        .input(OWNER_TREE_SUBJECT.as_bytes().to_vec())
        .stdout()
        .map_err(git_failure)?;
    Ok(created.trim().to_string())
}

pub(crate) fn snapshot_owner_tree(cwd: &Path, head: &str) -> Result<String, WorktreeError> {
    let index = TempIndex::new(cwd, "owner-tree")?;
    let git_dir = git(cwd, &["rev-parse", "--absolute-git-dir"])?;
    let own_index = Path::new(git_dir.trim()).join("index");
    if own_index.is_file() {
        std::fs::copy(&own_index, &index.path)?;
    }
    if !index.path.is_file() {
        index.run(cwd, &["read-tree", head])?;
    }
    index.run(cwd, &["add", "--all", "--", "."])?;
    let tree = index.write_tree(cwd)?;
    commit_owner_tree(cwd, &tree, head)
}

pub(crate) fn owner_tree_on(cwd: &Path, start: &str) -> Result<String, WorktreeError> {
    let head = resolve_commit(cwd, "HEAD")?;
    if start != head {
        return Err(git_failure(READY_FIX_FIRST));
    }
    snapshot_owner_tree(cwd, &head)
}

fn recovery_ref(id: &str, side: &str) -> String {
    format!("refs/goodboy/recovery/{}/{side}", sanitize_slug(id))
}

fn keep_recovery_trees(cwd: &Path, id: &str, entry: &Journal) -> Result<(), WorktreeError> {
    git(cwd, &["update-ref", &recovery_ref(id, "pre"), &entry.pre])?;
    git(cwd, &["update-ref", &recovery_ref(id, "post"), &entry.post])?;
    Ok(())
}

fn drop_recovery_trees(cwd: &Path, id: &str) {
    for side in ["pre", "post"] {
        crate::logging::note_failure(
            "recovery ref delete",
            git(cwd, &["update-ref", "-d", &recovery_ref(id, side)]),
        );
    }
}

struct Journal {
    state: String,
    pre: String,
    post: String,
    head: String,
    branch: String,
}

fn read_journal(journal: &Path, candidate: &str) -> Result<Option<Journal>, WorktreeError> {
    if !journal.exists() {
        return Ok(None);
    }
    let recorded = std::fs::read_to_string(journal)?;
    let lines: Vec<&str> = recorded.lines().map(str::trim).collect();
    if lines.first().copied() != Some(candidate) {
        return Err(git_failure(
            "the integration journal holds a different commit for this candidate",
        ));
    }
    if lines.len() < 6 {
        return Err(git_failure("the integration journal is incomplete"));
    }
    Ok(Some(Journal {
        state: lines[1].to_string(),
        pre: lines[2].to_string(),
        post: lines[3].to_string(),
        head: lines[4].to_string(),
        branch: lines[5].to_string(),
    }))
}

fn write_journal(journal: &Path, candidate: &str, entry: &Journal) -> Result<(), WorktreeError> {
    let dir = journal
        .parent()
        .ok_or_else(|| git_failure("the integration journal has no parent directory"))?;
    std::fs::create_dir_all(dir)?;
    let pending = journal.with_extension("pending");
    std::fs::write(
        &pending,
        format!(
            "{candidate}\n{}\n{}\n{}\n{}\n{}\n",
            entry.state, entry.pre, entry.post, entry.head, entry.branch
        ),
    )?;
    std::fs::rename(&pending, journal)?;
    Ok(())
}

fn branch_of(cwd: &Path) -> String {
    git(cwd, &["symbolic-ref", "-q", "HEAD"])
        .map(|name| name.trim().to_string())
        .unwrap_or_default()
}

fn owner_tree_now(
    cwd: &Path,
    head: &str,
    paths: &[String],
) -> Result<(TempIndex, String), WorktreeError> {
    let index = TempIndex::new(cwd, "owner-apply")?;
    index.run(cwd, &["read-tree", head])?;
    let files: Vec<String> = paths
        .iter()
        .filter(|path| {
            std::fs::symlink_metadata(cwd.join(path)).map_or(true, |meta| !meta.is_dir())
        })
        .cloned()
        .collect();
    index.take_from_disk(cwd, &files)?;
    let tree = index.write_tree(cwd)?;
    Ok((index, tree))
}

#[derive(PartialEq, Eq)]
enum Landing {
    Untouched,
    Partly,
    Done,
}

fn landing_of(
    cwd: &Path,
    current: &str,
    entry: &Journal,
    paths: &[String],
) -> Result<Landing, WorktreeError> {
    let off_post: HashSet<String> = paths_between(cwd, current, &entry.post)?
        .into_iter()
        .collect();
    let off_pre: HashSet<String> = paths_between(cwd, current, &entry.pre)?
        .into_iter()
        .collect();
    let mut done = 0;
    for path in paths {
        let is_done = !off_post.contains(path);
        if !is_done && off_pre.contains(path) {
            return Err(git_failure(CHANGED_WHILE_LANDING));
        }
        done += usize::from(is_done);
    }
    if done == paths.len() {
        return Ok(Landing::Done);
    }
    if done == 0 {
        return Ok(Landing::Untouched);
    }
    Ok(Landing::Partly)
}

pub(super) struct OwnerTreeIntegration<'a> {
    pub(super) path: &'a Path,
    pub(super) id: &'a str,
    pub(super) journal: &'a Path,
    pub(super) expected: &'a str,
    pub(super) candidate: &'a str,
    pub(super) target: &'a BranchTarget,
}

fn fixes_of(plan: &OwnerTreeIntegration<'_>) -> Result<Vec<String>, WorktreeError> {
    let commits = commits_between(plan.path, plan.expected, plan.candidate)?;
    let is_single_snapshot = commits.first().is_some_and(|commit| commit.is_owner_tree)
        && commits.iter().filter(|commit| commit.is_owner_tree).count() == 1;
    if !is_single_snapshot {
        return Err(git_failure(ONE_AT_A_TIME));
    }
    let mut fixes = Vec::new();
    for commit in commits.into_iter().skip(1) {
        if commit.is_merge {
            return Err(git_failure(MERGED));
        }
        fixes.push(commit.sha);
    }
    Ok(fixes)
}

fn guard(
    plan: &OwnerTreeIntegration<'_>,
    owner: &TempIndex,
    entry: &Journal,
) -> Result<(), WorktreeError> {
    ensure_nothing_untracked_in_the_way(
        plan.path,
        &|args| owner.run(plan.path, args),
        &entry.pre,
        &entry.post,
    )
}

fn land(
    plan: &OwnerTreeIntegration<'_>,
    owner: &TempIndex,
    entry: &Journal,
) -> Result<(), WorktreeError> {
    owner.run(
        plan.path,
        &["read-tree", "-m", "-u", &entry.pre, &entry.post],
    )?;
    after_files_moved(plan.path);
    Ok(())
}

fn finish(plan: &OwnerTreeIntegration<'_>, mut entry: Journal) -> Result<String, WorktreeError> {
    entry.state = APPLIED.to_string();
    write_journal(plan.journal, plan.candidate, &entry)?;
    drop_recovery_trees(plan.path, plan.id);
    Ok(plan.candidate.to_string())
}

fn touched_by(cwd: &Path, fixes: &[String]) -> Result<Vec<String>, WorktreeError> {
    let mut touched = BTreeSet::new();
    for fix in fixes {
        for change in changes_between(cwd, &format!("{fix}^"), fix)? {
            if change.is_gitlink {
                return Err(git_failure(SUBMODULE));
            }
            touched.insert(change.path);
        }
    }
    Ok(touched.into_iter().collect())
}

fn resume(plan: &OwnerTreeIntegration<'_>, entry: Journal) -> Result<String, WorktreeError> {
    let is_applied = entry.state == APPLIED;
    let refused = |error: WorktreeError| match is_applied {
        true => git_failure(LANDED_THEN_CHANGED),
        false => error,
    };
    if entry.head != plan.target.head || entry.branch != branch_of(plan.path) {
        return Err(refused(git_failure(MOVED_WHILE_LANDING)));
    }
    let paths = paths_between(plan.path, &entry.pre, &entry.post).map_err(refused)?;
    let (owner, current) = owner_tree_now(plan.path, &plan.target.head, &paths)?;
    let landing = landing_of(plan.path, &current, &entry, &paths).map_err(refused)?;
    if is_applied && landing != Landing::Done {
        return Err(git_failure(LANDED_THEN_CHANGED));
    }
    if landing != Landing::Done {
        guard(plan, &owner, &entry)?;
        land(plan, &owner, &entry).map_err(|_| git_failure(PARTLY_LANDED))?;
    }
    finish(plan, entry)
}

pub(super) fn integrate_onto_owner_tree(
    plan: OwnerTreeIntegration<'_>,
) -> Result<String, WorktreeError> {
    if let Some(entry) = read_journal(plan.journal, plan.candidate)? {
        return resume(&plan, entry);
    }
    if !is_ancestor(plan.path, plan.expected, plan.candidate) {
        return Err(git_failure(
            "the candidate is not based on the expected branch head",
        ));
    }
    let actual = plan.target.head.as_str();
    if !is_ancestor(plan.path, plan.expected, actual) {
        return Err(git_failure(format!(
            "the branch moved: expected head {}, found {}",
            short_of(plan.expected),
            short_of(actual)
        )));
    }
    let fixes = fixes_of(&plan)?;
    let touched = touched_by(plan.path, &fixes)?;
    let (owner, pre) = owner_tree_now(plan.path, actual, &touched)?;
    let fixed = TempIndex::new(plan.path, "owner-fix")?;
    fixed.run(plan.path, &["read-tree", &pre])?;
    for fix in &fixes {
        let patch = diff_of(plan.path, &format!("{fix}^"), fix)?;
        if !patch.trim().is_empty() && fixed.apply(plan.path, &patch).is_err() {
            return Err(git_failure(NO_LONGER_APPLIES));
        }
    }
    let entry = Journal {
        state: APPLYING.to_string(),
        post: fixed.write_tree(plan.path)?,
        pre,
        head: actual.to_string(),
        branch: plan.target.refname.clone().unwrap_or_default(),
    };
    if entry.pre == entry.post {
        return finish(&plan, entry);
    }
    guard(&plan, &owner, &entry)?;
    if !plan.target.is_current(plan.path) {
        return Err(git_failure(MOVED_WHILE_LANDING));
    }
    keep_recovery_trees(plan.path, plan.id, &entry)?;
    write_journal(plan.journal, plan.candidate, &entry)?;
    if land(&plan, &owner, &entry).is_err() {
        return settle_failed_landing(&plan, &entry);
    }
    finish(&plan, entry)
}

fn settle_failed_landing(
    plan: &OwnerTreeIntegration<'_>,
    entry: &Journal,
) -> Result<String, WorktreeError> {
    let paths = paths_between(plan.path, &entry.pre, &entry.post)?;
    let (_, current) = owner_tree_now(plan.path, &plan.target.head, &paths)?;
    if landing_of(plan.path, &current, entry, &paths)? != Landing::Untouched {
        return Err(git_failure(PARTLY_LANDED));
    }
    std::fs::remove_file(plan.journal)?;
    drop_recovery_trees(plan.path, plan.id);
    Err(git_failure(NO_LONGER_APPLIES))
}

#[cfg(test)]
mod tests;
