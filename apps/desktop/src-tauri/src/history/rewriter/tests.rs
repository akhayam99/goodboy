use super::{collect_rewrite, RewriterCollectArgs};
use crate::history::copies::{copy_git_dirs, create_copy};
use crate::history::fixtures::{
    branch, commit, git_ok, init_repo, ledger, plan, slug, step, subjects, temp_root,
};
use crate::history::reservation::{copy_path_of, discard_copy};
use crate::history::runner::git_run;
use crate::history::trial::trial;
use crate::history::types::{HistoryVerb, ShaMove};
use std::path::{Path, PathBuf};

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
