use super::*;

fn turn(run_id: &str, pid: u32) -> LiveTurn {
    LiveTurn {
        run_id: run_id.to_string(),
        pid,
        output_idle: Duration::from_secs(0),
    }
}

fn entry(pid: u32, session_id: &str, mount_id: Option<&str>, started_at: u64) -> LedgerEntry {
    LedgerEntry {
        spawn_id: format!("spawn-{pid}"),
        kind: "turn",
        pid,
        pgid: None,
        session_id: Some(session_id.to_string()),
        mount_path: None,
        cwd: None,
        started_at,
        agent_id: Some(format!("agent-{pid}")),
        run_id: None,
        mount_id: mount_id.map(str::to_string),
        branch: Some("northwind/retry".to_string()),
        branch_path: None,
        reflog_mark: None,
    }
}

fn tracker_after(binary: &str, lines: &[&str]) -> ToolTracker {
    let tracker = ToolTracker::default();
    tracker.begin("run-1", can_see_tools_of(binary));
    for text in lines {
        tracker.feed("run-1", text);
    }
    tracker
}

fn sight_after(lines: &[&str]) -> ToolSight {
    tracker_after("claude", lines).sight("run-1")
}

const CLAUDE_BASH: &str = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_1","name":"Bash","input":{"command":"pnpm test retry"}}]}}"#;
const CLAUDE_BASH_DONE: &str = r#"{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"ok"}]}}"#;
const CLAUDE_TEXT: &str = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"Looking at the ledger"}]}}"#;

#[test]
fn an_open_tool_call_is_the_last_tool() {
    let sight = sight_after(&[CLAUDE_TEXT, CLAUDE_BASH]);

    assert_eq!(
        sight.tool,
        Some(WorkTool {
            name: "Bash".to_string(),
            command: Some("pnpm test retry".to_string()),
            path: None,
        })
    );
    assert!(sight.has_tool_call);
}

#[test]
fn a_run_without_a_tool_call_says_so() {
    let sight = sight_after(&[CLAUDE_TEXT]);

    assert_eq!(sight.tool, None);
    assert!(!sight.has_tool_call);
}

#[test]
fn an_ended_tool_call_is_no_longer_the_last_tool() {
    let sight = sight_after(&[CLAUDE_BASH, CLAUDE_BASH_DONE]);

    assert_eq!(sight.tool, None);
    assert!(sight.has_tool_call);
}

#[test]
fn a_parallel_call_still_open_stays_the_last_tool() {
    let both = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","id":"a","name":"Read","input":{"file_path":"src/ledger/export.ts"}},{"type":"tool_use","id":"b","name":"Grep","input":{"pattern":"retry"}}]}}"#;
    let second_done =
        r#"{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"b"}]}}"#;

    let sight = sight_after(&[both, second_done]);

    assert_eq!(
        sight.tool,
        Some(WorkTool {
            name: "Read".to_string(),
            command: None,
            path: Some("src/ledger/export.ts".to_string()),
        })
    );
}

#[test]
fn every_provider_shape_the_parsers_read_gives_its_tool() {
    let codex = r#"{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"cargo test -p ledger-core","status":"in_progress"}}"#;
    let copilot = r#"{"type":"tool.execution_start","data":{"toolCallId":"call_1","toolName":"view","arguments":{"path":"notify-relay/src/main.rs"}}}"#;
    let opencode = r#"{"type":"tool_use","part":{"id":"prt_1","callID":"call_9","type":"tool","tool":"bash","state":{"status":"running","input":{"command":"pnpm lint"}}}}"#;

    assert_eq!(
        sight_after(&[codex])
            .tool
            .map(|tool| (tool.name, tool.command)),
        Some((
            "shell".to_string(),
            Some("cargo test -p ledger-core".to_string())
        ))
    );
    assert_eq!(
        sight_after(&[copilot]).tool.and_then(|tool| tool.path),
        Some("notify-relay/src/main.rs".to_string())
    );
    assert_eq!(
        sight_after(&[opencode]).tool.and_then(|tool| tool.command),
        Some("pnpm lint".to_string())
    );
}

