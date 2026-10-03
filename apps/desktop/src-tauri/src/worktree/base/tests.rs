use super::{branch_integration, default_base_name, resolve_base, resolve_base_ref};
use crate::worktree::changed_files::worktree_changed_files_blocking;
use crate::worktree::create::worktree_create_blocking;
use crate::worktree::diff::worktree_diff_blocking;
use crate::worktree::git::git;
use crate::worktree::status::worktree_status_blocking;
use crate::worktree::types::{BranchIntegration, CreateArgs, GitDistance};
use std::path::{Path, PathBuf};

fn git_ok(cwd: &Path, args: &[&str]) -> String {
    git(cwd, args)
        .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
        .trim()
        .to_string()
}

fn repo_on(name: &str, branch: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-default-base-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    let root = std::fs::canonicalize(root).unwrap();
    git_ok(&root, &["init", "-b", branch]);
    git_ok(&root, &["config", "user.email", "test@example.com"]);
    git_ok(&root, &["config", "user.name", "test"]);
    git_ok(&root, &["config", "commit.gpgsign", "false"]);
    commit(&root, "base.txt", "base\n", "base");
    root
}

fn commit(root: &Path, file: &str, body: &str, message: &str) -> String {
    std::fs::write(root.join(file), body).unwrap();
    git_ok(root, &["add", file]);
    git_ok(root, &["commit", "-m", message]);
    git_ok(root, &["rev-parse", "HEAD"])
}

fn mount(root: &Path, slug: &str) -> PathBuf {
    let parent = root.join(".goodboy").join("worktrees");
    let created = worktree_create_blocking(CreateArgs {
        repo_path: root.to_string_lossy().into_owned(),
        branch_name: format!("goodboy/{slug}"),
        parent_dir: Some(parent.to_string_lossy().into_owned()),
        existing_branch: None,
        fallback_ref: None,
        base_branch: None,
        dir_name: Some(slug.to_string()),
    })
    .unwrap();
    let path = PathBuf::from(created.worktree_path);
    git_ok(&path, &["config", "user.email", "test@example.com"]);
    git_ok(&path, &["config", "user.name", "test"]);
    path
}

