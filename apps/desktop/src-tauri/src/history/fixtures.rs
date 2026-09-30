use crate::history::backups::now_nanos;
use crate::history::reservation::copy_path_of;
use crate::history::run::{run_plan, HistoryRunArgs, RunOutcome};
use crate::history::types::{HistoryPlanArgs, HistoryStep, HistoryVerb, TrialResult};
use crate::worktree::git;
use std::path::{Path, PathBuf};

pub(super) fn slug(name: &str) -> String {
    format!("{name}-{}-{}", std::process::id(), now_nanos())
}

pub(super) fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-history-test-{name}-{}-{}",
        std::process::id(),
        now_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    root
}

pub(super) fn git_ok(cwd: &Path, args: &[&str]) -> String {
    git(cwd, args)
        .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
        .trim()
        .to_string()
}

pub(super) fn init_repo(name: &str) -> PathBuf {
    let root = temp_root(name);
    git_ok(&root, &["init", "-b", "main"]);
    git_ok(&root, &["config", "user.email", "test@example.com"]);
    git_ok(&root, &["config", "user.name", "test"]);
    git_ok(&root, &["config", "commit.gpgsign", "false"]);
    root
}

pub(super) fn commit(root: &Path, file: &str, body: &str, message: &str) -> String {
    std::fs::write(root.join(file), body).unwrap();
    git_ok(root, &["add", file]);
    git_ok(root, &["commit", "--no-verify", "-m", message]);
    git_ok(root, &["rev-parse", "HEAD"])
}

pub(super) fn step(sha: &str, verb: HistoryVerb) -> HistoryStep {
    HistoryStep {
        sha: sha.to_string(),
        verb,
        message: None,
        target: None,
    }
}

pub(super) fn plan(
    root: &Path,
    base: &str,
    head: &str,
    steps: Vec<HistoryStep>,
) -> HistoryPlanArgs {
    HistoryPlanArgs {
        worktree_path: root.to_string_lossy().into_owned(),
        base: base.to_string(),
        head: head.to_string(),
        steps,
        onto: None,
    }
}

pub(super) struct Branch {
    pub(super) root: PathBuf,
    pub(super) base: String,
    pub(super) a: String,
    pub(super) b: String,
    pub(super) c: String,
}

pub(super) fn branch(name: &str) -> Branch {
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

pub(super) fn subjects(root: &Path, range: &str) -> Vec<String> {
    git_ok(root, &["log", "--format=%s", range])
        .lines()
        .map(str::to_string)
        .collect()
}

pub(super) fn with_remote(b: &Branch) -> PathBuf {
    let remote = b.root.join("remote.git");
    git_ok(&b.root, &["init", "--bare", remote.to_str().unwrap()]);
    git_ok(
        &b.root,
        &["remote", "add", "origin", remote.to_str().unwrap()],
    );
    git_ok(&b.root, &["push", "origin", "main", "feature"]);
    remote
}

pub(super) struct Ledger {
    pub(super) root: PathBuf,
    pub(super) base: String,
    pub(super) export: String,
    pub(super) batch: String,
    pub(super) webhook: String,
    pub(super) retries: String,
    pub(super) logging: String,
    pub(super) tests: String,
    pub(super) typo: String,
}

pub(super) fn ledger(name: &str) -> Ledger {
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

pub(super) fn picks(shas: &[&String]) -> Vec<HistoryStep> {
    shas.iter()
        .map(|sha| step(sha, HistoryVerb::Pick))
        .collect()
}

pub(super) fn fold(sha: &str, target: &str, verb: HistoryVerb) -> HistoryStep {
    HistoryStep {
        sha: sha.to_string(),
        verb,
        message: None,
        target: Some(target.to_string()),
    }
}

pub(super) fn run_args(root: &Path, plan: HistoryPlanArgs) -> HistoryRunArgs {
    let _ = root;
    HistoryRunArgs {
        plan,
        branch: "feature".to_string(),
    }
}

pub(super) fn tried(outcome: RunOutcome) -> TrialResult {
    match outcome {
        RunOutcome::Tried { result } => *result,
        RunOutcome::Blocked { reason } => panic!("the run was blocked: {reason}"),
    }
}

pub(super) fn worktree_count(root: &Path) -> usize {
    git_ok(root, &["worktree", "list", "--porcelain"])
        .lines()
        .filter(|line| line.starts_with("worktree "))
        .count()
}

pub(super) fn ledger_plan(l: &Ledger, steps: Vec<HistoryStep>) -> HistoryPlanArgs {
    plan(&l.root, &l.base, &l.typo, steps)
}

pub(super) fn run_ok(l: &Ledger, steps: Vec<HistoryStep>, name: &str) -> TrialResult {
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
