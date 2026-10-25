use super::{
    carry_candidates_blocking, carry_into_blocking, carry_into_worktree, CarryOutcome, CarryStatus,
};
use crate::worktree::git::git;
use std::path::{Path, PathBuf};

fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-carry-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    root
}

fn git_ok(cwd: &Path, args: &[&str]) {
    git(cwd, args).unwrap_or_else(|error| panic!("git {} failed: {error}", args.join(" ")));
}

fn write(root: &Path, path: &str, text: &str) {
    let target = root.join(path);
    std::fs::create_dir_all(target.parent().unwrap()).unwrap();
    std::fs::write(target, text).unwrap();
}

struct World {
    repo: PathBuf,
    worktree: PathBuf,
}

fn world(name: &str) -> World {
    let repo = temp_root(name);
    git_ok(&repo, &["init", "-q", "-b", "main"]);
    git_ok(&repo, &["config", "user.email", "test@example.com"]);
    git_ok(&repo, &["config", "user.name", "test"]);
    write(
        &repo,
        ".gitignore",
        ".env*\nconfig/local.json\nnode_modules/\nnotes/\ncache/\n*.pem\n.goodboy/\n",
    );
    write(&repo, "tracked.txt", "tracked\n");
    git_ok(&repo, &["add", "-A"]);
    git_ok(&repo, &["commit", "-q", "-m", "first"]);
    let repo = std::fs::canonicalize(repo).unwrap();
    let worktree = repo
        .join(".goodboy")
        .join("worktrees")
        .join("retry-webhook");
    git_ok(
        &repo,
        &[
            "worktree",
            "add",
            "-q",
            "-b",
            "hl/retry-webhook",
            worktree.to_str().unwrap(),
        ],
    );
    World {
        worktree: std::fs::canonicalize(worktree).unwrap(),
        repo,
    }
}

fn carry(world: &World, paths: &[&str]) -> Vec<CarryOutcome> {
    let paths: Vec<String> = paths.iter().map(|path| path.to_string()).collect();
    carry_into_worktree(&world.repo, &world.worktree, &paths)
}

fn statuses(outcomes: &[CarryOutcome]) -> Vec<CarryStatus> {
    outcomes.iter().map(|outcome| outcome.status).collect()
}

#[test]
fn a_ticked_ignored_file_is_copied_and_a_secret_is_flagged() {
    let world = world("copy");
    write(&world.repo, ".env.local", "TOKEN=acme\n");
    write(&world.repo, "config/local.json", "{\"port\":4000}\n");

    let outcomes = carry(&world, &[".env.local", "config/local.json"]);

    assert_eq!(
        statuses(&outcomes),
        vec![CarryStatus::Copied, CarryStatus::Copied]
    );
    assert!(outcomes[0].is_secret);
    assert!(!outcomes[1].is_secret);
    assert_eq!(
        std::fs::read_to_string(world.worktree.join(".env.local")).unwrap(),
        "TOKEN=acme\n"
    );
    assert!(world.worktree.join("config/local.json").is_file());
}

#[test]
fn only_what_git_ignores_travels() {
    let world = world("ignored");
    write(&world.repo, "scratch.txt", "not ignored, not tracked\n");

    let outcomes = carry(&world, &["tracked.txt", "scratch.txt"]);

    assert_eq!(
        statuses(&outcomes),
        vec![
            CarryStatus::SkippedNotIgnored,
            CarryStatus::SkippedNotIgnored
        ]
    );
    assert!(!world.worktree.join("scratch.txt").exists());
}

#[test]
fn a_file_that_is_already_there_is_never_overwritten() {
    let world = world("exists");
    write(&world.repo, ".env.local", "TOKEN=from-main\n");
    write(&world.worktree, ".env.local", "TOKEN=kept\n");

    let outcomes = carry(&world, &[".env.local"]);

    assert_eq!(statuses(&outcomes), vec![CarryStatus::SkippedExists]);
    assert_eq!(
        std::fs::read_to_string(world.worktree.join(".env.local")).unwrap(),
        "TOKEN=kept\n"
    );
}

#[test]
fn a_secret_inside_a_folder_stays_behind_unless_its_own_path_is_ticked() {
    let world = world("secret-in-dir");
    write(&world.repo, "notes/todo.md", "todo\n");
    write(&world.repo, "notes/deploy.pem", "KEY\n");
    write(&world.repo, "notes/.env", "TOKEN=x\n");

    let folder = carry(&world, &["notes"]);

    assert_eq!(statuses(&folder), vec![CarryStatus::Copied]);
    assert!(world.worktree.join("notes/todo.md").is_file());
    assert!(!world.worktree.join("notes/deploy.pem").exists());
    assert!(!world.worktree.join("notes/.env").exists());

    let named = carry(&world, &["notes/deploy.pem"]);

    assert_eq!(statuses(&named), vec![CarryStatus::Copied]);
    assert!(named[0].is_secret);
    assert!(world.worktree.join("notes/deploy.pem").is_file());
}

