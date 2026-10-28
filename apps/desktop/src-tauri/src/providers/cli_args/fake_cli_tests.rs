use super::*;
use crate::fake_cli::FakeCli;
use crate::live_child::LiveChildRegistry;
use std::sync::{Arc, Mutex};

const SYSTEM: &str = "you review the Harborline queue";
const USER: &str = "--force list the Northwind blockers";
const COMBINED: &str = "you review the Harborline queue\n\n--force list the Northwind blockers";

fn registry() -> LiveChildRegistry {
    Arc::new(Mutex::new(std::collections::HashMap::new()))
}

fn recorded(fake: &FakeCli) -> Vec<String> {
    let text = fake
        .work_file("fake-cli-argv.txt")
        .expect("the fake cli records its argv");
    let lines: Vec<&str> = text.lines().collect();
    let joined = [SYSTEM, "", USER];
    let mut argv = Vec::new();
    let mut at = 0;
    while at < lines.len() {
        if lines[at..].starts_with(&joined) {
            argv.push(COMBINED.to_string());
            at += joined.len();
            continue;
        }
        argv.push(lines[at].to_string());
        at += 1;
    }
    argv
}

fn strings(parts: &[&str]) -> Vec<String> {
    parts.iter().map(|part| part.to_string()).collect()
}

fn run_side_job(job: Job, provider_id: &str, binary: &str, effort: Option<&str>) -> Vec<String> {
    run_side_job_with_stdin(job, provider_id, binary, effort).0
}

fn run_side_job_with_stdin(
    job: Job,
    provider_id: &str,
    binary: &str,
    effort: Option<&str>,
) -> (Vec<String>, Option<String>) {
    let fake = FakeCli::stage("ok");
    let work_dir = fake.work_dir();
    let binary_path = fake.binary(binary);
    let exit_code = match job {
        Job::Planner => {
            crate::planner::run_planner(
                &registry(),
                crate::planner::PlannerArgs {
                    provider_id: provider_id.to_string(),
                    model: "fake-model".to_string(),
                    binary: binary_path,
                    user_message: USER.to_string(),
                    system_prompt: SYSTEM.to_string(),
                    working_dir: Some(work_dir),
                    tools_disabled: false,
                    effort: effort.map(str::to_string),
                    run_id: None,
                },
            )
            .expect("the planner spawns")
            .exit_code
        }
        _ => {
            crate::summarize::run_summarize(
                &registry(),
                crate::summarize::SummarizeArgs {
                    provider_id: provider_id.to_string(),
                    model: "fake-model".to_string(),
                    binary: binary_path,
                    user_message: USER.to_string(),
                    system_prompt: SYSTEM.to_string(),
                    working_dir: Some(work_dir),
                    effort: effort.map(str::to_string),
                    run_id: None,
                },
            )
            .expect("the summarizer spawns")
            .exit_code
        }
    };
    assert_eq!(exit_code, Some(0));
    (recorded(&fake), fake.work_file("fake-cli-stdin.txt"))
}

fn with_prompt(head: &[&str], tail: &[&str]) -> Vec<String> {
    let mut argv = strings(head);
    argv.push(COMBINED.to_string());
    argv.extend(strings(tail));
    argv
}

const JOBS: [Job; 2] = [Job::Planner, Job::Summarizer];
const PROVIDERS: [(&str, &str); 6] = [
    ("anthropic", "claude"),
    ("cursor", "cursor-agent"),
    ("gemini", "agy"),
    ("copilot", "copilot"),
    ("codex", "codex"),
    ("opencode", "opencode"),
];

#[test]
fn cursor_side_jobs_spawn_in_plan_mode_without_force() {
    for job in JOBS {
        let argv = run_side_job(job, "cursor", "cursor-agent", None);

        assert_eq!(
            argv,
            with_prompt(
                &["-p"],
                &[
                    "--model",
                    "fake-model",
                    "--output-format",
                    "stream-json",
                    "--mode",
                    "plan",
                    "--trust"
                ]
            ),
            "{job:?}"
        );
        assert!(!argv.contains(&"--force".to_string()));
    }
}

#[test]
fn gemini_side_jobs_spawn_in_plan_mode_with_the_chosen_effort() {
    for job in JOBS {
        let argv = run_side_job(job, "gemini", "agy", Some("high"));

        assert_eq!(
            argv,
            with_prompt(
                &["-p"],
                &[
                    "--model",
                    "fake-model",
                    "--effort",
                    "high",
                    "--mode",
                    "plan",
                    "--sandbox"
                ]
            ),
            "{job:?}"
        );
    }
}

#[test]
fn copilot_side_jobs_spawn_with_their_denials_and_the_chosen_effort() {
    for job in JOBS {
        let argv = run_side_job(job, "copilot", "copilot", Some("high"));

        let mut expected = with_prompt(
            &["-p"],
            &[
                "--model",
                "fake-model",
                "--output-format=json",
                "--disable-client-telemetry",
                "--no-auto-update",
                "--disable-builtin-mcps",
                "--no-ask-user",
                "--allow-all-tools",
                "--deny-tool=write",
                "--deny-tool=shell",
                "--deny-tool=memory",
            ],
        );
        if job == Job::Summarizer {
            expected.extend(strings(&["--deny-tool=read", "--deny-tool=url"]));
        }
        expected.extend(strings(&["-C", "WORK", "--reasoning-effort", "high"]));
        let dir = expected.iter().position(|arg| arg == "WORK").unwrap();
        assert!(argv[dir].ends_with("/work"), "{argv:?}");
        expected[dir] = argv[dir].clone();
        assert_eq!(argv, expected, "{job:?}");
        for flag in [
            "--allow-all",
            "--yolo",
            "--allow-all-urls",
            "--allow-all-paths",
        ] {
            assert!(!argv.contains(&flag.to_string()), "{job:?} {flag}");
        }
    }
}

