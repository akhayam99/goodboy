use super::clear::{align_main, clear_root, recover, AlignOutcome, RecoverState};
use super::lock::MoveLock;
use super::{
    apply, prepare, rollback, ApplyArgs, BootstrapError, BootstrapPrepared, FileChange, PrepareArgs,
};
use crate::project_folder::create_project_folder;
use crate::worktree::{git, git_argv_log};
use std::path::{Path, PathBuf};

struct Fixture {
    parent: PathBuf,
    root: PathBuf,
    remote: PathBuf,
}

fn temp_parent(name: &str) -> PathBuf {
    let parent = std::env::temp_dir().join(format!(
        "goodboy-bootstrap-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&parent).unwrap();
    std::fs::canonicalize(parent).unwrap()
}

fn git_ok(cwd: &Path, args: &[&str]) -> String {
    git(cwd, args)
        .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
        .trim()
        .to_string()
}

fn identity(cwd: &Path) {
    git_ok(cwd, &["config", "user.email", "dana@example.com"]);
    git_ok(cwd, &["config", "user.name", "Dana Reyes"]);
    git_ok(cwd, &["config", "commit.gpgsign", "false"]);
}

fn write(root: &Path, rel: &str, body: &str) {
    let path = root.join(rel);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, body).unwrap();
}

fn commit_all(root: &Path, message: &str) {
    git_ok(root, &["add", "-A"]);
    git_ok(root, &["commit", "-q", "-m", message]);
}

fn fixture(name: &str) -> Fixture {
    let parent = temp_parent(name);
    let created = create_project_folder(parent.to_str().unwrap(), "cascadia").unwrap();
    let root = PathBuf::from(created.root_path);
    identity(&root);
    let remote = parent.join("remote.git");
    git_ok(
        &parent,
        &["init", "--bare", "-b", "main", remote.to_str().unwrap()],
    );
    git_ok(
        &root,
        &["remote", "add", "origin", remote.to_str().unwrap()],
    );
    git_ok(&root, &["push", "-q", "--set-upstream", "origin", "main"]);
    git_ok(&root, &["remote", "set-head", "origin", "main"]);
    Fixture {
        parent,
        root,
        remote,
    }
}

fn args(fixture: &Fixture) -> PrepareArgs {
    PrepareArgs {
        project_path: fixture.root.to_string_lossy().into_owned(),
        project_key: "proj-cascadia".to_string(),
        branch: "ak/bootstrap".to_string(),
        base_branch: "main".to_string(),
    }
}

fn finish(fixture: &Fixture) {
    std::fs::remove_dir_all(&fixture.parent).unwrap();
}

fn status(root: &Path) -> String {
    git_ok(root, &["status", "--porcelain"])
}

fn worktree_for(fixture: &Fixture, prepared: &BootstrapPrepared) -> PathBuf {
    let path = fixture
        .root
        .join(".goodboy")
        .join("worktrees")
        .join("bootstrap");
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    git_ok(
        &fixture.root,
        &[
            "worktree",
            "add",
            "-q",
            path.to_str().unwrap(),
            &prepared.branch,
        ],
    );
    path
}

fn apply_to(
    fixture: &Fixture,
    prepared: &BootstrapPrepared,
    worktree: &Path,
) -> Result<(), BootstrapError> {
    apply(ApplyArgs {
        project_path: fixture.root.to_string_lossy().into_owned(),
        snapshot_id: prepared.snapshot_id.clone(),
        worktree_path: worktree.to_string_lossy().into_owned(),
        base_branch: prepared.base_branch.clone(),
    })
}

fn moved(fixture: &Fixture) -> (BootstrapPrepared, PathBuf) {
    let prepared = prepare(args(fixture)).unwrap();
    let worktree = worktree_for(fixture, &prepared);
    apply_to(fixture, &prepared, &worktree).unwrap();
    (prepared, worktree)
}

fn first_lap_work(root: &Path) {
    write(root, "src/main.gd", "extends Node\n");
    write(root, "README.md", "cascadia\n");
    std::fs::write(root.join("art.bin"), [0u8, 159, 146, 150, 255, 0, 1]).unwrap();
}

#[test]
fn a_clean_project_has_nothing_to_move() {
    let fixture = fixture("clean");

    let result = prepare(args(&fixture));

    assert!(matches!(result, Err(BootstrapError::NothingToMove)));
    assert_eq!(
        git_ok(&fixture.root, &["branch", "--list", "ak/bootstrap"]),
        ""
    );
    finish(&fixture);
}

#[test]
fn moving_copies_every_kind_of_change_then_clears_the_folder_by_exact_paths() {
    let fixture = fixture("move");
    write(&fixture.root, "keep.txt", "tracked\n");
    write(&fixture.root, "gone.txt", "will be deleted\n");
    commit_all(&fixture.root, "base files");
    git_ok(&fixture.root, &["push", "-q", "origin", "main"]);
    first_lap_work(&fixture.root);
    write(&fixture.root, "keep.txt", "tracked and edited\n");
    std::fs::remove_file(fixture.root.join("gone.txt")).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::{symlink, PermissionsExt};
        write(&fixture.root, "run.sh", "#!/bin/sh\necho go\n");
        std::fs::set_permissions(
            fixture.root.join("run.sh"),
            std::fs::Permissions::from_mode(0o755),
        )
        .unwrap();
        symlink("README.md", fixture.root.join("link")).unwrap();
    }
    git_argv_log::reset();
    let before = status(&fixture.root);

    let prepared = prepare(args(&fixture)).unwrap();

    assert_eq!(status(&fixture.root), before);
    assert_eq!(
        git_ok(&fixture.root, &["rev-parse", &prepared.branch]),
        git_ok(&fixture.root, &["rev-parse", "origin/main"])
    );
    let by_path = |path: &str| {
        prepared
            .files
            .iter()
            .find(|file| file.path == path)
            .unwrap_or_else(|| panic!("{path} not listed"))
    };
    assert_eq!(by_path("src/main.gd").change, FileChange::Added);
    assert_eq!(by_path("keep.txt").change, FileChange::Modified);
    assert_eq!(by_path("gone.txt").change, FileChange::Deleted);
    assert_eq!(prepared.branch, "ak/bootstrap");
    let worktree = worktree_for(&fixture, &prepared);
    assert_eq!(status(&worktree), "");
    apply_to(&fixture, &prepared, &worktree).unwrap();
    assert_eq!(
        std::fs::read(worktree.join("art.bin")).unwrap(),
        std::fs::read(fixture.root.join("art.bin")).unwrap()
    );
    assert_eq!(
        std::fs::read_to_string(worktree.join("keep.txt")).unwrap(),
        "tracked and edited\n"
    );
    assert!(!worktree.join("gone.txt").exists());
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(worktree.join("run.sh"))
            .unwrap()
            .permissions()
            .mode();
        assert_ne!(mode & 0o111, 0);
        assert!(std::fs::symlink_metadata(worktree.join("link"))
            .unwrap()
            .file_type()
            .is_symlink());
    }
    assert!(!status(&worktree).is_empty());
    assert_eq!(
        git_ok(&fixture.root, &["rev-parse", &prepared.snapshot_ref]),
        prepared.snapshot_id
    );

    let report = clear_root(&fixture.root, &prepared.snapshot_id, &worktree).unwrap();

    assert!(report.kept.is_empty());
    assert_eq!(status(&fixture.root), "");
    assert!(!fixture.root.join("src").exists());
    assert!(!fixture.root.join("art.bin").exists());
    assert_eq!(
        std::fs::read_to_string(fixture.root.join("keep.txt")).unwrap(),
        "tracked\n"
    );
    assert!(fixture.root.join("gone.txt").exists());
    let spawned: Vec<String> = git_argv_log::recorded().into_iter().flatten().collect();
    assert!(!spawned.iter().any(|arg| arg == "clean" || arg == "stash"));
    finish(&fixture);
}

