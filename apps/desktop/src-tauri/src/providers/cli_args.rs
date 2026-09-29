use crate::aux_spawn::CLAUDE_SETTING_SOURCES;
use crate::turn::SpawnOneArgs;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Cli {
    Claude,
    Cursor,
    Agy,
    Codex,
    Opencode,
}

impl Cli {
    pub(crate) fn of_binary(binary: &str) -> Self {
        let name = std::path::Path::new(binary)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(binary);
        match name {
            "cursor-agent" => Cli::Cursor,
            "agy" => Cli::Agy,
            "codex" => Cli::Codex,
            "opencode" | "openrouter" | "moonshot" => Cli::Opencode,
            _ => Cli::Claude,
        }
    }

    pub(crate) fn of_provider(provider_id: &str) -> Option<Self> {
        match provider_id {
            "anthropic" => Some(Cli::Claude),
            "cursor" => Some(Cli::Cursor),
            "gemini" => Some(Cli::Agy),
            "codex" => Some(Cli::Codex),
            "opencode" | "openrouter" | "moonshot" => Some(Cli::Opencode),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Job {
    Turn,
    Planner,
    Summarizer,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum ArgsError {
    UnknownProvider(String),
    Policy(String),
}

pub(crate) fn effort_args(cli: Cli, effort: Option<&str>) -> Vec<String> {
    let Some(level) = effort.filter(|level| !level.is_empty()) else {
        return Vec::new();
    };
    match cli {
        Cli::Claude | Cli::Agy => vec!["--effort".to_string(), level.to_string()],
        Cli::Codex => vec![
            "-c".to_string(),
            format!("model_reasoning_effort=\"{level}\""),
        ],
        Cli::Opencode => vec!["--variant".to_string(), level.to_string()],
        Cli::Cursor => Vec::new(),
    }
}

pub(crate) struct Policy {
    pub pairs: &'static [(&'static str, &'static str)],
    pub switches: &'static [&'static str],
    pub forbidden: &'static [&'static str],
    pub prompt_after_separator: bool,
}

pub(crate) fn read_only_policy(cli: Cli, job: Job) -> Policy {
    match (cli, job) {
        (Cli::Claude, Job::Turn) => Policy {
            pairs: &[("--permission-mode", "plan")],
            switches: &[],
            forbidden: &["--dangerously-skip-permissions"],
            prompt_after_separator: false,
        },
        (Cli::Claude, Job::Planner) => Policy {
            pairs: &[("--disallowedTools", "mcp__*")],
            switches: &["--no-session-persistence"],
            forbidden: &["--dangerously-skip-permissions", "--allowedTools"],
            prompt_after_separator: false,
        },
        (Cli::Claude, Job::Summarizer) => Policy {
            pairs: &[("--disallowedTools", "mcp__*"), ("--tools", "")],
            switches: &["--no-session-persistence"],
            forbidden: &["--dangerously-skip-permissions", "--allowedTools"],
            prompt_after_separator: false,
        },
        (Cli::Cursor, _) => Policy {
            pairs: &[("--mode", "plan")],
            switches: &[],
            forbidden: &["--force"],
            prompt_after_separator: false,
        },
        (Cli::Agy, _) => Policy {
            pairs: &[("--mode", "plan")],
            switches: &["--sandbox"],
            forbidden: &["--dangerously-skip-permissions"],
            prompt_after_separator: false,
        },
        (Cli::Codex, _) => Policy {
            pairs: &[("-s", "read-only")],
            switches: &["--skip-git-repo-check"],
            forbidden: &["--full-auto", "--dangerously-bypass-approvals-and-sandbox"],
            prompt_after_separator: true,
        },
        (Cli::Opencode, _) => Policy {
            pairs: &[("--agent", "plan")],
            switches: &[],
            forbidden: &[],
            prompt_after_separator: true,
        },
    }
}

pub(crate) fn read_only_violations(cli: Cli, job: Job, argv: &[String]) -> Vec<String> {
    let policy = read_only_policy(cli, job);
    let mut found = Vec::new();
    if policy.prompt_after_separator {
        let separators = argv.iter().filter(|arg| arg.as_str() == "--").count();
        let before_prompt = argv.len().checked_sub(2).map(|at| argv[at].as_str());
        if separators != 1 || before_prompt != Some("--") {
            found.push("the prompt must follow a single --".to_string());
        }
    }
    let end = argv
        .iter()
        .position(|arg| arg == "--")
        .unwrap_or(argv.len());
    let mut flags: Vec<&str> = Vec::new();
    let mut after_prompt_flag = false;
    for arg in &argv[..end] {
        if after_prompt_flag {
            after_prompt_flag = false;
            continue;
        }
        after_prompt_flag = arg == "-p";
        flags.push(arg.as_str());
    }
    for flag in policy.forbidden {
        if flags.contains(flag) {
            found.push(format!("{flag} must not be set"));
        }
    }
    for (flag, value) in policy.pairs {
        let present = flags
            .windows(2)
            .any(|pair| pair[0] == *flag && pair[1] == *value);
        if !present {
            found.push(format!("{flag} must be {value:?}"));
        }
    }
    for switch in policy.switches {
        if !flags.contains(switch) {
            found.push(format!("{switch} is missing"));
        }
    }
    found
}

pub(crate) struct SideJob<'a> {
    pub job: Job,
    pub provider_id: &'a str,
    pub model: &'a str,
    pub system_prompt: &'a str,
    pub user_message: &'a str,
    pub working_dir: Option<&'a str>,
    pub tools_disabled: bool,
    pub effort: Option<&'a str>,
}

pub(crate) fn side_job_args(side: &SideJob<'_>) -> Result<Vec<String>, ArgsError> {
    let cli = Cli::of_provider(side.provider_id)
        .ok_or_else(|| ArgsError::UnknownProvider(side.provider_id.to_string()))?;
    let combined = format!("{}\n\n{}", side.system_prompt, side.user_message);
    let model = side.model.to_string();
    let effort = effort_args(cli, side.effort);
    let argv: Vec<String> = match cli {
        Cli::Claude => {
            let mut v = vec![
                "-p".to_string(),
                side.user_message.to_string(),
                "--model".to_string(),
                model,
                "--system-prompt".to_string(),
                side.system_prompt.to_string(),
                "--setting-sources".to_string(),
                CLAUDE_SETTING_SOURCES.to_string(),
                "--output-format".to_string(),
                "json".to_string(),
                "--no-session-persistence".to_string(),
            ];
            if side.tools_disabled || side.job == Job::Summarizer {
                v.push("--tools".to_string());
                v.push(String::new());
            }
            v.push("--disallowedTools".to_string());
            v.push("mcp__*".to_string());
            v.extend(effort);
            v
        }
        Cli::Cursor => vec![
            "-p".to_string(),
            combined,
            "--model".to_string(),
            model,
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--mode".to_string(),
            "plan".to_string(),
        ],
        Cli::Agy => {
            let mut v = vec!["-p".to_string(), combined, "--model".to_string(), model];
            v.extend(effort);
            v.extend([
                "--mode".to_string(),
                "plan".to_string(),
                "--sandbox".to_string(),
            ]);
            v
        }
        Cli::Codex => {
            let mut v = vec![
                "exec".to_string(),
                "--json".to_string(),
                "--skip-git-repo-check".to_string(),
                "-m".to_string(),
                model,
                "-s".to_string(),
                "read-only".to_string(),
            ];
            v.extend(effort);
            v.push("--".to_string());
            v.push(combined);
            v
        }
        Cli::Opencode => {
            let mut v = vec![
                "run".to_string(),
                "--format".to_string(),
                "json".to_string(),
                "-m".to_string(),
                model,
            ];
            if let Some(dir) = side.working_dir {
                v.push("--dir".to_string());
                v.push(dir.to_string());
            }
            v.extend([
                "--dangerously-skip-permissions".to_string(),
                "--agent".to_string(),
                "plan".to_string(),
            ]);
            v.extend(effort);
            v.push("--".to_string());
            v.push(combined);
            v
        }
    };
    let violations = read_only_violations(cli, side.job, &argv);
    if !violations.is_empty() {
        return Err(ArgsError::Policy(violations.join("; ")));
    }
    Ok(argv)
}

pub(crate) fn turn_args(binary: &str, args: &SpawnOneArgs<'_>) -> Vec<String> {
    let cli = Cli::of_binary(binary);
    match cli {
        Cli::Cursor => {
            let mut v = vec![
                "-p".to_string(),
                args.prompt.to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
                "--workspace".to_string(),
                args.working_dir.to_string(),
                "--model".to_string(),
                args.model.to_string(),
            ];
            if args.permission_mode == "bypassPermissions" {
                v.push("--force".to_string());
            } else {
                v.push("--mode".to_string());
                v.push("plan".to_string());
            }
            let _ = (
                args.allowed_tools,
                args.disallowed_tools,
                args.resume_session_id,
                args.system_prompt,
            );
            v.shrink_to_fit();
            v
        }
        Cli::Agy => {
            let _ = (
                args.allowed_tools,
                args.disallowed_tools,
                args.resume_session_id,
                args.system_prompt,
            );
            let mut v = vec![
                "-p".to_string(),
                args.prompt.to_string(),
                "--model".to_string(),
                args.model.to_string(),
            ];
            v.extend(effort_args(cli, args.effort));
            match args.permission_mode {
                "bypassPermissions" => v.push("--dangerously-skip-permissions".to_string()),
                "acceptEdits" => v.extend([
                    "--mode".to_string(),
                    "accept-edits".to_string(),
                    "--sandbox".to_string(),
                ]),
                _ => v.extend([
                    "--mode".to_string(),
                    "plan".to_string(),
                    "--sandbox".to_string(),
                ]),
            }
            v.shrink_to_fit();
            v
        }
        Cli::Codex => {
            let _ = (args.resume_session_id, args.system_prompt);
            let mut v: Vec<String> = vec![
                "exec".to_string(),
                "--json".to_string(),
                "--skip-git-repo-check".to_string(),
                "-m".to_string(),
                args.model.to_string(),
                "--cd".to_string(),
                args.working_dir.to_string(),
            ];
            let sandbox = match args.permission_mode {
                "acceptEdits" | "bypassPermissions" => "workspace-write",
                _ => "read-only",
            };
            v.push("-s".to_string());
            v.push(sandbox.to_string());
            if sandbox == "workspace-write" {
                v.push("-c".to_string());
                v.push("sandbox_workspace_write.network_access=true".to_string());
                if args.excludes_tmp {
                    for setting in [
                        "sandbox_workspace_write.exclude_tmpdir_env_var=true",
                        "sandbox_workspace_write.exclude_slash_tmp=true",
                    ] {
                        v.push("-c".to_string());
                        v.push(setting.to_string());
                    }
                }
                for root in args.writable_roots {
                    v.push("--add-dir".to_string());
                    v.push(root.to_string());
                }
                if let Some(socket_directory) = args.query_socket_directory {
                    v.push("--add-dir".to_string());
                    v.push(socket_directory.to_string());
                }
            }
            v.extend(effort_args(cli, args.effort));
            v.push("--".to_string());
            v.push(args.prompt.to_string());
            v
        }
        Cli::Opencode => {
            let _ = (
                args.allowed_tools,
                args.disallowed_tools,
                args.system_prompt,
            );
            let mut v = vec![
                "run".to_string(),
                "--format".to_string(),
                "json".to_string(),
                "-m".to_string(),
                args.model.to_string(),
                "--dir".to_string(),
                args.working_dir.to_string(),
                "--dangerously-skip-permissions".to_string(),
            ];
            if args.permission_mode != "bypassPermissions" {
                v.push("--agent".to_string());
                v.push("plan".to_string());
            }
            v.extend(effort_args(cli, args.effort));
            if let Some(session_id) = args.resume_session_id {
                v.push("--session".to_string());
                v.push(session_id.to_string());
            }
            v.push("--".to_string());
            v.push(args.prompt.to_string());
            v
        }
        Cli::Claude => {
            let mut v: Vec<String> = Vec::new();
            if let Some(sid) = args.resume_session_id {
                v.push("--resume".to_string());
                v.push(sid.to_string());
            }
            v.extend([
                "-p".to_string(),
                args.prompt.to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
                "--verbose".to_string(),
                "--model".to_string(),
                args.model.to_string(),
                "--permission-mode".to_string(),
                args.permission_mode.to_string(),
                "--setting-sources".to_string(),
                CLAUDE_SETTING_SOURCES.to_string(),
            ]);
            for root in args.writable_roots {
                v.push("--add-dir".to_string());
                v.push(root.to_string());
            }
            if let Some(socket_directory) = args.query_socket_directory {
                v.push("--add-dir".to_string());
                v.push(socket_directory.to_string());
            }
            if let Some(sp) = args.system_prompt {
                v.push("--append-system-prompt".to_string());
                v.push(sp.to_string());
            }
            v.extend(effort_args(cli, args.effort));
            if !args.allowed_tools.is_empty() {
                v.push("--allowedTools".to_string());
                v.push(args.allowed_tools.join(","));
            }
            let mut disallowed_tools: Vec<String> = args
                .disallowed_tools
                .iter()
                .filter(|tool| tool.as_str() != "mcp__*")
                .cloned()
                .collect();
            disallowed_tools.push("mcp__*".to_string());
            v.push("--disallowedTools".to_string());
            v.push(disallowed_tools.join(","));
            v
        }
    }
}
