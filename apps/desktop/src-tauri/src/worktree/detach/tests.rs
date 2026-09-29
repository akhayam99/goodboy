use super::{worktree_detach_assessment_blocking, REPRODUCIBLE_IGNORED_DIRS};
use crate::worktree::git::git;
use crate::worktree::types::{BranchIntegration, WorktreeDetachAssessment};
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
        .unwrap_or_else(|error| panic!("git {} failed: {error}", args.join(" ")))
        .trim()
        .to_string()
}

fn init_repo(name: &str) -> PathBuf {
    let root = temp_root(name);
    git_ok(&root, &["init", "-b", "main"]);
    git_ok(&root, &["config", "user.email", "test@example.com"]);
    git_ok(&root, &["config", "user.name", "test"]);
    std::fs::write(root.join(".gitignore"), "node_modules/\n").unwrap();
    std::fs::write(root.join("tracked.txt"), "base\n").unwrap();
    git_ok(&root, &["add", ".gitignore", "tracked.txt"]);
    git_ok(&root, &["commit", "-m", "base"]);
    std::fs::canonicalize(root).unwrap()
}

fn add_worktree(root: &Path, name: &str) -> PathBuf {
    let target = root.join("worktrees").join(name);
    git_ok(
        root,
        &[
            "worktree",
            "add",
            "-b",
            &format!("test/{name}"),
            target.to_str().unwrap(),
        ],
    );
    std::fs::canonicalize(target).unwrap()
}

fn publish_repo(root: &Path) {
    let bare = root.join("origin.git");
    git_ok(root, &["init", "--bare", bare.to_str().unwrap()]);
    git_ok(root, &["remote", "add", "origin", bare.to_str().unwrap()]);
    git_ok(root, &["push", "-u", "origin", "main"]);
    git_ok(root, &["remote", "set-head", "origin", "main"]);
}

fn assess(target: &Path) -> WorktreeDetachAssessment {
    worktree_detach_assessment_blocking(target.to_string_lossy().into_owned(), None).unwrap()
}

fn assess_against(target: &Path, base_branch: &str) -> WorktreeDetachAssessment {
    worktree_detach_assessment_blocking(
        target.to_string_lossy().into_owned(),
        Some(base_branch.to_string()),
    )
    .unwrap()
}

fn integration_of(assessment: &WorktreeDetachAssessment) -> &BranchIntegration {
    match assessment {
        WorktreeDetachAssessment::Assessed { integration, .. } => integration,
        _ => panic!("expected an assessed worktree"),
    }
}

#[test]
fn assessment_reports_a_clean_published_worktree_as_safe() {
    let root = init_repo("assess-clean");
    publish_repo(&root);
    let target = add_worktree(&root, "clean");
    git_ok(&target, &["push", "-u", "origin", "test/clean"]);

    assert_eq!(
        assess(&target),
        WorktreeDetachAssessment::Assessed {
            path: target.to_string_lossy().into_owned(),
            branch: Some("test/clean".to_string()),
            has_upstream: true,
            affected_files: 0,
            local_only_commits: 0,
            ignored_files: 0,
            ignored_file_samples: Vec::new(),
            integration: BranchIntegration::Merged {
                base: "origin/main".to_string()
            },
        }
    );
}

#[test]
fn assessment_treats_reproducible_ignored_directories_as_no_risk() {
    let root = init_repo("assess-ignored-reproducible");
    publish_repo(&root);
    let target = add_worktree(&root, "ignored-reproducible");
    git_ok(
        &target,
        &["push", "-u", "origin", "test/ignored-reproducible"],
    );
    let ignores = REPRODUCIBLE_IGNORED_DIRS
        .iter()
        .map(|directory| format!("{directory}/\n"))
        .collect::<String>();
    std::fs::write(target.join(".gitignore"), ignores).unwrap();
    for directory in REPRODUCIBLE_IGNORED_DIRS {
        let nested = target.join(directory).join("nested");
        std::fs::create_dir_all(&nested).unwrap();
        std::fs::write(nested.join("artifact.bin"), "x").unwrap();
    }

    let WorktreeDetachAssessment::Assessed {
        ignored_files,
        ignored_file_samples,
        ..
    } = assess(&target)
    else {
        panic!("expected an assessed worktree");
    };

    assert_eq!(ignored_files, 0);
    assert!(ignored_file_samples.is_empty());
}

#[test]
fn assessment_reports_and_names_a_non_reproducible_ignored_file() {
    let root = init_repo("assess-ignored-env");
    publish_repo(&root);
    let target = add_worktree(&root, "ignored-env");
    git_ok(&target, &["push", "-u", "origin", "test/ignored-env"]);
    std::fs::write(target.join(".gitignore"), "node_modules/\n.env.local\n").unwrap();
    std::fs::write(target.join(".env.local"), "SECRET=1\n").unwrap();

    let WorktreeDetachAssessment::Assessed {
        ignored_files,
        ignored_file_samples,
        ..
    } = assess(&target)
    else {
        panic!("expected an assessed worktree");
    };

    assert_eq!(ignored_files, 1);
    assert_eq!(ignored_file_samples, vec![".env.local".to_string()]);
}

