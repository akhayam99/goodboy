use std::sync::mpsc::{channel, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde_json::Value;

use super::*;
use crate::fake_cli::FakeCli;

static PARENT_ENV: Mutex<()> = Mutex::new(());

struct ParentEnv {
    saved: Vec<(&'static str, Option<std::ffi::OsString>)>,
    _lock: std::sync::MutexGuard<'static, ()>,
}

impl ParentEnv {
    fn set(keys: &[&'static str]) -> Self {
        let lock = PARENT_ENV
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let saved = keys
            .iter()
            .map(|key| (*key, std::env::var_os(key)))
            .collect();
        for key in keys {
            std::env::set_var(key, "parent-value");
        }
        Self { saved, _lock: lock }
    }
}

impl Drop for ParentEnv {
    fn drop(&mut self) {
        for (key, value) in &self.saved {
            match value {
                Some(value) => std::env::set_var(key, value),
                None => std::env::remove_var(key),
            }
        }
    }
}

const WAIT: Duration = Duration::from_secs(30);

#[derive(Clone)]
struct Recorder(Arc<Mutex<Sender<(String, Value)>>>);

impl TurnEmitter for Recorder {
    fn emit_turn<S: Serialize + Clone>(&self, event: &str, payload: S) {
        let value = serde_json::to_value(payload).expect("serialize an event");
        let _ = self.0.lock().unwrap().send((event.to_string(), value));
    }
}

struct Run {
    fake: FakeCli,
    registry: TurnRegistry,
    leases: crate::worktree_writer::WriterLeases,
    recorder: Recorder,
    events: Receiver<(String, Value)>,
}

impl Run {
    fn new(mode: &str) -> Self {
        let (sender, events) = channel();
        Self {
            fake: FakeCli::stage(mode),
            registry: TurnRegistry::new(),
            leases: crate::worktree_writer::WriterLeases::new(),
            recorder: Recorder(Arc::new(Mutex::new(sender))),
            events,
        }
    }

    fn spawn(&self, binary: &str, prompt: &str) -> Result<String, TurnError> {
        self.spawn_with_lease(binary, prompt, None)
    }

    fn spawn_with_lease(
        &self,
        binary: &str,
        prompt: &str,
        writer_lease: Option<&WriterLeaseBinding>,
    ) -> Result<String, TurnError> {
        let empty: Vec<String> = Vec::new();
        let binary_path = self.fake.binary(binary);
        let work_dir = self.fake.work_dir();
        let args = SpawnOneArgs {
            run_id: "run-1",
            binary: &binary_path,
            model: "fake-model",
            working_dir: &work_dir,
            writable_roots: &empty,
            query_socket_directory: None,
            prompt,
            permission_mode: "default",
            allowed_tools: &empty,
            disallowed_tools: &empty,
            resume_session_id: None,
            system_prompt: None,
            effort: None,
            api_key_env: None,
            credential_id: None,
            workspace_id: None,
            session_id: None,
            mount_id: None,
            cursor_max_mode: false,
            writer_lease,
            blocks_push: true,
            excludes_tmp: false,
        };
        spawn_one(
            &self.recorder,
            &self.registry.0,
            &self.registry.1,
            &self.leases.0,
            args,
        )
    }

    fn next(&self, what: &str) -> (String, Value) {
        match self.events.recv_timeout(WAIT) {
            Ok(event) => event,
            Err(RecvTimeoutError::Timeout) => panic!("timed out waiting for {what}"),
            Err(RecvTimeoutError::Disconnected) => {
                panic!("event channel closed waiting for {what}")
            }
        }
    }

    fn turn_events_until_end(&self) -> Vec<Value> {
        let mut collected = Vec::new();
        loop {
            let (name, value) = self.next("the end of the turn");
            if name != EVENT_NAME {
                continue;
            }
            let is_end = value["type"] == "end";
            collected.push(value);
            if is_end {
                return collected;
            }
        }
    }

    fn wait_until_backlog_finishes(&self, run_id: &str) -> AttachSnapshot {
        let deadline = Instant::now() + WAIT;
        loop {
            let snapshot = self
                .registry
                .1
                .snapshot(run_id, 0)
                .expect("a backlog for the run");
            if !snapshot.is_live {
                return snapshot;
            }
            assert!(Instant::now() < deadline, "the backlog never finished");
            std::thread::sleep(Duration::from_millis(20));
        }
    }
}

impl Drop for Run {
    fn drop(&mut self) {
        shutdown(&self.registry);
    }
}

fn lines_of(events: &[Value]) -> Vec<String> {
    events
        .iter()
        .filter(|event| event["type"] == "line")
        .map(|event| event["line"].as_str().unwrap().to_string())
        .collect()
}

fn end_of(events: &[Value]) -> &Value {
    events
        .last()
        .filter(|event| event["type"] == "end")
        .expect("an end event")
}

fn argv_of(run: &Run) -> Vec<String> {
    run.fake
        .work_file("fake-cli-argv.txt")
        .expect("the fake cli records its argv")
        .lines()
        .map(str::to_string)
        .collect()
}

fn env_of(run: &Run, key: &str) -> String {
    let record = run
        .fake
        .work_file("fake-cli-env.txt")
        .expect("the fake cli records its env");
    let prefix = format!("{key}=");
    record
        .lines()
        .find_map(|line| line.strip_prefix(&prefix))
        .unwrap_or_else(|| panic!("no {key} in the env record"))
        .to_string()
}

const PROMPT: &str = "summarize the Harborline release notes, \"quoted\" $HOME `id` ; done";

fn expected_argv(binary: &str, run: &Run) -> Vec<String> {
    let empty: Vec<String> = Vec::new();
    let binary_path = run.fake.binary(binary);
    let work_dir = run.fake.work_dir();
    let args = SpawnOneArgs {
        run_id: "run-1",
        binary: &binary_path,
        model: "fake-model",
        working_dir: &work_dir,
        writable_roots: &empty,
        query_socket_directory: None,
        prompt: PROMPT,
        permission_mode: "default",
        allowed_tools: &empty,
        disallowed_tools: &empty,
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
        blocks_push: true,
        excludes_tmp: false,
    };
    build_provider_cli_args(binary, &args)
}

fn assert_recorded_stream_reaches_the_sink(binary: &str, stream: &str) -> Run {
    let run = Run::new("ok");
    let run_id = run.spawn(binary, PROMPT).unwrap();
    assert_eq!(run_id, "run-1");

    let events = run.turn_events_until_end();

    assert_eq!(lines_of(&events), FakeCli::stream_lines(stream));
    let end = end_of(&events);
    assert_eq!(end["exit_code"], 0);
    assert_eq!(end["stderr"], "");
    let seqs: Vec<u64> = events
        .iter()
        .map(|event| event["seq"].as_u64().unwrap())
        .collect();
    assert_eq!(seqs, (1..=events.len() as u64).collect::<Vec<_>>());
    assert!(events.iter().all(|event| event["runId"] == "run-1"));
    assert_eq!(argv_of(&run), expected_argv(binary, &run));
    assert_eq!(
        std::fs::canonicalize(env_of(&run, "cwd")).unwrap(),
        std::fs::canonicalize(run.fake.work_dir()).unwrap()
    );
    assert!(live_run_ids(&run.registry).is_empty());
    let snapshot = run.wait_until_backlog_finishes("run-1");
    assert_eq!(snapshot.events.len(), events.len());
    run
}

#[test]
fn claude_recorded_stream_reaches_the_sink_with_stream_json_flags() {
    let run = assert_recorded_stream_reaches_the_sink("claude", "claude.jsonl");
    let argv = argv_of(&run);
    let format = argv
        .iter()
        .position(|arg| arg == "--output-format")
        .unwrap();
    assert_eq!(argv[format + 1], "stream-json");
    assert!(argv.contains(&"--verbose".to_string()));
    assert!(argv.contains(&PROMPT.to_string()));
}

#[test]
fn codex_recorded_stream_reaches_the_sink_with_exec_json_flags() {
    let run = assert_recorded_stream_reaches_the_sink("codex", "codex.jsonl");
    let argv = argv_of(&run);
    assert_eq!(&argv[..3], ["exec", "--json", "--skip-git-repo-check"]);
    let cd = argv.iter().position(|arg| arg == "--cd").unwrap();
    assert_eq!(argv[cd + 1], run.fake.work_dir());
    assert_eq!(argv[argv.len() - 2], "--");
    assert_eq!(argv[argv.len() - 1], PROMPT);
}

#[test]
fn cursor_recorded_stream_reaches_the_sink_with_stream_json_flags() {
    let run = assert_recorded_stream_reaches_the_sink("cursor-agent", "cursor-agent.jsonl");
    let argv = argv_of(&run);
    let format = argv
        .iter()
        .position(|arg| arg == "--output-format")
        .unwrap();
    assert_eq!(argv[format + 1], "stream-json");
    let workspace = argv.iter().position(|arg| arg == "--workspace").unwrap();
    assert_eq!(argv[workspace + 1], run.fake.work_dir());
}

#[test]
fn gemini_recorded_output_reaches_the_sink_as_plain_lines() {
    let run = assert_recorded_stream_reaches_the_sink("agy", "agy.txt");
    let argv = argv_of(&run);
    assert_eq!(argv[0], "-p");
    assert_eq!(argv[1], PROMPT);
    assert!(!argv.contains(&"--output-format".to_string()));
}

#[test]
fn a_failing_cli_reports_its_exit_code_and_stderr_after_the_lines_it_wrote() {
    let run = Run::new("fail");
    run.spawn("claude", PROMPT).unwrap();

    let events = run.turn_events_until_end();

    assert_eq!(
        lines_of(&events),
        FakeCli::stream_lines("claude.jsonl")[..2].to_vec()
    );
    let end = end_of(&events);
    assert_eq!(end["exit_code"], 3);
    assert_eq!(end["stderr"], "fake cli: authentication failed\n");
    assert!(live_run_ids(&run.registry).is_empty());
}

#[test]
fn a_cli_that_floods_stderr_before_stdout_does_not_deadlock_the_turn() {
    let run = Run::new("flood");
    run.spawn("claude", PROMPT).unwrap();

    let events = run.turn_events_until_end();

    assert_eq!(lines_of(&events), FakeCli::stream_lines("claude.jsonl"));
    let end = end_of(&events);
    assert_eq!(end["exit_code"], 0);
    let stderr = end["stderr"].as_str().unwrap();
    assert!(stderr.ends_with("\nflood-tail-marker\n"));
    assert_eq!(stderr.len(), MAX_STDERR_BYTES);
}

#[test]
fn an_unterminated_last_line_is_still_delivered() {
    let run = Run::new("partial");
    run.spawn("codex", PROMPT).unwrap();

    let events = run.turn_events_until_end();

    let mut expected = FakeCli::stream_lines("codex.jsonl");
    expected.push("unterminated final line".to_string());
    assert_eq!(lines_of(&events), expected);
    assert_eq!(end_of(&events)["exit_code"], 0);
}

#[test]
fn non_utf8_output_is_forwarded_lossily() {
    let run = Run::new("binary");
    run.spawn("agy", PROMPT).unwrap();

    let events = run.turn_events_until_end();

    assert_eq!(lines_of(&events), vec!["caf\u{fffd}".to_string()]);
}

#[test]
fn a_silent_cli_ends_the_turn_with_no_lines() {
    let run = Run::new("silent");
    run.spawn("cursor-agent", PROMPT).unwrap();

    let events = run.turn_events_until_end();

    assert_eq!(events.len(), 1);
    assert_eq!(end_of(&events)["exit_code"], 0);
}

#[test]
fn cancelling_a_hung_cli_ends_the_turn_and_takes_its_children_down() {
    let run = Run::new("hang");
    run.spawn("claude", PROMPT).unwrap();
    let first = run.next("the first line");
    assert_eq!(first.1["type"], "line");
    assert_eq!(live_run_ids(&run.registry), vec!["run-1".to_string()]);
    let sleeper = wait_for_sleeper_pid(&run);

    let cancelled_at = Instant::now();
    cancel_run(&run.registry.0, "run-1").unwrap();
    let events = run.turn_events_until_end();

    assert!(
        cancelled_at.elapsed() < Duration::from_secs(10),
        "the turn outlived the cancel"
    );
    assert_eq!(end_of(&events)["exit_code"], Value::Null);
    assert!(live_run_ids(&run.registry).is_empty());
    assert!(matches!(
        cancel_run(&run.registry.0, "run-1"),
        Err(TurnError::NotFound(_))
    ));
    assert!(
        process_is_gone(&sleeper),
        "the child of the cli survived the cancel"
    );
}

fn wait_for_sleeper_pid(run: &Run) -> String {
    let deadline = Instant::now() + WAIT;
    loop {
        if let Some(pid) = run.fake.work_file("fake-cli-sleeper.pid") {
            if !pid.trim().is_empty() {
                return pid.trim().to_string();
            }
        }
        assert!(
            Instant::now() < deadline,
            "the fake cli never started its child"
        );
        std::thread::sleep(Duration::from_millis(20));
    }
}

fn process_is_gone(pid: &str) -> bool {
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        let listed = Command::new("ps")
            .args(["-o", "stat=", "-p", pid])
            .output()
            .expect("run ps");
        let state = String::from_utf8_lossy(&listed.stdout).trim().to_string();
        if state.is_empty() || state.starts_with('Z') {
            return true;
        }
        if Instant::now() >= deadline {
            return false;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

#[test]
fn a_turn_that_blocks_push_carries_the_push_block_and_no_git_tokens() {
    let _env = ParentEnv::set(&["GH_TOKEN", "GITHUB_TOKEN"]);
    let run = Run::new("ok");
    run.spawn("claude", PROMPT).unwrap();
    run.turn_events_until_end();

    assert_eq!(env_of(&run, "GIT_CONFIG_COUNT"), "2");
    assert_eq!(env_of(&run, "GIT_CONFIG_KEY_0"), "remote.origin.pushurl");
    assert_eq!(env_of(&run, "GIT_CONFIG_VALUE_0"), PUSH_BLOCK_URL);
    assert_eq!(env_of(&run, "GIT_CONFIG_KEY_1"), "remote.pushDefault");
    assert_eq!(env_of(&run, "GIT_CONFIG_VALUE_1"), "goodboy-blocked");
    assert_eq!(env_of(&run, "GH_TOKEN"), "__unset__");
    assert_eq!(env_of(&run, "GITHUB_TOKEN"), "__unset__");
}

#[test]
fn a_spawned_cli_never_sees_the_nested_session_marker() {
    let _env = ParentEnv::set(&["CLAUDECODE"]);
    let run = Run::new("ok");
    run.spawn("claude", PROMPT).unwrap();
    run.turn_events_until_end();

    assert_eq!(env_of(&run, "CLAUDECODE"), "__unset__");
}

#[test]
fn a_missing_binary_fails_the_spawn_and_leaves_nothing_registered() {
    let run = Run::new("ok");

    let result = run.spawn("no-such-cli", PROMPT);

    assert!(matches!(result, Err(TurnError::Io(_))));
    assert!(live_run_ids(&run.registry).is_empty());
    assert!(run.registry.1.snapshot("run-1", 0).is_none());
}

#[test]
fn a_writer_lease_the_turn_does_not_own_stops_the_spawn_before_the_cli_starts() {
    let run = Run::new("ok");
    let binding = WriterLeaseBinding {
        path: run.fake.work_dir(),
        holder: "agent-1".to_string(),
        token: "stale-token".to_string(),
    };

    let result = run.spawn_with_lease("claude", PROMPT, Some(&binding));

    assert!(matches!(result, Err(TurnError::WriterLeaseNotOwned)));
    assert!(run.fake.work_file("fake-cli-argv.txt").is_none());
    assert!(live_run_ids(&run.registry).is_empty());
}

#[test]
fn an_owned_writer_lease_is_released_and_announced_when_the_turn_ends() {
    let run = Run::new("ok");
    let path = run.fake.work_dir();
    let granted = crate::worktree_writer::acquire_lease(&run.leases.0, &path, "agent-1", None);
    let binding = WriterLeaseBinding {
        path: path.clone(),
        holder: "agent-1".to_string(),
        token: granted.token.clone().expect("a granted token"),
    };

    run.spawn_with_lease("claude", PROMPT, Some(&binding))
        .unwrap();
    let announced = loop {
        let (name, value) = run.next("the lease exit event");
        if name == crate::worktree_writer::EVENT_NAME {
            break value;
        }
    };

    assert_eq!(announced["reason"], "exited");
    assert_eq!(announced["holder"], "agent-1");
    assert!(crate::worktree_writer::lease_status(&run.leases.0, &path).has_exited);
}
