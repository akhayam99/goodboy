use super::spec::{cli_of_binary_name, spec_of};
use crate::aux_spawn::CLAUDE_SETTING_SOURCES;
use crate::turn::SpawnOneArgs;

#[cfg(all(test, unix))]
mod fake_cli_tests;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Cli {
    Claude,
    Cursor,
    Agy,
    Copilot,
    Codex,
    Opencode,
}

impl Cli {
    pub(crate) fn of_binary(binary: &str) -> Option<Self> {
        let name = std::path::Path::new(binary)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(binary);
        cli_of_binary_name(name)
    }

    pub(crate) fn of_provider(provider_id: &str) -> Option<Self> {
        spec_of(provider_id).map(|spec| spec.cli)
    }
}

pub(crate) fn prompt_on_stdin(cli: Cli) -> bool {
    matches!(cli, Cli::Claude | Cli::Codex)
}

pub(crate) const CURSOR_TRUST_FLAG: &str = "--trust";

pub(crate) fn needs_workspace_trust(cli: Cli, argv: &[String]) -> bool {
    if cli != Cli::Cursor {
        return false;
    }
    let skips_prompt = ["--force", "-f", "--yolo", CURSOR_TRUST_FLAG];
    let mut after_prompt_flag = false;
    for arg in argv {
        if after_prompt_flag {
            after_prompt_flag = false;
            continue;
        }
        after_prompt_flag = arg == "-p";
        if skips_prompt.contains(&arg.as_str()) {
            return false;
        }
    }
    true
}

pub(crate) fn partial_output_flag(cli: Cli) -> Option<&'static str> {
    match cli {
        Cli::Claude => Some("--include-partial-messages"),
        Cli::Cursor => Some("--stream-partial-output"),
        Cli::Agy | Cli::Copilot | Cli::Codex | Cli::Opencode => None,
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
        Cli::Copilot => vec!["--reasoning-effort".to_string(), level.to_string()],
        Cli::Cursor => Vec::new(),
    }
}

const SIDE_JOB_FORBIDDEN: &[&str] = &[
    "--dangerously-skip-permissions",
    "--force",
    "-f",
    "--yolo",
    "-y",
    "--full-auto",
    "--dangerously-bypass-approvals-and-sandbox",
    "--allow-all",
    "--allow-all-paths",
    "--allow-all-urls",
];

const COPILOT_BASE_FLAGS: [&str; 5] = [
    "--output-format=json",
    "--disable-client-telemetry",
    "--no-auto-update",
    "--disable-builtin-mcps",
    "--no-ask-user",
];
const COPILOT_ALLOW_TOOLS: &str = "--allow-all-tools";
const COPILOT_DENY_WRITE: &str = "--deny-tool=write";
const COPILOT_DENY_SHELL: &str = "--deny-tool=shell";
const COPILOT_DENY_MEMORY: &str = "--deny-tool=memory";
const COPILOT_DENY_READ: &str = "--deny-tool=read";
const COPILOT_DENY_URL: &str = "--deny-tool=url";
const COPILOT_ALLOW_URLS: &str = "--allow-all-urls";

pub(crate) struct Policy {
    pub pairs: &'static [(&'static str, &'static str)],
    pub switches: &'static [&'static str],
    pub forbidden: &'static [&'static str],
    pub prompt_after_separator: bool,
    pub prompt_on_stdin: bool,
}

