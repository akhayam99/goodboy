use super::*;
use crate::util::wire_shape::assert_wire_value;
use std::path::Path;

fn folder(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "goodboy-deps-{name}-{}-{}",
        std::process::id(),
        crate::util::now_nanos()
    ));
    std::fs::create_dir_all(&dir).expect("dir");
    dir
}

fn write(dir: &Path, rel: &str, text: &str) {
    let path = dir.join(rel);
    std::fs::create_dir_all(path.parent().expect("parent")).expect("parents");
    std::fs::write(path, text).expect("write");
}

fn pnpm_project(name: &str) -> PathBuf {
    let dir = folder(name);
    write(
        &dir,
        "package.json",
        r#"{"name":"ledger-core","devDependencies":{"vitest":"1.0.0"}}"#,
    );
    write(&dir, "pnpm-lock.yaml", "lockfileVersion: '9.0'");
    dir
}

fn check(dir: &Path) -> DepsCheck {
    deps_check_blocking(dir.to_string_lossy().into_owned()).expect("a check")
}

#[test]
fn a_project_without_an_install_folder_is_missing_and_proposes_its_own_install() {
    let dir = pnpm_project("missing");

    let found = check(&dir);

    assert_eq!(found.state, DepsState::Missing);
    assert_eq!(
        found.command.as_deref(),
        Some("pnpm install --frozen-lockfile")
    );
    assert_eq!(found.source.as_deref(), Some("pnpm-lock.yaml"));
    assert!(!found.is_folder_link);
    std::fs::remove_dir_all(&dir).expect("cleanup");
}

