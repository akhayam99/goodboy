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
    recorded(&fake)
}

fn with_prompt(head: &[&str], tail: &[&str]) -> Vec<String> {
    let mut argv = strings(head);
    argv.push(COMBINED.to_string());
    argv.extend(strings(tail));
    argv
}

const JOBS: [Job; 2] = [Job::Planner, Job::Summarizer];
const PROVIDERS: [(&str, &str); 5] = [
    ("anthropic", "claude"),
    ("cursor", "cursor-agent"),
    ("gemini", "agy"),
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
                    "plan"
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
fn gemini_side_jobs_omit_the_effort_when_none_is_chosen() {
    let argv = run_side_job(Job::Summarizer, "gemini", "agy", None);

    assert!(!argv.contains(&"--effort".to_string()));
}

#[test]
fn codex_side_jobs_spawn_read_only_with_the_prompt_after_the_separator() {
    for job in JOBS {
        let argv = run_side_job(job, "codex", "codex", Some("low"));

        let mut expected = strings(&[
            "exec",
            "--json",
            "--skip-git-repo-check",
            "-m",
            "fake-model",
            "-s",
            "read-only",
            "-c",
            "model_reasoning_effort=\"low\"",
            "--",
        ]);
        expected.push(COMBINED.to_string());
        assert_eq!(argv, expected, "{job:?}");
    }
}

#[test]
fn opencode_side_jobs_spawn_the_plan_agent_with_the_turn_permission_flag() {
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
            "--dangerously-skip-permissions",
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
    }
}

#[test]
fn claude_side_jobs_spawn_without_tools_and_with_the_effort() {
    let summarizer = run_side_job(Job::Summarizer, "anthropic", "claude", Some("medium"));
    let planner = run_side_job(Job::Planner, "anthropic", "claude", Some("medium"));

    let common = [
        "-p",
        USER,
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