#[test]
fn each_provider_end_closes_its_call() {
    let codex = [
        r#"{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"pnpm test"}}"#,
        r#"{"type":"item.completed","item":{"id":"item_1","type":"command_execution","exit_code":0}}"#,
    ];
    let copilot = [
        r#"{"type":"tool.execution_start","data":{"toolCallId":"call_1","toolName":"bash","arguments":{"command":"pnpm test"}}}"#,
        r#"{"type":"tool.execution_complete","data":{"toolCallId":"call_1","success":true}}"#,
    ];
    let opencode = [
        r#"{"type":"tool_use","part":{"callID":"call_9","type":"tool","tool":"bash","state":{"status":"completed","input":{"command":"pnpm lint"}}}}"#,
    ];

    assert_eq!(sight_after(&codex).tool, None);
    assert_eq!(sight_after(&copilot).tool, None);
    assert_eq!(sight_after(&opencode).tool, None);
    assert!(sight_after(&opencode).has_tool_call);
}

#[test]
fn a_line_that_is_not_json_is_skipped() {
    let sight = sight_after(&["tool output that is plain text", CLAUDE_BASH]);

    assert!(sight.tool.is_some());
}

#[test]
fn a_later_line_closes_the_call_an_earlier_read_saw_open() {
    let tracker = tracker_after("claude", &[CLAUDE_BASH]);
    assert!(tracker.sight("run-1").tool.is_some());

    tracker.feed("run-1", CLAUDE_BASH_DONE);

    assert_eq!(tracker.sight("run-1").tool, None);
}

#[test]
fn an_ended_run_is_forgotten_by_the_tracker() {
    let tracker = tracker_after("claude", &[CLAUDE_BASH]);

    tracker.keep(&[turn("run-2", 20)]);

    assert!(lock_or_recover(&tracker.0).is_empty());
}

#[test]
fn a_run_that_ended_is_dropped_on_its_own() {
    let tracker = tracker_after("claude", &[CLAUDE_BASH]);

    tracker.forget("run-1");

    assert_eq!(tracker.sight("run-1"), ToolSight::default());
}

#[test]
fn a_codex_patch_completion_counts_as_a_tool_call() {
    let patch = r#"{"type":"item.completed","item":{"id":"item_3","type":"apply_patch","changes":[{"path":"src/ledger/export.ts","kind":"modify"}]}}"#;
    let change = r#"{"type":"item.completed","item":{"id":"item_4","type":"file_change"}}"#;

    assert!(
        tracker_after("codex", &[patch])
            .sight("run-1")
            .has_tool_call
    );
    assert!(
        tracker_after("codex", &[change])
            .sight("run-1")
            .has_tool_call
    );
}

#[test]
fn a_text_frame_that_only_mentions_a_tool_is_not_tool_work() {
    let tracker = tracker_after("claude", &[]);
    let nested = r#"{"type":"assistant","parent_tool_use_id":"toolu_1","message":{"content":[{"type":"text","text":"the tool is fine"}]}}"#;
    let mention = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"run the tool_use block"}]}}"#;

    assert!(!tracker.feed("run-1", nested));
    assert!(!tracker.feed("run-1", mention));
    assert!(!tracker.feed("run-1", CLAUDE_TEXT));
    assert!(tracker.feed("run-1", CLAUDE_BASH));
    assert!(tracker.feed("run-1", CLAUDE_BASH_DONE));
}

#[test]
fn a_tool_start_split_over_lines_is_assembled() {
    let sight = sight_after(&[
        r#"{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_7","name":"Bash","input":"#,
        r#"{"command":"pnpm test retry"}}]}}"#,
    ]);

    assert_eq!(
        sight.tool.and_then(|tool| tool.command),
        Some("pnpm test retry".to_string())
    );
}

#[test]
fn a_raw_newline_inside_a_string_is_accepted() {
    let sight = sight_after(&[
        "{\"type\":\"assistant\",\"message\":{\"content\":[{\"type\":\"tool_use\",\"id\":\"toolu_8\",\"name\":\"Bash\",\"input\":{\"command\":\"cd ledger-core",
        "pnpm test\"}}]}}",
    ]);

    assert_eq!(
        sight.tool.and_then(|tool| tool.command),
        Some("cd ledger-core\npnpm test".to_string())
    );
}

#[test]
fn a_split_result_closes_its_call() {
    let sight = sight_after(&[
        CLAUDE_BASH,
        r#"{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"a"#,
        r#"b"}]}}"#,
    ]);

    assert_eq!(sight.tool, None);
    assert!(sight.has_tool_call);
}