fn cleanup(root: PathBuf) {
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_new_mount_is_cut_from_the_develop_branch_of_a_develop_repo() {
    let root = repo_on("create", "develop");
    let tip = commit(&root, "tip.txt", "tip\n", "tip");

    let path = mount(&root, "dev-create");

    assert_eq!(git_ok(&path, &["rev-parse", "HEAD"]), tip);
    cleanup(root);
}

#[test]
fn a_new_mount_is_cut_from_a_custom_default_branch_when_no_remote_names_one() {
    let root = repo_on("create-release", "release");
    let tip = commit(&root, "tip.txt", "tip\n", "tip");

    let path = mount(&root, "rel-create");

    assert_eq!(git_ok(&path, &["rev-parse", "HEAD"]), tip);
    cleanup(root);
}

#[test]
fn the_base_of_a_develop_repo_resolves_to_develop_for_diff_and_status() {
    let root = repo_on("resolve", "develop");
    let fork = git_ok(&root, &["rev-parse", "HEAD"]);
    let path = mount(&root, "dev-resolve");
    commit(&path, "feature.txt", "a\nb\n", "feature");

    let (base_ref, merge_base) = resolve_base(&path, None).expect("develop resolves");
    let status = worktree_status_blocking(path.to_string_lossy().into_owned(), None).unwrap();
    let diff = worktree_diff_blocking(path.to_string_lossy().into_owned(), None).unwrap();
    let changed =
        worktree_changed_files_blocking(path.to_string_lossy().into_owned(), None).unwrap();

    assert_eq!((base_ref, merge_base), ("develop".to_string(), fork));
    assert_eq!(
        status.main_distance,
        GitDistance::Known {
            ahead: 1,
            behind: 0
        }
    );
    assert!(diff.contains("feature.txt"));
    assert_eq!(changed.additions, 2);
    cleanup(root);
}

#[test]
fn a_custom_default_branch_resolves_through_the_main_checkout_of_a_linked_mount() {
    let root = repo_on("resolve-release", "release");
    let path = mount(&root, "rel-resolve");
    commit(&path, "feature.txt", "a\n", "feature");

    let (base_ref, _) = resolve_base(&path, None).expect("release resolves");

    assert_eq!(base_ref, "release");
    cleanup(root);
}

#[test]
fn the_merge_check_of_a_develop_repo_uses_develop() {
    let root = repo_on("integration", "develop");
    let path = mount(&root, "dev-integration");
    let branch = git_ok(&path, &["rev-parse", "--abbrev-ref", "HEAD"]);
    commit(&path, "feature.txt", "a\n", "feature");

    assert_eq!(resolve_base_ref(&path, None).as_deref(), Some("develop"));
    assert_eq!(
        branch_integration(&path, None, true),
        BranchIntegration::Unmerged {
            base: "develop".to_string(),
            ahead: 1
        }
    );

    git_ok(&root, &["merge", "--ff-only", &branch]);

    assert_eq!(
        branch_integration(&path, None, true),
        BranchIntegration::Merged {
            base: "develop".to_string()
        }
    );
    cleanup(root);
}

#[test]
fn a_develop_repo_without_origin_head_prefers_the_remote_develop() {
    let root = repo_on("origin-develop", "develop");
    let remote = root.join("remote.git");
    git_ok(&root, &["init", "--bare", remote.to_str().unwrap()]);
    git_ok(
        &root,
        &["remote", "add", "origin", remote.to_str().unwrap()],
    );
    git_ok(&root, &["push", "-u", "origin", "develop"]);
    git_ok(&root, &["checkout", "-b", "scratch"]);
    let path = mount(&root, "dev-origin");
    commit(&path, "feature.txt", "a\n", "feature");

    assert!(git(&root, &["symbolic-ref", "refs/remotes/origin/HEAD"]).is_err());
    assert_eq!(
        resolve_base_ref(&path, None).as_deref(),
        Some("origin/develop")
    );
    assert_eq!(
        resolve_base(&path, None).map(|(base_ref, _)| base_ref),
        Some("origin/develop".to_string())
    );
    cleanup(root);
}

#[test]
fn main_still_wins_over_develop_when_both_exist_and_no_remote_names_a_default() {
    let root = repo_on("both", "main");
    git_ok(&root, &["checkout", "-b", "develop"]);
    let path = mount(&root, "both-main");
    commit(&path, "feature.txt", "a\n", "feature");

    assert_eq!(
        resolve_base(&path, None).map(|(base_ref, _)| base_ref),
        Some("main".to_string())
    );
    assert_eq!(resolve_base_ref(&path, None).as_deref(), Some("main"));
    cleanup(root);
}

#[test]
fn a_checkout_on_a_known_default_name_is_never_its_own_base() {
    for name in ["main", "develop"] {
        let root = repo_on(&format!("own-{name}"), name);

        assert_eq!(resolve_base(&root, None), None, "{name}");
        assert_eq!(resolve_base_ref(&root, None), None, "{name}");
        assert_eq!(default_base_name(&root, false), None, "{name}");
        assert!(
            crate::history::rebase_plan(&root, None, false).is_err(),
            "{name}"
        );
        cleanup(root);
    }
}

#[test]
fn a_dangling_origin_head_falls_through_for_every_resolver() {
    let root = repo_on("dangling-head", "main");
    let remote = root.join("remote.git");
    git_ok(&root, &["init", "--bare", remote.to_str().unwrap()]);
    git_ok(
        &root,
        &["remote", "add", "origin", remote.to_str().unwrap()],
    );
    git_ok(&root, &["push", "-u", "origin", "main"]);
    git_ok(
        &root,
        &[
            "symbolic-ref",
            "refs/remotes/origin/HEAD",
            "refs/remotes/origin/master",
        ],
    );
    let path = mount(&root, "dangling");
    commit(&path, "feature.txt", "a\n", "feature");

    let plan = crate::history::rebase_plan(&path, None, false).unwrap();

    assert_eq!(plan.onto_ref, "origin/main");
    assert_eq!(default_base_name(&path, false).as_deref(), Some("main"));
    assert_eq!(
        resolve_base(&path, None).map(|(base_ref, _)| base_ref),
        Some("origin/main".to_string())
    );
    assert_eq!(
        resolve_base_ref(&path, None).as_deref(),
        Some("origin/main")
    );
    cleanup(root);
}

#[test]
fn a_checkout_on_its_own_branch_does_not_become_its_own_base() {
    let root = repo_on("self-base", "trunk");

    assert_eq!(resolve_base(&root, None), None);
    assert_eq!(resolve_base_ref(&root, None), None);
    cleanup(root);
}