#[test]
fn the_package_manager_comes_from_the_lockfile() {
    for (lockfile, command) in [
        ("yarn.lock", "yarn install"),
        ("package-lock.json", "npm install"),
        ("bun.lock", "bun install"),
    ] {
        let dir = folder("manager");
        write(&dir, "package.json", r#"{"dependencies":{"left":"1.0.0"}}"#);
        write(&dir, lockfile, "x");

        assert_eq!(check(&dir).command.as_deref(), Some(command));
        std::fs::remove_dir_all(&dir).expect("cleanup");
    }
}

#[test]
fn an_empty_install_folder_counts_as_missing() {
    let dir = pnpm_project("empty");
    std::fs::create_dir_all(dir.join("node_modules/.bin")).expect("dir");

    assert_eq!(check(&dir).state, DepsState::Missing);
    std::fs::remove_dir_all(&dir).expect("cleanup");
}

#[test]
fn an_installed_project_is_ready() {
    let dir = pnpm_project("ready");
    write(&dir, "node_modules/vitest/package.json", "{}");

    let found = check(&dir);

    assert_eq!(found.state, DepsState::Ready);
    assert!(found.outside.is_empty());
    std::fs::remove_dir_all(&dir).expect("cleanup");
}

#[test]
fn a_project_with_no_dependencies_or_no_lockfile_needs_nothing() {
    let bare = folder("bare");
    write(&bare, "package.json", r#"{"name":"notify-relay"}"#);
    write(&bare, "pnpm-lock.yaml", "x");
    assert_eq!(check(&bare).state, DepsState::NotApplicable);
    std::fs::remove_dir_all(&bare).expect("cleanup");

    let unlocked = folder("unlocked");
    write(
        &unlocked,
        "package.json",
        r#"{"dependencies":{"left":"1.0.0"}}"#,
    );
    assert_eq!(check(&unlocked).state, DepsState::NotApplicable);
    std::fs::remove_dir_all(&unlocked).expect("cleanup");
}

#[test]
fn a_workspace_root_without_dependencies_still_needs_an_install() {
    let dir = folder("workspace");
    write(&dir, "package.json", r#"{"name":"payments-api"}"#);
    write(&dir, "pnpm-lock.yaml", "x");
    write(&dir, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");

    assert_eq!(check(&dir).state, DepsState::Missing);
    std::fs::remove_dir_all(&dir).expect("cleanup");
}

#[test]
fn a_composer_project_looks_for_its_vendor_folder() {
    let dir = folder("composer");
    write(
        &dir,
        "composer.json",
        r#"{"require":{"acme/ledger":"1.0"}}"#,
    );
    write(&dir, "composer.lock", "{}");

    let missing = check(&dir);
    assert_eq!(missing.state, DepsState::Missing);
    assert_eq!(missing.command.as_deref(), Some("composer install"));
    assert_eq!(missing.folder.as_deref(), Some("vendor"));

    write(&dir, "vendor/autoload.php", "<?php");
    assert_eq!(check(&dir).state, DepsState::Ready);
    std::fs::remove_dir_all(&dir).expect("cleanup");
}

#[cfg(unix)]
mod links {
    use super::*;
    use std::os::unix::fs::symlink;

    #[test]
    fn an_install_folder_linked_to_another_checkout_is_outside() {
        let dir = pnpm_project("linked");
        let other = folder("main-checkout");
        write(&other, "node_modules/vitest/package.json", "{}");
        symlink(other.join("node_modules"), dir.join("node_modules")).expect("link");

        let found = check(&dir);

        assert_eq!(found.state, DepsState::Outside);
        assert!(found.is_folder_link);
        assert_eq!(found.outside, vec!["node_modules".to_string()]);
        std::fs::remove_dir_all(&dir).expect("cleanup");
        std::fs::remove_dir_all(&other).expect("cleanup");
    }

    #[test]
    fn an_install_folder_linked_inside_the_worktree_is_ready() {
        let dir = pnpm_project("inside");
        write(&dir, ".cache/modules/vitest/package.json", "{}");
        symlink(dir.join(".cache/modules"), dir.join("node_modules")).expect("link");

        assert_eq!(check(&dir).state, DepsState::Ready);
        std::fs::remove_dir_all(&dir).expect("cleanup");
    }

    #[test]
    fn a_workspace_package_linked_outside_the_worktree_is_outside() {
        let dir = pnpm_project("workspace-link");
        let other = folder("main-package");
        write(&other, "design-tokens/package.json", "{}");
        write(&dir, "libraries/design-tokens/package.json", "{}");
        write(&dir, "node_modules/vitest/package.json", "{}");
        std::fs::create_dir_all(dir.join("node_modules/@acme")).expect("scope");
        symlink(
            other.join("design-tokens"),
            dir.join("node_modules/@acme/design-tokens"),
        )
        .expect("link");
        symlink(
            "../../libraries/design-tokens",
            dir.join("node_modules/@acme/local-tokens"),
        )
        .expect("link");

        let found = check(&dir);

        assert_eq!(found.state, DepsState::Outside);
        assert!(!found.is_folder_link);
        assert_eq!(
            found.outside,
            vec!["node_modules/@acme/design-tokens".to_string()]
        );
        std::fs::remove_dir_all(&dir).expect("cleanup");
        std::fs::remove_dir_all(&other).expect("cleanup");
    }

    #[test]
    fn a_nested_package_install_linked_outside_is_found() {
        let dir = pnpm_project("nested");
        let other = folder("main-nested");
        write(&other, "node_modules/left/package.json", "{}");
        write(&dir, "node_modules/vitest/package.json", "{}");
        write(&dir, "apps/web/package.json", "{}");
        symlink(
            other.join("node_modules"),
            dir.join("apps/web/node_modules"),
        )
        .expect("link");

        let found = check(&dir);

        assert_eq!(found.state, DepsState::Outside);
        assert_eq!(found.outside, vec!["apps/web/node_modules".to_string()]);
        std::fs::remove_dir_all(&dir).expect("cleanup");
        std::fs::remove_dir_all(&other).expect("cleanup");
    }

    #[test]
    fn unlinking_removes_the_link_and_never_what_it_points_to() {
        let dir = pnpm_project("unlink");
        let other = folder("keep");
        write(&other, "node_modules/vitest/package.json", "{}");
        symlink(other.join("node_modules"), dir.join("node_modules")).expect("link");

        let removed =
            deps_unlink_blocking(dir.to_string_lossy().into_owned()).expect("unlink works");

        assert_eq!(removed, vec!["node_modules".to_string()]);
        assert!(!dir.join("node_modules").exists());
        assert!(other.join("node_modules/vitest/package.json").is_file());
        assert_eq!(check(&dir).state, DepsState::Missing);
        std::fs::remove_dir_all(&dir).expect("cleanup");
        std::fs::remove_dir_all(&other).expect("cleanup");
    }

    #[test]
    fn unlinking_leaves_a_real_install_and_inside_links_alone() {
        let dir = pnpm_project("untouched");
        write(&dir, "node_modules/vitest/package.json", "{}");

        let removed =
            deps_unlink_blocking(dir.to_string_lossy().into_owned()).expect("unlink works");

        assert!(removed.is_empty());
        assert!(dir.join("node_modules/vitest/package.json").is_file());
        std::fs::remove_dir_all(&dir).expect("cleanup");
    }
}

mod authorization {
    use super::*;

    fn git_ok(cwd: &Path, args: &[&str]) {
        git(cwd, args).unwrap_or_else(|error| panic!("git {} failed: {error}", args.join(" ")));
    }

    fn repo(name: &str) -> PathBuf {
        let root = std::fs::canonicalize(folder(name)).expect("root");
        git_ok(&root, &["init", "-b", "main"]);
        git_ok(&root, &["config", "user.email", "test@example.com"]);
        git_ok(&root, &["config", "user.name", "test"]);
        write(&root, "tracked.txt", "base\n");
        git_ok(&root, &["add", "tracked.txt"]);
        git_ok(&root, &["commit", "-m", "base"]);
        root
    }

    fn authorize(repo_path: &Path, worktree_path: &Path) -> Result<(), WorktreeError> {
        authorize_worktree_with(repo_path, worktree_path, &mut |cwd, args| git(cwd, args))
    }

    #[test]
    fn a_registered_worktree_and_the_checkout_itself_are_authorized() {
        let root = repo("authorized");
        let linked = root.join("worktrees/payments-api");
        git_ok(
            &root,
            &[
                "worktree",
                "add",
                "-b",
                "test/payments-api",
                linked.to_str().expect("path"),
            ],
        );

        assert!(authorize(&root, &linked).is_ok());
        assert!(authorize(&root, &root).is_ok());
        std::fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn a_folder_git_does_not_know_is_refused() {
        let root = repo("refused");
        let stranger = folder("northwind-stranger");
        write(&stranger, "package.json", "{}");

        assert!(authorize(&root, &stranger).is_err());
        assert!(authorize(&root, &root.join("missing")).is_err());
        assert!(authorize(&stranger, &root).is_err());
        std::fs::remove_dir_all(&root).expect("cleanup");
        std::fs::remove_dir_all(&stranger).expect("cleanup");
    }

    #[test]
    fn a_folder_inside_a_worktree_is_not_the_worktree() {
        let root = repo("nested");
        write(&root, "apps/web/package.json", "{}");

        assert!(authorize(&root, &root.join("apps/web")).is_err());
        std::fs::remove_dir_all(&root).expect("cleanup");
    }
}

#[test]
fn a_missing_folder_is_an_error() {
    assert!(deps_check_blocking("/no/such/worktree".to_string()).is_err());
    assert!(deps_unlink_blocking("/no/such/worktree".to_string()).is_err());
}

#[test]
fn the_check_keeps_its_wire_shape() {
    assert_wire_value(
        &DepsCheck {
            state: DepsState::NotApplicable,
            command: None,
            source: None,
            folder: None,
            is_folder_link: false,
            outside: Vec::new(),
        },
        serde_json::json!({
            "state": "not-applicable",
            "command": null,
            "source": null,
            "folder": null,
            "isFolderLink": false,
            "outside": [],
        }),
    );
}
