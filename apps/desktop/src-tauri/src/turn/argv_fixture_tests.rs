use std::path::PathBuf;
use std::process::Command;

use super::fake_cli_tests::{Run, PROMPT};
use super::*;

const PROVIDERS: [(&str, &str); 6] = [
    ("anthropic", "claude"),
    ("cursor", "cursor-agent"),
    ("gemini", "agy"),
    ("copilot", "copilot"),
    ("codex", "codex"),
    ("opencode", "opencode"),
];

const RECORD_ENV: &str = "GOODBOY_RECORD_ARGV";
const STAMP_PREFIX: &str = "cli-version: ";

struct Scenario {
    name: &'static str,
    permission_mode: &'static str,
    resume_session_id: Option<&'static str>,
    system_prompt: Option<&'static str>,
    effort: Option<&'static str>,
    allowed_tools: &'static [&'static str],
    disallowed_tools: &'static [&'static str],
}

const SCENARIOS: [Scenario; 3] = [
    Scenario {
        name: "simple-turn",
        permission_mode: "default",
        resume_session_id: None,
        system_prompt: None,
        effort: None,
        allowed_tools: &[],
        disallowed_tools: &[],
    },
    Scenario {
        name: "resume",
        permission_mode: "default",
        resume_session_id: Some("session-ledger-core-1"),
        system_prompt: None,
        effort: None,
        allowed_tools: &[],
        disallowed_tools: &[],
    },
    Scenario {
        name: "write-access-with-tools",
        permission_mode: "bypassPermissions",
        resume_session_id: None,
        system_prompt: Some("you review the Harborline queue"),
        effort: Some("high"),
        allowed_tools: &["Read", "Edit"],
        disallowed_tools: &["WebFetch"],
    },
];

fn fixture_path(provider_id: &str, scenario: &Scenario) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/fake-cli/argv")
        .join(format!("{provider_id}.{}.txt", scenario.name))
}

fn fake_version(run: &Run, binary: &str) -> String {
    let output = Command::new(run.fake.binary(binary))
        .arg("--version")
        .output()
        .expect("the fake cli prints its version");
    String::from_utf8(output.stdout)
        .expect("the version is utf8")
        .trim()
        .to_string()
}

fn run_scenario(binary: &str, scenario: &Scenario) -> (Run, Vec<String>) {
    let run = Run::new("ok");
    let binary_path = run.fake.binary(binary);
    let work_dir = run.fake.work_dir();
    let allowed: Vec<String> = scenario
        .allowed_tools
        .iter()
        .map(|tool| tool.to_string())
        .collect();
    let disallowed: Vec<String> = scenario
        .disallowed_tools
        .iter()
        .map(|tool| tool.to_string())
        .collect();
    let empty: Vec<String> = Vec::new();
    let args = SpawnOneArgs {
        run_id: "run-1",
        binary: &binary_path,
        model: "fake-model",
        working_dir: &work_dir,
        writable_roots: &empty,
        query_socket_directory: None,
        prompt: PROMPT,
        permission_mode: scenario.permission_mode,
        allowed_tools: &allowed,
        disallowed_tools: &disallowed,
        resume_session_id: scenario.resume_session_id,
        system_prompt: scenario.system_prompt,
        effort: scenario.effort,
        api_key_env: None,
        credential_id: None,
        workspace_id: None,
        session_id: None,
        mount_id: None,
        cursor_max_mode: false,
        writer_lease: None,
        write_set_lease: None,
        confined_role: None,
        blocks_push: true,
        is_auto_child: false,
        excludes_tmp: false,
    };
    spawn_one(
        &run.recorder,
        &run.registry.0,
        &run.registry.1,
        &run.leases.0,
        args,
    )
    .expect("the fake cli spawns");
    run.turn_events_until_end();
    let recorded = run
        .fake
        .work_file("fake-cli-argv.txt")
        .expect("the fake cli records its argv");
    let argv = recorded
        .lines()
        .map(|line| {
            if line == PROMPT {
                return "{prompt}".to_string();
            }
            line.replace(&work_dir, "{work_dir}")
        })
        .collect();
    (run, argv)
}

fn render(version: &str, argv: &[String]) -> String {
    let mut text = format!("{STAMP_PREFIX}{version}\n");
    for arg in argv {
        text.push_str(arg);
        text.push('\n');
    }
    text
}

#[test]
fn every_provider_and_scenario_spawns_the_argv_its_fixture_expects() {
    let is_recording = std::env::var_os(RECORD_ENV).is_some();
    assert!(
        !is_recording || std::env::var_os("CI").is_none(),
        "{RECORD_ENV} is a hand-run recorder and never runs in CI"
    );
    let mut failures: Vec<String> = Vec::new();
    for (provider_id, binary) in PROVIDERS {
        for scenario in &SCENARIOS {
            let cell = format!("{provider_id} {}", scenario.name);
            let (run, argv) = run_scenario(binary, scenario);
            let version = fake_version(&run, binary);
            let path = fixture_path(provider_id, scenario);
            if is_recording {
                std::fs::create_dir_all(path.parent().unwrap()).expect("create the argv dir");
                std::fs::write(&path, render(&version, &argv)).expect("write the argv fixture");
                continue;
            }
            let Ok(expected) = std::fs::read_to_string(&path) else {
                failures.push(format!("{cell}: no fixture at {}", path.display()));
                continue;
            };
            let stamp = expected
                .lines()
                .next()
                .and_then(|line| line.strip_prefix(STAMP_PREFIX));
            if stamp != Some(version.as_str()) {
                failures.push(format!(
                    "{cell}: fixture stamped {stamp:?} but the fake cli is {version:?}"
                ));
            }
            let expected_argv: Vec<&str> = expected.lines().skip(1).collect();
            if expected_argv != argv {
                failures.push(format!(
                    "{cell}: expected {expected_argv:?} but spawned {argv:?}"
                ));
            }
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}

#[test]
fn every_argv_fixture_belongs_to_a_known_provider_and_scenario() {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/fake-cli/argv");
    let known: Vec<PathBuf> = PROVIDERS
        .iter()
        .flat_map(|(provider_id, _)| {
            SCENARIOS
                .iter()
                .map(move |scenario| fixture_path(provider_id, scenario))
        })
        .collect();
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return;
    };
    for entry in entries {
        let path = entry.expect("read an argv fixture entry").path();
        assert!(
            known.contains(&path),
            "orphan argv fixture {}",
            path.display()
        );
    }
}