#[test]
fn gemini_side_jobs_omit_the_effort_when_none_is_chosen() {
    let argv = run_side_job(Job::Summarizer, "gemini", "agy", None);

    assert!(!argv.contains(&"--effort".to_string()));
}

#[test]
fn codex_side_jobs_spawn_read_only_with_the_prompt_on_stdin() {
    for job in JOBS {
        let (argv, stdin) = run_side_job_with_stdin(job, "codex", "codex", Some("low"));

        assert_eq!(stdin.as_deref(), Some(COMBINED), "{job:?}");
        let expected = strings(&[
            "exec",
            "--json",
            "--skip-git-repo-check",
            "-m",
            "fake-model",
            "-s",
            "read-only",
            "-c",
            "model_reasoning_effort=\"low\"",
            "-",
        ]);
        assert_eq!(argv, expected, "{job:?}");
    }
}

#[test]
fn opencode_side_jobs_spawn_the_plan_agent_without_the_skip_permissions_flag() {
    for job in JOBS {
        let argv = run_side_job(job, "opencode", "opencode", Some("max"));

        let mut expected = strings(&[
            "run",
            "--format",
            "json",
            "-m",
            "fake-model",
            "--dir",
            "WORK",
            "--agent",
            "plan",
            "--variant",
            "max",
            "--",
        ]);
        expected.push(COMBINED.to_string());
        let dir = expected.iter().position(|arg| arg == "WORK").unwrap();
        assert!(argv[dir].ends_with("/work"), "{argv:?}");
        expected[dir] = argv[dir].clone();
        assert_eq!(argv, expected, "{job:?}");
        assert!(!argv.contains(&"--dangerously-skip-permissions".to_string()));
    }
}

#[test]
fn no_side_job_spawns_with_a_permission_bypass_flag() {
    for (provider_id, binary) in PROVIDERS {
        for job in JOBS {
            let argv = run_side_job(job, provider_id, binary, Some("high"));

            for flag in ["--dangerously-skip-permissions", "--force", "--yolo"] {
                assert!(
                    !argv.contains(&flag.to_string()),
                    "{provider_id} {job:?}: {argv:?}"
                );
            }
        }
    }
}

#[test]
fn claude_side_jobs_spawn_without_tools_and_with_the_effort() {
    let summarizer = run_side_job(Job::Summarizer, "anthropic", "claude", Some("medium"));
    let planner = run_side_job(Job::Planner, "anthropic", "claude", Some("medium"));

    let common = [
        "-p",
        "--model",
        "fake-model",
        "--system-prompt",
        SYSTEM,
        "--setting-sources",
        "project,local",
        "--output-format",
        "json",
        "--no-session-persistence",
    ];
    let mut expected_summarizer = strings(&common);
    expected_summarizer.extend(strings(&[
        "--tools",
        "",
        "--disallowedTools",
        "mcp__*",
        "--effort",
        "medium",
    ]));
    let mut expected_planner = strings(&common);
    expected_planner.extend(strings(&[
        "--disallowedTools",
        "mcp__*",
        "--effort",
        "medium",
    ]));
    assert_eq!(summarizer, expected_summarizer);
    assert_eq!(planner, expected_planner);
}

#[test]
fn a_cli_that_reads_stdin_never_sees_the_prompt_in_its_argv() {
    for (provider_id, binary) in [("anthropic", "claude"), ("codex", "codex")] {
        for job in JOBS {
            let (argv, stdin) = run_side_job_with_stdin(job, provider_id, binary, None);

            assert!(
                !argv.iter().any(|arg| arg.contains("Northwind")),
                "{provider_id} {job:?}: {argv:?}"
            );
            let expected = match provider_id {
                "anthropic" => USER,
                _ => COMBINED,
            };
            assert_eq!(stdin.as_deref(), Some(expected), "{provider_id} {job:?}");
        }
    }
}

#[test]
fn the_other_clis_keep_the_prompt_in_argv_until_their_stdin_is_confirmed() {
    for (provider_id, binary) in [
        ("cursor", "cursor-agent"),
        ("gemini", "agy"),
        ("copilot", "copilot"),
        ("opencode", "opencode"),
    ] {
        let (argv, stdin) = run_side_job_with_stdin(Job::Planner, provider_id, binary, None);

        assert!(
            argv.contains(&COMBINED.to_string()),
            "{provider_id}: {argv:?}"
        );
        assert_eq!(stdin, None, "{provider_id}");
    }
}

#[test]
fn every_side_job_argv_that_really_spawns_passes_its_read_only_policy() {
    for (provider_id, binary) in PROVIDERS {
        let cli = Cli::of_provider(provider_id).unwrap();
        for job in JOBS {
            let argv = run_side_job(job, provider_id, binary, Some("high"));

            let found = read_only_violations(cli, job, &argv);

            assert!(found.is_empty(), "{provider_id} {job:?}: {found:?}");
        }
    }
}
