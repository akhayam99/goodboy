use super::deps::link_dependencies;
use super::{clean_stale_copies_in, copy_git_dirs, create_copy, prepare_resolve_copy_at};
use crate::history::fixtures::{
    git_ok, ledger, ledger_plan, picks, slug, temp_root, worktree_count, Ledger,
};
use crate::history::reservation::{
    copy_path_of, discard_copy, take_held, try_lock_exclusive, COPY_DIR, COPY_PREFIX,
    RESERVATION_FILE, RESERVATION_HEADER, RESERVATION_LOCK,
};
use crate::history::trial::{trial, TRIAL_SLUG_PREFIX};
use std::path::{Path, PathBuf};

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
    assert!(copy_git_dirs(&copy).is_none_or(|dirs| dirs.git_dir != review_admin));
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

fn listing(dir: &Path) -> Vec<String> {
    let mut found = Vec::new();
    let mut pending = vec![dir.to_path_buf()];
    while let Some(next) = pending.pop() {
        for entry in std::fs::read_dir(&next).unwrap().flatten() {
            let kind = entry.file_type().unwrap();
            if entry.file_name() == ".git" {
                continue;
            }
            found.push(entry.path().to_string_lossy().to_string());
            if kind.is_dir() {
                pending.push(entry.path());
            }
        }
    }
    found.sort();
    found
}

#[cfg(unix)]
fn pnpm_workspace(l: &Ledger) {
    use std::os::unix::fs::symlink;
    let root = &l.root;
    std::fs::write(root.join(".gitignore"), "node_modules\n").unwrap();
    std::fs::create_dir_all(root.join("packages/core")).unwrap();
    std::fs::write(root.join("packages/core/index.ts"), "main core\n").unwrap();
    std::fs::create_dir_all(root.join("apps/app")).unwrap();
    std::fs::write(root.join("apps/app/main.ts"), "app\n").unwrap();
    git_ok(
        root,
        &[
            "add",
            ".gitignore",
            "packages/core/index.ts",
            "apps/app/main.ts",
        ],
    );
    git_ok(root, &["commit", "--no-verify", "-m", "Add workspace"]);
    let store = root.join("node_modules/.pnpm/zod@3/node_modules/zod");
    std::fs::create_dir_all(&store).unwrap();
    std::fs::write(store.join("index.js"), "zod\n").unwrap();
    symlink(
        ".pnpm/zod@3/node_modules/zod",
        root.join("node_modules/zod"),
    )
    .unwrap();
    std::fs::create_dir_all(root.join("node_modules/@types")).unwrap();
    symlink(
        "../.pnpm/zod@3/node_modules/zod",
        root.join("node_modules/@types/zod"),
    )
    .unwrap();
    std::fs::create_dir_all(root.join("apps/app/node_modules/@acme")).unwrap();
    symlink(
        "../../../../packages/core",
        root.join("apps/app/node_modules/@acme/core"),
    )
    .unwrap();
    symlink(
        "../../../node_modules/.pnpm/zod@3/node_modules/zod",
        root.join("apps/app/node_modules/zod"),
    )
    .unwrap();
    std::fs::create_dir_all(root.join(".claude/worktrees/other/node_modules")).unwrap();
}

#[cfg(unix)]
#[test]
fn the_resolve_copy_links_the_dependencies_of_the_main_tree() {
    let l = ledger("deps-linked");
    pnpm_workspace(&l);
    let before = listing(&l.root);
    let copy = copy_path_of(&slug("deps-linked"));
    prepare_resolve_copy_at(&l.root, &copy, None).unwrap();
    assert!(copy
        .join("node_modules")
        .symlink_metadata()
        .unwrap()
        .is_dir());
    assert_eq!(
        std::fs::read_to_string(copy.join("node_modules/zod/index.js")).unwrap(),
        "zod\n"
    );
    assert_eq!(
        std::fs::read_to_string(copy.join("node_modules/@types/zod/index.js")).unwrap(),
        "zod\n"
    );
    assert_eq!(
        std::fs::read_to_string(copy.join("apps/app/node_modules/zod/index.js")).unwrap(),
        "zod\n"
    );
    assert!(!copy.join(".claude").exists());
    assert_eq!(git_ok(&copy, &["status", "--porcelain"]), "");
    assert_eq!(listing(&l.root), before);
    discard_copy(&copy.to_string_lossy());
    assert!(l.root.join("node_modules/zod/index.js").exists());
}

#[cfg(unix)]
#[test]
fn a_workspace_package_in_the_copy_resolves_to_the_copy_and_not_the_main_tree() {
    let l = ledger("deps-workspace");
    pnpm_workspace(&l);
    let copy = copy_path_of(&slug("deps-workspace"));
    prepare_resolve_copy_at(&l.root, &copy, None).unwrap();
    std::fs::write(copy.join("packages/core/index.ts"), "copy core\n").unwrap();
    assert_eq!(
        std::fs::read_to_string(copy.join("apps/app/node_modules/@acme/core/index.ts")).unwrap(),
        "copy core\n"
    );
    assert_eq!(
        std::fs::read_to_string(l.root.join("packages/core/index.ts")).unwrap(),
        "main core\n"
    );
    discard_copy(&copy.to_string_lossy());
}

#[test]
fn a_main_tree_without_dependencies_gives_a_copy_without_links() {
    let l = ledger("deps-missing");
    let copy = copy_path_of(&slug("deps-missing"));
    let prepared = prepare_resolve_copy_at(&l.root, &copy, None).unwrap();
    assert_eq!(prepared.head, l.typo);
    assert!(!copy.join("node_modules").exists());
    assert!(copy.join("ledger.ts").exists());
    discard_copy(&copy.to_string_lossy());
}

#[test]
fn linking_dependencies_from_a_missing_main_tree_changes_nothing() {
    let scratch = temp_root("deps-no-main");
    let copy = scratch.join("copy");
    std::fs::create_dir_all(&copy).unwrap();
    link_dependencies(&scratch.join("gone"), &copy);
    assert!(listing(&copy).is_empty());
}