#[test]
fn a_file_edited_after_the_snapshot_stays_and_is_listed() {
    let fixture = fixture("edited");
    first_lap_work(&fixture.root);
    let (prepared, worktree) = moved(&fixture);
    write(
        &fixture.root,
        "README.md",
        "cascadia, edited by the engine\n",
    );

    let report = clear_root(&fixture.root, &prepared.snapshot_id, &worktree).unwrap();

    assert_eq!(report.kept, vec!["README.md".to_string()]);
    assert_eq!(
        std::fs::read_to_string(fixture.root.join("README.md")).unwrap(),
        "cascadia, edited by the engine\n"
    );
    assert!(!fixture.root.join("src").exists());
    finish(&fixture);
}

#[test]
fn clearing_refuses_when_the_copy_no_longer_matches() {
    let fixture = fixture("tampered");
    first_lap_work(&fixture.root);
    let (prepared, worktree) = moved(&fixture);
    write(&worktree, "README.md", "changed in the worktree\n");

    let result = clear_root(&fixture.root, &prepared.snapshot_id, &worktree);

    assert!(matches!(result, Err(BootstrapError::VerifyFailed(_))));
    assert!(fixture.root.join("README.md").exists());
    assert!(fixture.root.join("src").join("main.gd").exists());
    finish(&fixture);
}

