use super::{grep_word, is_identifier};
use crate::fake_cli::FakeCli;
use crate::proc::git::Git;
use crate::worktree::git::git;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

static NEXT_REPOSITORY: AtomicU64 = AtomicU64::new(0);

fn repository() -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-grep-{}-{}-{}",
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
    root
}

fn search(root: &std::path::Path, word: &str) -> super::GrepResult {
    grep_word(Git::new(), root, word, Duration::from_secs(3)).unwrap()
}

#[test]
fn returns_every_use_with_line_and_column() {
    let root = repository();
    std::fs::write(root.join("a.ts"), "const creditKey = 1;\n").unwrap();
    std::fs::write(root.join("b.ts"), "x\n  use(creditKey);\n").unwrap();
    std::fs::write(root.join("c.ts"), "creditKey\n").unwrap();
    git(&root, &["add", "."]).unwrap();
    git(&root, &["commit", "-m", "base"]).unwrap();
    let result = search(&root, "creditKey");
    assert_eq!(result.matches.len(), 3);
    assert!(!result.truncated);
    let b = result.matches.iter().find(|m| m.path == "b.ts").unwrap();
    assert_eq!((b.line, b.column), (2, 5));
    assert_eq!(b.text, "use(creditKey);");
    let a = result.matches.iter().find(|m| m.path == "a.ts").unwrap();
    assert_eq!((a.line, a.column), (1, 7));
}

#[test]
fn whole_word_only() {
    let root = repository();
    std::fs::write(
        root.join("a.ts"),
        "const creditKeyed = 1;\nconst creditKey = 2;\n",
    )
    .unwrap();
    git(&root, &["add", "."]).unwrap();
    let result = search(&root, "creditKey");
    assert_eq!(result.matches.len(), 1);
    assert_eq!(result.matches[0].line, 2);
}

#[test]
fn searches_untracked_files() {
    let root = repository();
    std::fs::write(root.join("tracked.ts"), "other\n").unwrap();
    git(&root, &["add", "."]).unwrap();
    git(&root, &["commit", "-m", "base"]).unwrap();
    std::fs::write(root.join("fresh.ts"), "const notifyRelay = 1;\n").unwrap();
    let result = search(&root, "notifyRelay");
    assert_eq!(result.matches.len(), 1);
    assert_eq!(result.matches[0].path, "fresh.ts");
}

#[test]
fn no_match_is_an_empty_list() {
    let root = repository();
    std::fs::write(root.join("a.ts"), "x\n").unwrap();
    git(&root, &["add", "."]).unwrap();
    let result = search(&root, "missingWord");
    assert!(result.matches.is_empty());
    assert!(!result.truncated);
}

#[test]
fn keeps_the_first_300_matches() {
    let root = repository();
    let body = "creditKey\n".repeat(400);
    std::fs::write(root.join("a.ts"), body).unwrap();
    git(&root, &["add", "."]).unwrap();
    let result = search(&root, "creditKey");
    assert_eq!(result.matches.len(), 300);
    assert!(result.truncated);
}

#[test]
fn trims_long_lines() {
    let root = repository();
    let line = format!("creditKey {}\n", "x".repeat(500));
    std::fs::write(root.join("a.ts"), line).unwrap();
    git(&root, &["add", "."]).unwrap();
    let result = search(&root, "creditKey");
    assert_eq!(result.matches[0].text.chars().count(), 240);
}

#[test]
fn refuses_an_invalid_word_before_any_process_starts() {
    let fake = FakeCli::stage("hang");
    for word in ["a b", "$(x)", "a", "", "1abc", &"a".repeat(200)] {
        let started = Instant::now();
        let result = grep_word(
            Git::with_binary(fake.binary("git")),
            std::path::Path::new(&fake.work_dir()),
            word,
            Duration::from_secs(3),
        );
        assert!(result.is_err(), "{word}");
        assert!(started.elapsed() < Duration::from_secs(1));
        assert!(fake.work_file("fake-git-sleeper.pid").is_none());
    }
}

#[test]
fn identifier_rules() {
    assert!(is_identifier("creditKey"));
    assert!(is_identifier("$ref"));
    assert!(is_identifier("_x"));
    assert!(!is_identifier("a-b"));
    assert!(is_identifier(&"a".repeat(128)));
    assert!(!is_identifier(&"a".repeat(129)));
}

#[test]
fn a_slow_git_times_out_cleanly() {
    let fake = FakeCli::stage("hang");
    let started = Instant::now();
    let error = grep_word(
        Git::with_binary(fake.binary("git")),
        std::path::Path::new(&fake.work_dir()),
        "creditKey",
        Duration::from_millis(300),
    )
    .unwrap_err();
    assert!(error.to_string().contains("took too long"));
    assert!(started.elapsed() < Duration::from_secs(5));
}
