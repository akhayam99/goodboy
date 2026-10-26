use super::{worktree_turn_files_blocking, TurnBefore, TurnFile, TurnFiles};
use crate::worktree::snapshot::worktree_snapshot_blocking;
use std::path::{Path, PathBuf};
use std::process::Command;

fn sh(cwd: &Path, args: &[&str]) -> std::process::ExitStatus {
    Command::new("git")
        .current_dir(cwd)
        .args(args)
        .env("GIT_AUTHOR_NAME", "Harborline")
        .env("GIT_AUTHOR_EMAIL", "dev@harborline.test")
        .env("GIT_COMMITTER_NAME", "Harborline")
        .env("GIT_COMMITTER_EMAIL", "dev@harborline.test")
        .env("GIT_EDITOR", "true")
        .status()
        .expect("git runs")
}

fn ok(cwd: &Path, args: &[&str]) {
    assert!(sh(cwd, args).success(), "git {args:?} failed");
}

fn write(cwd: &Path, path: &str, text: &str) {
    let target = cwd.join(path);
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).expect("dir");
    }
    std::fs::write(target, text).expect("write");
}

fn repo(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "goodboy-turn-files-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|elapsed| elapsed.as_nanos())
            .unwrap_or_default()
    ));
    std::fs::create_dir_all(&dir).expect("dir");
    ok(&dir, &["init", "-q", "-b", "main"]);
    write(&dir, "kept.txt", "kept\n");
    write(&dir, "shared.txt", "one\ntwo\nthree\n");
    ok(&dir, &["add", "-A"]);
    ok(&dir, &["commit", "-q", "-m", "first"]);
    ok(&dir, &["checkout", "-q", "-b", "hl/retry-webhook"]);
    dir
}

fn before(dir: &Path) -> TurnBefore {
    let snapshot = worktree_snapshot_blocking(dir.to_string_lossy().into_owned()).expect("ok");
    TurnBefore {
        head: snapshot.head,
        entries: snapshot.entries,
    }
}

fn files(dir: &Path, before: TurnBefore) -> TurnFiles {
    worktree_turn_files_blocking(
        dir.to_string_lossy().into_owned(),
        before,
        Some("main".to_string()),
    )
    .expect("ok")
}

fn paths(own: &[TurnFile]) -> Vec<&str> {
    own.iter().map(|file| file.path.as_str()).collect()
}

fn find<'a>(own: &'a [TurnFile], path: &str) -> &'a TurnFile {
    own.iter()
        .find(|file| file.path == path)
        .unwrap_or_else(|| panic!("{path} is not in the turn"))
}

#[test]
fn edits_new_files_and_deletions_of_the_turn_are_its_own_with_counts() {
    let dir = repo("edits");
    let start = before(&dir);
    write(&dir, "shared.txt", "one\ntwo changed\nthree\nfour\n");
    write(&dir, "src/retry.ts", "a\nb\nc\n");
    std::fs::remove_file(dir.join("kept.txt")).expect("remove");

    let result = files(&dir, start);

    assert_eq!(
        paths(&result.own),
        vec!["kept.txt", "shared.txt", "src/retry.ts"]
    );
    let shared = find(&result.own, "shared.txt");
    assert_eq!(
        (shared.status, shared.additions, shared.deletions),
        ("modified", Some(2), Some(1))
    );
    let added = find(&result.own, "src/retry.ts");
    assert_eq!(
        (added.status, added.additions, added.deletions),
        ("added", Some(3), Some(0))
    );
    let deleted = find(&result.own, "kept.txt");
    assert_eq!(
        (deleted.status, deleted.additions, deleted.deletions),
        ("deleted", Some(0), Some(1))
    );
    assert!(result.from_base.is_empty());
    std::fs::remove_dir_all(&dir).expect("cleanup");
}

#[test]
fn work_that_was_already_dirty_before_the_turn_is_not_the_turns() {
    let dir = repo("predirty");
    write(&dir, "shared.txt", "one\nedited by hand\nthree\n");
    write(&dir, "notes.txt", "mine\n");
    let start = before(&dir);
    write(&dir, "src/retry.ts", "a\n");

    let untouched = files(&dir, before(&dir));
    let result = files(&dir, start);

    assert!(untouched.own.is_empty());
    assert_eq!(paths(&result.own), vec!["src/retry.ts"]);
    std::fs::remove_dir_all(&dir).expect("cleanup");
}

#[test]
fn a_file_the_turn_edited_again_over_a_dirty_start_counts() {
    let dir = repo("redirty");
    write(&dir, "shared.txt", "one\nedited by hand\nthree\n");
    let start = before(&dir);
    write(
        &dir,
        "shared.txt",
        "one\nedited by hand\nand by the agent\n",
    );

    let result = files(&dir, start);

    assert_eq!(paths(&result.own), vec!["shared.txt"]);
    std::fs::remove_dir_all(&dir).expect("cleanup");
}

