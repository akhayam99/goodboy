use super::plan::EntryKind;
use super::{
    first_commit_plan_blocking, make_first_commit_blocking, probe_blocking, scaffold, CommitAuthor,
    FirstCommitArgs, FolderGitError, PlanStart, ProbeState, FALLBACK_AUTHOR_EMAIL,
    FALLBACK_AUTHOR_NAME,
};
use std::path::{Path, PathBuf};

fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-folder-git-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    std::fs::canonicalize(root).unwrap()
}

fn write(root: &Path, relative: &str, body: &str) {
    let path = root.join(relative);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, body).unwrap();
}

fn git_out(cwd: &Path, args: &[&str]) -> String {
    let out = crate::path_env::command("git")
        .args(args)
        .current_dir(cwd)
        .env("LC_ALL", "C")
        .output()
        .unwrap();
    String::from_utf8(out.stdout).unwrap().trim().to_string()
}

fn acme_web(name: &str) -> PathBuf {
    let root = temp_root(name);
    write(&root, "package.json", "{}");
    write(&root, "README.md", "# acme-web");
    write(&root, "src/index.ts", "export {};");
    write(&root, "src/app/page.tsx", "export {};");
    write(&root, "public/logo.svg", "<svg/>");
    write(
        &root,
        "node_modules/left-pad/index.js",
        "module.exports = 1;",
    );
    write(&root, "node_modules/left-pad/test.pem", "cert");
    write(&root, "dist/index.js", "built");
    write(&root, ".env", "API_TOKEN=northwind-fixture");
    write(&root, "config/.env.local", "TOKEN=northwind");
    write(&root, "keys/deploy.pem", "pem");
    write(&root, ".DS_Store", "finder");
    root
}

fn args(root: &Path, include: &[&str]) -> FirstCommitArgs {
    FirstCommitArgs {
        path: root.to_string_lossy().into_owned(),
        include: include.iter().map(|key| (*key).to_string()).collect(),
    }
}

fn committed(root: &Path) -> Vec<String> {
    git_out(root, &["ls-tree", "-r", "--name-only", "HEAD"])
        .lines()
        .map(str::to_string)
        .collect()
}