#[test]
fn clearing_refuses_when_the_project_moved_since_the_snapshot() {
    let fixture = fixture("moved");
    first_lap_work(&fixture.root);
    let (prepared, worktree) = moved(&fixture);
    write(&fixture.root, "later.txt", "later\n");
    git_ok(&fixture.root, &["add", "later.txt"]);
    git_ok(&fixture.root, &["commit", "-q", "-m", "later"]);

    let result = clear_root(&fixture.root, &prepared.snapshot_id, &worktree);

    assert!(matches!(result, Err(BootstrapError::RootMoved)));
    assert!(fixture.root.join("src").join("main.gd").exists());
    finish(&fixture);
}

#[test]
fn a_folder_with_its_own_repository_is_refused_before_a_worktree_is_made() {
    let fixture = fixture("nested");
    write(&fixture.root, "vendor/engine/readme.txt", "engine\n");
    let engine = fixture.root.join("vendor").join("engine");
    git_ok(&engine, &["init", "-q", "-b", "main"]);
    identity(&engine);
    git_ok(&engine, &["add", "-A"]);
    git_ok(&engine, &["commit", "-q", "-m", "engine"]);

    let result = prepare(args(&fixture));

    assert!(matches!(result, Err(BootstrapError::NestedRepository(_))));
    assert_eq!(
        git_ok(&fixture.root, &["branch", "--list", "ak/bootstrap"]),
        ""
    );
    assert!(!fixture
        .root
        .join(".goodboy")
        .join("worktrees")
        .join("bootstrap")
        .exists());
    assert_eq!(git_ok(&fixture.root, &["for-each-ref", "refs/goodboy"]), "");
    finish(&fixture);
}

#[test]
fn a_rebase_in_progress_refuses_the_move() {
    let fixture = fixture("rebase");
    first_lap_work(&fixture.root);
    std::fs::create_dir_all(fixture.root.join(".git").join("rebase-merge")).unwrap();

    let result = prepare(args(&fixture));

    assert!(matches!(
        result,
        Err(BootstrapError::OperationInProgress(_))
    ));
    assert!(fixture.root.join("src").join("main.gd").exists());
    finish(&fixture);
}

#[test]
fn conflicted_files_refuse_the_move() {
    let fixture = fixture("unmerged");
    write(&fixture.root, "a.txt", "base\n");
    commit_all(&fixture.root, "base");
    git_ok(&fixture.root, &["push", "-q", "origin", "main"]);
    git_ok(&fixture.root, &["checkout", "-q", "-b", "side"]);
    write(&fixture.root, "a.txt", "side\n");
    commit_all(&fixture.root, "side");
    git_ok(&fixture.root, &["checkout", "-q", "main"]);
    write(&fixture.root, "a.txt", "main\n");
    commit_all(&fixture.root, "main edit");
    let merged = git(&fixture.root, &["merge", "side"]);
    assert!(merged.is_err());

    let result = prepare(args(&fixture));

    assert!(matches!(
        result,
        Err(BootstrapError::Unmerged(_)) | Err(BootstrapError::OperationInProgress(_))
    ));
    finish(&fixture);
}

