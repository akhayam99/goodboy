use super::super::{worktree_integrate_candidate_blocking, worktree_quarantine_candidate_blocking};
use super::{snapshot_owner_tree, OWNER_TREE_SUBJECT};
use crate::worktree::git::git;
use crate::worktree::types::{IntegrateCandidateArgs, QuarantineCandidateArgs};
use std::path::{Path, PathBuf};

fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-{name}-{}-{}",
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

fn read(root: &Path, file: &str) -> String {
    std::fs::read_to_string(root.join(file)).unwrap()
}

struct Owner {
    root: PathBuf,
    base: String,
}

fn owner_with_local_work(name: &str) -> Owner {
    let root = temp_root(name);
    git_ok(&root, &["init", "-b", "main"]);
    git_ok(&root, &["config", "user.email", "test@example.com"]);
    git_ok(&root, &["config", "user.name", "test"]);
    git_ok(&root, &["config", "commit.gpgsign", "false"]);
    std::fs::write(root.join("ledger.ts"), "export const round = 'up';\n").unwrap();
    std::fs::write(root.join("payments-api.ts"), "export const api = 1;\n").unwrap();
    git_ok(&root, &["add", "."]);
    git_ok(&root, &["commit", "--no-verify", "-m", "base"]);
    let base = git_ok(&root, &["rev-parse", "HEAD"]);
    std::fs::write(
        root.join("ledger.ts"),
        "export const round = 'up';\nexport const header = 'Harborline';\n",
    )
    .unwrap();
    std::fs::write(root.join("notify-relay.ts"), "export const relay = true;\n").unwrap();
    Owner { root, base }
}

fn copy_at(owner: &Owner, sha: &str) -> PathBuf {
    let copy = temp_root("owner-tree-copy").join("copy");
    git_ok(
        &owner.root,
        &[
            "worktree",
            "add",
            "--detach",
            "--quiet",
            &copy.to_string_lossy(),
            sha,
        ],
    );
    git_ok(&copy, &["config", "user.email", "agent@example.com"]);
    git_ok(&copy, &["config", "user.name", "agent"]);
    copy
}

fn quarantine(
    path: &Path,
    id: &str,
    base: &str,
    is_stacked: bool,
    is_keeping: bool,
) -> Option<String> {
    worktree_quarantine_candidate_blocking(QuarantineCandidateArgs {
        worktree_path: path.to_string_lossy().into_owned(),
        candidate_id: id.to_string(),
        base_sha: base.to_string(),
        stack: is_stacked,
        should_keep_uncommitted: is_keeping,
    })
    .unwrap()
    .sha
}

fn integrate(path: &Path, id: &str, candidate: &str, expected: &str) -> Result<String, String> {
    worktree_integrate_candidate_blocking(IntegrateCandidateArgs {
        worktree_path: path.to_string_lossy().into_owned(),
        candidate_id: id.to_string(),
        candidate_sha: candidate.to_string(),
        expected_head: expected.to_string(),
    })
    .map(|done| done.sha)
    .map_err(|error| error.to_string())
}

fn status(root: &Path) -> String {
    git_ok(root, &["status", "--porcelain=v1", "--untracked-files=all"])
}

#[test]
fn a_snapshot_holds_tracked_edits_and_untracked_files_and_leaves_the_owner_tree_alone() {
    let owner = owner_with_local_work("owner-tree-snapshot");
    let before = status(&owner.root);

    let snapshot = snapshot_owner_tree(&owner.root, &owner.base)
        .unwrap()
        .expect("a dirty tree makes a snapshot");

    assert_eq!(
        status(&owner.root),
        before,
        "the snapshot touched the owner's tree"
    );
    assert_eq!(git_ok(&owner.root, &["rev-parse", "HEAD"]), owner.base);
    assert_eq!(
        git_ok(&owner.root, &["rev-parse", &format!("{snapshot}^")]),
        owner.base
    );
    assert_eq!(
        git_ok(&owner.root, &["log", "-1", "--format=%s", &snapshot]),
        OWNER_TREE_SUBJECT
    );
    let files = git_ok(&owner.root, &["ls-tree", "-r", "--name-only", &snapshot]);
    assert!(files.contains("notify-relay.ts"), "{files}");
    assert!(
        git_ok(&owner.root, &["show", &format!("{snapshot}:ledger.ts")]).contains("Harborline")
    );
}

#[test]
fn a_clean_tree_needs_no_snapshot() {
    let owner = owner_with_local_work("owner-tree-clean");
    git_ok(&owner.root, &["checkout", "--", "ledger.ts"]);
    std::fs::remove_file(owner.root.join("notify-relay.ts")).unwrap();

    assert_eq!(snapshot_owner_tree(&owner.root, &owner.base).unwrap(), None);
}