#[test]
fn a_dependency_tree_and_a_big_file_are_never_byte_copied() {
    let world = world("large");
    write(&world.repo, "node_modules/left-pad/index.js", "x\n");
    write(&world.repo, "cache/keep.txt", "k\n");
    write(&world.repo, "cache/node_modules/dep/index.js", "x\n");
    let big = world.repo.join(".env.big");
    std::fs::write(&big, vec![b'a'; 6 * 1024 * 1024]).unwrap();

    let outcomes = carry(&world, &["node_modules", "cache", ".env.big"]);

    assert_eq!(
        statuses(&outcomes),
        vec![
            CarryStatus::SkippedLarge,
            CarryStatus::SkippedLarge,
            CarryStatus::SkippedLarge
        ]
    );
    assert!(!world.worktree.join("node_modules").exists());
    assert!(!world.worktree.join("cache").exists());
    assert!(!world.worktree.join(".env.big").exists());
}

#[test]
fn unsafe_missing_and_repeated_paths_copy_nothing() {
    let world = world("unsafe");
    write(&world.repo, ".env.local", "T=1\n");
    let outside = world.repo.parent().unwrap().join("outside.txt");
    std::fs::write(&outside, "outside\n").unwrap();

    let outcomes = carry(
        &world,
        &[
            "../outside.txt",
            "/etc/hosts",
            ".git/config",
            ".goodboy/worktrees",
            "",
            "does/not/exist.env",
            ".env.local",
            ".env.local",
        ],
    );

    assert_eq!(
        statuses(&outcomes),
        vec![
            CarryStatus::SkippedUnsafe,
            CarryStatus::SkippedUnsafe,
            CarryStatus::SkippedUnsafe,
            CarryStatus::SkippedUnsafe,
            CarryStatus::SkippedUnsafe,
            CarryStatus::SkippedMissing,
            CarryStatus::Copied,
        ]
    );
    assert!(!world
        .worktree
        .parent()
        .unwrap()
        .join("outside.txt")
        .exists());
}

#[cfg(unix)]
#[test]
fn a_link_is_never_followed() {
    let world = world("link");
    write(&world.repo, "elsewhere.txt", "secret outside the tree\n");
    std::os::unix::fs::symlink(
        world.repo.join("elsewhere.txt"),
        world.repo.join(".env.link"),
    )
    .unwrap();

    let outcomes = carry(&world, &[".env.link"]);

    assert_eq!(statuses(&outcomes), vec![CarryStatus::SkippedUnsafe]);
    assert!(!world.worktree.join(".env.link").exists());
}

#[test]
fn candidates_name_ignored_paths_flag_secrets_and_leave_dependencies_to_setup() {
    let world = world("candidates");
    write(&world.repo, ".env.local", "T=1\n");
    write(&world.repo, "config/local.json", "{}\n");
    write(&world.repo, "node_modules/dep/index.js", "x\n");
    write(&world.repo, "notes/todo.md", "todo\n");
    write(&world.repo, "scratch.txt", "not ignored\n");

    let found = carry_candidates_blocking(world.repo.to_string_lossy().into_owned()).unwrap();

    let names: Vec<&str> = found.iter().map(|entry| entry.path.as_str()).collect();
    assert_eq!(names, vec![".env.local", "config/local.json", "notes"]);
    assert!(found[0].is_secret);
    assert!(!found[1].is_secret);
    assert!(found[2].is_directory);
    assert!(!found[2].is_large);
}

#[test]
fn only_a_registered_worktree_of_the_repository_receives_files() {
    let world = world("registered");
    write(&world.repo, ".env.local", "T=1\n");
    let stranger = temp_root("registered-stranger");
    let repo = world.repo.to_string_lossy().into_owned();

    let into_stranger = carry_into_blocking(
        repo.clone(),
        stranger.to_string_lossy().into_owned(),
        vec![".env.local".to_string()],
    );
    let into_main = carry_into_blocking(repo.clone(), repo.clone(), vec![".env.local".to_string()]);
    let into_worktree = carry_into_blocking(
        repo,
        world.worktree.to_string_lossy().into_owned(),
        vec![".env.local".to_string()],
    )
    .unwrap();

    assert!(into_stranger.is_err());
    assert!(into_main.is_err());
    assert_eq!(statuses(&into_worktree), vec![CarryStatus::Copied]);
    assert!(!stranger.join(".env.local").exists());
}

#[test]
fn the_wire_shape_names_each_status_in_kebab_case() {
    use crate::util::wire_shape::assert_wire_value;
    use serde_json::json;

    assert_wire_value(
        &CarryOutcome {
            path: ".env.local".to_string(),
            status: CarryStatus::SkippedNotIgnored,
            is_secret: true,
        },
        json!({ "path": ".env.local", "status": "skipped-not-ignored", "isSecret": true }),
    );
}