pub(crate) fn read_only_policy(cli: Cli, job: Job) -> Policy {
    match (cli, job) {
        (Cli::Claude, Job::Turn) => Policy {
            pairs: &[("--permission-mode", "plan")],
            switches: &[],
            forbidden: &["--dangerously-skip-permissions"],
            prompt_after_separator: false,
            prompt_on_stdin: true,
        },
        (Cli::Claude, Job::Planner) => Policy {
            pairs: &[("--disallowedTools", "mcp__*")],
            switches: &["--no-session-persistence"],
            forbidden: &["--dangerously-skip-permissions", "--allowedTools"],
            prompt_after_separator: false,
            prompt_on_stdin: true,
        },
        (Cli::Claude, Job::Summarizer) => Policy {
            pairs: &[("--disallowedTools", "mcp__*"), ("--tools", "")],
            switches: &["--no-session-persistence"],
            forbidden: &["--dangerously-skip-permissions", "--allowedTools"],
            prompt_after_separator: false,
            prompt_on_stdin: true,
        },
        (Cli::Cursor, _) => Policy {
            pairs: &[("--mode", "plan")],
            switches: &[],
            forbidden: &["--force"],
            prompt_after_separator: false,
            prompt_on_stdin: false,
        },
        (Cli::Agy, _) => Policy {
            pairs: &[("--mode", "plan")],
            switches: &["--sandbox"],
            forbidden: &["--dangerously-skip-permissions"],
            prompt_after_separator: false,
            prompt_on_stdin: false,
        },
        (Cli::Copilot, _) => Policy {
            pairs: &[],
            switches: &[
                COPILOT_ALLOW_TOOLS,
                COPILOT_DENY_WRITE,
                COPILOT_DENY_SHELL,
                COPILOT_DENY_MEMORY,
            ],
            forbidden: &["--allow-all", "--yolo"],
            prompt_after_separator: false,
            prompt_on_stdin: false,
        },
        (Cli::Codex, _) => Policy {
            pairs: &[("-s", "read-only")],
            switches: &["--skip-git-repo-check"],
            forbidden: &["--full-auto", "--dangerously-bypass-approvals-and-sandbox"],
            prompt_after_separator: false,
            prompt_on_stdin: true,
        },
        (Cli::Opencode, _) => Policy {
            pairs: &[("--agent", "plan")],
            switches: &[],
            forbidden: &[],
            prompt_after_separator: true,
            prompt_on_stdin: false,
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
        after_prompt_flag = arg == "-p" && !policy.prompt_on_stdin;
        flags.push(arg.as_str());
    }
    let side_job_forbidden: &[&str] = if job == Job::Turn {
        &[]
    } else {
        SIDE_JOB_FORBIDDEN
    };
    for flag in policy.forbidden.iter().chain(side_job_forbidden) {
        let message = format!("{flag} must not be set");
        if flags.contains(flag) && !found.contains(&message) {
            found.push(message);
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
        Cli::Copilot => {
            let mut v = vec!["-p".to_string(), combined, "--model".to_string(), model];
            v.extend(COPILOT_BASE_FLAGS.iter().map(|flag| flag.to_string()));
            v.extend(
                [
                    COPILOT_ALLOW_TOOLS,
                    COPILOT_DENY_WRITE,
                    COPILOT_DENY_SHELL,
                    COPILOT_DENY_MEMORY,
                ]
                .iter()
                .map(|flag| flag.to_string()),
            );
            if side.tools_disabled || side.job == Job::Summarizer {
                v.push(COPILOT_DENY_READ.to_string());
                v.push(COPILOT_DENY_URL.to_string());
            }
            if let Some(dir) = side.working_dir {
                v.push("-C".to_string());
                v.push(dir.to_string());
            }
            v.extend(effort);
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
            v.push("-".to_string());
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
            v.extend(["--agent".to_string(), "plan".to_string()]);
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

pub(crate) fn side_job_stdin(side: &SideJob<'_>) -> Option<String> {
    let cli = Cli::of_provider(side.provider_id)?;
    match cli {
        Cli::Claude => Some(side.user_message.to_string()),
        Cli::Codex => Some(format!("{}\n\n{}", side.system_prompt, side.user_message)),
        Cli::Cursor | Cli::Agy | Cli::Copilot | Cli::Opencode => None,
    }
}

pub(crate) fn turn_stdin(binary: &str, args: &SpawnOneArgs<'_>) -> Option<String> {
    Cli::of_binary(binary)
        .is_some_and(prompt_on_stdin)
        .then(|| args.prompt.to_string())
}

pub(crate) fn feed_stdin(child: &mut std::process::Child, text: String) {
    let Some(mut stdin) = child.stdin.take() else {
        return;
    };
    std::thread::spawn(move || {
        let _ = std::io::Write::write_all(&mut stdin, text.as_bytes());
    });
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RoleAccess {
    ReadOnly,
    Writer,
}

const READ_ONLY_ROLES: &[&str] = &["scout", "planner", "investigator", "reviewer", "auto"];
const WRITER_ROLES: &[&str] = &[
    "implementer",
    "tester",
    "docs",
    "scribe",
    "ci-fixer",
    "rewriter",
];
const READ_ONLY_CLAUDE_TOOLS: &str = "Read,Grep,Glob";
const NATIVE_SUBAGENT_TOOLS: &[&str] = &["Task", "Agent"];
const READ_ONLY_DENIED_TOOLS: &[&str] = &["Bash", "Edit", "Write", "MultiEdit", "NotebookEdit"];
const AUTO_CHILD_DENIED_TOOLS: &[&str] = &[
    "Bash(git push:*)",
    "Bash(git push *)",
    "Bash(*--no-verify*)",
];

pub(crate) fn role_access(role: &str) -> Option<RoleAccess> {
    if READ_ONLY_ROLES.contains(&role) {
        return Some(RoleAccess::ReadOnly);
    }
    if WRITER_ROLES.contains(&role) {
        return Some(RoleAccess::Writer);
    }
    None
}

fn claude_allowed_tools(args: &SpawnOneArgs<'_>, access: Option<RoleAccess>) -> Vec<String> {
    if access == Some(RoleAccess::ReadOnly) {
        return Vec::new();
    }
    args.allowed_tools.to_vec()
}

fn confinement_of(args: &SpawnOneArgs<'_>) -> Option<RoleAccess> {
    args.confined_role
        .map(|role| role_access(role).unwrap_or(RoleAccess::ReadOnly))
}

fn effective_permission_mode<'a>(args: &SpawnOneArgs<'a>, access: Option<RoleAccess>) -> &'a str {
    if access == Some(RoleAccess::ReadOnly) {
        return "plan";
    }
    args.permission_mode
}

pub(crate) fn turn_args(binary: &str, args: &SpawnOneArgs<'_>) -> Vec<String> {
    build_turn_args(binary, args, true)
}

pub(crate) fn turn_args_with_prompt(binary: &str, args: &SpawnOneArgs<'_>) -> Vec<String> {
    build_turn_args(binary, args, false)
}

fn build_turn_args(binary: &str, args: &SpawnOneArgs<'_>, is_stdin_allowed: bool) -> Vec<String> {
    let Some(cli) = Cli::of_binary(binary) else {
        return Vec::new();
    };
    let access = confinement_of(args);
    let permission_mode = effective_permission_mode(args, access);
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
            if permission_mode == "bypassPermissions" {
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
            match permission_mode {
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
        Cli::Copilot => {
            let _ = (
                args.allowed_tools,
                args.disallowed_tools,
                args.system_prompt,
            );
            let mut v = vec![
                "-p".to_string(),
                args.prompt.to_string(),
                "--model".to_string(),
                args.model.to_string(),
                "-C".to_string(),
                args.working_dir.to_string(),
            ];
            v.extend(COPILOT_BASE_FLAGS.iter().map(|flag| flag.to_string()));
            v.push(COPILOT_ALLOW_TOOLS.to_string());
            match permission_mode {
                "bypassPermissions" => v.push(COPILOT_ALLOW_URLS.to_string()),
                "acceptEdits" => v.push(COPILOT_DENY_SHELL.to_string()),
                _ => v.extend([
                    COPILOT_DENY_WRITE.to_string(),
                    COPILOT_DENY_SHELL.to_string(),
                    COPILOT_DENY_MEMORY.to_string(),
                ]),
            }
            for root in args.writable_roots {
                v.push("--add-dir".to_string());
                v.push(root.to_string());
            }
            if let Some(socket_directory) = args.query_socket_directory {
                v.push("--add-dir".to_string());
                v.push(socket_directory.to_string());
            }
            v.extend(effort_args(cli, args.effort));
            if let Some(session_id) = args.resume_session_id {
                v.push(format!("--resume={session_id}"));
            }
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
            let sandbox = match permission_mode {
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
            if is_stdin_allowed {
                v.push("-".to_string());
                return v;
            }
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
            if permission_mode != "bypassPermissions" {
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
            v.push("-p".to_string());
            if !is_stdin_allowed {
                v.push(args.prompt.to_string());
            }
            v.extend([
                "--output-format".to_string(),
                "stream-json".to_string(),
                "--verbose".to_string(),
                "--model".to_string(),
                args.model.to_string(),
                "--permission-mode".to_string(),
                permission_mode.to_string(),
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
            if access == Some(RoleAccess::ReadOnly) {
                v.push("--tools".to_string());
                v.push(READ_ONLY_CLAUDE_TOOLS.to_string());
            }
            let allowed_tools = claude_allowed_tools(args, access);
            if !allowed_tools.is_empty() {
                v.push("--allowedTools".to_string());
                v.push(allowed_tools.join(","));
            }
            let mut disallowed_tools: Vec<String> = args
                .disallowed_tools
                .iter()
                .filter(|tool| tool.as_str() != "mcp__*")
                .cloned()
                .collect();
            if access.is_some() {
                disallowed_tools.extend(NATIVE_SUBAGENT_TOOLS.iter().map(|tool| tool.to_string()));
            }
            if access == Some(RoleAccess::ReadOnly) {
                disallowed_tools.extend(READ_ONLY_DENIED_TOOLS.iter().map(|tool| tool.to_string()));
            }
            if args.is_auto_child {
                disallowed_tools
                    .extend(AUTO_CHILD_DENIED_TOOLS.iter().map(|tool| tool.to_string()));
            }
            disallowed_tools.push("mcp__*".to_string());
            v.push("--disallowedTools".to_string());
            v.push(disallowed_tools.join(","));
            v
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(parts: &[&str]) -> Vec<String> {
        parts.iter().map(|part| part.to_string()).collect()
    }

    #[test]
    fn only_claude_and_cursor_have_a_partial_output_flag() {
        assert_eq!(
            partial_output_flag(Cli::Claude),
            Some("--include-partial-messages")
        );
        assert_eq!(
            partial_output_flag(Cli::Cursor),
            Some("--stream-partial-output")
        );
        for cli in [Cli::Agy, Cli::Copilot, Cli::Codex, Cli::Opencode] {
            assert_eq!(partial_output_flag(cli), None);
        }
    }

    #[test]
    fn only_a_cursor_run_without_force_needs_workspace_trust() {
        let read_only = strings(&["-p", "x", "--mode", "plan"]);
        assert!(needs_workspace_trust(Cli::Cursor, &read_only));
        for skip in ["--force", "-f", "--yolo", "--trust"] {
            let argv = strings(&["-p", "x", skip]);
            assert!(!needs_workspace_trust(Cli::Cursor, &argv), "{skip}");
        }
        for cli in [
            Cli::Claude,
            Cli::Agy,
            Cli::Copilot,
            Cli::Codex,
            Cli::Opencode,
        ] {
            assert!(!needs_workspace_trust(cli, &read_only));
        }
        let prompt_is_a_flag = strings(&["-p", "--force", "--mode", "plan"]);
        assert!(needs_workspace_trust(Cli::Cursor, &prompt_is_a_flag));
    }

    #[test]
    fn the_trust_flag_is_not_a_read_only_violation() {
        let argv = strings(&["-p", "x", "--mode", "plan", "--trust"]);
        assert!(read_only_violations(Cli::Cursor, Job::Planner, &argv).is_empty());
        assert!(read_only_violations(Cli::Cursor, Job::Turn, &argv).is_empty());
    }

    #[test]
    fn effort_maps_each_cli_including_gemini() {
        assert_eq!(
            effort_args(Cli::Claude, Some("high")),
            strings(&["--effort", "high"])
        );
        assert_eq!(
            effort_args(Cli::Agy, Some("high")),
            strings(&["--effort", "high"])
        );
        assert_eq!(
            effort_args(Cli::Codex, Some("low")),
            strings(&["-c", "model_reasoning_effort=\"low\""])
        );
        assert_eq!(
            effort_args(Cli::Opencode, Some("max")),
            strings(&["--variant", "max"])
        );
        assert_eq!(
            effort_args(Cli::Copilot, Some("xhigh")),
            vec!["--reasoning-effort", "xhigh"]
        );
        assert!(effort_args(Cli::Cursor, Some("high")).is_empty());
    }

    #[test]
    fn effort_is_omitted_when_missing_or_empty() {
        assert!(effort_args(Cli::Claude, None).is_empty());
        assert!(effort_args(Cli::Agy, Some("")).is_empty());
    }

    #[test]
    fn a_provider_id_and_a_binary_name_resolve_to_the_same_cli() {
        let pairs = [
            ("anthropic", "/usr/local/bin/claude", Cli::Claude),
            ("cursor", "cursor-agent", Cli::Cursor),
            ("gemini", "/x/agy", Cli::Agy),
            ("codex", "codex", Cli::Codex),
            ("copilot", "/usr/local/bin/copilot", Cli::Copilot),
            ("moonshot", "opencode", Cli::Opencode),
            ("openrouter", "/x/opencode", Cli::Opencode),
        ];
        for (provider_id, binary, cli) in pairs {
            assert_eq!(Cli::of_provider(provider_id), Some(cli));
            assert_eq!(Cli::of_binary(binary), Some(cli));
        }
        assert_eq!(Cli::of_provider("nonexistent"), None);
    }

    #[test]
    fn a_binary_nobody_drives_has_no_cli_and_no_arguments() {
        assert_eq!(Cli::of_binary("moonshot"), None);
        assert_eq!(Cli::of_binary("openrouter"), None);
        assert_eq!(Cli::of_binary("claudee"), None);
        assert_eq!(Cli::of_binary("/usr/bin/true"), None);
        assert_eq!(Cli::of_binary("codex.exe"), Some(Cli::Codex));
        assert_eq!(Cli::of_binary("cursor-agent.cmd"), Some(Cli::Cursor));
        assert_eq!(Cli::of_binary("copilot.exe"), Some(Cli::Copilot));
        assert_eq!(Cli::of_binary("copilot-agent"), None);
    }

    fn side(provider_id: &'static str, job: Job) -> SideJob<'static> {
        SideJob {
            job,
            provider_id,
            model: "cheap-model",
            system_prompt: "you plan",
            user_message: "plan this",
            working_dir: None,
            tools_disabled: false,
            effort: None,
        }
    }

    #[test]
    fn every_side_job_builds_an_argv_that_passes_its_own_policy() {
        for provider_id in [
            "anthropic",
            "cursor",
            "gemini",
            "copilot",
            "codex",
            "opencode",
        ] {
            let cli = Cli::of_provider(provider_id).unwrap();
            for job in [Job::Planner, Job::Summarizer] {
                let argv = side_job_args(&side(provider_id, job)).expect("argv");
                assert_eq!(read_only_violations(cli, job, &argv), Vec::<String>::new());
            }
        }
    }

    #[test]
    fn the_policy_rejects_a_cursor_argv_with_force() {
        let argv = strings(&["-p", "x", "--mode", "plan", "--force"]);
        assert_eq!(
            read_only_violations(Cli::Cursor, Job::Planner, &argv),
            strings(&["--force must not be set"])
        );
    }

    #[test]
    fn the_policy_rejects_a_missing_plan_posture() {
        let argv = strings(&["-p", "x", "--model", "m", "--sandbox"]);
        assert_eq!(
            read_only_violations(Cli::Agy, Job::Summarizer, &argv),
            strings(&["--mode must be \"plan\""])
        );
    }

    #[test]
    fn the_policy_rejects_an_opencode_prompt_without_the_separator() {
        let argv = strings(&["run", "--agent", "plan", "a prompt"]);
        assert_eq!(
            read_only_violations(Cli::Opencode, Job::Summarizer, &argv),
            strings(&["the prompt must follow a single --"])
        );
    }

    #[test]
    fn side_jobs_reject_every_bypass_flag_but_an_opencode_turn_keeps_its_own() {
        for flag in ["--dangerously-skip-permissions", "--force", "--yolo"] {
            let argv = strings(&["run", "--agent", "plan", flag, "--", "a prompt"]);
            for job in [Job::Planner, Job::Summarizer] {
                assert_eq!(
                    read_only_violations(Cli::Opencode, job, &argv),
                    vec![format!("{flag} must not be set")]
                );
            }
        }
        let turn = strings(&[
            "run",
            "--dangerously-skip-permissions",
            "--agent",
            "plan",
            "--",
            "a prompt",
        ]);
        assert!(read_only_violations(Cli::Opencode, Job::Turn, &turn).is_empty());
    }

    #[test]
    fn a_prompt_that_looks_like_a_flag_is_not_a_violation() {
        let argv = strings(&["-p", "--force", "--mode", "plan"]);
        assert!(read_only_violations(Cli::Cursor, Job::Planner, &argv).is_empty());
    }

    #[test]
    fn a_side_job_for_an_unknown_provider_is_rejected() {
        let err = side_job_args(&side("nonexistent", Job::Planner)).expect_err("unknown");
        assert_eq!(err, ArgsError::UnknownProvider("nonexistent".to_string()));
    }

    #[test]
    fn the_planner_keeps_tools_unless_disabled_and_the_summarizer_never_has_them() {
        let mut planner = side("anthropic", Job::Planner);
        let with_tools = side_job_args(&planner).expect("argv");
        planner.tools_disabled = true;
        let without_tools = side_job_args(&planner).expect("argv");
        let summarizer = side_job_args(&side("anthropic", Job::Summarizer)).expect("argv");
        assert!(!with_tools.contains(&"--tools".to_string()));
        assert!(without_tools.contains(&"--tools".to_string()));
        assert!(summarizer.contains(&"--tools".to_string()));
    }

    fn spawn_args<'a>(
        permission_mode: &'a str,
        confined_role: Option<&'a str>,
        allowed: &'a [String],
        disallowed: &'a [String],
        roots: &'a [String],
    ) -> SpawnOneArgs<'a> {
        SpawnOneArgs {
            run_id: "run-1",
            binary: "claude",
            model: "model",
            working_dir: "/repo/wt",
            writable_roots: roots,
            query_socket_directory: None,
            prompt: "do it",
            permission_mode,
            allowed_tools: allowed,
            disallowed_tools: disallowed,
            resume_session_id: None,
            system_prompt: None,
            effort: None,
            api_key_env: None,
            credential_id: None,
            workspace_id: None,
            session_id: None,
            mount_id: None,
            cursor_max_mode: false,
            writer_lease: None,
            write_set_lease: None,
            confined_role,
            blocks_push: false,
            is_auto_child: false,
            excludes_tmp: false,
        }
    }

    fn value_after(argv: &[String], flag: &str) -> Option<String> {
        argv.windows(2)
            .find(|pair| pair[0] == flag)
            .map(|pair| pair[1].clone())
    }

    #[test]
    fn a_read_only_claude_role_gets_a_built_in_tool_list_whatever_the_session_mode() {
        let allowed = strings(&["Bash(ls:*)"]);
        let disallowed = strings(&["Read(.env)"]);
        for mode in ["default", "acceptEdits", "bypassPermissions", "plan"] {
            for role in ["scout", "planner", "investigator", "reviewer"] {
                let args = spawn_args(mode, Some(role), &allowed, &disallowed, &[]);
                let argv = turn_args("claude", &args);
                assert_eq!(
                    value_after(&argv, "--tools").as_deref(),
                    Some("Read,Grep,Glob")
                );
                assert_eq!(
                    value_after(&argv, "--permission-mode").as_deref(),
                    Some("plan")
                );
                assert!(!argv.contains(&"--allowedTools".to_string()));
                let denied = value_after(&argv, "--disallowedTools").expect("deny list");
                for tool in [
                    "Read(.env)",
                    "Task",
                    "Agent",
                    "Bash",
                    "Edit",
                    "Write",
                    "mcp__*",
                ] {
                    assert!(
                        denied.split(',').any(|entry| entry == tool),
                        "{tool} in {denied}"
                    );
                }
            }
        }
    }

    #[test]
    fn a_writer_role_keeps_the_session_mode_and_loses_native_subagents() {
        let roots = strings(&["/repo/.meta"]);
        let args = spawn_args("acceptEdits", Some("implementer"), &[], &[], &roots);
        let argv = turn_args("claude", &args);
        assert_eq!(
            value_after(&argv, "--permission-mode").as_deref(),
            Some("acceptEdits")
        );
        assert!(!argv.contains(&"--tools".to_string()));
        assert_eq!(
            value_after(&argv, "--add-dir").as_deref(),
            Some("/repo/.meta")
        );
        let denied = value_after(&argv, "--disallowedTools").expect("deny list");
        assert!(denied.split(',').any(|entry| entry == "Task"));
        assert!(!denied.split(',').any(|entry| entry == "Bash"));
    }

    #[test]
    fn an_auto_child_on_claude_denies_git_push_and_no_verify_and_other_turns_do_not() {
        let mut child = spawn_args("acceptEdits", Some("implementer"), &[], &[], &[]);
        child.is_auto_child = true;
        let denied = value_after(&turn_args("claude", &child), "--disallowedTools").expect("deny");
        for rule in [
            "Bash(git push:*)",
            "Bash(git push *)",
            "Bash(*--no-verify*)",
        ] {
            assert!(denied.split(',').any(|entry| entry == rule), "{rule}");
        }
        let hand = spawn_args("acceptEdits", Some("implementer"), &[], &[], &[]);
        let hand_denied =
            value_after(&turn_args("claude", &hand), "--disallowedTools").expect("deny");
        assert!(!hand_denied.contains("git push"));
        assert!(!hand_denied.contains("--no-verify"));
    }

    #[test]
    fn a_turn_with_no_confined_role_builds_the_arguments_it_always_did() {
        let allowed = strings(&["Bash(ls:*)"]);
        let args = spawn_args("bypassPermissions", None, &allowed, &[], &[]);
        let argv = turn_args("claude", &args);
        assert!(!argv.contains(&"--tools".to_string()));
        assert_eq!(
            value_after(&argv, "--permission-mode").as_deref(),
            Some("bypassPermissions")
        );
        assert_eq!(
            value_after(&argv, "--allowedTools").as_deref(),
            Some("Bash(ls:*)")
        );
        assert_eq!(
            value_after(&argv, "--disallowedTools").as_deref(),
            Some("mcp__*")
        );
    }

    #[test]
    fn a_read_only_role_runs_codex_in_the_read_only_sandbox_even_when_bypassing() {
        let roots = strings(&["/repo/.meta"]);
        let args = spawn_args("bypassPermissions", Some("reviewer"), &[], &[], &roots);
        let argv = turn_args("codex", &args);
        assert_eq!(value_after(&argv, "-s").as_deref(), Some("read-only"));
        assert!(!argv.contains(&"--add-dir".to_string()));
        let writer = spawn_args("acceptEdits", Some("tester"), &[], &[], &roots);
        let writer_argv = turn_args("codex", &writer);
        assert_eq!(
            value_after(&writer_argv, "-s").as_deref(),
            Some("workspace-write")
        );
        assert_eq!(
            value_after(&writer_argv, "--add-dir").as_deref(),
            Some("/repo/.meta")
        );
    }

    #[test]
    fn a_codex_writer_in_a_linked_worktree_gets_the_common_and_the_own_git_dir() {
        let roots = strings(&[
            "/repo/api/.git",
            "/repo/api/.git/worktrees/first",
            "/repo/api/.git/worktrees/second",
        ]);
        let args = spawn_args("acceptEdits", Some("implementer"), &[], &[], &roots);
        let argv = turn_args("codex", &args);
        let added: Vec<&str> = argv
            .windows(2)
            .filter(|pair| pair[0] == "--add-dir")
            .map(|pair| pair[1].as_str())
            .collect();
        assert_eq!(value_after(&argv, "-s").as_deref(), Some("workspace-write"));
        assert_eq!(
            added,
            vec![
                "/repo/api/.git",
                "/repo/api/.git/worktrees/first",
                "/repo/api/.git/worktrees/second"
            ]
        );
    }

    #[test]
    fn a_read_only_role_never_gets_the_bypass_flags_of_cursor_gemini_or_opencode() {
        let args = spawn_args("bypassPermissions", Some("scout"), &[], &[], &[]);
        let cursor = turn_args("cursor-agent", &args);
        assert!(!cursor.contains(&"--force".to_string()));
        assert_eq!(value_after(&cursor, "--mode").as_deref(), Some("plan"));
        let agy = turn_args("agy", &args);
        assert!(!agy.contains(&"--dangerously-skip-permissions".to_string()));
        assert_eq!(value_after(&agy, "--mode").as_deref(), Some("plan"));
        assert!(agy.contains(&"--sandbox".to_string()));
        let opencode = turn_args("opencode", &args);
        assert_eq!(value_after(&opencode, "--agent").as_deref(), Some("plan"));
    }

    #[test]
    fn a_copilot_turn_always_carries_its_non_interactive_flags() {
        for mode in ["default", "plan", "acceptEdits", "bypassPermissions"] {
            let args = spawn_args(mode, None, &[], &[], &[]);
            let argv = turn_args("copilot", &args);
            assert_eq!(&argv[..2], ["-p", "do it"], "{mode}");
            assert_eq!(value_after(&argv, "--model").as_deref(), Some("model"));
            assert_eq!(value_after(&argv, "-C").as_deref(), Some("/repo/wt"));
            for flag in [
                "--output-format=json",
                "--disable-client-telemetry",
                "--no-auto-update",
                "--disable-builtin-mcps",
                "--no-ask-user",
                "--allow-all-tools",
            ] {
                assert!(argv.contains(&flag.to_string()), "{mode} lacks {flag}");
            }
            assert!(!argv.contains(&"--allow-all".to_string()), "{mode}");
            assert!(!argv.contains(&"--yolo".to_string()), "{mode}");
            assert!(!argv.contains(&"--allow-all-paths".to_string()), "{mode}");
        }
    }

    #[test]
    fn a_copilot_turn_denies_what_its_mode_does_not_allow() {
        let denied = |mode: &str| -> Vec<String> {
            let args = spawn_args(mode, None, &[], &[], &[]);
            turn_args("copilot", &args)
                .into_iter()
                .filter(|arg| arg.starts_with("--deny-tool="))
                .collect()
        };
        for mode in ["default", "dontAsk", "plan", "anything-unknown"] {
            assert_eq!(
                denied(mode),
                strings(&[
                    "--deny-tool=write",
                    "--deny-tool=shell",
                    "--deny-tool=memory"
                ]),
                "{mode}"
            );
        }
        assert_eq!(denied("acceptEdits"), strings(&["--deny-tool=shell"]));
        assert!(denied("bypassPermissions").is_empty());
    }

    #[test]
    fn a_copilot_full_access_turn_allows_urls_and_no_other_turn_does() {
        let allows_urls = |mode: &str| {
            let args = spawn_args(mode, None, &[], &[], &[]);
            turn_args("copilot", &args).contains(&"--allow-all-urls".to_string())
        };
        assert!(allows_urls("bypassPermissions"));
        for mode in ["default", "plan", "acceptEdits"] {
            assert!(!allows_urls(mode), "{mode}");
        }
    }

    #[test]
    fn a_read_only_copilot_role_never_gets_the_full_access_flags() {
        let args = spawn_args("bypassPermissions", Some("scout"), &[], &[], &[]);
        let argv = turn_args("copilot", &args);
        assert!(!argv.contains(&"--allow-all-urls".to_string()));
        assert!(argv.contains(&"--deny-tool=write".to_string()));
        assert!(argv.contains(&"--deny-tool=shell".to_string()));
        assert!(read_only_violations(Cli::Copilot, Job::Turn, &argv).is_empty());
    }

    #[test]
    fn a_copilot_turn_names_its_roots_its_effort_and_its_session() {
        let roots = strings(&["/repo/.meta", "/repo/wt-2"]);
        let mut args = spawn_args("default", None, &[], &[], &roots);
        args.effort = Some("high");
        args.resume_session_id = Some("session-ledger-core-1");
        args.query_socket_directory = Some("/run/goodboy");
        let argv = turn_args("copilot", &args);
        let added: Vec<&str> = argv
            .windows(2)
            .filter(|pair| pair[0] == "--add-dir")
            .map(|pair| pair[1].as_str())
            .collect();
        assert_eq!(added, ["/repo/.meta", "/repo/wt-2", "/run/goodboy"]);
        assert_eq!(
            value_after(&argv, "--reasoning-effort").as_deref(),
            Some("high")
        );
        assert!(argv.contains(&"--resume=session-ledger-core-1".to_string()));
        let fresh = turn_args("copilot", &spawn_args("default", None, &[], &[], &[]));
        assert!(!fresh.iter().any(|arg| arg.starts_with("--resume")));
        assert!(!fresh.contains(&"--reasoning-effort".to_string()));
    }

    #[test]
    fn a_copilot_turn_keeps_the_prompt_in_argv_and_off_stdin() {
        assert!(!prompt_on_stdin(Cli::Copilot));
        let args = spawn_args("default", None, &[], &[], &[]);
        assert_eq!(turn_stdin("copilot", &args), None);
    }

    #[test]
    fn the_copilot_policy_rejects_a_missing_deny_and_a_blanket_grant() {
        let missing = strings(&["-p", "plan", "--allow-all-tools", "--deny-tool=write"]);
        let found = read_only_violations(Cli::Copilot, Job::Planner, &missing);
        assert!(found.contains(&"--deny-tool=shell is missing".to_string()));
        assert!(found.contains(&"--deny-tool=memory is missing".to_string()));
        let granted = strings(&[
            "-p",
            "plan",
            "--allow-all-tools",
            "--deny-tool=write",
            "--deny-tool=shell",
            "--deny-tool=memory",
            "--allow-all-urls",
            "--allow-all-paths",
            "--yolo",
        ]);
        let found = read_only_violations(Cli::Copilot, Job::Summarizer, &granted);
        for flag in ["--allow-all-urls", "--allow-all-paths", "--yolo"] {
            assert!(
                found.contains(&format!("{flag} must not be set")),
                "{flag}: {found:?}"
            );
        }
    }

    #[test]
    fn a_copilot_side_job_denies_reads_and_urls_only_when_it_has_no_tools() {
        let planner = side_job_args(&side("copilot", Job::Planner)).expect("argv");
        assert!(!planner.contains(&"--deny-tool=read".to_string()));
        let summarizer = side_job_args(&side("copilot", Job::Summarizer)).expect("argv");
        assert!(summarizer.contains(&"--deny-tool=read".to_string()));
        assert!(summarizer.contains(&"--deny-tool=url".to_string()));
        let mut bare = side("copilot", Job::Planner);
        bare.tools_disabled = true;
        let argv = side_job_args(&bare).expect("argv");
        assert!(argv.contains(&"--deny-tool=read".to_string()));
        assert!(argv.contains(&"--deny-tool=url".to_string()));
    }

    #[test]
    fn auto_is_a_read_only_role_like_a_scout() {
        assert_eq!(role_access("auto"), Some(RoleAccess::ReadOnly));
        assert_eq!(role_access("auto"), role_access("scout"));
    }

    #[test]
    fn auto_gets_the_argv_of_a_scout_on_every_provider() {
        let roots = strings(&["/repo/.meta"]);
        let allowed = strings(&["Bash(rm:*)"]);
        let disallowed = strings(&["Read(.env)"]);
        for mode in ["default", "acceptEdits", "bypassPermissions", "plan"] {
            for binary in [
                "claude",
                "codex",
                "cursor-agent",
                "agy",
                "copilot",
                "opencode",
            ] {
                let auto = spawn_args(mode, Some("auto"), &allowed, &disallowed, &roots);
                let scout = spawn_args(mode, Some("scout"), &allowed, &disallowed, &roots);
                assert_eq!(
                    turn_args(binary, &auto),
                    turn_args(binary, &scout),
                    "{binary} in {mode}"
                );
            }
        }
    }

    #[test]
    fn auto_on_claude_reads_only_and_holds_no_bash_rule() {
        let allowed = strings(&["Bash(rm:*)"]);
        let disallowed = strings(&["Read(.env)"]);
        for mode in ["default", "acceptEdits", "bypassPermissions", "plan"] {
            let args = spawn_args(mode, Some("auto"), &allowed, &disallowed, &[]);
            let argv = turn_args("claude", &args);
            assert_eq!(
                value_after(&argv, "--tools").as_deref(),
                Some("Read,Grep,Glob")
            );
            assert_eq!(
                value_after(&argv, "--permission-mode").as_deref(),
                Some("plan")
            );
            assert!(!argv.contains(&"--allowedTools".to_string()));
            assert!(argv.iter().all(|arg| !arg.contains("Bash(")));
            assert!(argv.iter().all(|arg| !arg.contains("query agent")));
            let denied = value_after(&argv, "--disallowedTools").expect("deny list");
            for tool in [
                "Read(.env)",
                "Task",
                "Agent",
                "Bash",
                "Edit",
                "Write",
                "MultiEdit",
                "NotebookEdit",
                "mcp__*",
            ] {
                assert!(
                    denied.split(',').any(|entry| entry == tool),
                    "{tool} in {denied}"
                );
            }
        }
    }

    #[test]
    fn auto_on_another_cli_never_gets_a_bypass_flag_or_a_write_sandbox() {
        let roots = strings(&["/repo/.meta"]);
        let args = spawn_args("bypassPermissions", Some("auto"), &[], &[], &roots);
        let codex = turn_args("codex", &args);
        assert_eq!(value_after(&codex, "-s").as_deref(), Some("read-only"));
        assert!(!codex.contains(&"--add-dir".to_string()));
        let cursor = turn_args("cursor-agent", &args);
        assert!(!cursor.contains(&"--force".to_string()));
        assert_eq!(value_after(&cursor, "--mode").as_deref(), Some("plan"));
        let agy = turn_args("agy", &args);
        assert!(!agy.contains(&"--dangerously-skip-permissions".to_string()));
        assert_eq!(value_after(&agy, "--mode").as_deref(), Some("plan"));
        assert!(agy.contains(&"--sandbox".to_string()));
        let opencode = turn_args("opencode", &args);
        assert_eq!(value_after(&opencode, "--agent").as_deref(), Some("plan"));
    }

    #[test]
    fn the_writer_roles_match_the_auto_writer_roles_of_core() {
        let source = include_str!("../../../../../packages/core/src/auto/roles.ts");
        let start = source
            .find("AUTO_WRITER_ROLES = [")
            .expect("AUTO_WRITER_ROLES in core");
        let end = start + source[start..].find(']').expect("end of the list");
        let mut core: Vec<&str> = source[start..end].split('\'').skip(1).step_by(2).collect();
        let mut rust: Vec<&str> = WRITER_ROLES.to_vec();
        core.sort_unstable();
        rust.sort_unstable();
        assert_eq!(core, rust);
        for role in ["scribe", "ci-fixer", "rewriter"] {
            assert_eq!(role_access(role), Some(RoleAccess::Writer));
            let args = spawn_args("acceptEdits", Some(role), &[], &[], &[]);
            let argv = turn_args("claude", &args);
            assert_eq!(value_after(&argv, "--tools"), None);
            assert_ne!(
                value_after(&argv, "--permission-mode").as_deref(),
                Some("plan")
            );
        }
    }

    #[test]
    fn an_unknown_confined_role_is_treated_as_read_only() {
        assert_eq!(role_access("custom"), None);
        let args = spawn_args("bypassPermissions", Some("custom"), &[], &[], &[]);
        let argv = turn_args("claude", &args);
        assert_eq!(
            value_after(&argv, "--tools").as_deref(),
            Some("Read,Grep,Glob")
        );
    }
}