#[test]
fn a_fix_on_the_snapshot_is_only_the_agent_delta_and_lands_uncommitted_on_the_owner_work() {
    let owner = owner_with_local_work("owner-tree-accept");
    let snapshot = snapshot_owner_tree(&owner.root, &owner.base)
        .unwrap()
        .unwrap();
    let copy = copy_at(&owner, &snapshot);
    std::fs::write(
        copy.join("ledger.ts"),
        "export const round = 'up';\nexport const header = 'Harborline';\nexport const layout = 'Acme';\n",
    )
    .unwrap();
    git_ok(
        &copy,
        &[
            "commit",
            "--no-verify",
            "-am",
            "move the header into the layout",
        ],
    );
    let candidate = quarantine(&copy, "note-fix", &snapshot, true, false).unwrap();

    let delta = git_ok(&owner.root, &["diff", "--name-only", &snapshot, &candidate]);
    assert_eq!(
        delta, "ledger.ts",
        "the proposal holds more than the agent change"
    );
    assert_eq!(
        git_ok(&owner.root, &["diff", "--shortstat", &snapshot, &candidate]),
        "1 file changed, 1 insertion(+)"
    );

    let landed = integrate(&owner.root, "note-fix", &candidate, &snapshot).unwrap();

    assert_eq!(landed, candidate);
    assert_eq!(
        git_ok(&owner.root, &["rev-parse", "HEAD"]),
        owner.base,
        "the fix was committed"
    );
    assert!(read(&owner.root, "ledger.ts").contains("Harborline"));
    assert!(read(&owner.root, "ledger.ts").contains("layout = 'Acme'"));
    assert_eq!(
        read(&owner.root, "notify-relay.ts"),
        "export const relay = true;\n"
    );

    let again = integrate(&owner.root, "note-fix", &candidate, &snapshot).unwrap();
    assert_eq!(again, candidate);
    assert_eq!(
        read(&owner.root, "ledger.ts").matches("layout").count(),
        1,
        "applied twice"
    );
}

#[test]
fn skipping_a_note_fix_leaves_the_owner_work_byte_for_byte() {
    let owner = owner_with_local_work("owner-tree-skip");
    let ledger = read(&owner.root, "ledger.ts");
    let relay = read(&owner.root, "notify-relay.ts");
    let before = status(&owner.root);
    let snapshot = snapshot_owner_tree(&owner.root, &owner.base)
        .unwrap()
        .unwrap();
    let copy = copy_at(&owner, &snapshot);
    std::fs::write(copy.join("payments-api.ts"), "export const api = 2;\n").unwrap();
    let candidate = quarantine(&copy, "note-skip", &snapshot, true, false).unwrap();

    assert_eq!(
        git_ok(&owner.root, &["diff", "--name-only", &snapshot, &candidate]),
        "payments-api.ts"
    );
    git_ok(
        &owner.root,
        &["worktree", "remove", "--force", &copy.to_string_lossy()],
    );

    assert_eq!(read(&owner.root, "ledger.ts"), ledger);
    assert_eq!(read(&owner.root, "notify-relay.ts"), relay);
    assert_eq!(
        read(&owner.root, "payments-api.ts"),
        "export const api = 1;\n"
    );
    assert_eq!(status(&owner.root), before);
}

#[test]
fn a_note_fix_that_no_longer_applies_on_the_owner_work_is_refused_and_touches_nothing() {
    let owner = owner_with_local_work("owner-tree-conflict");
    let snapshot = snapshot_owner_tree(&owner.root, &owner.base)
        .unwrap()
        .unwrap();
    let copy = copy_at(&owner, &snapshot);
    std::fs::write(copy.join("ledger.ts"), "export const round = 'even';\n").unwrap();
    let candidate = quarantine(&copy, "note-late", &snapshot, true, false).unwrap();
    std::fs::write(
        owner.root.join("ledger.ts"),
        "export const round = 'down';\n",
    )
    .unwrap();

    let outcome = integrate(&owner.root, "note-late", &candidate, &snapshot);

    assert!(outcome
        .unwrap_err()
        .contains("the fix no longer applies on the branch"));
    assert_eq!(
        read(&owner.root, "ledger.ts"),
        "export const round = 'down';\n"
    );
}

#[test]
fn a_shared_worktree_quarantine_never_sweeps_the_owner_work() {
    let owner = owner_with_local_work("owner-tree-keep");
    let ledger = read(&owner.root, "ledger.ts");
    std::fs::write(owner.root.join("cascadia.ts"), "export const fix = 1;\n").unwrap();
    git_ok(&owner.root, &["add", "cascadia.ts"]);
    git_ok(
        &owner.root,
        &[
            "commit",
            "--no-verify",
            "-m",
            "agent fix",
            "--",
            "cascadia.ts",
        ],
    );

    let candidate = quarantine(&owner.root, "shared", &owner.base, false, true).unwrap();

    assert_eq!(
        git_ok(
            &owner.root,
            &["diff", "--name-only", &owner.base, &candidate]
        ),
        "cascadia.ts"
    );
    assert_eq!(git_ok(&owner.root, &["rev-parse", "HEAD"]), owner.base);
    assert!(
        !owner.root.join("cascadia.ts").exists(),
        "the proposal stayed in the tree"
    );
    assert_eq!(read(&owner.root, "ledger.ts"), ledger);
    assert_eq!(
        read(&owner.root, "notify-relay.ts"),
        "export const relay = true;\n"
    );
}

#[test]
fn a_note_copy_starts_on_the_owner_work_and_a_comment_copy_on_the_branch_head() {
    let owner = owner_with_local_work("owner-tree-copy");
    let scratch = temp_root("owner-tree-copy-scratch");
    let note = scratch.join("goodboy-history-resolve-note").join("copy");
    let comment = scratch.join("goodboy-history-resolve-comment").join("copy");

    let note_copy =
        crate::history::prepare_resolve_copy_at(&owner.root, &note, None, true).unwrap();
    let comment_copy =
        crate::history::prepare_resolve_copy_at(&owner.root, &comment, None, false).unwrap();

    assert_ne!(note_copy.head, owner.base);
    assert!(read(&note, "ledger.ts").contains("Harborline"));
    assert!(note.join("notify-relay.ts").exists());
    assert_eq!(comment_copy.head, owner.base);
    assert!(!read(&comment, "ledger.ts").contains("Harborline"));
    assert!(!comment.join("notify-relay.ts").exists());
    crate::history::discard_copy(&note.to_string_lossy());
    crate::history::discard_copy(&comment.to_string_lossy());
}
