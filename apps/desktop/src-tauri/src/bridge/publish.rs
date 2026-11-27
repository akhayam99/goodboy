use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{State, WebviewWindow};
use tokio::sync::broadcast;

use super::publish_schema::{
    ChatsProjection, NeedsYouProjection, PullRequestProjection, RunsProjection, SessionProjection,
    SessionsProjection, TasksProjection,
};
use super::{BridgeError, BridgeState};

pub const MAIN_WINDOW_LABEL: &str = "main";
pub const STALE_AFTER: Duration = Duration::from_secs(10);
pub const MAX_PROJECTION_BYTES: usize = 56_000;
pub const MAX_KEY_LEN: usize = 200;
pub const MAX_ITEMS_PER_CALL: usize = 400;
pub const MAX_NEEDS_YOU_ROWS: usize = 60;
pub const MAX_LANE_ROWS: usize = 30;
pub const MAX_LINES: usize = 20;
pub const MAX_RUNS: usize = 20;
pub const MAX_TASK_ROWS: usize = 40;
pub const MAX_CHATS: usize = 30;
pub const MAX_CHECKS: usize = 50;
pub const MAX_ARTIFACTS: usize = 20;
pub const MAX_QUESTIONS_PER_STATE: usize = 12;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    NeedsYou,
    Sessions,
    Session,
    Runs,
    PullRequest,
    Tasks,
    Chats,
}

#[derive(Debug, Deserialize)]
pub struct PublishItem {
    pub key: String,
    pub kind: Kind,
    pub projection: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Rejected {
    pub key: String,
    pub reason: String,
}

#[derive(Debug, Default, Serialize)]
pub struct PublishReport {
    pub rejected: Vec<Rejected>,
}

#[derive(Debug, Clone)]
pub struct Stored {
    pub key: String,
    pub kind: Kind,
    pub seq: i64,
    pub value: Value,
}

#[derive(Debug, Clone)]
pub enum Update {
    Projection(Stored),
    Removed(String),
}

#[derive(Default)]
struct HubInner {
    epoch: i64,
    last_seen: Option<Instant>,
    store: HashMap<String, Stored>,
}

pub struct PublishHub {
    inner: Mutex<HubInner>,
    tx: broadcast::Sender<Update>,
}

impl Default for PublishHub {
    fn default() -> Self {
        Self::new()
    }
}

fn reject(reason: &str) -> String {
    reason.to_string()
}

fn parse<T: DeserializeOwned + Serialize>(value: &Value) -> Result<Value, String> {
    let typed: T = serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
    serde_json::to_value(typed).map_err(|e| e.to_string())
}

fn truncate(value: &mut Value, path: &[&str], max: usize) {
    let mut node = value;
    for step in &path[..path.len().saturating_sub(1)] {
        match node.get_mut(*step) {
            Some(next) => node = next,
            None => return,
        }
    }
    let Some(last) = path.last() else { return };
    if let Some(Value::Array(items)) = node.get_mut(*last) {
        items.truncate(max);
    }
}

fn truncate_each(value: &mut Value, list: &str, path: &[&str], max: usize) {
    if let Some(Value::Array(items)) = value.get_mut(list) {
        for item in items {
            truncate(item, path, max);
        }
    }
}

fn truncate_by_state(value: &mut Value, path: &[&str], max_each: usize) {
    let mut node = value;
    for step in &path[..path.len().saturating_sub(1)] {
        match node.get_mut(*step) {
            Some(next) => node = next,
            None => return,
        }
    }
    let Some(last) = path.last() else { return };
    if let Some(Value::Array(items)) = node.get_mut(*last) {
        let mut open = 0;
        let mut answered = 0;
        items.retain(|item| {
            let is_open = item.get("state").and_then(Value::as_str) == Some("open");
            let seen = &mut answered;
            if is_open {
                open += 1;
                return open <= max_each;
            }
            *seen += 1;
            *seen <= max_each
        });
    }
}

fn apply_limits(kind: Kind, value: &mut Value) {
    match kind {
        Kind::NeedsYou => truncate(value, &["rows"], MAX_NEEDS_YOU_ROWS),
        Kind::Sessions => truncate_each(value, "lanes", &["rows"], MAX_LANE_ROWS),
        Kind::Session => {
            truncate(value, &["now"], MAX_LINES);
            truncate(value, &["next"], MAX_LINES);
            truncate(value, &["activity"], MAX_LINES);
            truncate(value, &["needsYou"], MAX_NEEDS_YOU_ROWS);
            truncate(value, &["artifacts"], MAX_ARTIFACTS);
            truncate_by_state(value, &["questions"], MAX_QUESTIONS_PER_STATE);
        }
        Kind::Runs => truncate(value, &["runs"], MAX_RUNS),
        Kind::PullRequest => truncate(value, &["checks"], MAX_CHECKS),
        Kind::Tasks => truncate(value, &["rows"], MAX_TASK_ROWS),
        Kind::Chats => truncate(value, &["chats"], MAX_CHATS),
    }
}

pub fn is_main_label(label: &str) -> bool {
    label == MAIN_WINDOW_LABEL
}

pub fn is_absolute_path(text: &str) -> bool {
    let bytes = text.as_bytes();
    if text.starts_with("~/") || text.starts_with("\\\\") {
        return true;
    }
    if bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/')
    {
        return true;
    }
    if text.starts_with('/') && !text.contains(char::is_whitespace) && text[1..].contains('/') {
        return true;
    }
    text.contains("/Users/") || text.contains("/home/") || text.contains("\\Users\\")
}

fn first_absolute_path(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => is_absolute_path(text).then(|| text.clone()),
        Value::Array(items) => items.iter().find_map(first_absolute_path),
        Value::Object(map) => map.values().find_map(first_absolute_path),
        _ => None,
    }
}

