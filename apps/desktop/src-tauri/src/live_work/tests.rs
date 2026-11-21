use std::sync::Arc;

use super::*;

fn line(text: &str) -> TurnEventPayload {
    TurnEventPayload::Line {
        line: Arc::from(text),
    }
}

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

fn sight_after(lines: &[&str]) -> ToolSight {
    let backlog = TurnBacklog::default();
    backlog.open("run-1");
    for text in lines {
        backlog.record("run-1", line(text));
    }
    ToolTracker::default().sight(&backlog, "run-1")
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
fn a_second_read_only_reads_the_new_lines() {
    let backlog = TurnBacklog::default();
    backlog.open("run-1");
    backlog.record("run-1", line(CLAUDE_BASH));
    let tracker = ToolTracker::default();
    assert!(tracker.sight(&backlog, "run-1").tool.is_some());

    backlog.record("run-1", line(CLAUDE_BASH_DONE));

    assert_eq!(tracker.sight(&backlog, "run-1").tool, None);
    assert_eq!(
        lock_or_recover(&tracker.0)
            .get("run-1")
            .map(|state| state.after_seq),
        Some(2)
    );
}

#[test]
fn a_backlog_with_a_gap_never_claims_no_tool_call() {
    let backlog = TurnBacklog::default();
    backlog.open("run-1");
    let big = "x".repeat(crate::turn_backlog::MAX_RUN_BACKLOG_BYTES / 2 + 1);
    backlog.record("run-1", line(&big));
    backlog.record("run-1", line(&big));
    backlog.record("run-1", line(CLAUDE_TEXT));

    let sight = ToolTracker::default().sight(&backlog, "run-1");

    assert!(sight.has_tool_call);
}

#[test]
fn an_ended_run_is_forgotten_by_the_tracker() {
    let backlog = TurnBacklog::default();
    backlog.open("run-1");
    let tracker = ToolTracker::default();
    tracker.sight(&backlog, "run-1");

    tracker.keep(&[turn("run-2", 20)]);

    assert!(lock_or_recover(&tracker.0).is_empty());
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

    let rows = rows_of(&turns, &ledger, &quiet, |run_id| ToolSight {
        tool: (run_id == "run-a").then(|| WorkTool {
            name: "Bash".to_string(),
            command: Some("pnpm test retry".to_string()),
            path: None,
        }),
        has_tool_call: run_id == "run-a",
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
    let rows = rows_of(&[turn("run-a", 10)], &HashMap::new(), &[], |_| {
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
        |_| ToolSight::default(),
    );

    let wire = serde_json::to_value(&rows[0]).expect("row");

    assert_eq!(wire["runId"], "run-a");
    assert_eq!(wire["sessionId"], "session-1");
    assert_eq!(wire["hasToolCall"], false);
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
fn only_tool_shaped_lines_wake_the_pulse() {
    assert!(is_tool_line(CLAUDE_BASH));
    assert!(is_tool_line(
        r#"{"type":"item.started","item":{"type":"command_execution"}}"#
    ));
    assert!(!is_tool_line(CLAUDE_TEXT));
}
