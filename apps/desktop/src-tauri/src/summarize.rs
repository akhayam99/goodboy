use std::collections::HashMap;
use std::io::Read;
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SummarizeError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("unknown provider: {0}")]
    UnknownProvider(String),
}

crate::util::impl_error_serialize!(SummarizeError);

impl SummarizeError {
    fn kind(&self) -> &'static str {
        match self {
            SummarizeError::Io(_) => "io",
            SummarizeError::UnknownProvider(_) => "unknown_provider",
        }
    }
}

type ChildSlot = Arc<Mutex<Option<Child>>>;
type ChildRegistry = Arc<Mutex<HashMap<String, ChildSlot>>>;

#[derive(Default)]
pub struct SummarizeRegistry(pub ChildRegistry);

impl SummarizeRegistry {
    pub fn new() -> Self {
        Self::default()
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummarizeArgs {
    pub provider_id: String,
    pub model: String,
    pub binary: String,
    pub user_message: String,
    pub system_prompt: String,
    #[serde(default)]
    pub working_dir: Option<String>,
    #[serde(default)]
    pub effort: Option<String>,
    #[serde(default)]
    pub run_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SummarizeResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

#[tauri::command]
pub async fn summarize_session(
    state: State<'_, SummarizeRegistry>,
    args: SummarizeArgs,
) -> Result<SummarizeResult, SummarizeError> {
    let registry = Arc::clone(&state.0);
    tauri::async_runtime::spawn_blocking(move || run_summarize(&registry, args))
        .await
        .map_err(|e| SummarizeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub fn summarize_cancel(
    state: State<'_, SummarizeRegistry>,
    run_id: String,
) -> Result<(), SummarizeError> {
    kill_run(&state.0, &run_id);
    Ok(())
}

fn run_summarize(
    registry: &ChildRegistry,
    args: SummarizeArgs,
) -> Result<SummarizeResult, SummarizeError> {
    let cli_args = build_cli_args(&args)?;

    let mut command = crate::path_env::command(&args.binary);
    crate::aux_spawn::scrub_nested_session_env(&mut command);
    if let Some(dir) = args.working_dir.as_deref() {
        if !dir.is_empty() {
            command.current_dir(dir);
        }
    }

    let mut child = command
        .args(&cli_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| SummarizeError::Io(std::io::Error::other("no stdout")))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| SummarizeError::Io(std::io::Error::other("no stderr")))?;

    let slot: ChildSlot = Arc::new(Mutex::new(Some(child)));
    let run_id = args.run_id.clone();
    if let Some(id) = run_id.as_deref() {
        if let Ok(mut map) = registry.lock() {
            map.insert(id.to_string(), Arc::clone(&slot));
        }
    }

    let stdout_handle = thread::spawn(move || drain(stdout));
    let stderr_handle = thread::spawn(move || drain(stderr));
    let stdout_buf = stdout_handle.join().unwrap_or_default();
    let stderr_buf = stderr_handle.join().unwrap_or_default();
    let exit_code = wait_and_remove(&slot, registry, run_id.as_deref());

    Ok(SummarizeResult {
        stdout: stdout_buf,
        stderr: stderr_buf,
        exit_code,
    })
}

fn drain<R: Read>(mut source: R) -> String {
    let mut buf = Vec::new();
    let _ = source.read_to_end(&mut buf);
    String::from_utf8_lossy(&buf).into_owned()
}

fn kill_run(registry: &ChildRegistry, run_id: &str) {
    let slot = {
        let Ok(map) = registry.lock() else {
            return;
        };
        map.get(run_id).cloned()
    };
    let Some(slot) = slot else {
        return;
    };
    let Ok(mut guard) = slot.lock() else {
        return;
    };
    if let Some(child) = guard.as_mut() {
        let _ = child.kill();
    }
}

fn wait_and_remove(
    slot: &ChildSlot,
    registry: &ChildRegistry,
    run_id: Option<&str>,
) -> Option<i32> {
    let exit = {
        let mut guard = slot.lock().ok()?;
        let child = guard.as_mut()?;
        child.wait().ok().and_then(|status| status.code())
    };
    if let Some(id) = run_id {
        if let Ok(mut map) = registry.lock() {
            map.remove(id);
        }
    }
    exit
}

fn build_cli_args(args: &SummarizeArgs) -> Result<Vec<String>, SummarizeError> {
    match args.provider_id.as_str() {
        "anthropic" => {
            let mut cli_args = vec![
                "-p".to_string(),
                args.user_message.clone(),
                "--model".to_string(),
                args.model.clone(),
                "--system-prompt".to_string(),
                args.system_prompt.clone(),
                "--setting-sources".to_string(),
                crate::aux_spawn::CLAUDE_SETTING_SOURCES.to_string(),
                "--output-format".to_string(),
                "json".to_string(),
                "--no-session-persistence".to_string(),
                "--tools".to_string(),
                String::new(),
            ];
            crate::aux_spawn::push_claude_mcp_deny(&mut cli_args);
            crate::aux_spawn::push_effort_args("anthropic", args.effort.as_deref(), &mut cli_args);
            Ok(cli_args)
        }
        "cursor" => Ok(vec![
            "-p".to_string(),
            format!("{}\n\n{}", args.system_prompt, args.user_message),
            "--model".to_string(),
            args.model.clone(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--force".to_string(),
        ]),
        "codex" => {
            let mut cli_args = vec![
                "exec".to_string(),
                "--json".to_string(),
                "-m".to_string(),
                args.model.clone(),
                "-s".to_string(),
                "read-only".to_string(),
                "--skip-git-repo-check".to_string(),
            ];
            crate::aux_spawn::push_effort_args("codex", args.effort.as_deref(), &mut cli_args);
            cli_args.push(format!("{}\n\n{}", args.system_prompt, args.user_message));
            Ok(cli_args)
        }
        "gemini" => Ok(vec![
            "-p".to_string(),
            format!("{}\n\n{}", args.system_prompt, args.user_message),
            "--model".to_string(),
            args.model.clone(),
            "--sandbox".to_string(),
        ]),
        "opencode" | "openrouter" | "moonshot" => {
            let mut cli_args = vec![
                "run".to_string(),
                "--format".to_string(),
                "json".to_string(),
                "-m".to_string(),
                args.model.clone(),
            ];
            if let Some(working_dir) = args.working_dir.as_deref() {
                cli_args.push("--dir".to_string());
                cli_args.push(working_dir.to_string());
            }
            crate::aux_spawn::push_effort_args(
                &args.provider_id,
                args.effort.as_deref(),
                &mut cli_args,
            );
            cli_args.push("--agent".to_string());
            cli_args.push("plan".to_string());
            cli_args.push("--".to_string());
            cli_args.push(format!("{}\n\n{}", args.system_prompt, args.user_message));
            Ok(cli_args)
        }
        other => Err(SummarizeError::UnknownProvider(other.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_args(provider_id: &str) -> SummarizeArgs {
        SummarizeArgs {
            provider_id: provider_id.to_string(),
            model: "cheap-model".to_string(),
            binary: "claude".to_string(),
            user_message: "summarize this".to_string(),
            system_prompt: "you summarize".to_string(),
            working_dir: None,
            effort: None,
            run_id: None,
        }
    }

    #[test]
    fn anthropic_args_pass_effort_when_set() {
        let mut args = make_args("anthropic");
        args.effort = Some("medium".to_string());
        let cli = build_cli_args(&args).expect("anthropic args");
        let idx = cli.iter().position(|a| a == "--effort").expect("--effort");
        assert_eq!(cli[idx + 1], "medium");
    }

    #[test]
    fn anthropic_args_isolate_user_settings() {
        let cli = build_cli_args(&make_args("anthropic")).expect("anthropic args");
        let idx = cli
            .iter()
            .position(|a| a == "--setting-sources")
            .expect("--setting-sources");
        assert_eq!(cli[idx + 1], "project,local");
        assert!(!cli.iter().any(|a| a == "--bare"));
    }

    #[test]
    fn anthropic_args_disable_builtin_tools() {
        let cli = build_cli_args(&make_args("anthropic")).expect("anthropic args");
        let idx = cli.iter().position(|a| a == "--tools").expect("--tools");
        assert_eq!(cli[idx + 1], "");
    }

    #[test]
    fn anthropic_args_deny_mcp_tools() {
        let cli = build_cli_args(&make_args("anthropic")).expect("anthropic args");
        assert!(cli
            .windows(2)
            .any(|pair| pair[0] == "--disallowedTools" && pair[1] == "mcp__*"));
    }

    #[test]
    fn cursor_and_codex_args_do_not_deny_mcp_tools() {
        for provider_id in ["cursor", "codex"] {
            let cli = build_cli_args(&make_args(provider_id)).expect("provider args");
            assert!(!cli
                .windows(2)
                .any(|pair| pair[0] == "--disallowedTools" && pair[1] == "mcp__*"));
        }
    }

    #[test]
    fn gemini_is_supported() {
        let cli = build_cli_args(&make_args("gemini")).expect("gemini args");
        assert!(cli.iter().any(|a| a == "--sandbox"));
        let idx = cli.iter().position(|a| a == "--model").expect("--model");
        assert_eq!(cli[idx + 1], "cheap-model");
    }

    #[test]
    fn opencode_uses_run_args() {
        let mut args = make_args("opencode");
        args.working_dir = Some("/tmp/project".to_string());
        let cli = build_cli_args(&args).expect("opencode args");
        assert_eq!(
            cli,
            vec![
                "run",
                "--format",
                "json",
                "-m",
                "cheap-model",
                "--dir",
                "/tmp/project",
                "--agent",
                "plan",
                "--",
                "you summarize\n\nsummarize this",
            ]
        );
    }

    #[test]
    fn unknown_provider_is_rejected() {
        let err = build_cli_args(&make_args("nonexistent")).expect_err("unknown provider");
        assert_eq!(err.kind(), "unknown_provider");
    }

    #[cfg(unix)]
    fn register_sleeping_child(registry: &ChildRegistry, run_id: &str) -> ChildSlot {
        let child = std::process::Command::new("sleep")
            .arg("30")
            .spawn()
            .expect("spawn sleep");
        let slot: ChildSlot = Arc::new(Mutex::new(Some(child)));
        registry
            .lock()
            .expect("registry")
            .insert(run_id.to_string(), Arc::clone(&slot));
        slot
    }

    #[cfg(unix)]
    fn assert_exits_within(slot: &ChildSlot, budget: std::time::Duration, message: &str) {
        let deadline = std::time::Instant::now() + budget;
        loop {
            let exited = slot
                .lock()
                .expect("slot")
                .as_mut()
                .expect("child")
                .try_wait()
                .expect("try_wait")
                .is_some();
            if exited {
                return;
            }
            assert!(std::time::Instant::now() < deadline, "{message}");
            thread::sleep(std::time::Duration::from_millis(20));
        }
    }

    #[cfg(unix)]
    #[test]
    fn cancel_kills_the_registered_child() {
        let registry: ChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let slot = register_sleeping_child(&registry, "run-1");

        kill_run(&registry, "run-1");

        assert_exits_within(
            &slot,
            std::time::Duration::from_secs(2),
            "cancel left the child running",
        );
    }

    #[cfg(unix)]
    #[test]
    fn cancel_leaves_a_different_run_alive() {
        let registry: ChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let cancelled = register_sleeping_child(&registry, "run-1");
        let other = register_sleeping_child(&registry, "run-2");

        kill_run(&registry, "run-1");

        assert_exits_within(
            &cancelled,
            std::time::Duration::from_secs(2),
            "cancel left the child running",
        );
        assert!(other
            .lock()
            .expect("slot")
            .as_mut()
            .expect("child")
            .try_wait()
            .expect("try_wait")
            .is_none());
        kill_run(&registry, "run-2");
    }

    #[test]
    fn cancel_for_an_unknown_run_is_a_no_op() {
        let registry: ChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        kill_run(&registry, "missing");
        assert!(registry.lock().expect("registry").is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn waiting_drops_the_registry_entry() {
        let registry: ChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let slot = register_sleeping_child(&registry, "run-1");
        kill_run(&registry, "run-1");

        wait_and_remove(&slot, &registry, Some("run-1"));

        assert!(registry.lock().expect("registry").is_empty());
    }
}