fn string_at<'a>(value: &'a Value, field: &str) -> &'a str {
    value.get(field).and_then(Value::as_str).unwrap_or("")
}

fn expected_key(kind: Kind, value: &Value) -> String {
    let workspace = string_at(value, "workspaceId");
    let session = string_at(value, "sessionId");
    match kind {
        Kind::NeedsYou => "needsYou".to_string(),
        Kind::Sessions => format!("sessions:{workspace}"),
        Kind::Session => format!("session:{workspace}:{session}"),
        Kind::Runs => format!("runs:{workspace}:{session}"),
        Kind::PullRequest => format!("pullRequest:{workspace}:{session}"),
        Kind::Tasks => format!("tasks:{workspace}"),
        Kind::Chats => format!("chats:{workspace}"),
    }
}

pub fn validate(item: &PublishItem) -> Result<Stored, String> {
    if item.key.len() > MAX_KEY_LEN {
        return Err(reject("key too long"));
    }
    let mut value = match item.kind {
        Kind::NeedsYou => parse::<NeedsYouProjection>(&item.projection),
        Kind::Sessions => parse::<SessionsProjection>(&item.projection),
        Kind::Session => parse::<SessionProjection>(&item.projection),
        Kind::Runs => parse::<RunsProjection>(&item.projection),
        Kind::PullRequest => parse::<PullRequestProjection>(&item.projection),
        Kind::Tasks => parse::<TasksProjection>(&item.projection),
        Kind::Chats => parse::<ChatsProjection>(&item.projection),
    }
    .map_err(|e| format!("schema: {e}"))?;
    apply_limits(item.kind, &mut value);
    if first_absolute_path(&value).is_some() {
        return Err(reject("an absolute path"));
    }
    if expected_key(item.kind, &value) != item.key {
        return Err(reject("key does not name its projection"));
    }
    let size = serde_json::to_vec(&value).map_err(|e| e.to_string())?.len();
    if size > MAX_PROJECTION_BYTES {
        return Err(format!(
            "{size} bytes is over the {MAX_PROJECTION_BYTES} cap"
        ));
    }
    let seq = value.get("seq").and_then(Value::as_i64).unwrap_or(0);
    Ok(Stored {
        key: item.key.clone(),
        kind: item.kind,
        seq,
        value,
    })
}