#[test]
fn the_held_lines_are_bounded() {
    let tracker = tracker_after("claude", &[]);

    tracker.feed("run-1", r#"{"type":"assistant","message":{"content":["#);
    for _ in 0..200 {
        tracker.feed("run-1", "noise");
    }

    let held = lock_or_recover(&tracker.0)
        .get("run-1")
        .map(|state| state.assembler.held_lines());
    assert_eq!(held, Some(0));
    assert!(tracker.feed("run-1", CLAUDE_BASH));
}

#[test]
fn a_cursor_call_opens_and_closes_by_its_call_id() {
    let started = r#"{"type":"tool_call","subtype":"started","call_id":"call_1"}"#;
    let completed = r#"{"type":"tool_call","subtype":"completed","call_id":"call_1"}"#;
    let tracker = tracker_after("cursor-agent", &[started]);

    let open = tracker.sight("run-1");
    tracker.feed("run-1", completed);
    let done = tracker.sight("run-1");

    assert_eq!(
        open.tool,
        Some(WorkTool {
            name: "tool".to_string(),
            command: None,
            path: None,
        })
    );
    assert!(open.has_tool_call);
    assert_eq!(done.tool, None);
    assert!(done.has_tool_call);
}

#[test]
fn only_providers_that_stream_tool_frames_can_be_seen() {
    assert!(can_see_tools_of("claude"));
    assert!(can_see_tools_of("/usr/local/bin/codex"));
    assert!(can_see_tools_of("cursor-agent"));
    assert!(can_see_tools_of("copilot"));
    assert!(can_see_tools_of("opencode"));
    assert!(!can_see_tools_of("agy"));
    assert!(!can_see_tools_of("some-wrapper"));
}

#[test]
fn a_run_of_an_unseen_provider_never_claims_no_tool_call() {
    let sight = tracker_after("agy", &[CLAUDE_TEXT]).sight("run-1");

    assert!(!sight.can_see_tools);
    assert!(!sight.has_tool_call);
}

#[test]
fn one_row_per_live_run_with_session_agent_mount_and_last_tool() {
    let turns = [turn("run-b", 20), turn("run-a", 10)];
    let ledger: HashMap<u32, LedgerEntry> = [
        (10, entry(10, "session-1", Some("mount-payments-api"), 100)),
        (20, entry(20, "session-1", None, 200)),
    ]
    .into_iter()
    .collect();
    let quiet = [TurnQuiet {
        run_id: "run-a".to_string(),
        quiet_ms: 4_000,
    }];

    let rows = rows_of(&turns, &ledger, &quiet, None, |run_id| ToolSight {
        tool: (run_id == "run-a").then(|| WorkTool {
            name: "Bash".to_string(),
            command: Some("pnpm test retry".to_string()),
            path: None,
        }),
        has_tool_call: run_id == "run-a",
        can_see_tools: true,
    });

    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].run_id, "run-a");
    assert_eq!(rows[0].session_id.as_deref(), Some("session-1"));
    assert_eq!(rows[0].agent_id.as_deref(), Some("agent-10"));
    assert_eq!(rows[0].mount_id.as_deref(), Some("mount-payments-api"));
    assert_eq!(rows[0].quiet_ms, Some(4_000));
    assert_eq!(rows[0].started_at, Some(100));
    assert!(rows[0].tool.is_some());
    assert_eq!(rows[1].mount_id, None);
    assert_eq!(rows[1].quiet_ms, None);
    assert!(!rows[1].has_tool_call);
}

#[test]
fn a_run_the_ledger_does_not_know_keeps_its_row_without_a_session() {
    let rows = rows_of(&[turn("run-a", 10)], &HashMap::new(), &[], None, |_| {
        ToolSight::default()
    });

    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].session_id, None);
    assert_eq!(rows[0].started_at, None);
}

#[test]
fn the_row_wire_shape_is_camel_case() {
    let rows = rows_of(
        &[turn("run-a", 10)],
        &[(10, entry(10, "session-1", None, 100))]
            .into_iter()
            .collect(),
        &[],
        None,
        |_| ToolSight::default(),
    );

    let wire = serde_json::to_value(&rows[0]).expect("row");

    assert_eq!(wire["runId"], "run-a");
    assert_eq!(wire["sessionId"], "session-1");
    assert_eq!(wire["hasToolCall"], false);
    assert_eq!(wire["canSeeTools"], false);
    assert!(wire["mountId"].is_null());
    assert!(wire["tool"].is_null());
}