#[test]
fn the_plan_groups_what_goes_in_and_what_stays_out() {
    let root = acme_web("plan");

    let plan = first_commit_plan_blocking(&root.to_string_lossy()).unwrap();

    assert_eq!(plan.start, PlanStart::NoGit);
    assert_eq!(plan.branch, "main");
    let summary: Vec<(EntryKind, &str, u32, bool)> = plan
        .entries
        .iter()
        .map(|entry| {
            (
                entry.kind,
                entry.key.as_str(),
                entry.files,
                entry.can_toggle,
            )
        })
        .collect();
    assert_eq!(
        summary,
        vec![
            (EntryKind::Included, "src/", 2, false),
            (EntryKind::Included, "public/", 1, false),
            (EntryKind::Included, ".", 2, false),
            (EntryKind::Dependencies, "node_modules/", 1, true),
            (EntryKind::Output, "dist/", 1, true),
            (EntryKind::Secret, "*.pem", 2, false),
            (EntryKind::Secret, ".env*", 2, false),
            (EntryKind::System, ".DS_Store", 1, false),
        ]
    );
    assert!(!plan.has_ignore_file);
    assert!(!root.join(".git").exists());
    assert!(!root.join(".gitignore").exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn the_first_commit_keeps_every_secret_out_and_writes_the_ignore_file() {
    let root = acme_web("secrets");

    let made = make_first_commit_blocking(&args(&root, &[])).unwrap();

    let files = committed(&root);
    assert!(files.contains(&"src/index.ts".to_string()));
    assert!(files.contains(&".gitignore".to_string()));
    assert!(files.iter().all(|path| !path.contains(".env")));
    assert!(files.iter().all(|path| !path.ends_with(".pem")));
    assert!(files.iter().all(|path| !path.starts_with("node_modules/")));
    assert!(files.iter().all(|path| !path.starts_with("dist/")));
    assert_eq!(made.files, u32::try_from(files.len()).unwrap());
    assert_eq!(made.branch, "main");
    assert_eq!(git_out(&root, &["symbolic-ref", "--short", "HEAD"]), "main");
    let ignore = std::fs::read_to_string(root.join(".gitignore")).unwrap();
    for line in ["node_modules/", "/dist/", ".env*", "*.pem", ".DS_Store"] {
        assert!(ignore.lines().any(|found| found == line), "missing {line}");
    }
    assert!(git_out(&root, &["remote"]).is_empty());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_dependency_folder_goes_in_only_when_asked_and_its_secrets_still_stay_out() {
    let root = acme_web("include");

    make_first_commit_blocking(&args(&root, &["node_modules/"])).unwrap();

    let files = committed(&root);
    assert!(files.contains(&"node_modules/left-pad/index.js".to_string()));
    assert!(!files.contains(&"node_modules/left-pad/test.pem".to_string()));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_secret_can_never_be_asked_into_the_first_commit() {
    let root = acme_web("ask-secret");

    let refused = make_first_commit_blocking(&args(&root, &[".env*"])).unwrap_err();

    assert!(matches!(refused, FolderGitError::UnknownEntry(_)));
    assert!(!root.join(".git").exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn the_fallback_author_signs_when_git_has_no_identity() {
    let root = acme_web("fallback");
    let mut plan = first_commit_plan_blocking(&root.to_string_lossy()).unwrap();
    plan.author = CommitAuthor {
        name: FALLBACK_AUTHOR_NAME.to_string(),
        email: FALLBACK_AUTHOR_EMAIL.to_string(),
        is_fallback: true,
    };

    scaffold(&root, &plan, &[]).unwrap();

    assert_eq!(
        git_out(&root, &["log", "-1", "--format=%an <%ae>"]),
        "Goodboy <goodboy@localhost>"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn the_plan_names_the_identity_git_would_use() {
    let root = temp_root("identity");
    write(&root, "notes.md", "hello");
    git_out(&root, &["init", "-q"]);
    git_out(&root, &["config", "user.name", "Dana Reyes"]);
    git_out(&root, &["config", "user.email", "dana@acme.dev"]);

    let plan = first_commit_plan_blocking(&root.to_string_lossy()).unwrap();

    assert_eq!(plan.start, PlanStart::NoCommits);
    assert_eq!(
        plan.author,
        CommitAuthor {
            name: "Dana Reyes".to_string(),
            email: "dana@acme.dev".to_string(),
            is_fallback: false,
        }
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn a_failed_first_commit_takes_git_back_out_of_the_folder() {
    use std::os::unix::fs::PermissionsExt;
    let root = acme_web("undo");
    write(&root, ".gitignore", "*.log\n");
    let locked = root.join("src/locked.ts");
    std::fs::write(&locked, "secret sauce").unwrap();
    std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o000)).unwrap();

    let failed = make_first_commit_blocking(&args(&root, &[]));

    std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o644)).unwrap();
    assert!(failed.is_err());
    assert!(!root.join(".git").exists());
    assert_eq!(
        std::fs::read_to_string(root.join(".gitignore")).unwrap(),
        "*.log\n"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn a_failed_first_commit_in_an_empty_repository_keeps_its_git_folder() {
    use std::os::unix::fs::PermissionsExt;
    let root = temp_root("undo-empty");
    write(&root, "notes.md", "hello");
    git_out(&root, &["init", "-q"]);
    let locked = root.join("locked.md");
    std::fs::write(&locked, "draft").unwrap();
    std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o000)).unwrap();

    let failed = make_first_commit_blocking(&args(&root, &[]));

    std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o644)).unwrap();
    assert!(failed.is_err());
    assert!(root.join(".git").is_dir());
    assert!(!root.join(".gitignore").exists());
    assert!(git_out(&root, &["ls-files", "--cached"]).is_empty());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn the_first_commit_in_an_empty_repository_keeps_its_branch() {
    let root = temp_root("empty-repo");
    write(&root, "notes.md", "hello");
    git_out(&root, &["init", "-q"]);
    git_out(&root, &["symbolic-ref", "HEAD", "refs/heads/trunk"]);

    let made = make_first_commit_blocking(&args(&root, &[])).unwrap();

    assert_eq!(made.branch, "trunk");
    assert!(committed(&root).contains(&"notes.md".to_string()));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_tracked_folder_or_one_inside_a_repository_is_refused() {
    let root = acme_web("refuse");
    make_first_commit_blocking(&args(&root, &[])).unwrap();
    std::fs::create_dir_all(root.join("docs")).unwrap();

    let again = make_first_commit_blocking(&args(&root, &[])).unwrap_err();
    let inside = first_commit_plan_blocking(&root.join("docs").to_string_lossy()).unwrap_err();

    assert!(matches!(again, FolderGitError::AlreadyTracked(_)));
    assert!(matches!(inside, FolderGitError::InsideRepository(_)));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn the_probe_tells_no_git_an_empty_repository_commits_and_a_repository_above() {
    let root = temp_root("probe");
    write(&root, "notes.md", "hello");
    std::fs::create_dir_all(root.join("handbook")).unwrap();

    let none = probe_blocking(&root.to_string_lossy()).unwrap();
    git_out(&root, &["init", "-q"]);
    let empty = probe_blocking(&root.to_string_lossy()).unwrap();
    make_first_commit_blocking(&args(&root, &[])).unwrap();
    git_out(
        &root,
        &[
            "remote",
            "add",
            "origin",
            "https://github.com/acme/acme-notes.git",
        ],
    );
    let tracked = probe_blocking(&root.to_string_lossy()).unwrap();
    let above = probe_blocking(&root.join("handbook").to_string_lossy()).unwrap();

    assert_eq!(none.state, ProbeState::None);
    assert_eq!(empty.state, ProbeState::Empty);
    assert_eq!(empty.commit_count, 0);
    assert_eq!(tracked.state, ProbeState::Tracked);
    assert_eq!(tracked.commit_count, 1);
    assert_eq!(
        tracked.remote_url.as_deref(),
        Some("https://github.com/acme/acme-notes.git")
    );
    assert_eq!(above.state, ProbeState::Above);
    assert_eq!(
        above.root_path.as_deref(),
        Some(root.to_string_lossy().as_ref())
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn the_probe_writes_nothing_in_the_folder() {
    let root = temp_root("probe-read-only");
    write(&root, "notes.md", "hello");

    probe_blocking(&root.to_string_lossy()).unwrap();
    first_commit_plan_blocking(&root.to_string_lossy()).unwrap();

    let names: Vec<String> = std::fs::read_dir(&root)
        .unwrap()
        .flatten()
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .collect();
    assert_eq!(names, vec!["notes.md".to_string()]);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_repository_nested_in_the_folder_stays_out_of_the_first_commit() {
    let root = acme_web("nested");
    write(&root, "widgets/index.ts", "export {};");
    git_out(&root.join("widgets"), &["init", "-q"]);

    let plan = first_commit_plan_blocking(&root.to_string_lossy()).unwrap();
    make_first_commit_blocking(&args(&root, &[])).unwrap();

    assert!(plan
        .entries
        .iter()
        .any(|entry| entry.kind == EntryKind::Repository && entry.key == "widgets/"));
    assert!(committed(&root)
        .iter()
        .all(|path| !path.starts_with("widgets")));
    std::fs::remove_dir_all(root).unwrap();
}