#[test]
fn files_the_turn_committed_are_its_own() {
    let dir = repo("committed");
    let start = before(&dir);
    write(&dir, "src/retry.ts", "a\nb\n");
    ok(&dir, &["add", "-A"]);
    ok(&dir, &["commit", "-q", "-m", "retry"]);

    let result = files(&dir, start);

    assert_eq!(paths(&result.own), vec!["src/retry.ts"]);
    assert_eq!(result.own[0].additions, Some(2));
    assert!(result.from_base.is_empty());
    std::fs::remove_dir_all(&dir).expect("cleanup");
}

#[test]
fn a_rebase_pours_twelve_files_from_main_and_they_are_hidden_not_counted() {
    let dir = repo("rebase");
    write(&dir, "src/old.ts", "old\n");
    ok(&dir, &["add", "-A"]);
    ok(&dir, &["commit", "-q", "-m", "earlier branch work"]);
    ok(&dir, &["checkout", "-q", "main"]);
    for index in 0..12 {
        write(&dir, &format!("src/ledger/from-main-{index}.ts"), "main\n");
    }
    ok(&dir, &["add", "-A"]);
    ok(&dir, &["commit", "-q", "-m", "main moved"]);
    ok(&dir, &["checkout", "-q", "hl/retry-webhook"]);
    let start = before(&dir);
    write(&dir, "src/retry.ts", "retry\n");
    ok(&dir, &["add", "-A"]);
    ok(&dir, &["commit", "-q", "-m", "retry"]);
    ok(&dir, &["rebase", "main"]);

    let result = files(&dir, start);

    assert_eq!(paths(&result.own), vec!["src/retry.ts"]);
    assert_eq!(result.from_base.len(), 12);
    assert!(result
        .from_base
        .iter()
        .all(|path| path.starts_with("src/ledger/from-main-")));
    assert!(!result.from_base.contains(&"src/old.ts".to_string()));
    std::fs::remove_dir_all(&dir).expect("cleanup");
}

#[test]
fn a_conflict_the_turn_fixed_counts_as_its_own() {
    let dir = repo("conflict");
    write(&dir, "shared.txt", "one\ntwo from branch\nthree\n");
    ok(&dir, &["add", "-A"]);
    ok(&dir, &["commit", "-q", "-m", "branch edit"]);
    ok(&dir, &["checkout", "-q", "main"]);
    write(&dir, "shared.txt", "one\ntwo from main\nthree\n");
    write(&dir, "main-only.txt", "main\n");
    ok(&dir, &["add", "-A"]);
    ok(&dir, &["commit", "-q", "-m", "main edit"]);
    ok(&dir, &["checkout", "-q", "hl/retry-webhook"]);
    let start = before(&dir);
    assert!(!sh(&dir, &["rebase", "main"]).success());
    write(&dir, "shared.txt", "one\ntwo resolved\nthree\n");
    ok(&dir, &["add", "shared.txt"]);
    ok(&dir, &["rebase", "--continue"]);

    let result = files(&dir, start);

    assert_eq!(paths(&result.own), vec!["shared.txt"]);
    assert_eq!(result.from_base, vec!["main-only.txt".to_string()]);
    std::fs::remove_dir_all(&dir).expect("cleanup");
}

#[test]
fn without_a_base_every_committed_file_counts_because_nothing_can_be_told_apart() {
    let dir = repo("nobase");
    let start = before(&dir);
    write(&dir, "src/retry.ts", "a\n");
    ok(&dir, &["add", "-A"]);
    ok(&dir, &["commit", "-q", "-m", "retry"]);
    ok(&dir, &["branch", "-m", "main", "trunk"]);

    let result = worktree_turn_files_blocking(
        dir.to_string_lossy().into_owned(),
        start,
        Some("no-such-base".to_string()),
    )
    .expect("ok");

    assert_eq!(paths(&result.own), vec!["src/retry.ts"]);
    assert!(result.from_base.is_empty());
    std::fs::remove_dir_all(&dir).expect("cleanup");
}

#[test]
fn a_clean_turn_has_no_files_and_a_missing_folder_is_an_error() {
    let dir = repo("clean");
    let start = before(&dir);

    let result = files(&dir, start);

    assert!(result.own.is_empty());
    assert!(result.from_base.is_empty());
    assert!(!result.is_partial);
    assert!(worktree_turn_files_blocking(
        "/no/such/worktree".to_string(),
        TurnBefore {
            head: String::new(),
            entries: Vec::new(),
        },
        None,
    )
    .is_err());
    std::fs::remove_dir_all(&dir).expect("cleanup");
}

#[test]
fn the_wire_shape_is_camel_case_with_the_hidden_list() {
    use crate::util::wire_shape::assert_wire_value;
    use serde_json::json;

    assert_wire_value(
        &TurnFiles {
            own: vec![TurnFile {
                path: "src/retry.ts".to_string(),
                status: "modified",
                additions: Some(42),
                deletions: None,
            }],
            from_base: vec!["src/ledger/post.ts".to_string()],
            is_partial: false,
        },
        json!({
            "own": [{ "path": "src/retry.ts", "status": "modified", "additions": 42, "deletions": null }],
            "fromBase": ["src/ledger/post.ts"],
            "isPartial": false,
        }),
    );
}