fn scope(session_id: &str, mount_id: Option<&str>) -> WorkScope {
    WorkScope {
        session_id: session_id.to_string(),
        mount_id: mount_id.map(str::to_string),
    }
}

#[test]
fn a_session_gets_at_most_one_event_a_second() {
    let pulse = WorkPulse::default();
    let start = Instant::now();
    pulse.mark(&scope("session-1", Some("mount-1")));

    let first = pulse.due(start);
    pulse.mark(&scope("session-1", Some("mount-1")));
    let too_soon = pulse.due(start + Duration::from_millis(400));
    let later = pulse.due(start + PULSE_EVERY);

    assert_eq!(
        first,
        vec![WorkChanged {
            session_id: "session-1".to_string(),
            mount_id: Some("mount-1".to_string()),
        }]
    );
    assert!(too_soon.is_empty());
    assert_eq!(later.len(), 1);
    assert!(pulse.due(start + PULSE_EVERY * 3).is_empty());
}

#[test]
fn many_marks_in_one_second_are_one_event() {
    let pulse = WorkPulse::default();
    for _ in 0..50 {
        pulse.mark(&scope("session-1", Some("mount-1")));
    }

    assert_eq!(pulse.due(Instant::now()).len(), 1);
}

#[test]
fn two_mounts_in_one_second_name_the_session_only() {
    let pulse = WorkPulse::default();
    pulse.mark(&scope("session-1", Some("mount-1")));
    pulse.mark(&scope("session-1", Some("mount-2")));

    let changes = pulse.due(Instant::now());

    assert_eq!(changes[0].mount_id, None);
}

#[test]
fn each_session_has_its_own_second() {
    let pulse = WorkPulse::default();
    let start = Instant::now();
    pulse.mark(&scope("session-1", None));
    pulse.due(start);
    pulse.mark(&scope("session-2", None));
    pulse.mark(&scope("session-1", None));

    let changes = pulse.due(start + Duration::from_millis(300));

    assert_eq!(
        changes
            .iter()
            .map(|change| change.session_id.as_str())
            .collect::<Vec<_>>(),
        vec!["session-2"]
    );
}

#[test]
fn the_event_wire_shape_names_session_and_mount() {
    let wire = serde_json::to_value(WorkChanged {
        session_id: "session-1".to_string(),
        mount_id: Some("mount-1".to_string()),
    })
    .expect("event");

    assert_eq!(wire["sessionId"], "session-1");
    assert_eq!(wire["mountId"], "mount-1");
}

#[test]
fn a_session_read_builds_sight_only_for_its_own_rows() {
    let turns = [turn("run-a", 10), turn("run-b", 20)];
    let ledger: HashMap<u32, LedgerEntry> = [
        (10, entry(10, "session-1", None, 100)),
        (20, entry(20, "session-2", None, 200)),
    ]
    .into_iter()
    .collect();
    let looked = std::cell::RefCell::new(Vec::new());

    let rows = rows_of(&turns, &ledger, &[], Some("session-2"), |run_id| {
        looked.borrow_mut().push(run_id.to_string());
        ToolSight::default()
    });

    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].run_id, "run-b");
    assert_eq!(*looked.borrow(), vec!["run-b".to_string()]);
}

fn sample(at: Instant, run_ids: &[&str]) -> QuietSample {
    QuietSample {
        at,
        covers: run_ids.iter().map(|id| id.to_string()).collect(),
        rows: Vec::new(),
    }
}

#[test]
fn a_fresh_quiet_sample_is_shared_by_every_reader() {
    let start = Instant::now();
    let shared = sample(start, &["run-a", "run-b"]);

    assert!(is_shared(
        &shared,
        &[turn("run-a", 10), turn("run-b", 20)],
        start + Duration::from_millis(100)
    ));
}

#[test]
fn a_stale_or_short_quiet_sample_is_measured_again() {
    let start = Instant::now();
    let shared = sample(start, &["run-a"]);

    assert!(!is_shared(
        &shared,
        &[turn("run-a", 10)],
        start + QUIET_SHARED_FOR
    ));
    assert!(!is_shared(
        &shared,
        &[turn("run-a", 10), turn("run-b", 20)],
        start + Duration::from_millis(100)
    ));
}
