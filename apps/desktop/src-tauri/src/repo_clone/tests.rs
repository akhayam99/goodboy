use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::json;

use super::auth::{login_tool, ProbeCall, ProbeOutput};
use super::failure::{classify_failure, progress_of, FailureKind, PhaseKind};
use super::source::{parse_source, CloneHost};
use super::staging::MAX_CANCEL_MARKERS;
use super::*;
use crate::util::wire_shape::assert_wire_value;

fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-clone-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    root
}

fn succeeded(stdout: &str) -> Option<ProbeOutput> {
    Some(ProbeOutput {
        is_success: true,
        stdout: stdout.to_string(),
        stderr: String::new(),
    })
}

fn failed(stderr: &str) -> Option<ProbeOutput> {
    Some(ProbeOutput {
        is_success: false,
        stdout: String::new(),
        stderr: stderr.to_string(),
    })
}

fn source_of(raw: &str) -> CloneSource {
    parse_source(raw).unwrap()
}

#[test]
fn github_forms_parse() {
    let https = source_of("https://github.com/Northwind/ledger-core");
    assert_eq!(https.host, CloneHost::Github);
    assert_eq!(https.path, "Northwind/ledger-core");
    assert_eq!(https.name, "ledger-core");
    assert_eq!(https.remote, "https://github.com/Northwind/ledger-core.git");
    let with_suffix = source_of("https://www.github.com/Northwind/ledger-core.git/");
    assert_eq!(with_suffix.remote, https.remote);
    let ssh = source_of("git@github.com:Northwind/ledger-core.git");
    assert_eq!(ssh.path, "Northwind/ledger-core");
    assert_eq!(ssh.remote, "git@github.com:Northwind/ledger-core.git");
}

#[test]
fn gitlab_forms_parse_with_subgroups() {
    let flat = source_of("https://gitlab.com/acme/payments-api");
    assert_eq!(flat.host, CloneHost::Gitlab);
    assert_eq!(flat.name, "payments-api");
    let nested = source_of("https://gitlab.com/acme/platform/payments-api.git");
    assert_eq!(nested.path, "acme/platform/payments-api");
    assert_eq!(nested.name, "payments-api");
    let ssh = source_of("ssh://git@gitlab.com/acme/payments-api.git");
    assert_eq!(ssh.host, CloneHost::Gitlab);
}

#[test]
fn bitbucket_forms_parse() {
    let https = source_of("https://bitbucket.org/cascadia/notify-relay");
    assert_eq!(https.host, CloneHost::Bitbucket);
    assert_eq!(
        https.remote,
        "https://bitbucket.org/cascadia/notify-relay.git"
    );
    let ssh = source_of("git@bitbucket.org:cascadia/notify-relay.git");
    assert_eq!(ssh.name, "notify-relay");
    assert!(parse_source("https://bitbucket.org/cascadia/notify-relay/src/main").is_none());
}

#[test]
fn unknown_forms_are_refused() {
    for raw in [
        "",
        "ledger-core",
        "https://example.com/acme/ledger-core",
        "https://github.com/acme",
        "https://github.com/acme/ledger-core/tree/main",
        "https://github.com/-acme/ledger-core",
        "https://github.com/acme/ledger core",
        "https://github.com/acme/ledger-core?tab=readme",
        "ext::sh -c touch /tmp/x",
        "--upload-pack=touch",
        "http://github.com/acme/ledger-core",
        "file:///tmp/ledger-core",
    ] {
        assert!(parse_source(raw).is_none(), "{raw}");
    }
}

#[test]
fn github_auth_probe_reads_gh() {
    let present = login_tool(CloneHost::Github, &|call: &ProbeCall| {
        assert_eq!(call.binary, "gh");
        assert_eq!(call.args, ["auth", "status", "--hostname", "github.com"]);
        succeeded("Logged in")
    });
    assert_eq!(present, Some("gh"));
    let absent = login_tool(CloneHost::Github, &|_: &ProbeCall| failed("not logged in"));
    assert_eq!(absent, None);
    let missing_cli = login_tool(CloneHost::Github, &|_: &ProbeCall| None);
    assert_eq!(missing_cli, None);
}

#[test]
fn gitlab_auth_probe_reads_glab() {
    let present = login_tool(CloneHost::Gitlab, &|call: &ProbeCall| {
        assert_eq!(call.binary, "glab");
        assert_eq!(call.args, ["auth", "status", "--hostname", "gitlab.com"]);
        succeeded("Logged in")
    });
    assert_eq!(present, Some("glab"));
    let absent = login_tool(CloneHost::Gitlab, &|_: &ProbeCall| failed("no token"));
    assert_eq!(absent, None);
}