#[test]
fn the_bootstrap_branch_takes_the_full_name_built_from_the_workspace_template() {
    let fixture = fixture("nested-bootstrap");
    first_lap_work(&fixture.root);
    let mut nested = args(&fixture);
    nested.branch = "team/ak/bootstrap".to_string();

    let prepared = prepare(nested).unwrap();

    assert_eq!(prepared.branch, "team/ak/bootstrap");
    finish(&fixture);
}

#[test]
fn a_bootstrap_branch_the_validator_refuses_is_refused_before_the_snapshot() {
    let fixture = fixture("invalid-bootstrap");
    first_lap_work(&fixture.root);
    let mut invalid = args(&fixture);
    invalid.branch = "ak/boot..strap".to_string();
    let before = status(&fixture.root);

    let result = prepare(invalid);

    assert!(matches!(result, Err(BootstrapError::InvalidInput(_))));
    assert_eq!(status(&fixture.root), before);
    finish(&fixture);
}

#[test]
fn a_remote_branch_that_was_never_fetched_refuses_the_move() {
    let fixture = fixture("unfetched");
    first_lap_work(&fixture.root);
    let mut missing = args(&fixture);
    missing.base_branch = "trunk".to_string();

    let result = prepare(missing);

    assert!(matches!(
        result,
        Err(BootstrapError::RemoteBranchMissing(_))
    ));
    finish(&fixture);
}

#[test]
fn a_clash_with_the_remote_fails_the_apply_and_rolls_back_without_touching_the_folder() {
    let fixture = fixture("clash");
    write(&fixture.root, "plot.txt", "chapter one\n");
    commit_all(&fixture.root, "plot");
    git_ok(&fixture.root, &["push", "-q", "origin", "main"]);
    let other = fixture.parent.join("other");
    git_ok(
        &fixture.parent,
        &[
            "clone",
            "-q",
            fixture.remote.to_str().unwrap(),
            other.to_str().unwrap(),
        ],
    );
    identity(&other);
    write(&other, "plot.txt", "their chapter one\n");
    commit_all(&other, "theirs");
    git_ok(&other, &["push", "-q", "origin", "main"]);
    git_ok(&fixture.root, &["fetch", "-q", "origin"]);
    write(&fixture.root, "plot.txt", "my chapter one\n");
    first_lap_work(&fixture.root);
    let before = status(&fixture.root);

    let prepared = prepare(args(&fixture)).unwrap();
    let worktree = worktree_for(&fixture, &prepared);
    let result = apply_to(&fixture, &prepared, &worktree);

    assert!(matches!(result, Err(BootstrapError::ApplyConflict { .. })));
    assert_eq!(status(&fixture.root), before);
    rollback(
        fixture.root.to_str().unwrap(),
        worktree.to_str().unwrap(),
        &prepared.branch,
    )
    .unwrap();
    assert_eq!(
        git_ok(&fixture.root, &["branch", "--list", "ak/bootstrap"]),
        ""
    );
    assert!(!worktree.exists());
    assert_ne!(git_ok(&fixture.root, &["for-each-ref", "refs/goodboy"]), "");
    assert_eq!(
        std::fs::read_to_string(fixture.root.join("plot.txt")).unwrap(),
        "my chapter one\n"
    );
    finish(&fixture);
}

