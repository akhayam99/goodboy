use super::super::{
    journal_path, worktree_integrate_candidate_blocking, worktree_quarantine_candidate_blocking,
};
use super::{snapshot_owner_tree, TempIndex, OWNER_TREE_SUBJECT};
use crate::worktree::diff::worktree_diff_range_blocking;
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

fn write(root: &Path, file: &str, text: &str) {
    std::fs::write(root.join(file), text).unwrap();
}

struct Owner {
    root: PathBuf,
    base: String,
}

fn clean_owner(name: &str) -> Owner {
    let root = temp_root(name);
    git_ok(&root, &["init", "-b", "main"]);
    git_ok(&root, &["config", "user.email", "test@example.com"]);
    git_ok(&root, &["config", "user.name", "test"]);
    git_ok(&root, &["config", "commit.gpgsign", "false"]);
    write(&root, "ledger.ts", "export const round = 'up';\n");
    write(&root, "payments-api.ts", "export const api = 1;\n");
    git_ok(&root, &["add", "."]);
    git_ok(&root, &["commit", "--no-verify", "-m", "base"]);
    let base = git_ok(&root, &["rev-parse", "HEAD"]);
    Owner { root, base }
}

fn owner_with_local_work(name: &str) -> Owner {
    let owner = clean_owner(name);
    write(
        &owner.root,
        "ledger.ts",
        "export const round = 'up';\nexport const header = 'Harborline';\n",
    );
    write(
        &owner.root,
        "notify-relay.ts",
        "export const relay = true;\n",
    );
    owner
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

fn agent_commit(copy: &Path, file: &str, text: &str) {
    write(copy, file, text);
    git_ok(copy, &["add", "--", file]);
    git_ok(copy, &["commit", "--no-verify", "-m", "agent fix"]);
}

fn quarantine_args(
    path: &Path,
    id: &str,
    base: &str,
    is_stacked: bool,
    is_keeping: bool,
) -> QuarantineCandidateArgs {
    QuarantineCandidateArgs {
        worktree_path: path.to_string_lossy().into_owned(),
        candidate_id: id.to_string(),
        base_sha: base.to_string(),
        stack: is_stacked,
        should_keep_uncommitted: is_keeping,
    }
}

fn quarantine(
    path: &Path,
    id: &str,
    base: &str,
    is_stacked: bool,
    is_keeping: bool,
) -> Option<String> {
    worktree_quarantine_candidate_blocking(quarantine_args(path, id, base, is_stacked, is_keeping))
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

fn note_copy(owner: &Owner, start: Option<&str>) -> (PathBuf, crate::history::ResolveCopy) {
    let copy = temp_root("owner-tree-note")
        .join("goodboy-history-resolve-note")
        .join("copy");
    let made = crate::history::prepare_resolve_copy_at(&owner.root, &copy, start, true).unwrap();
    git_ok(&copy, &["config", "user.email", "agent@example.com"]);
    git_ok(&copy, &["config", "user.name", "agent"]);
    (copy, made)
}

struct Landed {
    owner: Owner,
    candidate: String,
}

fn two_file_note_fix(name: &str) -> Landed {
    let owner = owner_with_local_work(name);
    let (copy, made) = note_copy(&owner, None);
    write(
        &copy,
        "ledger.ts",
        "export const round = 'up';\nexport const header = 'Harborline';\nexport const layout = 'Acme';\n",
    );
    agent_commit(&copy, "payments-api.ts", "export const api = 2;\n");
    let candidate = quarantine(&copy, "two-files", &made.base, true, false).unwrap();
    crate::history::discard_copy(&copy.to_string_lossy());
    Landed { owner, candidate }
}

fn rewrite_state(owner: &Owner, id: &str, state: &str) {
    let journal = journal_path(&owner.root, id).unwrap();
    let recorded = std::fs::read_to_string(&journal).unwrap();
    let mut lines: Vec<String> = recorded.lines().map(str::to_string).collect();
    lines[1] = state.to_string();
    std::fs::write(&journal, format!("{}\n", lines.join("\n"))).unwrap();
}

#[test]
fn a_snapshot_holds_tracked_edits_and_untracked_files_and_leaves_the_owner_tree_alone() {
    let owner = owner_with_local_work("owner-tree-snapshot");
    let before = status(&owner.root);

    let snapshot = snapshot_owner_tree(&owner.root, &owner.base).unwrap();

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
    let git_dir = git_ok(&owner.root, &["rev-parse", "--absolute-git-dir"]);
    let leftovers: Vec<String> = std::fs::read_dir(git_dir)
        .unwrap()
        .flatten()
        .map(|entry| entry.file_name().to_string_lossy().to_string())
        .filter(|name| name.ends_with(".index"))
        .collect();
    assert!(leftovers.is_empty(), "{leftovers:?}");
}

#[test]
fn two_temporary_indexes_never_share_a_file_and_each_removes_only_its_own() {
    let owner = clean_owner("owner-tree-two-indexes");
    let first = TempIndex::new(&owner.root, "owner-tree").unwrap();
    let second = TempIndex::new(&owner.root, "owner-tree").unwrap();
    assert_ne!(first.path, second.path);

    first.run(&owner.root, &["read-tree", &owner.base]).unwrap();
    second
        .run(&owner.root, &["read-tree", &owner.base])
        .unwrap();
    let kept = first.path.clone();
    drop(second);

    assert!(kept.is_file(), "the other window's index was deleted");
    assert_eq!(
        first.write_tree(&owner.root).unwrap(),
        git_ok(
            &owner.root,
            &["rev-parse", &format!("{}^{{tree}}", owner.base)]
        )
    );
}

#[test]
fn a_note_on_a_clean_tree_still_lands_uncommitted_and_never_overwrites_a_new_owner_file() {
    let owner = clean_owner("owner-tree-clean-note");
    let (copy, made) = note_copy(&owner, None);
    assert_eq!(made.base, owner.base);
    assert_ne!(
        made.head, owner.base,
        "a clean note lost its working tree mode"
    );
    agent_commit(&copy, "cascadia.ts", "export const fix = 'agent';\n");
    let candidate = quarantine(&copy, "clean-note", &made.base, true, false).unwrap();
    write(&owner.root, "cascadia.ts", "export const fix = 'owner';\n");

    let refused = integrate(&owner.root, "clean-note", &candidate, &owner.base);

    assert!(refused.unwrap_err().contains("no longer applies"));
    assert_eq!(
        read(&owner.root, "cascadia.ts"),
        "export const fix = 'owner';\n"
    );
    std::fs::remove_file(owner.root.join("cascadia.ts")).unwrap();

    let landed = integrate(&owner.root, "clean-note", &candidate, &owner.base).unwrap();

    assert_eq!(landed, candidate);
    assert_eq!(
        git_ok(&owner.root, &["rev-parse", "HEAD"]),
        owner.base,
        "the note fix was committed"
    );
    assert_eq!(
        read(&owner.root, "cascadia.ts"),
        "export const fix = 'agent';\n"
    );
    assert_eq!(status(&owner.root), "?? cascadia.ts");
}

#[test]
fn a_comment_fix_never_overwrites_an_untracked_owner_file_at_a_path_it_adds() {
    let owner = clean_owner("owner-tree-ordinary-untracked");
    let copy = copy_at(&owner, &owner.base);
    agent_commit(&copy, "cascadia.ts", "export const fix = 'agent';\n");
    let candidate = quarantine(&copy, "comment", &owner.base, true, false).unwrap();
    write(&owner.root, "cascadia.ts", "export const fix = 'owner';\n");

    let refused = integrate(&owner.root, "comment", &candidate, &owner.base);

    assert!(refused.unwrap_err().contains("no longer applies"));
    assert_eq!(
        read(&owner.root, "cascadia.ts"),
        "export const fix = 'owner';\n"
    );
    assert_eq!(git_ok(&owner.root, &["rev-parse", "HEAD"]), owner.base);
}

#[test]
fn a_fix_on_the_snapshot_is_only_the_agent_delta_and_lands_uncommitted_on_the_owner_work() {
    let owner = owner_with_local_work("owner-tree-accept");
    let (copy, made) = note_copy(&owner, None);
    write(
        &copy,
        "ledger.ts",
        "export const round = 'up';\nexport const header = 'Harborline';\nexport const layout = 'Acme';\n",
    );
    git_ok(
        &copy,
        &[
            "commit",
            "--no-verify",
            "-am",
            "move the header into the layout",
        ],
    );
    let candidate = quarantine(&copy, "note-fix", &made.base, true, false).unwrap();

    let shown = worktree_diff_range_blocking(
        owner.root.to_string_lossy().into_owned(),
        made.base.clone(),
        candidate.clone(),
        false,
    )
    .unwrap();
    assert!(shown.contains("layout = 'Acme'"), "{shown}");
    assert!(
        !shown.contains("notify-relay"),
        "the proposal shows the owner work: {shown}"
    );
    assert!(!shown.contains("+export const header"), "{shown}");

    let landed = integrate(&owner.root, "note-fix", &candidate, &made.base).unwrap();

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

    let again = integrate(&owner.root, "note-fix", &candidate, &made.base).unwrap();
    assert_eq!(again, candidate);
    assert_eq!(
        read(&owner.root, "ledger.ts").matches("layout").count(),
        1,
        "applied twice"
    );
}

#[test]
fn a_note_copy_with_no_agent_commit_gives_no_candidate() {
    let owner = owner_with_local_work("owner-tree-empty-note");
    let (copy, made) = note_copy(&owner, None);

    assert_eq!(
        quarantine(&copy, "empty-note", &made.base, true, false),
        None
    );
}

#[test]
fn skipping_a_note_fix_leaves_the_owner_work_byte_for_byte() {
    let owner = owner_with_local_work("owner-tree-skip");
    let ledger = read(&owner.root, "ledger.ts");
    let relay = read(&owner.root, "notify-relay.ts");
    let before = status(&owner.root);
    let (copy, made) = note_copy(&owner, None);
    agent_commit(&copy, "payments-api.ts", "export const api = 2;\n");
    quarantine(&copy, "note-skip", &made.base, true, false).unwrap();
    crate::history::discard_copy(&copy.to_string_lossy());

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
    let (copy, made) = note_copy(&owner, None);
    agent_commit(&copy, "ledger.ts", "export const round = 'even';\n");
    let candidate = quarantine(&copy, "note-late", &made.base, true, false).unwrap();
    write(&owner.root, "ledger.ts", "export const round = 'down';\n");

    let outcome = integrate(&owner.root, "note-late", &candidate, &made.base);

    assert!(outcome
        .unwrap_err()
        .contains("the fix no longer applies on the branch"));
    assert_eq!(
        read(&owner.root, "ledger.ts"),
        "export const round = 'down';\n"
    );
    assert!(!journal_path(&owner.root, "note-late").unwrap().exists());
}

#[test]
fn a_crash_in_the_middle_of_a_landing_is_finished_on_the_next_accept() {
    let landed = two_file_note_fix("owner-tree-partial");
    let owner = &landed.owner;
    integrate(&owner.root, "two-files", &landed.candidate, &owner.base).unwrap();
    let ledger = read(&owner.root, "ledger.ts");
    rewrite_state(owner, "two-files", "applying-to-working-tree");
    write(&owner.root, "payments-api.ts", "export const api = 1;\n");

    let finished = integrate(&owner.root, "two-files", &landed.candidate, &owner.base).unwrap();

    assert_eq!(finished, landed.candidate);
    assert_eq!(
        read(&owner.root, "payments-api.ts"),
        "export const api = 2;\n"
    );
    assert_eq!(read(&owner.root, "ledger.ts"), ledger);
    assert_eq!(
        read(&owner.root, "notify-relay.ts"),
        "export const relay = true;\n"
    );
    let journal = std::fs::read_to_string(journal_path(&owner.root, "two-files").unwrap()).unwrap();
    assert!(journal.contains("applied-to-working-tree"), "{journal}");
}

#[test]
fn a_file_changed_after_a_crash_in_a_landing_is_left_alone_and_the_journal_kept() {
    let landed = two_file_note_fix("owner-tree-partial-foreign");
    let owner = &landed.owner;
    integrate(&owner.root, "two-files", &landed.candidate, &owner.base).unwrap();
    rewrite_state(owner, "two-files", "applying-to-working-tree");
    write(
        &owner.root,
        "payments-api.ts",
        "export const api = 'Northwind';\n",
    );

    let refused = integrate(&owner.root, "two-files", &landed.candidate, &owner.base);

    assert!(refused
        .unwrap_err()
        .contains("changed while Goodboy was landing"));
    assert_eq!(
        read(&owner.root, "payments-api.ts"),
        "export const api = 'Northwind';\n"
    );
    assert!(journal_path(&owner.root, "two-files").unwrap().exists());
}

#[test]
fn a_replay_after_the_owner_moved_the_landed_fix_away_is_refused() {
    let landed = two_file_note_fix("owner-tree-replay-moved");
    let owner = &landed.owner;
    integrate(&owner.root, "two-files", &landed.candidate, &owner.base).unwrap();
    git_ok(
        &owner.root,
        &["checkout", "--quiet", "--", "payments-api.ts"],
    );
    git_ok(&owner.root, &["switch", "--quiet", "-c", "acme-other"]);

    let refused = integrate(&owner.root, "two-files", &landed.candidate, &owner.base);

    assert!(refused.unwrap_err().contains("changed since"));
    assert_eq!(
        read(&owner.root, "payments-api.ts"),
        "export const api = 1;\n"
    );
}

#[test]
fn a_fix_that_moves_a_submodule_is_refused_before_anything_lands() {
    let owner = owner_with_local_work("owner-tree-submodule");
    let before = status(&owner.root);
    let (copy, made) = note_copy(&owner, None);
    git_ok(
        &copy,
        &[
            "update-index",
            "--add",
            "--cacheinfo",
            &format!("160000,{},ledger-core", owner.base),
        ],
    );
    agent_commit(&copy, "payments-api.ts", "export const api = 2;\n");
    let candidate = quarantine(&copy, "submodule", &made.base, true, false).unwrap();

    let refused = integrate(&owner.root, "submodule", &candidate, &made.base);

    assert!(refused.unwrap_err().contains("submodule"));
    assert_eq!(status(&owner.root), before);
    assert!(!journal_path(&owner.root, "submodule").unwrap().exists());
}

#[test]
fn a_shared_worktree_quarantine_never_sweeps_the_owner_work() {
    let owner = owner_with_local_work("owner-tree-keep");
    let ledger = read(&owner.root, "ledger.ts");
    write(&owner.root, "cascadia.ts", "export const fix = 1;\n");
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
fn a_shared_worktree_quarantine_keeps_a_staged_version_apart_from_the_working_one() {
    let owner = clean_owner("owner-tree-keep-index");
    write(
        &owner.root,
        "payments-api.ts",
        "export const api = 'staged';\n",
    );
    git_ok(&owner.root, &["add", "payments-api.ts"]);
    write(
        &owner.root,
        "payments-api.ts",
        "export const api = 'working';\n",
    );
    write(&owner.root, "cascadia.ts", "export const fix = 1;\n");
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

    quarantine(&owner.root, "shared-index", &owner.base, false, true).unwrap();

    assert_eq!(git_ok(&owner.root, &["rev-parse", "HEAD"]), owner.base);
    assert_eq!(
        git_ok(&owner.root, &["show", ":payments-api.ts"]),
        "export const api = 'staged';"
    );
    assert_eq!(
        read(&owner.root, "payments-api.ts"),
        "export const api = 'working';\n"
    );
    assert!(!owner.root.join("cascadia.ts").exists());
}

#[test]
fn a_shared_worktree_quarantine_refuses_when_the_owner_edited_the_agent_file() {
    let owner = clean_owner("owner-tree-keep-refuse");
    write(&owner.root, "cascadia.ts", "export const fix = 1;\n");
    git_ok(&owner.root, &["add", "cascadia.ts"]);
    git_ok(&owner.root, &["commit", "--no-verify", "-m", "agent fix"]);
    let tip = git_ok(&owner.root, &["rev-parse", "HEAD"]);
    write(&owner.root, "cascadia.ts", "export const fix = 'owner';\n");

    let refused = worktree_quarantine_candidate_blocking(quarantine_args(
        &owner.root,
        "shared-refuse",
        &owner.base,
        false,
        true,
    ));

    assert!(refused.is_err());
    assert_eq!(git_ok(&owner.root, &["rev-parse", "HEAD"]), tip);
    assert_eq!(
        read(&owner.root, "cascadia.ts"),
        "export const fix = 'owner';\n"
    );
}

#[test]
fn a_note_copy_starts_on_the_owner_work_and_a_comment_copy_on_the_branch_head() {
    let owner = owner_with_local_work("owner-tree-copy");
    let scratch = temp_root("owner-tree-copy-scratch");
    let comment = scratch.join("goodboy-history-resolve-comment").join("copy");

    let (note, note_copy) = note_copy(&owner, None);
    let comment_copy =
        crate::history::prepare_resolve_copy_at(&owner.root, &comment, None, false).unwrap();

    assert_ne!(note_copy.head, owner.base);
    assert_eq!(note_copy.base, owner.base);
    assert!(read(&note, "ledger.ts").contains("Harborline"));
    assert!(note.join("notify-relay.ts").exists());
    assert_eq!(comment_copy.head, owner.base);
    assert_eq!(comment_copy.base, owner.base);
    assert!(!read(&comment, "ledger.ts").contains("Harborline"));
    assert!(!comment.join("notify-relay.ts").exists());
    crate::history::discard_copy(&note.to_string_lossy());
    crate::history::discard_copy(&comment.to_string_lossy());
}

#[test]
fn a_note_on_a_lane_tip_sees_the_owner_work_and_the_whole_lane_lands_uncommitted() {
    let owner = owner_with_local_work("owner-tree-lane");
    let comment = copy_at(&owner, &owner.base);
    agent_commit(&comment, "payments-api.ts", "export const api = 2;\n");
    let first = quarantine(&comment, "lane-comment", &owner.base, true, false).unwrap();
    write(&owner.root, "cascadia.ts", "export const fix = 'owner';\n");

    let (note, made) = note_copy(&owner, Some(&first));

    assert_eq!(made.base, first, "the note left the lane");
    assert!(read(&note, "ledger.ts").contains("Harborline"));
    assert_eq!(read(&note, "payments-api.ts"), "export const api = 2;\n");
    assert_eq!(read(&note, "cascadia.ts"), "export const fix = 'owner';\n");
    agent_commit(
        &note,
        "ledger.ts",
        "export const round = 'up';\nexport const header = 'Harborline';\nexport const layout = 'Acme';\n",
    );
    let second = quarantine(&note, "lane-note", &made.base, true, false).unwrap();
    let shown = worktree_diff_range_blocking(
        owner.root.to_string_lossy().into_owned(),
        made.base.clone(),
        second.clone(),
        false,
    )
    .unwrap();
    assert!(
        !shown.contains("cascadia"),
        "the proposal shows the owner work: {shown}"
    );

    let landed = integrate(&owner.root, "lane-note", &second, &owner.base).unwrap();

    assert_eq!(landed, second);
    assert_eq!(git_ok(&owner.root, &["rev-parse", "HEAD"]), owner.base);
    assert_eq!(
        read(&owner.root, "payments-api.ts"),
        "export const api = 2;\n"
    );
    assert!(read(&owner.root, "ledger.ts").contains("layout = 'Acme'"));
    assert_eq!(
        read(&owner.root, "cascadia.ts"),
        "export const fix = 'owner';\n"
    );
    assert_eq!(
        read(&owner.root, "notify-relay.ts"),
        "export const relay = true;\n"
    );
    crate::history::discard_copy(&note.to_string_lossy());
}

#[test]
fn a_note_whose_owner_work_clashes_with_the_lane_tip_never_starts() {
    let owner = owner_with_local_work("owner-tree-lane-clash");
    let comment = copy_at(&owner, &owner.base);
    agent_commit(&comment, "ledger.ts", "export const round = 'even';\n");
    let first = quarantine(&comment, "lane-clash", &owner.base, true, false).unwrap();
    let copy = temp_root("owner-tree-lane-clash")
        .join("goodboy-history-resolve-clash")
        .join("copy");

    let refused = crate::history::prepare_resolve_copy_at(&owner.root, &copy, Some(&first), true);

    assert!(refused
        .unwrap_err()
        .to_string()
        .contains("accept or skip that fix first"));
    assert!(!copy.exists());
}
