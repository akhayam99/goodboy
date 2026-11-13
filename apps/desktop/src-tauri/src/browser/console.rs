use std::sync::mpsc;
use std::sync::LazyLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{Runtime, Webview};

use super::reason::{self, CONSOLE_UNAVAILABLE};
use crate::util::{uuid_v4, MessageError};

pub(crate) const RING_SIZE: usize = 500;
pub(crate) const MAX_TEXT_CHARS: usize = 2_000;
pub(crate) const MAX_SOURCE_CHARS: usize = 200;
pub(crate) const MAX_METHOD_CHARS: usize = 16;
pub(crate) const MAX_ANSWER_BYTES: usize = 4_000_000;
const MAX_DOC_CHARS: usize = 32;

const HOOK: &str = include_str!("console_hook.js");
const READ_NAME_SLOT: &str = "__GOODBOY_CONSOLE_READ__";
const READ_TIMEOUT: Duration = Duration::from_secs(1);

static READ_NAME: LazyLock<String> =
    LazyLock::new(|| format!("goodboy-console-{}", uuid_v4().replace('-', "")));

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum EntryKind {
    Console,
    Network,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum EntryLevel {
    Log,
    Info,
    Warn,
    Error,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsoleEntry {
    pub(crate) seq: u64,
    pub(crate) kind: EntryKind,
    pub(crate) level: EntryLevel,
    pub(crate) text: String,
    pub(crate) source: Option<String>,
    pub(crate) method: Option<String>,
    pub(crate) status: Option<u16>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsoleRead {
    pub(crate) doc: Option<String>,
    pub(crate) entries: Vec<ConsoleEntry>,
    pub(crate) is_heard: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Cursor {
    doc: Option<String>,
    after: u64,
}

impl Cursor {
    pub(crate) fn of(doc: Option<&str>, after: u64) -> Self {
        Self {
            doc: doc.filter(|doc| is_doc_id(doc)).map(str::to_string),
            after,
        }
    }
}

#[derive(Deserialize)]
struct RawAnswer {
    doc: String,
    entries: Vec<serde_json::Value>,
}

#[derive(Deserialize)]
struct RawEntry {
    seq: u64,
    kind: EntryKind,
    level: EntryLevel,
    text: String,
    source: Option<String>,
    method: Option<String>,
    status: Option<u16>,
}

fn is_doc_id(doc: &str) -> bool {
    !doc.is_empty()
        && doc.len() <= MAX_DOC_CHARS
        && doc
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
}

fn clipped(text: &str, max: usize) -> String {
    text.chars().take(max).collect()
}

fn method_of(raw: Option<String>) -> Option<String> {
    raw.map(|method| clipped(&method, MAX_METHOD_CHARS))
        .filter(|method| !method.is_empty() && method.chars().all(|c| c.is_ascii_uppercase()))
}

fn entry_of(value: serde_json::Value) -> Option<ConsoleEntry> {
    let raw: RawEntry = serde_json::from_value(value).ok()?;
    let is_network = raw.kind == EntryKind::Network;
    Some(ConsoleEntry {
        seq: raw.seq,
        kind: raw.kind,
        level: raw.level,
        text: clipped(&raw.text, MAX_TEXT_CHARS),
        source: raw
            .source
            .map(|source| clipped(&source, MAX_SOURCE_CHARS))
            .filter(|source| !source.is_empty()),
        method: method_of(raw.method).filter(|_| is_network),
        status: raw.status.filter(|_| is_network),
    })
}

#[cfg(target_os = "macos")]
fn with_passkey_probe(hook: String) -> String {
    format!("{hook}\n{}", super::passkey::WATCH_SCRIPT)
}

#[cfg(not(target_os = "macos"))]
fn with_passkey_probe(hook: String) -> String {
    hook
}

pub(crate) fn tab_script() -> String {
    with_passkey_probe(HOOK.replace(READ_NAME_SLOT, &READ_NAME))
}

pub(crate) fn reader_script(cursor: &Cursor) -> String {
    let name = serde_json::to_string(READ_NAME.as_str()).unwrap_or_default();
    let doc = cursor
        .doc
        .as_deref()
        .and_then(|doc| serde_json::to_string(doc).ok())
        .unwrap_or_else(|| "null".to_string());
    let after = cursor.after;
    format!(
        "(function(){{try{{var box={{doc:{doc},after:{after}}};window.dispatchEvent(new CustomEvent({name},{{detail:box}}));return typeof box.answer==='string'?box.answer:null}}catch(e){{return null}}}})()"
    )
}

fn unheard() -> ConsoleRead {
    ConsoleRead {
        doc: None,
        entries: Vec::new(),
        is_heard: false,
    }
}

fn after_of(cursor: &Cursor, doc: &str) -> u64 {
    if cursor.doc.as_deref() != Some(doc) {
        return 0;
    }
    cursor.after
}

pub(crate) fn answer_of(raw: &str, cursor: &Cursor) -> Option<ConsoleRead> {
    if raw.len() > MAX_ANSWER_BYTES {
        return None;
    }
    let value: serde_json::Value = serde_json::from_str(raw.trim()).ok()?;
    let answer: RawAnswer = match value {
        serde_json::Value::Null => return Some(unheard()),
        serde_json::Value::String(inner) => serde_json::from_str(&inner).ok()?,
        object @ serde_json::Value::Object(_) => serde_json::from_value(object).ok()?,
        _ => return None,
    };
    if !is_doc_id(&answer.doc) {
        return None;
    }
    let after = after_of(cursor, &answer.doc);
    let mut entries: Vec<ConsoleEntry> = answer
        .entries
        .into_iter()
        .filter_map(entry_of)
        .filter(|entry| entry.seq > after)
        .collect();
    entries.sort_by_key(|entry| entry.seq);
    entries.dedup_by_key(|entry| entry.seq);
    if entries.len() > RING_SIZE {
        entries.drain(..entries.len() - RING_SIZE);
    }
    Some(ConsoleRead {
        doc: Some(answer.doc),
        entries,
        is_heard: true,
    })
}

pub(crate) fn read_console<R: Runtime>(
    webview: &Webview<R>,
    cursor: Cursor,
) -> Result<ConsoleRead, MessageError> {
    let (sender, receiver) = mpsc::channel();
    webview
        .eval_with_callback(reader_script(&cursor), move |raw| {
            let _ = sender.send(raw);
        })
        .map_err(|error| MessageError::Failed(error.to_string()))?;
    receiver
        .recv_timeout(READ_TIMEOUT)
        .ok()
        .and_then(|raw| answer_of(&raw, &cursor))
        .ok_or_else(|| reason::failed(CONSOLE_UNAVAILABLE))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::util::wire_shape::assert_wire_value;

    fn entry(seq: u64) -> serde_json::Value {
        json!({
            "seq": seq,
            "kind": "console",
            "level": "log",
            "text": format!("line {seq}"),
            "source": "checkout.js:12",
            "method": null,
            "status": null,
        })
    }

    fn page_answer(doc: &str, seqs: impl IntoIterator<Item = u64>) -> String {
        let entries: Vec<serde_json::Value> = seqs.into_iter().map(entry).collect();
        serde_json::to_string(&json!({ "doc": doc, "entries": entries }).to_string())
            .expect("a string answer")
    }

    fn seqs_of(read: &ConsoleRead) -> Vec<u64> {
        read.entries.iter().map(|entry| entry.seq).collect()
    }

    #[test]
    fn wire_shape_console_read() {
        assert_wire_value(
            &ConsoleRead {
                doc: Some("k3x9".into()),
                entries: vec![ConsoleEntry {
                    seq: 4,
                    kind: EntryKind::Network,
                    level: EntryLevel::Error,
                    text: "/api/orders/confirm".into(),
                    source: None,
                    method: Some("POST".into()),
                    status: Some(500),
                }],
                is_heard: true,
            },
            json!({
                "doc": "k3x9",
                "entries": [{
                    "seq": 4,
                    "kind": "network",
                    "level": "error",
                    "text": "/api/orders/confirm",
                    "source": null,
                    "method": "POST",
                    "status": 500,
                }],
                "isHeard": true,
            }),
        );
    }

    #[test]
    fn answers_only_the_entries_after_the_cursor_of_the_same_load() {
        let cursor = Cursor::of(Some("k3x9"), 3);
        let read = answer_of(&page_answer("k3x9", 1..=6), &cursor).expect("reads");
        assert_eq!(seqs_of(&read), vec![4, 5, 6]);
        assert!(read.is_heard);
        assert_eq!(read.doc.as_deref(), Some("k3x9"));
    }

    #[test]
    fn answers_every_entry_of_a_new_load() {
        let cursor = Cursor::of(Some("k3x9"), 40);
        let read = answer_of(&page_answer("p2m7", 1..=3), &cursor).expect("reads");
        assert_eq!(seqs_of(&read), vec![1, 2, 3]);
        assert_eq!(read.doc.as_deref(), Some("p2m7"));
    }

    #[test]
    fn caps_the_answer_at_the_ring_size_and_keeps_the_newest() {
        let cursor = Cursor::of(None, 0);
        let read = answer_of(&page_answer("k3x9", 1..=700), &cursor).expect("reads");
        assert_eq!(read.entries.len(), RING_SIZE);
        assert_eq!(read.entries.first().map(|entry| entry.seq), Some(201));
        assert_eq!(read.entries.last().map(|entry| entry.seq), Some(700));
    }

    #[test]
    fn says_unheard_when_the_hook_does_not_answer() {
        let read = answer_of("null", &Cursor::of(None, 0)).expect("reads");
        assert!(!read.is_heard);
        assert!(read.entries.is_empty());
    }

    #[test]
    fn reads_nothing_from_an_answer_that_is_not_a_ring() {
        let cursor = Cursor::of(None, 0);
        assert_eq!(answer_of("", &cursor), None);
        assert_eq!(answer_of("42", &cursor), None);
        assert_eq!(answer_of("\"{}\"", &cursor), None);
        let bad_doc = serde_json::to_string(&json!({ "doc": "../x", "entries": [] }).to_string())
            .expect("a string");
        assert_eq!(answer_of(&bad_doc, &cursor), None);
        let huge = format!("\"{}\"", "a".repeat(MAX_ANSWER_BYTES + 1));
        assert_eq!(answer_of(&huge, &cursor), None);
    }

    #[test]
    fn drops_a_malformed_entry_and_clips_what_the_page_wrote() {
        let answer = json!({
            "doc": "k3x9",
            "entries": [
                { "seq": 1, "kind": "console", "level": "shout", "text": "x" },
                {
                    "seq": 2,
                    "kind": "console",
                    "level": "warn",
                    "text": "a".repeat(MAX_TEXT_CHARS + 50),
                    "source": "s".repeat(MAX_SOURCE_CHARS + 5),
                    "method": "POST",
                    "status": 500,
                },
                {
                    "seq": 3,
                    "kind": "network",
                    "level": "error",
                    "text": "/api/orders",
                    "source": null,
                    "method": "post<script>",
                    "status": 502,
                },
            ],
        })
        .to_string();
        let read = answer_of(&answer, &Cursor::of(None, 0)).expect("reads");
        assert_eq!(seqs_of(&read), vec![2, 3]);
        let warn = &read.entries[0];
        assert_eq!(warn.text.chars().count(), MAX_TEXT_CHARS);
        assert_eq!(
            warn.source.as_deref().map(|s| s.chars().count()),
            Some(MAX_SOURCE_CHARS)
        );
        assert_eq!(warn.method, None);
        assert_eq!(warn.status, None);
        let network = &read.entries[1];
        assert_eq!(network.method, None);
        assert_eq!(network.status, Some(502));
    }

    #[test]
    fn ignores_a_cursor_whose_load_id_is_not_one_the_hook_makes() {
        let cursor = Cursor::of(Some("\");alert(1);(\""), 9);
        assert_eq!(cursor, Cursor::of(None, 9));
        assert!(reader_script(&cursor).contains("doc:null,after:9"));
    }

    #[test]
    fn the_reader_dispatches_one_named_event_and_reaches_nothing_else() {
        let script = reader_script(&Cursor::of(Some("k3x9"), 2));
        assert!(script.contains(&format!("\"{}\"", READ_NAME.as_str())));
        assert!(script.contains("doc:\"k3x9\",after:2"));
        for banned in [
            "__TAURI",
            "invoke",
            "postMessage",
            "webkit",
            "fetch",
            "cookie",
        ] {
            assert!(!script.contains(banned), "{banned}");
        }
    }

    #[test]
    fn the_hook_holds_nothing_on_window_and_opens_no_channel() {
        for banned in [
            "globalThis",
            "self.",
            "window[",
            "defineProperty",
            "__TAURI",
            "invoke",
            "postMessage",
            "webkit",
            "messageHandlers",
            "ipc",
            "WebSocket",
            "sendBeacon",
            "localStorage",
            "sessionStorage",
            "document.cookie",
            "eval(",
            "Function(",
        ] {
            assert!(!HOOK.contains(banned), "the hook names {banned}");
        }
        let mut assigned = Vec::new();
        let mut rest = HOOK;
        while let Some(at) = rest.find("window.") {
            let tail = &rest[at + "window.".len()..];
            let name: String = tail
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
                .collect();
            let after = tail[name.len()..].trim_start();
            if after.starts_with('=') && !after.starts_with("==") {
                assigned.push(name);
            }
            rest = tail;
        }
        assert_eq!(assigned, vec!["fetch".to_string()]);
    }

    #[test]
    fn the_hook_runs_in_the_top_frame_only_and_keeps_a_ring_of_five_hundred() {
        assert!(HOOK.starts_with("(() => {\n  if (window.top !== window) {\n    return;\n  }"));
        assert!(HOOK.contains("const RING_SIZE = 500;"));
        assert_eq!(RING_SIZE, 500);
        assert!(HOOK.contains(READ_NAME_SLOT));
    }

    #[test]
    fn one_tab_script_holds_the_hook_with_its_read_name() {
        let script = tab_script();
        assert!(!script.contains(READ_NAME_SLOT));
        assert!(script.contains(READ_NAME.as_str()));
        assert!(script.contains("const RING_SIZE = 500;"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn one_tab_script_also_holds_the_passkey_probe_on_macos() {
        let script = tab_script();
        assert!(script.contains(super::super::passkey::WATCH_SCRIPT));
        assert!(script.contains("goodboyPasskey"));
    }
}