#[test]
fn assessment_excludes_reproducible_names_only_at_the_top_level() {
    let root = init_repo("assess-ignored-top-level");
    publish_repo(&root);
    let target = add_worktree(&root, "ignored-top-level");
    git_ok(&target, &["push", "-u", "origin", "test/ignored-top-level"]);
    std::fs::write(target.join(".gitignore"), "**/node_modules/\n").unwrap();
    let nested = target.join("scratch").join("node_modules");
    std::fs::create_dir_all(&nested).unwrap();
    std::fs::write(nested.join("local.bin"), "x").unwrap();
    std::fs::create_dir_all(target.join("node_modules")).unwrap();
    std::fs::write(target.join("node_modules").join("dep.js"), "x").unwrap();

    let WorktreeDetachAssessment::Assessed {
        ignored_files,
        ignored_file_samples,
        ..
    } = assess(&target)
    else {
        panic!("expected an assessed worktree");
    };

    assert_eq!(ignored_files, 2);
    assert_eq!(
        ignored_file_samples,
        vec!["scratch/".to_string(), "scratch/node_modules/".to_string()]
    );
}

#[test]
fn assessment_limits_relative_samples_and_orders_shortest_first() {
    let root = init_repo("assess-ignored-samples");
    publish_repo(&root);
    let target = add_worktree(&root, "ignored-samples");
    git_ok(&target, &["push", "-u", "origin", "test/ignored-samples"]);
    let paths = [
        ".a",
        ".env",
        "local.db",
        "notes.txt",
        "settings.json",
        "space file.txt",
    ];
    std::fs::write(target.join(".gitignore"), paths.join("\n")).unwrap();
    for relative in paths {
        let path = target.join(relative);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(path, "x").unwrap();
    }

    let WorktreeDetachAssessment::Assessed {
        ignored_files,
        ignored_file_samples,
        ..
    } = assess(&target)
    else {
        panic!("expected an assessed worktree");
    };

    assert_eq!(ignored_files, 6);
    assert_eq!(
        ignored_file_samples,
        vec![
            ".a".to_string(),
            ".env".to_string(),
            "local.db".to_string(),
            "notes.txt".to_string(),
            "settings.json".to_string(),
        ]
    );
    assert!(ignored_file_samples
        .iter()
        .all(|sample| !Path::new(sample).is_absolute()));
}

#[test]
fn assessment_counts_only_the_non_reproducible_ignored_file_when_both_are_present() {
    let root = init_repo("assess-ignored-mixed");
    publish_repo(&root);
    let target = add_worktree(&root, "ignored-mixed");
    git_ok(&target, &["push", "-u", "origin", "test/ignored-mixed"]);
    std::fs::write(target.join(".gitignore"), "node_modules/\n.env.local\n").unwrap();
    std::fs::write(target.join(".env.local"), "SECRET=1\n").unwrap();
    std::fs::create_dir_all(target.join("node_modules")).unwrap();
    std::fs::write(target.join("node_modules").join("dep.js"), "x").unwrap();

    let WorktreeDetachAssessment::Assessed {
        ignored_files,
        ignored_file_samples,
        ..
    } = assess(&target)
    else {
        panic!("expected an assessed worktree");
    };

    assert_eq!(ignored_files, 1);
    assert_eq!(ignored_file_samples, vec![".env.local".to_string()]);
}

#[test]
fn assessment_counts_each_affected_path_once_and_skips_ignored_files() {
    let root = init_repo("assess-files");
    publish_repo(&root);
    let target = add_worktree(&root, "files");
    git_ok(&target, &["push", "-u", "origin", "test/files"]);
    std::fs::write(target.join("tracked.txt"), "staged\n").unwrap();
    git_ok(&target, &["add", "tracked.txt"]);
    std::fs::write(target.join("tracked.txt"), "staged and then edited\n").unwrap();
    std::fs::write(target.join("scratch.txt"), "untracked\n").unwrap();
    std::fs::create_dir_all(target.join("node_modules")).unwrap();
    std::fs::write(target.join("node_modules").join("dep.js"), "x").unwrap();

    let WorktreeDetachAssessment::Assessed {
        affected_files,
        local_only_commits,
        has_upstream,
        ..
    } = assess(&target)
    else {
        panic!("expected an assessed worktree");
    };

    assert_eq!(
        (affected_files, local_only_commits, has_upstream),
        (2, 0, true)
    );
}

#[test]
fn assessment_counts_commits_that_no_remote_ref_contains() {
    let root = init_repo("assess-commits");
    publish_repo(&root);
    let target = add_worktree(&root, "commits");
    git_ok(&target, &["push", "-u", "origin", "test/commits"]);
    std::fs::write(target.join("tracked.txt"), "local\n").unwrap();
    git_ok(&target, &["commit", "-am", "local work"]);

    let WorktreeDetachAssessment::Assessed {
        affected_files,
        local_only_commits,
        has_upstream,
        ..
    } = assess(&target)
    else {
        panic!("expected an assessed worktree");
    };

    assert_eq!(
        (affected_files, local_only_commits, has_upstream),
        (0, 1, true)
    );
}

