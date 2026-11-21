use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;
use tauri::State;

use crate::proc::ledger::LedgerEntry;
use crate::turn::{TurnEmitter, TurnError, TurnEventPayload, TurnRegistry};
use crate::turn_backlog::TurnBacklog;
use crate::turn_quiet::{LiveTurn, TurnQuiet};
use crate::util::lock_or_recover;

pub const EVENT_NAME: &str = "work-changed";
pub const PULSE_EVERY: Duration = Duration::from_secs(1);
const FLUSH_EVERY: Duration = Duration::from_millis(250);
const PATH_KEYS: &[&str] = &[
    "file_path",
    "path",
    "target_file",
    "notebook_path",
    "filename",
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkTool {
    pub name: String,
    pub command: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkRow {
    pub run_id: String,
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub mount_id: Option<String>,
    pub workflow_run_id: Option<String>,
    pub branch: Option<String>,
    pub started_at: Option<u64>,
    pub quiet_ms: Option<u64>,
    pub tool: Option<WorkTool>,
    pub has_tool_call: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkChanged {
    pub session_id: String,
    pub mount_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct WorkScope {
    pub(crate) session_id: String,
    pub(crate) mount_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum ToolFrame {
    Start { id: String, tool: WorkTool },
    End { id: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
struct ToolSight {
    tool: Option<WorkTool>,
    has_tool_call: bool,
}

fn text_at<'a>(value: &'a Value, path: &[&str]) -> Option<&'a str> {
    path.iter()
        .try_fold(value, |node, key| node.get(key))?
        .as_str()
        .filter(|text| !text.is_empty())
}

fn tool_of(name: &str, input: Option<&Value>) -> WorkTool {
    let input = input.unwrap_or(&Value::Null);
    WorkTool {
        name: name.to_string(),
        command: input
            .get("command")
            .and_then(Value::as_str)
            .filter(|command| !command.trim().is_empty())
            .map(str::to_string),
        path: PATH_KEYS
            .iter()
            .find_map(|key| text_at(input, &[key]))
            .map(str::to_string),
    }
}

fn anthropic_frames(value: &Value, kind: &str) -> Vec<ToolFrame> {
    let Some(blocks) = value
        .get("message")
        .and_then(|message| message.get("content"))
        .and_then(Value::as_array)
    else {
        return Vec::new();
    };
    blocks
        .iter()
        .filter_map(|block| match (kind, text_at(block, &["type"])?) {
            ("assistant", "tool_use") => Some(ToolFrame::Start {
                id: text_at(block, &["id"])?.to_string(),
                tool: tool_of(text_at(block, &["name"])?, block.get("input")),
            }),
            ("user", "tool_result") => Some(ToolFrame::End {
                id: text_at(block, &["tool_use_id"])?.to_string(),
            }),
            _ => None,
        })
        .collect()
}

fn codex_frames(value: &Value, kind: &str) -> Vec<ToolFrame> {
    let Some(item) = value.get("item") else {
        return Vec::new();
    };
    let Some(id) = text_at(item, &["id"]).map(str::to_string) else {
        return Vec::new();
    };
    match (kind, text_at(item, &["type"])) {
        ("item.started", Some("command_execution")) => vec![ToolFrame::Start {
            id,
            tool: WorkTool {
                name: "shell".to_string(),
                command: item
                    .get("command")
                    .and_then(Value::as_str)
                    .filter(|command| !command.trim().is_empty())
                    .map(str::to_string),
                path: None,
            },
        }],
        ("item.completed", Some("command_execution" | "apply_patch" | "file_change")) => {
            vec![ToolFrame::End { id }]
        }
        _ => Vec::new(),
    }
}

fn copilot_frames(value: &Value, kind: &str) -> Vec<ToolFrame> {
    let Some(data) = value.get("data") else {
        return Vec::new();
    };
    let Some(id) = text_at(data, &["toolCallId"]).map(str::to_string) else {
        return Vec::new();
    };
    match kind {
        "tool.execution_start" => vec![ToolFrame::Start {
            id,
            tool: tool_of(
                text_at(data, &["toolName"]).unwrap_or("tool"),
                data.get("arguments"),
            ),
        }],
        "tool.execution_complete" => vec![ToolFrame::End { id }],
        _ => Vec::new(),
    }
}

fn opencode_frames(part: &Value) -> Vec<ToolFrame> {
    if text_at(part, &["type"]) != Some("tool") {
        return Vec::new();
    }
    let Some(id) = text_at(part, &["callID"])
        .or_else(|| text_at(part, &["id"]))
        .map(str::to_string)
    else {
        return Vec::new();
    };
    let state = part.get("state");
    let mut frames = vec![ToolFrame::Start {
        id: id.clone(),
        tool: tool_of(
            text_at(part, &["tool"]).unwrap_or("tool"),
            state.and_then(|state| state.get("input")),
        ),
    }];
    let status = state.and_then(|state| text_at(state, &["status"]));
    if matches!(status, Some("completed" | "error")) {
        frames.push(ToolFrame::End { id });
    }
    frames
}

pub(crate) fn is_tool_line(line: &str) -> bool {
    line.contains("tool") || line.contains("command_execution")
}

fn frames_of(line: &str) -> Vec<ToolFrame> {
    if !is_tool_line(line) {
        return Vec::new();
    }
    let Ok(value) = serde_json::from_str::<Value>(line.trim()) else {
        return Vec::new();
    };
    if let Some(part) = value.get("part") {
        return opencode_frames(part);
    }
    let Some(kind) = text_at(&value, &["type"]) else {
        return Vec::new();
    };
    match kind {
        "assistant" | "user" => anthropic_frames(&value, kind),
        "item.started" | "item.completed" => codex_frames(&value, kind),
        "tool.execution_start" | "tool.execution_complete" => copilot_frames(&value, kind),
        _ => Vec::new(),
    }
}

#[derive(Default)]
struct ToolState {
    open: Vec<(String, WorkTool)>,
    seen: HashSet<String>,
    after_seq: u64,
    has_gap: bool,
}

impl ToolState {
    fn take(&mut self, frame: ToolFrame) {
        match frame {
            ToolFrame::Start { id, tool } => {
                if self.seen.insert(id.clone()) {
                    self.open.push((id, tool));
                }
            }
            ToolFrame::End { id } => {
                self.open.retain(|(open, _)| open != &id);
                self.seen.insert(id);
            }
        }
    }

    fn sight(&self) -> ToolSight {
        ToolSight {
            tool: self.open.last().map(|(_, tool)| tool.clone()),
            has_tool_call: !self.seen.is_empty() || self.has_gap,
        }
    }
}

#[derive(Default)]
struct ToolTracker(Mutex<HashMap<String, ToolState>>);

impl ToolTracker {
    fn sight(&self, backlog: &TurnBacklog, run_id: &str) -> ToolSight {
        let mut runs = lock_or_recover(&self.0);
        let state = runs.entry(run_id.to_string()).or_default();
        let Some(snapshot) = backlog.snapshot(run_id, state.after_seq) else {
            return state.sight();
        };
        state.has_gap = state.has_gap || snapshot.has_gap;
        for event in snapshot.events {
            state.after_seq = event.seq;
            if let TurnEventPayload::Line { line } = &event.event {
                for frame in frames_of(line) {
                    state.take(frame);
                }
            }
        }
        state.sight()
    }

    fn keep(&self, turns: &[LiveTurn]) {
        let live: HashSet<&str> = turns.iter().map(|turn| turn.run_id.as_str()).collect();
        lock_or_recover(&self.0).retain(|run_id, _| live.contains(run_id.as_str()));
    }
}

fn tracker() -> &'static ToolTracker {
    static TRACKER: OnceLock<ToolTracker> = OnceLock::new();
    TRACKER.get_or_init(ToolTracker::default)
}

fn rows_of(
    turns: &[LiveTurn],
    ledger: &HashMap<u32, LedgerEntry>,
    quiet: &[TurnQuiet],
    sight_of: impl Fn(&str) -> ToolSight,
) -> Vec<WorkRow> {
    let quiet_by_run: HashMap<&str, u64> = quiet
        .iter()
        .map(|row| (row.run_id.as_str(), row.quiet_ms))
        .collect();
    let mut rows: Vec<WorkRow> = turns
        .iter()
        .map(|turn| {
            let entry = ledger.get(&turn.pid);
            let sight = sight_of(&turn.run_id);
            WorkRow {
                run_id: turn.run_id.clone(),
                session_id: entry.and_then(|entry| entry.session_id.clone()),
                agent_id: entry.and_then(|entry| entry.agent_id.clone()),
                mount_id: entry.and_then(|entry| entry.mount_id.clone()),
                workflow_run_id: entry.and_then(|entry| entry.run_id.clone()),
                branch: entry.and_then(|entry| entry.branch.clone()),
                started_at: entry.map(|entry| entry.started_at),
                quiet_ms: quiet_by_run.get(turn.run_id.as_str()).copied(),
                tool: sight.tool,
                has_tool_call: sight.has_tool_call,
            }
        })
        .collect();
    rows.sort_by(|a, b| {
        a.started_at
            .cmp(&b.started_at)
            .then_with(|| a.run_id.cmp(&b.run_id))
    });
    rows
}

#[derive(Default)]
struct PulseState {
    dirty: HashMap<String, Option<String>>,
    sent: HashMap<String, Instant>,
}

#[derive(Default)]
pub struct WorkPulse(Mutex<PulseState>);

impl WorkPulse {
    pub(crate) fn mark(&self, scope: &WorkScope) {
        let mut state = lock_or_recover(&self.0);
        let Some(seen) = state.dirty.get_mut(&scope.session_id) else {
            state
                .dirty
                .insert(scope.session_id.clone(), scope.mount_id.clone());
            return;
        };
        if *seen != scope.mount_id {
            *seen = None;
        }
    }

    pub(crate) fn due(&self, now: Instant) -> Vec<WorkChanged> {
        let mut state = lock_or_recover(&self.0);
        let ready: Vec<String> = state
            .dirty
            .keys()
            .filter(|session_id| {
                state
                    .sent
                    .get(*session_id)
                    .is_none_or(|at| now.saturating_duration_since(*at) >= PULSE_EVERY)
            })
            .cloned()
            .collect();
        let mut changes = Vec::with_capacity(ready.len());
        for session_id in ready {
            let mount_id = state.dirty.remove(&session_id).flatten();
            state.sent.insert(session_id.clone(), now);
            changes.push(WorkChanged {
                session_id,
                mount_id,
            });
        }
        state
            .sent
            .retain(|_, at| now.saturating_duration_since(*at) < PULSE_EVERY);
        changes.sort_by(|a, b| a.session_id.cmp(&b.session_id));
        changes
    }
}

pub(crate) fn pulse() -> &'static WorkPulse {
    static PULSE: OnceLock<WorkPulse> = OnceLock::new();
    PULSE.get_or_init(WorkPulse::default)
}

pub(crate) fn mark(scope: Option<&WorkScope>) {
    if let Some(scope) = scope {
        pulse().mark(scope);
    }
}

pub(crate) fn start_pulse<E: TurnEmitter + Sync>(app: &E) {
    static STARTED: OnceLock<()> = OnceLock::new();
    STARTED.get_or_init(|| {
        let app = app.clone();
        thread::spawn(move || loop {
            thread::sleep(FLUSH_EVERY);
            for change in pulse().due(Instant::now()) {
                app.emit_turn(EVENT_NAME, change);
            }
        });
    });
}

#[tauri::command]
pub async fn live_work(
    state: State<'_, TurnRegistry>,
    session_id: Option<String>,
) -> Result<Vec<WorkRow>, TurnError> {
    let turns = crate::turn::running_turns(&state);
    let quiet = crate::turn::measure_quiet(&state, &turns).await?;
    let ledger = crate::proc::ledger::global().by_pid();
    tracker().keep(&turns);
    let rows = rows_of(&turns, &ledger, &quiet, |run_id| {
        tracker().sight(&state.1, run_id)
    });
    Ok(rows
        .into_iter()
        .filter(|row| {
            session_id
                .as_deref()
                .is_none_or(|wanted| row.session_id.as_deref() == Some(wanted))
        })
        .collect())
}

#[cfg(test)]
mod tests;