impl PublishHub {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(256);
        Self {
            inner: Mutex::new(HubInner::default()),
            tx,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Update> {
        self.tx.subscribe()
    }

    pub fn publish(
        &self,
        now: Instant,
        epoch: i64,
        items: Vec<PublishItem>,
        removed: Vec<String>,
    ) -> Result<PublishReport, BridgeError> {
        if items.len() > MAX_ITEMS_PER_CALL {
            return Err(BridgeError::Protocol("too many projections".into()));
        }
        let mut inner = self.inner.lock().expect("publish hub lock");
        if epoch < inner.epoch {
            return Err(BridgeError::Unauthorized(
                "projections from an older window".into(),
            ));
        }
        if epoch > inner.epoch {
            let gone: Vec<String> = inner.store.keys().cloned().collect();
            inner.store.clear();
            inner.epoch = epoch;
            for key in gone {
                let _ = self.tx.send(Update::Removed(key));
            }
        }
        inner.last_seen = Some(now);
        let mut report = PublishReport::default();
        for item in &items {
            match validate(item) {
                Err(reason) => report.rejected.push(Rejected {
                    key: item.key.clone(),
                    reason,
                }),
                Ok(stored) => {
                    let is_older = inner
                        .store
                        .get(&stored.key)
                        .is_some_and(|known| known.seq > stored.seq);
                    if is_older {
                        continue;
                    }
                    inner.store.insert(stored.key.clone(), stored.clone());
                    let _ = self.tx.send(Update::Projection(stored));
                }
            }
        }
        for key in removed {
            if inner.store.remove(&key).is_some() {
                let _ = self.tx.send(Update::Removed(key));
            }
        }
        Ok(report)
    }

    pub fn all(&self) -> Vec<Stored> {
        let inner = self.inner.lock().expect("publish hub lock");
        let mut all: Vec<Stored> = inner.store.values().cloned().collect();
        all.sort_by(|a, b| a.key.cmp(&b.key));
        all
    }

    pub fn is_fresh_at(&self, now: Instant) -> bool {
        let inner = self.inner.lock().expect("publish hub lock");
        inner
            .last_seen
            .is_some_and(|seen| now.saturating_duration_since(seen) < STALE_AFTER)
    }

    pub fn is_fresh(&self) -> bool {
        self.is_fresh_at(Instant::now())
    }
}

#[tauri::command]
pub async fn bridge_publish(
    window: WebviewWindow,
    state: State<'_, BridgeState>,
    epoch: i64,
    items: Vec<PublishItem>,
    removed: Vec<String>,
) -> Result<PublishReport, BridgeError> {
    if !is_main_label(window.label()) {
        return Err(BridgeError::Unauthorized(
            "only the main window publishes projections".into(),
        ));
    }
    let report = state.hub.publish(Instant::now(), epoch, items, removed)?;
    for rejected in &report.rejected {
        log::warn!(
            "[bridge] projection {} rejected: {}",
            rejected.key,
            rejected.reason
        );
    }
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const NEEDS_YOU: &str =
        include_str!("../../../src/features/companion/projections/fixtures/needsYou.json");
    const SESSIONS: &str =
        include_str!("../../../src/features/companion/projections/fixtures/sessions.json");
    const SESSION: &str =
        include_str!("../../../src/features/companion/projections/fixtures/session.json");
    const RUNS: &str =
        include_str!("../../../src/features/companion/projections/fixtures/runs.json");
    const PULL_REQUEST: &str =
        include_str!("../../../src/features/companion/projections/fixtures/pullRequest.json");
    const TASKS: &str =
        include_str!("../../../src/features/companion/projections/fixtures/tasks.json");
    const CHATS: &str =
        include_str!("../../../src/features/companion/projections/fixtures/chats.json");

    fn fixture(text: &str) -> Value {
        serde_json::from_str(text).expect("fixture parses")
    }

    fn same(left: &Value, right: &Value) -> bool {
        match (left, right) {
            (Value::Number(a), Value::Number(b)) => a.as_f64() == b.as_f64(),
            (Value::Array(a), Value::Array(b)) => {
                a.len() == b.len() && a.iter().zip(b).all(|(x, y)| same(x, y))
            }
            (Value::Object(a), Value::Object(b)) => {
                a.len() == b.len() && a.iter().all(|(k, v)| b.get(k).is_some_and(|w| same(v, w)))
            }
            _ => left == right,
        }
    }

    fn item(key: &str, kind: Kind, projection: Value) -> PublishItem {
        PublishItem {
            key: key.to_string(),
            kind,
            projection,
        }
    }

    fn all_fixtures() -> Vec<PublishItem> {
        let needs = fixture(NEEDS_YOU);
        let sessions = fixture(SESSIONS);
        let session = fixture(SESSION);
        let runs = fixture(RUNS);
        let pr = fixture(PULL_REQUEST);
        let tasks = fixture(TASKS);
        let chats = fixture(CHATS);
        vec![
            item("needsYou", Kind::NeedsYou, needs),
            item(
                &expected_key(Kind::Sessions, &sessions),
                Kind::Sessions,
                sessions,
            ),
            item(
                &expected_key(Kind::Session, &session),
                Kind::Session,
                session,
            ),
            item(&expected_key(Kind::Runs, &runs), Kind::Runs, runs),
            item(&expected_key(Kind::PullRequest, &pr), Kind::PullRequest, pr),
            item(&expected_key(Kind::Tasks, &tasks), Kind::Tasks, tasks),
            item(&expected_key(Kind::Chats, &chats), Kind::Chats, chats),
        ]
    }

    #[test]
    fn every_golden_projection_passes_unchanged() {
        for entry in all_fixtures() {
            let stored = validate(&entry).unwrap_or_else(|e| panic!("{}: {e}", entry.key));
            assert!(same(&stored.value, &entry.projection), "{}", entry.key);
        }
    }

    #[test]
    fn a_train_with_its_status_and_a_start_offer_with_its_choices_pass_the_schema() {
        let mut sessions = fixture(SESSIONS);
        sessions["train"] = json!({
            "actionId": "act:mergeTrain:ws-harborline:abc.0",
            "isBusy": true,
            "method": "squash",
            "orderLine": "Squash and merge, smallest change first",
            "entries": [{
                "sessionId": "ses-one", "prNumber": 11, "headSha": "aaaa111",
                "title": "Round the ledger", "repo": "ledger-core", "reason": null
            }],
            "status": {
                "trainId": "train-1", "phase": "stopped", "index": 1, "merged": 1, "total": 2,
                "step": "merging", "line": "Merged 1 of 2 · #12 has conflicts",
                "cars": [{
                    "sessionId": "ses-one", "prNumber": 11, "state": "merged",
                    "mark": { "kind": "state", "state": "merged" }, "line": "#11 ledger-core · Merged"
                }],
                "stopReason": "#12 has conflicts. The Lead has it", "isWithLead": true,
                "isStopRequested": false
            },
            "stopActionId": null
        });
        let key = format!("sessions:{}", sessions["workspaceId"].as_str().unwrap());
        let stored = validate(&item(&key, Kind::Sessions, sessions)).expect("valid train");
        assert!(stored.value.to_string().contains("stopReason"));

        let mut tasks = fixture(TASKS);
        tasks["start"]["kinds"] = json!([
            { "startKind": "leadPlan", "presetId": "preset-layout", "label": "Lead", "hasLimit": true, "hasStops": true }
        ]);
        tasks["start"]["defaultAccess"] = json!("editsAllowed");
        let tasks_key = format!("tasks:{}", tasks["workspaceId"].as_str().unwrap());
        assert!(validate(&item(&tasks_key, Kind::Tasks, tasks.clone())).is_ok());
        tasks["start"]["defaultStops"] = json!("sometimes");
        let err = validate(&item(&tasks_key, Kind::Tasks, tasks.clone())).unwrap_err();
        assert!(err.starts_with("schema:"));
        tasks["start"]["defaultStops"] = json!("never");
        assert!(validate(&item(&tasks_key, Kind::Tasks, tasks.clone())).is_ok());
        tasks["start"]["defaultAccess"] = json!("bypassPermissions");
        let err = validate(&item(&tasks_key, Kind::Tasks, tasks)).unwrap_err();
        assert!(err.starts_with("schema:"));
    }

    #[test]
    fn unknown_fields_are_dropped_at_every_depth() {
        let mut needs = fixture(NEEDS_YOU);
        needs["worktreePath"] = json!("/tmp/x");
        needs["rows"][0]["token"] = json!("secret");
        needs["rows"][0]["decision"]["archivedAt"] = json!("2026-01-01");
        let stored = validate(&item("needsYou", Kind::NeedsYou, needs)).expect("valid");
        let wire = stored.value.to_string();
        assert!(!wire.contains("worktreePath"));
        assert!(!wire.contains("token"));
        assert!(!wire.contains("archivedAt"));
    }

    #[test]
    fn a_value_outside_the_vocabulary_is_rejected() {
        let mut needs = fixture(NEEDS_YOU);
        needs["rows"][0]["reason"] = json!("made-up");
        let err = validate(&item("needsYou", Kind::NeedsYou, needs)).unwrap_err();
        assert!(err.starts_with("schema:"));
    }

    #[test]
    fn a_missing_required_field_is_rejected() {
        let mut needs = fixture(NEEDS_YOU);
        needs.as_object_mut().unwrap().remove("epoch");
        assert!(validate(&item("needsYou", Kind::NeedsYou, needs)).is_err());
    }

    #[test]
    fn an_absolute_path_in_any_string_is_rejected() {
        for path in [
            "/Users/someone/work/payments-api",
            "/var/folders/ab/cd",
            "~/work/ledger-core",
            "C:\\Users\\someone\\ledger-core",
            "see /home/someone/notes",
        ] {
            let mut sessions = fixture(SESSIONS);
            sessions["lanes"][1]["title"] = json!(path);
            let key = expected_key(Kind::Sessions, &sessions);
            let err = validate(&item(&key, Kind::Sessions, sessions)).unwrap_err();
            assert_eq!(err, "an absolute path", "{path}");
        }
    }

    #[test]
    fn a_folder_name_a_slash_command_and_a_url_are_not_paths() {
        for text in [
            "payments-api",
            "/review",
            "https://github.com/harborline/payments-api/pull/304",
        ] {
            assert!(!is_absolute_path(text), "{text}");
        }
    }

    #[test]
    fn a_projection_over_the_size_cap_is_rejected() {
        let mut needs = fixture(NEEDS_YOU);
        needs["rows"][0]["goal"] = json!("x".repeat(MAX_PROJECTION_BYTES));
        let err = validate(&item("needsYou", Kind::NeedsYou, needs)).unwrap_err();
        assert!(err.contains("over the"));
    }

    #[test]
    fn lists_are_cut_to_their_limits() {
        let mut needs = fixture(NEEDS_YOU);
        let row = needs["rows"][0].clone();
        needs["rows"] = json!(vec![row; MAX_NEEDS_YOU_ROWS + 25]);
        let stored = validate(&item("needsYou", Kind::NeedsYou, needs)).expect("valid");
        assert_eq!(
            stored.value["rows"].as_array().unwrap().len(),
            MAX_NEEDS_YOU_ROWS
        );
    }

    #[test]
    fn a_session_cuts_artifacts_and_each_question_state_to_their_limits() {
        let mut session = fixture(SESSION);
        let artifact = json!({
            "id": "artifact-1", "title": "Ledger plan", "kind": "plan", "role": "Lead",
            "version": 1, "updatedAt": null, "commentCount": 0, "isAwaitingApproval": false,
            "approveActionId": null, "body": null, "isBodyCut": false
        });
        let question = session["questions"][0].clone();
        let mut answered = question.clone();
        answered["state"] = json!("answered");
        let mut open = question.clone();
        open["state"] = json!("open");
        session["artifacts"] = json!(vec![artifact; MAX_ARTIFACTS + 7]);
        let mut questions = vec![open; MAX_QUESTIONS_PER_STATE + 5];
        questions.extend(vec![answered; MAX_QUESTIONS_PER_STATE + 3]);
        session["questions"] = json!(questions);
        let key = format!(
            "session:{}:{}",
            session["workspaceId"].as_str().unwrap(),
            session["sessionId"].as_str().unwrap()
        );
        let stored = validate(&item(&key, Kind::Session, session)).expect("valid");
        assert_eq!(
            stored.value["artifacts"].as_array().unwrap().len(),
            MAX_ARTIFACTS
        );
        let kept = stored.value["questions"].as_array().unwrap();
        let open_kept = kept.iter().filter(|q| q["state"] == "open").count();
        assert_eq!(open_kept, MAX_QUESTIONS_PER_STATE);
        assert_eq!(kept.len() - open_kept, MAX_QUESTIONS_PER_STATE);
    }

    #[test]
    fn a_key_that_does_not_name_its_projection_is_rejected() {
        let sessions = fixture(SESSIONS);
        let err = validate(&item("sessions:another", Kind::Sessions, sessions)).unwrap_err();
        assert_eq!(err, "key does not name its projection");
    }

    #[test]
    fn only_the_main_window_label_may_publish() {
        assert!(is_main_label("main"));
        assert!(!is_main_label("win-1"));
        assert!(!is_main_label(""));
    }

    #[test]
    fn the_hub_is_stale_ten_seconds_after_the_last_call() {
        let hub = PublishHub::new();
        let start = Instant::now();
        assert!(!hub.is_fresh_at(start));
        hub.publish(start, 1, vec![], vec![]).expect("empty call");
        assert!(hub.is_fresh_at(start + Duration::from_secs(9)));
        assert!(!hub.is_fresh_at(start + Duration::from_secs(10)));
        hub.publish(start + Duration::from_secs(10), 1, vec![], vec![])
            .expect("heartbeat");
        assert!(hub.is_fresh_at(start + Duration::from_secs(15)));
    }

    #[test]
    fn a_newer_window_replaces_the_store_and_an_older_one_is_refused() {
        let hub = PublishHub::new();
        let now = Instant::now();
        hub.publish(now, 5, all_fixtures(), vec![])
            .expect("first window");
        assert_eq!(hub.all().len(), 7);
        hub.publish(now, 6, vec![], vec![])
            .expect("reloaded window");
        assert!(hub.all().is_empty());
        let stale = hub.publish(now, 5, all_fixtures(), vec![]);
        assert!(matches!(stale, Err(BridgeError::Unauthorized(_))));
        assert!(hub.all().is_empty());
    }

    #[test]
    fn an_older_seq_does_not_replace_a_newer_projection() {
        let hub = PublishHub::new();
        let now = Instant::now();
        let mut newer = fixture(NEEDS_YOU);
        newer["seq"] = json!(9);
        let mut older = fixture(NEEDS_YOU);
        older["seq"] = json!(3);
        hub.publish(
            now,
            1,
            vec![item("needsYou", Kind::NeedsYou, newer)],
            vec![],
        )
        .expect("newer");
        hub.publish(
            now,
            1,
            vec![item("needsYou", Kind::NeedsYou, older)],
            vec![],
        )
        .expect("older");
        assert_eq!(hub.all()[0].seq, 9);
    }

    #[test]
    fn a_rejected_projection_is_reported_and_the_rest_is_kept() {
        let hub = PublishHub::new();
        let mut items = all_fixtures();
        items[0].projection["rows"][0]["reason"] = json!("made-up");
        let report = hub.publish(Instant::now(), 1, items, vec![]).expect("call");
        assert_eq!(report.rejected.len(), 1);
        assert_eq!(report.rejected[0].key, "needsYou");
        assert_eq!(hub.all().len(), 6);
    }

    #[test]
    fn a_removed_key_leaves_the_store_and_reaches_listeners() {
        let hub = PublishHub::new();
        let mut updates = hub.subscribe();
        hub.publish(Instant::now(), 1, all_fixtures(), vec![])
            .expect("fill");
        let key = hub.all()[0].key.clone();
        hub.publish(Instant::now(), 1, vec![], vec![key.clone()])
            .expect("remove");
        assert_eq!(hub.all().len(), 6);
        let mut saw_removed = false;
        while let Ok(update) = updates.try_recv() {
            if let Update::Removed(gone) = update {
                saw_removed = gone == key;
            }
        }
        assert!(saw_removed);
    }

    #[test]
    fn too_many_projections_in_one_call_are_refused() {
        let hub = PublishHub::new();
        let items = (0..=MAX_ITEMS_PER_CALL)
            .map(|n| item(&format!("tasks:w{n}"), Kind::Tasks, json!({})))
            .collect();
        assert!(hub.publish(Instant::now(), 1, items, vec![]).is_err());
    }
}
