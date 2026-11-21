use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;
use tauri::State;

use crate::proc::ledger::LedgerEntry;
use crate::turn::{TurnEmitter, TurnError, TurnRegistry};
use crate::turn_quiet::{LiveTurn, TurnQuiet};
use crate::util::lock_or_recover;

use self::assemble::LineAssembler;

mod assemble;

pub const EVENT_NAME: &str = "work-changed";
pub const PULSE_EVERY: Duration = Duration::from_secs(1);
const FLUSH_EVERY: Duration = Duration::from_millis(250);
const QUIET_SHARED_FOR: Duration = Duration::from_millis(500);
const SIGHTED_BINARIES: &[&str] = &["claude", "codex", "cursor-agent", "copilot", "opencode"];
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
    pub can_see_tools: bool,
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
    can_see_tools: bool,
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

fn cursor_frames(value: &Value) -> Vec<ToolFrame> {
    let Some(id) = text_at(value, &["call_id"]).map(str::to_string) else {
        return Vec::new();
    };
    match text_at(value, &["subtype"]) {
        Some("started") => vec![ToolFrame::Start {
            id,
            tool: tool_of("tool", None),
        }],
        Some("completed") => vec![ToolFrame::End { id }],
        _ => Vec::new(),
    }
}

fn frames_of(value: &Value) -> Vec<ToolFrame> {
    if let Some(part) = value.get("part") {
        return opencode_frames(part);
    }
    let Some(kind) = text_at(value, &["type"]) else {
        return Vec::new();
    };
    match kind {
        "assistant" | "user" => anthropic_frames(value, kind),
        "item.started" | "item.completed" => codex_frames(value, kind),
        "tool.execution_start" | "tool.execution_complete" => copilot_frames(value, kind),
        "tool_call" => cursor_frames(value),
        _ => Vec::new(),
    }
}

fn can_see_tools_of(binary: &str) -> bool {
    std::path::Path::new(binary)
        .file_stem()
        .and_then(|name| name.to_str())
        .is_some_and(|name| SIGHTED_BINARIES.contains(&name))
}

#[derive(Default)]
struct ToolState {
    open: Vec<(String, WorkTool)>,
    seen: HashSet<String>,
    assembler: LineAssembler,
    can_see_tools: bool,
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
            has_tool_call: !self.seen.is_empty(),
            can_see_tools: self.can_see_tools,
        }
    }
}

#[derive(Default)]
struct ToolTracker(Mutex<HashMap<String, ToolState>>);

impl ToolTracker {
    fn begin(&self, run_id: &str, can_see_tools: bool) {
        lock_or_recover(&self.0).insert(
            run_id.to_string(),
            ToolState {
                can_see_tools,
                ..ToolState::default()
            },
        );
    }

    fn feed(&self, run_id: &str, line: &str) -> bool {
        let mut runs = lock_or_recover(&self.0);
        let Some(state) = runs.get_mut(run_id) else {
            return false;
        };
        let frames: Vec<ToolFrame> = state
            .assembler
            .push(line)
            .iter()
            .flat_map(frames_of)
            .collect();
        let has_frames = !frames.is_empty();
        for frame in frames {
            state.take(frame);
        }
        has_frames
    }

    fn sight(&self, run_id: &str) -> ToolSight {
        lock_or_recover(&self.0)
            .get(run_id)
            .map(ToolState::sight)
            .unwrap_or_default()
    }

    fn forget(&self, run_id: &str) {
        lock_or_recover(&self.0).remove(run_id);
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

pub(crate) fn begin_run(run_id: &str, binary: &str) {
    tracker().begin(run_id, can_see_tools_of(binary));
}

pub(crate) fn track_line(run_id: &str, line: &str) -> bool {
    tracker().feed(run_id, line)
}

pub(crate) fn end_run(run_id: &str) {
    tracker().forget(run_id);
}

fn rows_of(
    turns: &[LiveTurn],
    ledger: &HashMap<u32, LedgerEntry>,
    quiet: &[TurnQuiet],
    wanted: Option<&str>,
    sight_of: impl Fn(&str) -> ToolSight,
) -> Vec<WorkRow> {
    let quiet_by_run: HashMap<&str, u64> = quiet
        .iter()
        .map(|row| (row.run_id.as_str(), row.quiet_ms))
        .collect();
    let mut rows: Vec<WorkRow> = turns
        .iter()
        .filter_map(|turn| {
            let entry = ledger.get(&turn.pid);
            let session_id = entry.and_then(|entry| entry.session_id.as_deref());
            if wanted.is_some_and(|wanted| session_id != Some(wanted)) {
                return None;
            }
            let sight = sight_of(&turn.run_id);
            Some(WorkRow {
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
                can_see_tools: sight.can_see_tools,
            })
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

struct QuietSample {
    at: Instant,
    covers: HashSet<String>,
    rows: Vec<TurnQuiet>,
}

fn quiet_sample() -> &'static tauri::async_runtime::Mutex<Option<QuietSample>> {
    static SAMPLE: OnceLock<tauri::async_runtime::Mutex<Option<QuietSample>>> = OnceLock::new();
    SAMPLE.get_or_init(|| tauri::async_runtime::Mutex::new(None))
}

fn is_shared(sample: &QuietSample, turns: &[LiveTurn], now: Instant) -> bool {
    now.saturating_duration_since(sample.at) < QUIET_SHARED_FOR
        && turns
            .iter()
            .all(|turn| sample.covers.contains(turn.run_id.as_str()))
}

async fn shared_quiet(
    registry: &TurnRegistry,
    turns: &[LiveTurn],
) -> Result<Vec<TurnQuiet>, TurnError> {
    let mut sample = quiet_sample().lock().await;
    let now = Instant::now();
    if let Some(shared) = sample
        .as_ref()
        .filter(|shared| is_shared(shared, turns, now))
    {
        return Ok(shared.rows.clone());
    }
    let rows = crate::turn::measure_quiet(registry, turns).await?;
    *sample = Some(QuietSample {
        at: Instant::now(),
        covers: turns.iter().map(|turn| turn.run_id.clone()).collect(),
        rows: rows.clone(),
    });
    Ok(rows)
}

#[tauri::command]
pub async fn live_work(
    state: State<'_, TurnRegistry>,
    db: State<'_, crate::db::Db>,
    session_id: Option<String>,
) -> Result<Vec<WorkRow>, TurnError> {
    let turns = crate::turn::running_turns(&state);
    tracker().keep(&turns);
    let mounts = crate::proc::ledger::current_mount_places(&db);
    let ledger = tauri::async_runtime::spawn_blocking(move || {
        crate::proc::ledger::global().by_pid_at(&mounts)
    })
    .await
    .map_err(|error| TurnError::Io(std::io::Error::other(error)))?;
    let quiet = shared_quiet(&state, &turns).await?;
    Ok(rows_of(
        &turns,
        &ledger,
        &quiet,
        session_id.as_deref(),
        |run_id| tracker().sight(run_id),
    ))
}

#[cfg(test)]
mod tests;