#[test]
fn assessment_reports_a_branch_without_an_upstream() {
    let root = init_repo("assess-no-upstream");
    publish_repo(&root);
    let target = add_worktree(&root, "no-upstream");

    let WorktreeDetachAssessment::Assessed {
        affected_files,
        local_only_commits,
        has_upstream,
        ..
    } = assess(&target)
    else {
        panic!("expected an assessed worktree");
    };

    assert_eq!(
        (affected_files, local_only_commits, has_upstream),
        (0, 0, false)
    );
}

#[test]
fn assessment_reports_an_absent_directory_as_missing() {
    let root = init_repo("assess-missing");
    let target = root.join("worktrees").join("gone");

    assert_eq!(
        assess(&target),
        WorktreeDetachAssessment::Missing {
            path: target.to_string_lossy().into_owned()
        }
    );
}

#[test]
fn assessment_reports_a_branch_merged_into_the_configured_base() {
    let root = init_repo("assess-merged-base");
    publish_repo(&root);
    let target = add_worktree(&root, "merged-base");
    git_ok(&target, &["push", "-u", "origin", "test/merged-base"]);

    assert_eq!(
        integration_of(&assess_against(&target, "main")),
        &BranchIntegration::Merged {
            base: "origin/main".to_string()
        }
    );
}

#[test]
fn assessment_counts_commits_missing_from_the_configured_base() {
    let root = init_repo("assess-unmerged-base");
    publish_repo(&root);
    let target = add_worktree(&root, "unmerged-base");
    std::fs::write(target.join("first.txt"), "one\n").unwrap();
    git_ok(&target, &["add", "first.txt"]);
    git_ok(&target, &["commit", "-m", "first"]);
    std::fs::write(target.join("second.txt"), "two\n").unwrap();
    git_ok(&target, &["add", "second.txt"]);
    git_ok(&target, &["commit", "-m", "second"]);
    git_ok(&target, &["push", "-u", "origin", "test/unmerged-base"]);

    assert_eq!(
        integration_of(&assess_against(&target, "main")),
        &BranchIntegration::Unmerged {
            base: "origin/main".to_string(),
            ahead: 2
        }
    );
}

#[test]
fn assessment_reads_integration_against_the_project_base_not_main() {
    let root = init_repo("assess-project-base");
    publish_repo(&root);
    let target = add_worktree(&root, "project-base");
    std::fs::write(target.join("feature.txt"), "work\n").unwrap();
    git_ok(&target, &["add", "feature.txt"]);
    git_ok(&target, &["commit", "-m", "feature"]);
    git_ok(&target, &["push", "-u", "origin", "test/project-base"]);
    git_ok(&target, &["push", "origin", "HEAD:refs/heads/develop"]);
    git_ok(&target, &["fetch", "origin"]);

    assert_eq!(
        integration_of(&assess_against(&target, "develop")),
        &BranchIntegration::Merged {
            base: "origin/develop".to_string()
        }
    );
    assert_eq!(
        integration_of(&assess_against(&target, "main")),
        &BranchIntegration::Unmerged {
            base: "origin/main".to_string(),
            ahead: 1
        }
    );
}

#[test]
fn assessment_reports_unknown_integration_when_the_base_does_not_resolve() {
    let root = init_repo("assess-base-missing");
    publish_repo(&root);
    let target = add_worktree(&root, "base-missing");
    git_ok(&target, &["push", "-u", "origin", "test/base-missing"]);

    assert_eq!(
        integration_of(&assess_against(&target, "release/never-cut")),
        &BranchIntegration::Unknown
    );
}

#[test]
fn assessment_reports_unknown_integration_when_no_base_is_configured_and_none_is_published() {
    let root = init_repo("assess-base-absent");
    let target = add_worktree(&root, "base-absent");
    git_ok(&root, &["branch", "-m", "main", "trunk"]);
    git_ok(&root, &["checkout", "--detach"]);

    assert_eq!(
        integration_of(&assess(&target)),
        &BranchIntegration::Unknown
    );
}

#[test]
fn assessment_finds_the_local_default_branch_when_no_base_is_configured_and_no_remote_exists() {
    let root = init_repo("assess-local-default");
    let target = add_worktree(&root, "local-default");

    assert_eq!(
        integration_of(&assess(&target)),
        &BranchIntegration::Merged {
            base: "main".to_string()
        }
    );
}

#[test]
fn assessment_falls_back_to_a_local_base_branch_without_a_remote() {
    let root = init_repo("assess-local-base");
    let target = add_worktree(&root, "local-base");

    assert_eq!(
        integration_of(&assess_against(&target, "main")),
        &BranchIntegration::Merged {
            base: "main".to_string()
        }
    );
}

#[test]
fn assessment_reports_a_non_repository_directory_as_unavailable() {
    let root = temp_root("assess-unavailable");
    std::fs::create_dir_all(root.join("plain")).unwrap();

    assert_eq!(
        assess(&root.join("plain")),
        WorktreeDetachAssessment::Unavailable {
            path: root.join("plain").to_string_lossy().into_owned(),
            branch: None
        }
    );
}
