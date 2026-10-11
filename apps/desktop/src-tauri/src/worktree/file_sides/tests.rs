use super::read_sides;
use crate::worktree::git::git;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT_REPOSITORY: AtomicU64 = AtomicU64::new(0);

fn repository() -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-file-sides-{}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
        NEXT_REPOSITORY.fetch_add(1, Ordering::Relaxed)
    ));
    std::fs::create_dir(&root).unwrap();
    for args in [
        vec!["init", "-b", "main"],
        vec!["config", "user.name", "Harborline"],
        vec!["config", "user.email", "dev@harborline.test"],
        vec!["config", "commit.gpgsign", "false"],
    ] {
        git(&root, &args).unwrap();
    }
    std::fs::write(root.join("ledger-core.ts"), "const ledger = 1;\n").unwrap();
    git(&root, &["add", "ledger-core.ts"]).unwrap();
    git(&root, &["commit", "-m", "base"]).unwrap();
    root
}

#[test]
fn reads_modified_added_deleted_and_revision_sides() {
    let root = repository();
    let worktree = root.to_str().unwrap();
    std::fs::write(root.join("ledger-core.ts"), "const ledger = 2;\n").unwrap();
    let sides = read_sides(worktree, "ledger-core.ts", None, None, Some("main".into())).unwrap();
    assert_eq!(sides.old.as_deref(), Some("const ledger = 1;\n"));
    assert_eq!(sides.new.as_deref(), Some("const ledger = 2;\n"));
    assert!(!sides.too_large);
    let revision = read_sides(
        worktree,
        "ledger-core.ts",
        Some("HEAD".into()),
        Some("HEAD".into()),
        None,
    )
    .unwrap();
    assert_eq!(revision.old, revision.new);
    let initial = read_sides(
        worktree,
        "ledger-core.ts",
        Some("HEAD^".into()),
        Some("HEAD".into()),
        None,
    )
    .unwrap();
    assert!(initial.old.is_none());
    assert_eq!(initial.new.as_deref(), Some("const ledger = 1;\n"));
    std::fs::write(root.join("notify-relay.ts"), "fresh\n").unwrap();
    let added = read_sides(worktree, "notify-relay.ts", None, None, Some("main".into())).unwrap();
    assert!(added.old.is_none());
    assert_eq!(added.new.as_deref(), Some("fresh\n"));
    std::fs::remove_file(root.join("ledger-core.ts")).unwrap();
    let deleted = read_sides(worktree, "ledger-core.ts", None, None, Some("main".into())).unwrap();
    assert!(deleted.old.is_some());
    assert!(deleted.new.is_none());
    assert!(read_sides(
        worktree,
        "ledger-core.ts",
        Some("unknown".into()),
        None,
        None
    )
    .is_err());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn refuses_escape_and_limits_text() {
    let root = repository();
    let worktree = root.to_str().unwrap();
    for path in ["../ledger-core.ts", "/ledger-core.ts", "", "."] {
        assert!(read_sides(worktree, path, None, None, None).is_err());
    }
    for bytes in [
        vec![b'a'; 3 * 1024 * 1024],
        vec![0xff],
        "line\n".repeat(20_001).into_bytes(),
    ] {
        std::fs::write(root.join("ledger-core.ts"), bytes).unwrap();
        let sides =
            read_sides(worktree, "ledger-core.ts", None, None, Some("main".into())).unwrap();
        assert!(sides.too_large);
        assert!(sides.old.is_none());
        assert!(sides.new.is_none());
    }
    std::fs::write(root.join("ledger-core.ts"), vec![b'a'; 3 * 1024 * 1024]).unwrap();
    git(&root, &["add", "ledger-core.ts"]).unwrap();
    git(&root, &["commit", "-m", "large"]).unwrap();
    assert!(
        read_sides(
            worktree,
            "ledger-core.ts",
            Some("HEAD".into()),
            Some("HEAD".into()),
            None
        )
        .unwrap()
        .too_large
    );
    std::fs::write(root.join("ledger-core.ts"), [0xff]).unwrap();
    git(&root, &["add", "ledger-core.ts"]).unwrap();
    git(&root, &["commit", "-m", "binary"]).unwrap();
    assert!(
        read_sides(
            worktree,
            "ledger-core.ts",
            Some("HEAD".into()),
            Some("HEAD".into()),
            None
        )
        .unwrap()
        .too_large
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn refuses_symlink_escape_even_for_a_missing_child() {
    let root = repository();
    std::os::unix::fs::symlink(root.parent().unwrap(), root.join("outside")).unwrap();
    assert!(read_sides(
        root.to_str().unwrap(),
        "outside/missing.ts",
        None,
        None,
        None
    )
    .is_err());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn reads_the_old_path_of_a_renamed_file_and_the_index_pair() {
    let root = repository();
    let worktree = root.to_str().unwrap();
    git(&root, &["mv", "ledger-core.ts", "notify-relay.ts"]).unwrap();
    let renamed = read_sides(
        worktree,
        "notify-relay.ts",
        Some("HEAD".into()),
        Some(":0".into()),
        None,
    )
    .unwrap();
    assert_eq!(renamed.old.as_deref(), Some("const ledger = 1;\n"));
    assert_eq!(renamed.old, renamed.new);
    std::fs::write(root.join("notify-relay.ts"), "const ledger = 2;\n").unwrap();
    let unstaged = read_sides(worktree, "notify-relay.ts", Some(":0".into()), None, None).unwrap();
    assert_eq!(unstaged.old.as_deref(), Some("const ledger = 1;\n"));
    assert_eq!(unstaged.new.as_deref(), Some("const ledger = 2;\n"));
    git(&root, &["config", "diff.renames", "false"]).unwrap();
    let added = read_sides(
        worktree,
        "notify-relay.ts",
        Some("HEAD".into()),
        Some(":0".into()),
        None,
    )
    .unwrap();
    assert!(added.old.is_none());
    assert_eq!(added.new.as_deref(), Some("const ledger = 1;\n"));
    std::fs::write(root.join("ledger-core.ts"), "const ledger = 2;\n").unwrap();
    git(&root, &["add", "ledger-core.ts"]).unwrap();
    git(&root, &["config", "diff.renames", "copies"]).unwrap();
    let copied = read_sides(
        worktree,
        "notify-relay.ts",
        Some("HEAD".into()),
        Some(":0".into()),
        None,
    )
    .unwrap();
    assert_eq!(copied.old.as_deref(), Some("const ledger = 1;\n"));
    assert_eq!(copied.old, copied.new);
    std::fs::remove_dir_all(root).unwrap();
}