#[test]
fn work_moves_onto_a_remote_main_that_came_from_elsewhere_and_local_main_aligns() {
    let parent = temp_parent("elsewhere");
    let created = create_project_folder(parent.to_str().unwrap(), "cascadia").unwrap();
    let root = PathBuf::from(created.root_path);
    identity(&root);
    let remote = parent.join("remote.git");
    git_ok(
        &parent,
        &["init", "--bare", "-b", "main", remote.to_str().unwrap()],
    );
    let other = parent.join("other");
    git_ok(
        &parent,
        &[
            "clone",
            "-q",
            remote.to_str().unwrap(),
            other.to_str().unwrap(),
        ],
    );
    identity(&other);
    git_ok(&other, &["checkout", "-q", "-b", "main"]);
    write(&other, "LICENSE", "mit\n");
    commit_all(&other, "license");
    git_ok(&other, &["push", "-q", "origin", "main"]);
    git_ok(
        &root,
        &["remote", "add", "origin", remote.to_str().unwrap()],
    );
    git_ok(&root, &["fetch", "-q", "origin"]);
    first_lap_work(&root);
    let fixture = Fixture {
        parent,
        root,
        remote,
    };

    let (prepared, worktree) = moved(&fixture);

    assert!(worktree.join("LICENSE").exists());
    assert!(worktree.join("src").join("main.gd").exists());
    let report = clear_root(&fixture.root, &prepared.snapshot_id, &worktree).unwrap();
    assert!(report.kept.is_empty());
    assert_eq!(status(&fixture.root), "");

    let aligned = align_main(&fixture.root, "main").unwrap();

    assert_eq!(aligned, AlignOutcome::Reset);
    assert!(fixture.root.join("LICENSE").exists());
    assert_eq!(
        git_ok(&fixture.root, &["rev-parse", "HEAD"]),
        git_ok(&fixture.root, &["rev-parse", "origin/main"])
    );
    assert_eq!(status(&fixture.root), "");
    finish(&fixture);
}

#[test]
fn aligning_is_a_no_op_when_goodboy_published_main_itself() {
    let fixture = fixture("aligned");

    assert_eq!(
        align_main(&fixture.root, "main").unwrap(),
        AlignOutcome::AlreadyAligned
    );
    finish(&fixture);
}

#[test]
fn aligning_leaves_local_main_alone_when_it_holds_more_than_the_first_commit() {
    let parent = temp_parent("diverged");
    let created = create_project_folder(parent.to_str().unwrap(), "cascadia").unwrap();
    let root = PathBuf::from(created.root_path);
    identity(&root);
    write(&root, "mine.txt", "mine\n");
    commit_all(&root, "mine");
    let remote = parent.join("remote.git");
    git_ok(
        &parent,
        &["init", "--bare", "-b", "main", remote.to_str().unwrap()],
    );
    let other = parent.join("other");
    git_ok(
        &parent,
        &[
            "clone",
            "-q",
            remote.to_str().unwrap(),
            other.to_str().unwrap(),
        ],
    );
    identity(&other);
    git_ok(&other, &["checkout", "-q", "-b", "main"]);
    write(&other, "theirs.txt", "theirs\n");
    commit_all(&other, "theirs");
    git_ok(&other, &["push", "-q", "origin", "main"]);
    git_ok(
        &root,
        &["remote", "add", "origin", remote.to_str().unwrap()],
    );
    git_ok(&root, &["fetch", "-q", "origin"]);
    let before = git_ok(&root, &["rev-parse", "HEAD"]);

    let outcome = align_main(&root, "main").unwrap();

    assert_eq!(
        outcome,
        AlignOutcome::Skipped {
            reason: "histories-differ".to_string()
        }
    );
    assert_eq!(git_ok(&root, &["rev-parse", "HEAD"]), before);
    std::fs::remove_dir_all(&parent).unwrap();
}

#[test]
fn recovery_tells_a_verified_copy_from_a_missing_or_changed_one() {
    let fixture = fixture("recover");
    first_lap_work(&fixture.root);
    let (prepared, worktree) = moved(&fixture);

    assert_eq!(
        recover(&fixture.root, &prepared.snapshot_id, &worktree).unwrap(),
        RecoverState::Verified
    );
    write(&worktree, "README.md", "damaged\n");
    assert!(matches!(
        recover(&fixture.root, &prepared.snapshot_id, &worktree).unwrap(),
        RecoverState::Mismatch { .. }
    ));
    assert_eq!(
        recover(
            &fixture.root,
            &prepared.snapshot_id,
            &fixture.parent.join("gone")
        )
        .unwrap(),
        RecoverState::WorktreeMissing
    );
    finish(&fixture);
}