#[test]
fn bitbucket_auth_probe_reads_git_credentials() {
    let present = login_tool(CloneHost::Bitbucket, &|call: &ProbeCall| {
        assert_eq!(call.binary, "git");
        assert_eq!(call.args, ["credential", "fill"]);
        assert_eq!(
            call.input.as_deref(),
            Some("protocol=https\nhost=bitbucket.org\n\n")
        );
        succeeded("protocol=https\nhost=bitbucket.org\nusername=ak\npassword=secret\n")
    });
    assert_eq!(present, Some("git"));
    let without_password = login_tool(CloneHost::Bitbucket, &|_: &ProbeCall| {
        succeeded("protocol=https\nhost=bitbucket.org\n")
    });
    assert_eq!(without_password, None);
    let absent = login_tool(CloneHost::Bitbucket, &|_: &ProbeCall| {
        failed("terminal prompts disabled")
    });
    assert_eq!(absent, None);
}

#[test]
fn public_repository_clones_without_login() {
    let root = temp_root("public");
    let source = source_of("https://github.com/Northwind/ledger-core");
    let route = probe_route(&source, &root.join("ledger-core"), &|call: &ProbeCall| {
        assert_eq!(call.binary, "git");
        succeeded("abc\tHEAD")
    });
    assert!(matches!(route, Ok(CloneRoute::Git)));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn private_repository_uses_the_host_cli_login() {
    let root = temp_root("private");
    let refused = |call: &ProbeCall| match call.binary {
        "git" => failed("fatal: could not read Username for 'https://github.com'"),
        _ => succeeded("Logged in"),
    };
    let github = probe_route(
        &source_of("https://github.com/Northwind/ledger-core"),
        &root.join("a"),
        &refused,
    );
    assert!(matches!(github, Ok(CloneRoute::Gh)));
    let gitlab = probe_route(
        &source_of("https://gitlab.com/acme/payments-api"),
        &root.join("b"),
        &refused,
    );
    assert!(matches!(gitlab, Ok(CloneRoute::Glab)));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn private_repository_without_login_is_auth_refused() {
    let root = temp_root("no-login");
    let refused = |call: &ProbeCall| match call.binary {
        "git" if call.args.first().map(String::as_str) == Some("ls-remote") => {
            failed("remote: Repository not found.")
        }
        _ => failed("not logged in"),
    };
    for (raw, label) in [
        ("https://github.com/Northwind/ledger-core", "GitHub"),
        ("https://gitlab.com/acme/payments-api", "GitLab"),
        ("https://bitbucket.org/cascadia/notify-relay", "Bitbucket"),
    ] {
        let result = probe_route(&source_of(raw), &root.join("dest"), &refused);
        match result {
            Err(CloneError::AuthRefused { host }) => assert_eq!(host, label),
            other => panic!("{other:?}"),
        }
    }
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn unreachable_host_is_a_network_failure() {
    let root = temp_root("network");
    let result = probe_route(
        &source_of("https://github.com/Northwind/ledger-core"),
        &root.join("dest"),
        &|_: &ProbeCall| failed("fatal: unable to access: Could not resolve host: github.com"),
    );
    assert!(matches!(result, Err(CloneError::Network)));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_destination_with_files_is_never_probed_or_overwritten() {
    let root = temp_root("occupied");
    let dest = root.join("ledger-core");
    std::fs::create_dir_all(&dest).unwrap();
    std::fs::write(dest.join("notes.md"), "keep").unwrap();
    let result = probe_route(
        &source_of("https://github.com/Northwind/ledger-core"),
        &dest,
        &|_: &ProbeCall| panic!("the host must not be asked"),
    );
    assert!(matches!(result, Err(CloneError::DestinationNotEmpty)));
    assert_eq!(
        std::fs::read_to_string(dest.join("notes.md")).unwrap(),
        "keep"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_file_or_relative_destination_is_refused() {
    let root = temp_root("not-a-folder");
    let file = root.join("file");
    std::fs::write(&file, "x").unwrap();
    assert!(matches!(
        check_destination(&file),
        Err(CloneError::DestinationNotAFolder)
    ));
    assert!(matches!(
        check_destination(Path::new("relative/path")),
        Err(CloneError::DestinationNotAFolder)
    ));
    assert!(check_destination(&root.join("fresh")).is_ok());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn another_name_is_offered_beside_a_taken_one() {
    let root = temp_root("free");
    let taken = root.join("ledger-core");
    std::fs::create_dir_all(&taken).unwrap();
    std::fs::write(taken.join("a"), "x").unwrap();
    std::fs::create_dir_all(root.join("ledger-core-2")).unwrap();
    std::fs::write(root.join("ledger-core-2").join("a"), "x").unwrap();
    assert_eq!(free_destination(&taken), Some(root.join("ledger-core-3")));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn failure_markers_classify() {
    assert_eq!(
        classify_failure("fatal: unable to access 'x': Could not resolve host: github.com"),
        FailureKind::Network
    );
    assert_eq!(
        classify_failure("remote: fatal: Authentication failed for 'https://x'"),
        FailureKind::AuthRefused
    );
    assert_eq!(
        classify_failure("fatal: could not read Username: terminal prompts disabled"),
        FailureKind::AuthRefused
    );
    assert_eq!(
        classify_failure("remote: Repository not found."),
        FailureKind::NotFound
    );
    assert_eq!(classify_failure("fatal: something odd"), FailureKind::Other);
}

#[test]
fn progress_lines_parse() {
    let receiving = progress_of("Receiving objects:  45% (45/100), 1.2 MiB | 2 MiB/s").unwrap();
    assert_eq!(receiving.phase, PhaseKind::Receiving);
    assert_eq!(receiving.percent, 45);
    let remote = progress_of("remote: Counting objects: 100% (12/12), done.").unwrap();
    assert_eq!(remote.phase, PhaseKind::Counting);
    assert_eq!(remote.percent, 100);
    assert!(progress_of("Cloning into 'ledger-core'...").is_none());
    assert!(progress_of("fatal: repository not found").is_none());
}

#[test]
fn progress_events_carry_a_typed_phase_never_raw_text() {
    let secret = progress_of("access_token=ghp_Northwind0123456789: 50%").unwrap();
    let payload = ProgressPayload {
        request_id: "r".to_string(),
        phase: secret.phase,
        percent: secret.percent,
    };
    let wire = serde_json::to_string(&payload).unwrap();
    assert!(!wire.contains("ghp_"), "{wire}");
    assert!(!wire.contains("access_token"), "{wire}");
    assert!(wire.contains("\"phase\":\"Working\""), "{wire}");
}

#[test]
fn clone_argv_names_its_target() {
    let source = source_of("https://gitlab.com/acme/platform/payments-api");
    let dest = Path::new("/mock/Developer/payments-api");
    let argv = |route| -> Vec<String> {
        let command = clone_command(&source, route, dest);
        std::iter::once(command.get_program())
            .chain(command.get_args())
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect()
    };
    assert_eq!(
        argv(CloneRoute::Git),
        [
            "git",
            "clone",
            "--progress",
            "--",
            "https://gitlab.com/acme/platform/payments-api.git",
            "/mock/Developer/payments-api"
        ]
    );
    assert_eq!(
        argv(CloneRoute::Glab),
        [
            "glab",
            "repo",
            "clone",
            "https://gitlab.com/acme/platform/payments-api.git",
            "/mock/Developer/payments-api",
            "--",
            "--progress"
        ]
    );
    assert_eq!(argv(CloneRoute::Gh)[0], "gh");
}

fn argv_of(command: &Command) -> Vec<String> {
    std::iter::once(command.get_program())
        .chain(command.get_args())
        .map(|arg| arg.to_string_lossy().into_owned())
        .collect()
}

fn env_of(command: &Command, key: &str) -> Option<String> {
    command
        .get_envs()
        .find(|(name, _)| *name == key)
        .and_then(|(_, value)| value.map(|value| value.to_string_lossy().into_owned()))
}

const HOST_CASES: [(&str, &str, CloneRoute); 3] = [
    (
        "https://github.com/Northwind/ledger-core",
        "github.com",
        CloneRoute::Gh,
    ),
    (
        "https://gitlab.com/acme/payments-api",
        "gitlab.com",
        CloneRoute::Glab,
    ),
    (
        "https://bitbucket.org/cascadia/notify-relay",
        "bitbucket.org",
        CloneRoute::Git,
    ),
];

#[test]
fn every_probe_command_names_the_validated_host() {
    for (raw, domain, _) in HOST_CASES {
        let source = source_of(raw);
        let probe = ls_remote_call(&source);
        assert!(
            probe.args.iter().any(|arg| arg.contains(domain)),
            "{raw}: {:?}",
            probe.args
        );
        let seen = std::cell::RefCell::new(Vec::new());
        let root = temp_root("probe-host");
        let _ = probe_route(&source, &root.join("dest"), &|call: &ProbeCall| {
            seen.borrow_mut().push(call.clone());
            failed("remote: Repository not found.")
        });
        std::fs::remove_dir_all(root).unwrap();
        let calls = seen.borrow();
        assert!(calls.len() >= 2, "{raw}");
        let login = &calls[1];
        let names_host = login.args.iter().any(|arg| arg == domain)
            || login
                .input
                .as_deref()
                .is_some_and(|input| input.contains(domain));
        assert!(names_host, "{raw}: {login:?}");
    }
}

#[test]
fn every_route_prints_english_whatever_the_user_locale() {
    for (raw, _, route) in HOST_CASES {
        let source = source_of(raw);
        let dest = Path::new("/mock/Developer/target");
        for route in [route, CloneRoute::Git] {
            let command = clone_command(&source, route, dest);
            assert_eq!(env_of(&command, "LC_ALL").as_deref(), Some("C"), "{raw}");
            assert!(
                command
                    .get_envs()
                    .any(|(name, value)| name == "LANGUAGE" && value.is_none()),
                "{raw}: LANGUAGE kept"
            );
        }
        let git = git_probe(&ls_remote_call(&source)).into_command();
        assert_eq!(env_of(&git, "LC_ALL").as_deref(), Some("C"), "{raw}");
        let cli = cli_probe_command(&ProbeCall {
            binary: "gh",
            args: vec!["auth".to_string(), "status".to_string()],
            input: None,
        });
        assert_eq!(env_of(&cli, "LC_ALL").as_deref(), Some("C"), "{raw}");
    }
}

#[test]
fn every_clone_command_names_the_validated_host() {
    for (raw, domain, route) in HOST_CASES {
        let source = source_of(raw);
        let dest = Path::new("/mock/Developer/target");
        let git = clone_command(&source, CloneRoute::Git, dest);
        assert!(
            argv_of(&git).iter().any(|arg| arg.contains(domain)),
            "{raw}"
        );
        if route == CloneRoute::Git {
            continue;
        }
        let cli = clone_command(&source, route, dest);
        let argv = argv_of(&cli);
        assert!(
            argv.contains(&format!("https://{domain}/{}.git", source.path)),
            "{raw}: {argv:?}"
        );
        let variable = cli_host_variable(route);
        assert_eq!(env_of(&cli, variable).as_deref(), Some(domain), "{raw}");
        assert!(!argv.contains(&source.path), "{raw}: bare path in {argv:?}");
    }
}

#[test]
fn ssh_remotes_keep_the_validated_host() {
    let scp = source_of("git@www.github.com:Northwind/ledger-core");
    assert_eq!(scp.remote, "git@github.com:Northwind/ledger-core.git");
    let url = source_of("ssh://git@www.gitlab.com/acme/payments-api");
    assert_eq!(url.remote, "ssh://git@gitlab.com/acme/payments-api.git");
    assert_eq!(url.https_remote, "https://gitlab.com/acme/payments-api.git");
}

fn script(body: &str, dest: &Path) -> Command {
    let mut command = Command::new("sh");
    command.arg("-c").arg(body).arg(dest);
    command
}

fn admit_now(
    registry: &CloneRegistry,
    request_id: &str,
    dest: &Path,
) -> Result<Staged, CloneError> {
    let generation = lock_or_recover(&registry.admission).generation();
    admit(registry, request_id, dest, generation)
}

fn stage(registry: &CloneRegistry, request_id: &str, dest: &Path) -> Staged {
    admit_now(registry, request_id, dest).unwrap()
}

fn run(
    registry: &CloneRegistry,
    request_id: &str,
    command: Command,
    staged: &Staged,
) -> Result<(), CloneError> {
    run_clone(
        RunParams {
            registry,
            request_id,
            host: CloneHost::Github,
            command,
            staged,
        },
        &|_| {},
    )
}

fn write_clone(staged: &Staged) -> Command {
    script("echo content > \"$0/file\"; exit 0", &staged.path)
}

#[cfg(unix)]
#[test]
fn a_clone_is_staged_then_moved_into_the_destination() {
    let root = temp_root("publish");
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    let staged = stage(&registry, "req-ok", &dest);
    let name = staged
        .path
        .file_name()
        .unwrap()
        .to_string_lossy()
        .into_owned();
    assert_eq!(name, ".ledger-core.clone-req-ok");
    assert_eq!(
        staged.path.parent(),
        Some(root.canonicalize().unwrap().as_path())
    );
    assert!(!dest.exists());
    let result = run(&registry, "req-ok", write_clone(&staged), &staged);
    assert!(result.is_ok(), "{result:?}");
    assert_eq!(
        std::fs::read_to_string(dest.join("file")).unwrap(),
        "content\n"
    );
    assert!(!staged.path.exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn network_failure_removes_the_staging_folder() {
    let root = temp_root("net-fail");
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    let staged = stage(&registry, "req-net", &dest);
    let command = script(
        "echo part > \"$0/file\"; echo 'fatal: unable to access: Could not resolve host: github.com' >&2; exit 128",
        &staged.path,
    );
    let result = run(&registry, "req-net", command, &staged);
    assert!(matches!(result, Err(CloneError::Network)));
    assert!(!dest.exists());
    assert!(!staged.path.exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn refused_login_is_reported_and_cleaned_up() {
    let root = temp_root("auth-fail");
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    let staged = stage(&registry, "req-auth", &dest);
    let command = script(
        "echo 'fatal: Authentication failed for x' >&2; exit 128",
        &staged.path,
    );
    let result = run(&registry, "req-auth", command, &staged);
    assert!(matches!(
        result,
        Err(CloneError::AuthRefused { host: "GitHub" })
    ));
    assert!(!dest.exists());
    assert!(!staged.path.exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn cancel_mid_clone_removes_the_staging_folder() {
    let root = temp_root("cancel");
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    let staged = stage(&registry, "req-cancel", &dest);
    let command = script("echo part > \"$0/file\"; sleep 30", &staged.path);
    let result = std::thread::scope(|scope| {
        let worker = scope.spawn(|| run(&registry, "req-cancel", command, &staged));
        loop {
            let is_live = lock_or_recover(&registry.live).contains_key("req-cancel");
            if is_live && staged.path.join("file").exists() {
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        cancel(&registry, "req-cancel");
        worker.join().unwrap()
    });
    assert!(matches!(result, Err(CloneError::Cancelled)));
    assert!(!dest.exists());
    assert!(!staged.path.exists());
    assert_eq!(lock_or_recover(&registry.admission).marker_count(), 0);
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn a_cancel_before_admission_is_remembered_and_honoured() {
    let root = temp_root("cancel-early");
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    cancel(&registry, "req-early");
    let result = admit_now(&registry, "req-early", &dest);
    assert!(matches!(result, Err(CloneError::Cancelled)));
    assert!(std::fs::read_dir(&root).unwrap().next().is_none());
    assert_eq!(lock_or_recover(&registry.admission).marker_count(), 0);
    assert!(admit_now(&registry, "req-early", &dest).is_ok());
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn a_cancel_after_admission_stops_the_spawn_and_removes_staging() {
    let root = temp_root("cancel-staged");
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    let staged = stage(&registry, "req-staged", &dest);
    cancel(&registry, "req-staged");
    let command = script("echo ran > \"$0/file\"; sleep 30", &staged.path);
    let result = run(&registry, "req-staged", command, &staged);
    assert!(matches!(result, Err(CloneError::Cancelled)));
    assert!(!staged.path.exists());
    assert!(!dest.exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn a_failed_spawn_removes_the_staging_folder() {
    let root = temp_root("spawn-fail");
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    let staged = stage(&registry, "req-nospawn", &dest);
    assert!(staged.path.is_dir());
    let result = run(
        &registry,
        "req-nospawn",
        Command::new("/nonexistent/goodboy-git"),
        &staged,
    );
    assert!(matches!(result, Err(CloneError::Io(_))));
    assert!(!staged.path.exists());
    assert!(!dest.exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn an_existing_folder_empty_or_not_is_never_accepted() {
    let root = temp_root("existing");
    let registry = CloneRegistry::new();
    let empty = root.join("empty");
    std::fs::create_dir_all(&empty).unwrap();
    assert!(matches!(
        admit_now(&registry, "r1", &empty),
        Err(CloneError::DestinationNotEmpty)
    ));
    assert!(empty.is_dir());
    assert!(std::fs::read_dir(&empty).unwrap().next().is_none());
    let full = root.join("full");
    std::fs::create_dir_all(&full).unwrap();
    std::fs::write(full.join("notes.md"), "keep").unwrap();
    assert!(matches!(
        admit_now(&registry, "r2", &full),
        Err(CloneError::DestinationNotEmpty)
    ));
    assert_eq!(
        std::fs::read_to_string(full.join("notes.md")).unwrap(),
        "keep"
    );
    assert_eq!(std::fs::read_dir(&root).unwrap().count(), 2);
    assert_eq!(free_destination(&empty), Some(root.join("empty-2")));
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn a_symlink_destination_is_taken_even_when_dangling() {
    let root = temp_root("symlink-dest");
    let target = root.join("elsewhere");
    let link = root.join("ledger-core");
    std::os::unix::fs::symlink(&target, &link).unwrap();
    let registry = CloneRegistry::new();
    assert!(matches!(
        admit_now(&registry, "r1", &link),
        Err(CloneError::DestinationNotEmpty)
    ));
    assert!(!target.exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_foreign_folder_with_the_staging_name_is_never_adopted_or_removed() {
    let root = temp_root("staging-collision");
    let dest = root.join("ledger-core");
    let foreign = root.join(".ledger-core.clone-r1");
    std::fs::create_dir_all(&foreign).unwrap();
    std::fs::write(foreign.join("mine"), "keep").unwrap();
    let registry = CloneRegistry::new();
    assert!(matches!(
        admit_now(&registry, "r1", &dest),
        Err(CloneError::Io(_))
    ));
    assert_eq!(
        std::fs::read_to_string(foreign.join("mine")).unwrap(),
        "keep"
    );
    assert!(lock_or_recover(&registry.admission).close().is_empty());
    assert_eq!(
        std::fs::read_to_string(foreign.join("mine")).unwrap(),
        "keep"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn a_destination_created_during_the_clone_is_never_replaced_or_emptied() {
    let root = temp_root("raced");
    let registry = CloneRegistry::new();
    let filled = root.join("filled");
    let first = stage(&registry, "req-a", &filled);
    std::fs::create_dir_all(&filled).unwrap();
    std::fs::write(filled.join("mine"), "keep").unwrap();
    let result = run(&registry, "req-a", write_clone(&first), &first);
    assert!(matches!(result, Err(CloneError::DestinationNotEmpty)));
    assert_eq!(
        std::fs::read_to_string(filled.join("mine")).unwrap(),
        "keep"
    );
    assert!(!first.path.exists());
    let hollow = root.join("hollow");
    let second = stage(&registry, "req-b", &hollow);
    std::fs::create_dir_all(&hollow).unwrap();
    let result = run(&registry, "req-b", write_clone(&second), &second);
    assert!(matches!(result, Err(CloneError::DestinationNotEmpty)));
    assert!(hollow.is_dir());
    assert!(std::fs::read_dir(&hollow).unwrap().next().is_none());
    assert!(!second.path.exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn two_requests_for_one_destination_never_touch_each_other() {
    let root = temp_root("two-requests");
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    let first = stage(&registry, "req-1", &dest);
    let second = stage(&registry, "req-2", &dest);
    assert_ne!(first.path, second.path);
    let result = run(&registry, "req-1", write_clone(&first), &first);
    assert!(result.is_ok(), "{result:?}");
    let result = run(&registry, "req-2", write_clone(&second), &second);
    assert!(matches!(result, Err(CloneError::DestinationNotEmpty)));
    assert_eq!(
        std::fs::read_to_string(dest.join("file")).unwrap(),
        "content\n"
    );
    assert!(!second.path.exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn an_exclusive_move_never_replaces_an_existing_destination() {
    let root = temp_root("exclusive");
    let from = root.join("from");
    let to = root.join("to");
    std::fs::create_dir_all(&from).unwrap();
    std::fs::write(from.join("file"), "new").unwrap();
    std::fs::create_dir_all(&to).unwrap();
    let error = move_exclusive(&from, &to).unwrap_err();
    assert_eq!(error.kind(), std::io::ErrorKind::AlreadyExists);
    assert!(std::fs::read_dir(&to).unwrap().next().is_none());
    assert_eq!(std::fs::read_to_string(from.join("file")).unwrap(), "new");
    std::fs::remove_dir(&to).unwrap();
    move_exclusive(&from, &to).unwrap();
    assert_eq!(std::fs::read_to_string(to.join("file")).unwrap(), "new");
    assert!(!from.exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn discarding_never_follows_a_symlink_at_the_top() {
    let root = temp_root("discard-link");
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    let staged = stage(&registry, "req-top", &dest);
    let precious = root.join("precious");
    std::fs::create_dir_all(&precious).unwrap();
    std::fs::write(precious.join("mine"), "keep").unwrap();
    std::fs::remove_dir(&staged.path).unwrap();
    std::os::unix::fs::symlink(&precious, &staged.path).unwrap();
    assert!(!discard_staging(&staged));
    assert_eq!(
        std::fs::read_to_string(precious.join("mine")).unwrap(),
        "keep"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
fn swap_parent_for_decoy(root: &Path, staged: &Staged) -> PathBuf {
    let decoy = root.join("decoy");
    let decoy_staging = decoy.join(staged.path.file_name().unwrap());
    std::fs::create_dir_all(&decoy_staging).unwrap();
    std::fs::write(decoy_staging.join("mine"), "keep").unwrap();
    let moved = root.join("parent-moved");
    std::fs::rename(&staged.parent, &moved).unwrap();
    std::os::unix::fs::symlink(&decoy, &staged.parent).unwrap();
    decoy_staging
}

#[cfg(unix)]
#[test]
fn discarding_never_follows_a_replaced_ancestor() {
    let root = temp_root("discard-ancestor");
    let parent = root.join("projects");
    let dest = parent.join("ledger-core");
    let registry = CloneRegistry::new();
    let staged = stage(&registry, "req-anc", &dest);
    let decoy_staging = swap_parent_for_decoy(&root, &staged);
    assert!(!discard_staging(&staged));
    assert_eq!(
        std::fs::read_to_string(decoy_staging.join("mine")).unwrap(),
        "keep"
    );
    assert!(root
        .join("parent-moved")
        .join(staged.path.file_name().unwrap())
        .is_dir());
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn discarding_leaves_a_folder_that_is_no_longer_the_one_created() {
    let root = temp_root("discard-identity");
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    let staged = stage(&registry, "req-id", &dest);
    std::fs::remove_dir(&staged.path).unwrap();
    std::fs::create_dir(&staged.path).unwrap();
    std::fs::write(staged.path.join("mine"), "keep").unwrap();
    assert!(!discard_staging(&staged));
    assert!(staged.path.join("mine").exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn publishing_never_moves_through_a_replaced_ancestor() {
    let root = temp_root("publish-ancestor");
    let parent = root.join("projects");
    let dest = parent.join("ledger-core");
    let registry = CloneRegistry::new();
    let staged = stage(&registry, "req-pub", &dest);
    std::fs::write(staged.path.join("file"), "content").unwrap();
    let decoy_staging = swap_parent_for_decoy(&root, &staged);
    let result = run(
        &registry,
        "req-pub",
        script("exit 0", &staged.path),
        &staged,
    );
    assert!(matches!(result, Err(CloneError::Failed(_))), "{result:?}");
    let decoy = decoy_staging.parent().unwrap();
    assert!(!decoy.join("ledger-core").exists());
    assert_eq!(
        std::fs::read_to_string(decoy_staging.join("mine")).unwrap(),
        "keep"
    );
    assert_eq!(
        std::fs::read_to_string(
            root.join("parent-moved")
                .join(staged.path.file_name().unwrap())
                .join("file")
        )
        .unwrap(),
        "content"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn the_published_path_is_the_one_the_clone_landed_in() {
    let root = temp_root("published");
    let real = root.join("real");
    let other = root.join("other");
    std::fs::create_dir_all(&real).unwrap();
    std::fs::create_dir_all(&other).unwrap();
    let link = root.join("link");
    std::os::unix::fs::symlink(&real, &link).unwrap();
    let registry = CloneRegistry::new();
    let staged = stage(&registry, "req-path", &link.join("ledger-core"));
    let result = run(&registry, "req-path", write_clone(&staged), &staged);
    assert!(result.is_ok(), "{result:?}");
    std::fs::remove_file(&link).unwrap();
    std::os::unix::fs::symlink(&other, &link).unwrap();
    let done = done_of(&staged);
    assert_eq!(
        Path::new(&done.path),
        real.canonicalize().unwrap().join("ledger-core")
    );
    assert!(Path::new(&done.path).join("file").exists());
    assert!(!other.join("ledger-core").exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn unwinding_runs_cleanup_and_deregisters_the_child() {
    let root = temp_root("unwind");
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    let staged = stage(&registry, "req-panic", &dest);
    let live = crate::live_child::test_support::register_sleeping(&registry.live, "req-panic");
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _guard = StagingGuard::new(&registry, "req-panic", &staged);
        panic!("reader thread refused");
    }));
    assert!(outcome.is_err());
    assert!(!staged.path.exists());
    assert!(lock_or_recover(&registry.live).is_empty());
    assert!(!lock_or_recover(&registry.admission).has_staging("req-panic"));
    let exited = wait_and_remove(&live, &registry.live, "req-panic");
    assert_ne!(exited.code, Some(0));
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn shutdown_kills_running_clones_and_removes_their_staging_folders() {
    let root = temp_root("shutdown");
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    let staged = stage(&registry, "req-exit", &dest);
    let command = script("echo part > \"$0/file\"; sleep 30", &staged.path);
    let result = std::thread::scope(|scope| {
        let worker = scope.spawn(|| run(&registry, "req-exit", command, &staged));
        loop {
            let is_live = lock_or_recover(&registry.live).contains_key("req-exit");
            if is_live && staged.path.join("file").exists() {
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        shutdown(&registry);
        worker.join().unwrap()
    });
    assert!(matches!(result, Err(CloneError::Cancelled)));
    assert!(!staged.path.exists());
    assert!(!dest.exists());
    assert!(lock_or_recover(&registry.live).is_empty());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn shutdown_closes_admission_before_it_cleans() {
    let root = temp_root("closed");
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    shutdown(&registry);
    assert!(matches!(
        admit_now(&registry, "late", &dest),
        Err(CloneError::Cancelled)
    ));
    assert!(std::fs::read_dir(&root).unwrap().next().is_none());
    reopen(&registry);
    assert!(admit_now(&registry, "after-wipe", &dest).is_ok());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_call_queued_before_a_wipe_is_refused_after_admission_reopens() {
    let root = temp_root("queued");
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    let generation = lock_or_recover(&registry.admission).generation();
    shutdown(&registry);
    reopen(&registry);
    let result = admit(&registry, "queued-before", &dest, generation);
    assert!(matches!(result, Err(CloneError::Cancelled)));
    assert!(std::fs::read_dir(&root).unwrap().next().is_none());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn cancel_markers_are_bounded_and_drop_the_oldest() {
    let registry = CloneRegistry::new();
    for index in 0..(MAX_CANCEL_MARKERS + 8) {
        cancel(&registry, &format!("req-{index}"));
    }
    cancel(&registry, "req-39");
    let admission = lock_or_recover(&registry.admission);
    assert_eq!(admission.marker_count(), MAX_CANCEL_MARKERS);
    assert!(!admission.is_cancelled("req-0"));
    assert!(!admission.is_cancelled("req-7"));
    assert!(admission.is_cancelled("req-8"));
    assert!(admission.is_cancelled("req-39"));
}

#[test]
fn a_repository_with_no_refs_is_reachable() {
    let root = temp_root("empty-repo");
    let source = source_of("https://github.com/Northwind/ledger-core");
    let route = probe_route(&source, &root.join("dest"), &|call: &ProbeCall| {
        assert_eq!(call.binary, "git");
        assert!(!call.args.iter().any(|arg| arg == "--exit-code"));
        succeeded("")
    });
    assert!(matches!(route, Ok(CloneRoute::Git)));
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn the_real_probe_reaches_an_empty_repository() {
    let root = temp_root("empty-bare");
    let bare = root.join("bare.git");
    let status = Command::new("git")
        .args(["init", "--bare", "-q"])
        .arg(&bare)
        .status()
        .unwrap();
    assert!(status.success());
    let source = CloneSource {
        host: CloneHost::Github,
        path: "Northwind/ledger-core".to_string(),
        name: "ledger-core".to_string(),
        remote: bare.to_string_lossy().into_owned(),
        https_remote: String::new(),
    };
    let route = probe_route(&source, &root.join("dest"), &system_runner);
    assert!(matches!(route, Ok(CloneRoute::Git)), "{route:?}");
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn a_real_clone_succeeds_and_reports_progress() {
    let root = temp_root("real");
    let origin = root.join("origin");
    std::fs::create_dir_all(&origin).unwrap();
    let git = |cwd: &Path, args: &[&str]| {
        let status = Command::new("git")
            .args(["-c", "user.name=t", "-c", "user.email=t@example.com"])
            .args(args)
            .current_dir(cwd)
            .status()
            .unwrap();
        assert!(status.success(), "git {args:?}");
    };
    git(&origin, &["init", "-b", "main"]);
    std::fs::write(origin.join("README.md"), "# ledger-core").unwrap();
    git(&origin, &["add", "."]);
    git(&origin, &["commit", "-m", "init"]);
    let dest = root.join("ledger-core");
    let registry = CloneRegistry::new();
    let staged = stage(&registry, "req-real", &dest);
    let mut command = Command::new("git");
    command
        .args(["clone", "--progress", "--"])
        .arg(&origin)
        .arg(&staged.path);
    let result = run(&registry, "req-real", command, &staged);
    assert!(result.is_ok(), "{result:?}");
    assert!(dest.join("README.md").exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn wire_shape_clone_results() {
    assert_wire_value(
        &CloneProbe {
            route: CloneRoute::Gh,
            host: "github",
            name: "ledger-core".to_string(),
        },
        json!({ "route": "gh", "host": "github", "name": "ledger-core" }),
    );
    assert_wire_value(
        &CloneDone {
            path: "/mock/Developer/ledger-core".to_string(),
        },
        json!({ "path": "/mock/Developer/ledger-core" }),
    );
    assert_wire_value(
        &CloneError::AuthRefused { host: "GitLab" },
        json!({ "kind": "auth_refused", "message": "no login for GitLab is usable here" }),
    );
    assert_wire_value(
        &ProgressPayload {
            request_id: "r".to_string(),
            phase: PhaseKind::Receiving,
            percent: 5,
        },
        json!({ "requestId": "r", "phase": "Receiving objects", "percent": 5 }),
    );
}