#[test]
fn rolling_back_removes_the_worktree_and_branch_but_keeps_the_snapshot() {
    let fixture = fixture("rollback");
    first_lap_work(&fixture.root);
    let (prepared, worktree) = moved(&fixture);

    rollback(
        fixture.root.to_str().unwrap(),
        worktree.to_str().unwrap(),
        &prepared.branch,
    )
    .unwrap();

    assert!(!worktree.exists());
    assert_eq!(
        git_ok(&fixture.root, &["branch", "--list", "ak/bootstrap"]),
        ""
    );
    assert_eq!(
        git_ok(&fixture.root, &["rev-parse", &prepared.snapshot_ref]),
        prepared.snapshot_id
    );
    assert!(fixture.root.join("src").join("main.gd").exists());
    finish(&fixture);
}

#[test]
fn rolling_back_before_a_worktree_exists_only_drops_the_branch() {
    let fixture = fixture("branchonly");
    first_lap_work(&fixture.root);
    let prepared = prepare(args(&fixture)).unwrap();

    rollback(fixture.root.to_str().unwrap(), "", &prepared.branch).unwrap();

    assert_eq!(
        git_ok(&fixture.root, &["branch", "--list", "ak/bootstrap"]),
        ""
    );
    assert!(fixture.root.join("src").join("main.gd").exists());
    finish(&fixture);
}

#[test]
fn applying_refuses_a_worktree_that_does_not_start_from_the_remote_main_or_is_not_clean() {
    let fixture = fixture("badapply");
    first_lap_work(&fixture.root);
    let prepared = prepare(args(&fixture)).unwrap();
    let worktree = worktree_for(&fixture, &prepared);
    write(&worktree, "stray.txt", "stray\n");

    let dirty = apply_to(&fixture, &prepared, &worktree);

    assert!(matches!(dirty, Err(BootstrapError::InvalidInput(_))));
    let outside = fixture.parent.join("elsewhere");
    std::fs::create_dir_all(&outside).unwrap();
    let escaped = apply_to(&fixture, &prepared, &outside);
    assert!(matches!(escaped, Err(BootstrapError::InvalidInput(_))));
    finish(&fixture);
}

#[test]
fn rolling_back_refuses_a_path_outside_the_worktree_folder() {
    let fixture = fixture("outside");
    let outside = fixture.parent.join("precious");
    std::fs::create_dir_all(&outside).unwrap();
    write(&outside, "keep.txt", "keep\n");

    let result = rollback(
        fixture.root.to_str().unwrap(),
        outside.to_str().unwrap(),
        "ak/bootstrap",
    );

    assert!(matches!(result, Err(BootstrapError::InvalidInput(_))));
    assert!(outside.join("keep.txt").exists());
    finish(&fixture);
}

#[test]
fn a_second_move_on_the_same_project_is_locked_out_and_a_dead_holder_is_replaced() {
    let fixture = fixture("lock");
    let git_dir = fixture.root.join(".git");

    let held = MoveLock::acquire(&git_dir).unwrap();
    assert!(matches!(
        MoveLock::acquire(&git_dir),
        Err(BootstrapError::Locked)
    ));
    drop(held);
    assert!(MoveLock::acquire(&git_dir).is_ok());

    std::fs::write(git_dir.join("goodboy-bootstrap.lock"), "999999").unwrap();
    assert!(MoveLock::acquire(&git_dir).is_ok());
    finish(&fixture);
}

#[test]
fn an_existing_branch_with_the_session_name_is_not_touched() {
    let fixture = fixture("taken");
    git_ok(&fixture.root, &["branch", "ak/bootstrap"]);
    first_lap_work(&fixture.root);

    let result = prepare(args(&fixture));

    assert!(matches!(result, Err(BootstrapError::BranchTaken(_))));
    assert_eq!(
        git_ok(&fixture.root, &["rev-parse", "ak/bootstrap"]),
        git_ok(&fixture.root, &["rev-parse", "main"])
    );
    finish(&fixture);
}

#[test]
fn files_over_one_hundred_megabytes_are_listed_as_large() {
    let fixture = fixture("large");
    let big = std::fs::File::create(fixture.root.join("video.mp4")).unwrap();
    big.set_len(101 * 1024 * 1024).unwrap();

    let prepared = prepare(args(&fixture)).unwrap();

    assert_eq!(prepared.large_files, vec!["video.mp4".to_string()]);
    finish(&fixture);
}
