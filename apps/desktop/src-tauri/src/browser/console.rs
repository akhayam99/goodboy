use std::collections::HashSet;
use std::sync::mpsc;
use std::sync::LazyLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{Runtime, Webview};

use super::reason::{self, CONSOLE_UNAVAILABLE};
use crate::util::{uuid_v4, MessageError};

pub(crate) const CONSOLE_RING_SIZE: usize = 500;
pub(crate) const NETWORK_RING_SIZE: usize = 300;
pub(crate) const ERROR_RING_SIZE: usize = 100;
pub(crate) const MAX_TEXT_CHARS: usize = 2_000;
pub(crate) const MAX_SOURCE_CHARS: usize = 200;
pub(crate) const MAX_METHOD_CHARS: usize = 16;
pub(crate) const MAX_STACK_CHARS: usize = 4_000;
pub(crate) const MAX_BODY_CHARS: usize = 65_536;
pub(crate) const MAX_HEADERS: usize = 50;
pub(crate) const MAX_HEADER_NAME_CHARS: usize = 100;
pub(crate) const MAX_HEADER_VALUE_CHARS: usize = 1_000;
pub(crate) const MAX_ANSWER_BYTES: usize = 4_000_000;
pub(crate) const SENSITIVE_HEADERS: [&str; 9] = [
    "authorization",
    "proxy-authorization",
    "cookie",
    "set-cookie",
    "set-cookie2",
    "x-api-key",
    "x-auth-token",
    "x-csrf-token",
    "x-xsrf-token",
];
const MAX_DOC_CHARS: usize = 32;
const MAX_ID_CHARS: usize = 32;

const RUNTIME: &str = concat!(
    "(() => {\n  if (window.top !== window) {\n    return;\n  }\n",
    include_str!("page_runtime/prelude.js"),
    include_str!("page_runtime/console.js"),
    include_str!("page_runtime/errors.js"),
    include_str!("page_runtime/network.js"),
    include_str!("page_runtime/pick.js"),
    include_str!("page_runtime/reader.js"),
    "})();\n",
);
const APP_SCRIPT_SOURCE: &str = "user-script:";
const IPC_FALLBACK_TEXT: &str = "IPC custom protocol failed";
const REJECTION_TEXT: &str = "Unhandled rejection: ";
const WINDOW_REFUSAL_MARK: &str = " not allowed on window \"";
const ACL_REFUSAL_HEAD: &str = "Command ";
const ACL_REFUSAL_TAIL: &str = " not allowed by ACL";
const READ_NAME_SLOT: &str = "__GOODBOY_CONSOLE_READ__";
const READ_TIMEOUT: Duration = Duration::from_secs(1);

static READ_NAME: LazyLock<String> =
    LazyLock::new(|| format!("goodboy-console-{}", uuid_v4().replace('-', "")));

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum EntryKind {
    Console,
    Network,
    Error,
}

impl EntryKind {
    fn ring_size(self) -> usize {
        match self {
            EntryKind::Console => CONSOLE_RING_SIZE,
            EntryKind::Network => NETWORK_RING_SIZE,
            EntryKind::Error => ERROR_RING_SIZE,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum EntryLevel {
    Log,
    Info,
    Warn,
    Error,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum RequestType {
    Fetch,
    Xhr,
    Doc,
    Script,
    Style,
    Img,
    Ws,
    Sse,
    Other,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ErrorOrigin {
    Uncaught,
    Rejection,
    Console,
    Request,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SocketPhase {
    Open,
    Closed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Header {
    pub(crate) name: String,
    pub(crate) value: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SocketFacts {
    pub(crate) phase: SocketPhase,
    pub(crate) sent: u32,
    pub(crate) received: u32,
    pub(crate) code: Option<u16>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RequestFacts {
    pub(crate) id: String,
    #[serde(rename = "type")]
    pub(crate) request_type: RequestType,
    pub(crate) start: f64,
    pub(crate) duration: Option<f64>,
    pub(crate) size: Option<u64>,
    pub(crate) request_headers: Vec<Header>,
    pub(crate) response_headers: Vec<Header>,
    pub(crate) request_body: Option<String>,
    pub(crate) response_body: Option<String>,
    pub(crate) socket: Option<SocketFacts>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ErrorFacts {
    pub(crate) origin: ErrorOrigin,
    pub(crate) stack: Option<String>,
    pub(crate) request_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsoleEntry {
    pub(crate) seq: u64,
    pub(crate) kind: EntryKind,
    pub(crate) level: EntryLevel,
    pub(crate) text: String,
    pub(crate) source: Option<String>,
    pub(crate) method: Option<String>,
    pub(crate) status: Option<u16>,
    pub(crate) network: Option<RequestFacts>,
    pub(crate) error: Option<ErrorFacts>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
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
#[serde(rename_all = "camelCase")]
struct RawRequest {
    id: String,
    #[serde(rename = "type")]
    request_type: RequestType,
    start: f64,
    duration: Option<f64>,
    size: Option<u64>,
    #[serde(default)]
    request_headers: Vec<Header>,
    #[serde(default)]
    response_headers: Vec<Header>,
    request_body: Option<String>,
    response_body: Option<String>,
    socket: Option<SocketFacts>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawError {
    origin: ErrorOrigin,
    stack: Option<String>,
    request_id: Option<String>,
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
    #[serde(default)]
    network: Option<RawRequest>,
    #[serde(default)]
    error: Option<RawError>,
}

fn is_doc_id(doc: &str) -> bool {
    !doc.is_empty()
        && doc.len() <= MAX_DOC_CHARS
        && doc
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
}

fn is_request_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= MAX_ID_CHARS && id.chars().all(|c| c.is_ascii_alphanumeric())
}

fn clipped(text: &str, max: usize) -> String {
    text.chars().take(max).collect()
}

fn method_of(raw: Option<String>) -> Option<String> {
    raw.map(|method| clipped(&method, MAX_METHOD_CHARS))
        .filter(|method| !method.is_empty() && method.chars().all(|c| c.is_ascii_uppercase()))
}

fn is_header_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_HEADER_NAME_CHARS
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || "!#$%&'*+-.^_`|~".contains(c))
}

fn headers_of(raw: Vec<Header>) -> Vec<Header> {
    raw.into_iter()
        .filter_map(|header| {
            let name = header.name.trim().to_ascii_lowercase();
            if !is_header_name(&name) || SENSITIVE_HEADERS.contains(&name.as_str()) {
                return None;
            }
            Some(Header {
                name,
                value: clipped(&header.value, MAX_HEADER_VALUE_CHARS),
            })
        })
        .take(MAX_HEADERS)
        .collect()
}

fn body_of(raw: Option<String>) -> Option<String> {
    raw.map(|body| clipped(&body, MAX_BODY_CHARS))
}

fn is_stream(request_type: RequestType) -> bool {
    matches!(request_type, RequestType::Ws | RequestType::Sse)
}

fn request_of(raw: RawRequest) -> Option<RequestFacts> {
    if !is_request_id(&raw.id) {
        return None;
    }
    Some(RequestFacts {
        id: raw.id,
        request_type: raw.request_type,
        start: raw.start.max(0.0),
        duration: raw.duration.filter(|duration| *duration >= 0.0),
        size: raw.size,
        request_headers: headers_of(raw.request_headers),
        response_headers: headers_of(raw.response_headers),
        request_body: body_of(raw.request_body),
        response_body: body_of(raw.response_body),
        socket: raw.socket.filter(|_| is_stream(raw.request_type)),
    })
}

fn error_of(raw: RawError) -> ErrorFacts {
    ErrorFacts {
        origin: raw.origin,
        stack: raw
            .stack
            .map(|stack| clipped(&stack, MAX_STACK_CHARS))
            .filter(|stack| !stack.is_empty()),
        request_id: raw
            .request_id
            .filter(|id| raw.origin == ErrorOrigin::Request && is_request_id(id)),
    }
}

fn is_command_name(text: &str) -> bool {
    !text.is_empty() && !text.contains(' ')
}

fn is_host_refusal(reason: &str) -> bool {
    let is_acl = reason
        .strip_prefix(ACL_REFUSAL_HEAD)
        .and_then(|rest| rest.strip_suffix(ACL_REFUSAL_TAIL))
        .is_some_and(is_command_name);
    let is_window = reason
        .split_once(WINDOW_REFUSAL_MARK)
        .is_some_and(|(name, _)| is_command_name(name) && name.contains('.'));
    is_acl || is_window
}

fn is_app_noise(raw: &RawEntry) -> bool {
    if raw.kind == EntryKind::Network {
        return false;
    }
    raw.source
        .as_deref()
        .is_some_and(|source| source.starts_with(APP_SCRIPT_SOURCE))
        || raw.text.starts_with(IPC_FALLBACK_TEXT)
        || raw
            .text
            .strip_prefix(REJECTION_TEXT)
            .is_some_and(is_host_refusal)
}

fn entry_of(value: serde_json::Value) -> Option<ConsoleEntry> {
    let raw: RawEntry = serde_json::from_value(value).ok()?;
    if is_app_noise(&raw) {
        return None;
    }
    let is_network = raw.kind == EntryKind::Network;
    let network = match raw.network {
        Some(request) if is_network => Some(request_of(request)?),
        _ => None,
    };
    let error = raw
        .error
        .filter(|_| raw.kind == EntryKind::Error)
        .map(error_of);
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
        network,
        error,
    })
}

fn newest_of_each_ring(entries: Vec<ConsoleEntry>) -> Vec<ConsoleEntry> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut counts = [0_usize; 3];
    let mut kept: Vec<ConsoleEntry> = entries
        .into_iter()
        .rev()
        .filter(|entry| {
            if let Some(request) = &entry.network {
                if !seen.insert(request.id.clone()) {
                    return false;
                }
            }
            let slot = &mut counts[entry.kind as usize];
            *slot += 1;
            *slot <= entry.kind.ring_size()
        })
        .collect();
    kept.reverse();
    kept
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
    with_passkey_probe(RUNTIME.replace(READ_NAME_SLOT, &READ_NAME))
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
    Some(ConsoleRead {
        doc: Some(answer.doc),
        entries: newest_of_each_ring(entries),
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
            "network": null,
            "error": null,
        })
    }

    fn request(seq: u64, id: &str) -> serde_json::Value {
        json!({
            "seq": seq,
            "kind": "network",
            "level": "info",
            "text": "/api/orders",
            "source": null,
            "method": "GET",
            "status": 200,
            "network": {
                "id": id,
                "type": "fetch",
                "start": 12.5,
                "duration": 30.0,
                "size": 120,
                "requestHeaders": [],
                "responseHeaders": [],
                "requestBody": null,
                "responseBody": null,
                "socket": null,
            },
            "error": null,
        })
    }

    fn failure(seq: u64) -> serde_json::Value {
        json!({
            "seq": seq,
            "kind": "error",
            "level": "error",
            "text": "TypeError: total is undefined",
            "source": "checkout.js:40",
            "method": null,
            "status": null,
            "network": null,
            "error": { "origin": "uncaught", "stack": "at checkout.js:40:3", "requestId": null },
        })
    }

    fn answer_with(doc: &str, entries: Vec<serde_json::Value>) -> String {
        serde_json::to_string(&json!({ "doc": doc, "entries": entries }).to_string())
            .expect("a string answer")
    }

    fn page_answer(doc: &str, seqs: impl IntoIterator<Item = u64>) -> String {
        answer_with(doc, seqs.into_iter().map(entry).collect())
    }

    fn seqs_of(read: &ConsoleRead) -> Vec<u64> {
        read.entries.iter().map(|entry| entry.seq).collect()
    }

    fn only_entry(value: serde_json::Value) -> Option<ConsoleEntry> {
        answer_of(&answer_with("k3x9", vec![value]), &Cursor::of(None, 0))
            .expect("reads")
            .entries
            .into_iter()
            .next()
    }

    #[test]
    fn wire_shape_console_read() {
        assert_wire_value(
            &ConsoleRead {
                doc: Some("k3x9".into()),
                entries: vec![
                    ConsoleEntry {
                        seq: 4,
                        kind: EntryKind::Network,
                        level: EntryLevel::Error,
                        text: "/api/orders/confirm".into(),
                        source: None,
                        method: Some("POST".into()),
                        status: Some(500),
                        network: Some(RequestFacts {
                            id: "r4".into(),
                            request_type: RequestType::Fetch,
                            start: 12.5,
                            duration: Some(30.5),
                            size: Some(42),
                            request_headers: vec![Header {
                                name: "content-type".into(),
                                value: "application/json".into(),
                            }],
                            response_headers: Vec::new(),
                            request_body: Some("{\"cart\":12}".into()),
                            response_body: None,
                            socket: None,
                        }),
                        error: None,
                    },
                    ConsoleEntry {
                        seq: 5,
                        kind: EntryKind::Error,
                        level: EntryLevel::Error,
                        text: "POST /api/orders/confirm 500".into(),
                        source: None,
                        method: None,
                        status: None,
                        network: None,
                        error: Some(ErrorFacts {
                            origin: ErrorOrigin::Request,
                            stack: None,
                            request_id: Some("r4".into()),
                        }),
                    },
                ],
                is_heard: true,
            },
            json!({
                "doc": "k3x9",
                "entries": [
                    {
                        "seq": 4,
                        "kind": "network",
                        "level": "error",
                        "text": "/api/orders/confirm",
                        "source": null,
                        "method": "POST",
                        "status": 500,
                        "network": {
                            "id": "r4",
                            "type": "fetch",
                            "start": 12.5,
                            "duration": 30.5,
                            "size": 42,
                            "requestHeaders": [{ "name": "content-type", "value": "application/json" }],
                            "responseHeaders": [],
                            "requestBody": "{\"cart\":12}",
                            "responseBody": null,
                            "socket": null,
                        },
                        "error": null,
                    },
                    {
                        "seq": 5,
                        "kind": "error",
                        "level": "error",
                        "text": "POST /api/orders/confirm 500",
                        "source": null,
                        "method": null,
                        "status": null,
                        "network": null,
                        "error": { "origin": "request", "stack": null, "requestId": "r4" },
                    },
                ],
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
    fn caps_the_console_at_its_ring_size_and_keeps_the_newest() {
        let cursor = Cursor::of(None, 0);
        let read = answer_of(&page_answer("k3x9", 1..=700), &cursor).expect("reads");
        assert_eq!(read.entries.len(), CONSOLE_RING_SIZE);
        assert_eq!(read.entries.first().map(|entry| entry.seq), Some(201));
        assert_eq!(read.entries.last().map(|entry| entry.seq), Some(700));
    }

    #[test]
    fn one_kind_cannot_push_another_out_of_the_answer() {
        let mut entries = vec![entry(1), failure(2)];
        entries.extend((3..=702).map(|seq| request(seq, &format!("r{seq}"))));
        let read = answer_of(&answer_with("k3x9", entries), &Cursor::of(None, 0)).expect("reads");
        let count = |kind: EntryKind| read.entries.iter().filter(|e| e.kind == kind).count();
        assert_eq!(count(EntryKind::Console), 1);
        assert_eq!(count(EntryKind::Error), 1);
        assert_eq!(count(EntryKind::Network), NETWORK_RING_SIZE);
        assert_eq!(seqs_of(&read)[..3], [1, 2, 403]);
        let errors: Vec<serde_json::Value> = (1..=150).map(failure).collect();
        let read = answer_of(&answer_with("k3x9", errors), &Cursor::of(None, 0)).expect("reads");
        assert_eq!(read.entries.len(), ERROR_RING_SIZE);
        assert_eq!(read.entries.first().map(|entry| entry.seq), Some(51));
    }

    #[test]
    fn keeps_only_the_newest_record_of_a_request() {
        let mut done = request(9, "r3");
        done["network"]["responseBody"] = json!("{\"ok\":true}");
        let answer = answer_with("k3x9", vec![request(4, "r3"), request(5, "r4"), done]);
        let read = answer_of(&answer, &Cursor::of(None, 0)).expect("reads");
        assert_eq!(seqs_of(&read), vec![5, 9]);
        let body = read.entries[1]
            .network
            .as_ref()
            .and_then(|facts| facts.response_body.as_deref());
        assert_eq!(body, Some("{\"ok\":true}"));
    }

    #[test]
    fn drops_sensitive_and_malformed_headers_whatever_the_page_sent() {
        let mut value = request(1, "r1");
        let mut headers = vec![
            json!({ "name": "Authorization", "value": "Bearer abc" }),
            json!({ "name": "cookie", "value": "sid=1" }),
            json!({ "name": "Set-Cookie", "value": "sid=2" }),
            json!({ "name": "x-api-key", "value": "k" }),
            json!({ "name": "bad name", "value": "x" }),
            json!({ "name": "Content-Type", "value": "application/json" }),
            json!({ "name": "x-trace", "value": "v".repeat(MAX_HEADER_VALUE_CHARS + 9) }),
        ];
        headers.extend((0..80).map(|n| json!({ "name": format!("x-h{n}"), "value": "1" })));
        value["network"]["requestHeaders"] = json!(headers);
        value["network"]["responseHeaders"] = json!([{ "name": "set-cookie", "value": "sid=3" }]);
        let facts = only_entry(value)
            .and_then(|e| e.network)
            .expect("a request");
        let names: Vec<&str> = facts
            .request_headers
            .iter()
            .map(|h| h.name.as_str())
            .collect();
        assert_eq!(names[..2], ["content-type", "x-trace"]);
        assert_eq!(facts.request_headers.len(), MAX_HEADERS);
        assert_eq!(
            facts.request_headers[1].value.chars().count(),
            MAX_HEADER_VALUE_CHARS
        );
        assert!(facts.response_headers.is_empty());
        for name in SENSITIVE_HEADERS {
            assert!(!names.contains(&name), "{name}");
        }
    }

    #[test]
    fn clips_bodies_and_stacks_and_drops_facts_that_do_not_fit_the_kind() {
        let mut value = request(1, "r1");
        value["network"]["responseBody"] = json!("b".repeat(MAX_BODY_CHARS + 10));
        value["network"]["socket"] =
            json!({ "phase": "open", "sent": 1, "received": 2, "code": null });
        let facts = only_entry(value)
            .and_then(|e| e.network)
            .expect("a request");
        assert_eq!(
            facts.response_body.map(|body| body.chars().count()),
            Some(MAX_BODY_CHARS)
        );
        assert_eq!(facts.socket, None);

        let mut socket = request(2, "r2");
        socket["network"]["type"] = json!("ws");
        socket["network"]["socket"] =
            json!({ "phase": "closed", "sent": 3, "received": 4, "code": 1000 });
        let facts = only_entry(socket)
            .and_then(|e| e.network)
            .expect("a socket");
        assert_eq!(facts.socket.map(|s| (s.sent, s.received)), Some((3, 4)));

        let mut thrown = failure(3);
        thrown["error"]["stack"] = json!("s".repeat(MAX_STACK_CHARS + 1));
        thrown["error"]["requestId"] = json!("r1");
        let facts = only_entry(thrown).and_then(|e| e.error).expect("an error");
        assert_eq!(
            facts.stack.map(|stack| stack.chars().count()),
            Some(MAX_STACK_CHARS)
        );
        assert_eq!(facts.request_id, None);

        let mut bad_id = request(4, "r4");
        bad_id["network"]["id"] = json!("r4\");alert(1)");
        assert_eq!(only_entry(bad_id), None);

        let mut stray = entry(5);
        stray["network"] = request(5, "r5")["network"].clone();
        stray["error"] = failure(5)["error"].clone();
        let line = only_entry(stray).expect("a console line");
        assert_eq!((line.network, line.error), (None, None));
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
    fn keeps_the_apps_own_injected_script_messages_out_of_the_page_console() {
        let answer = json!({
            "doc": "k3x9",
            "entries": [
                {
                    "seq": 1,
                    "kind": "console",
                    "level": "warn",
                    "text": "IPC custom protocol failed, Tauri will now use the postMessage interface",
                    "source": "user-script:38",
                },
                {
                    "seq": 2,
                    "kind": "error",
                    "level": "error",
                    "text": "Unhandled rejection: notification.is_permission_granted not allowed on window \"main\"",
                    "source": null,
                    "error": { "origin": "rejection", "stack": null, "requestId": null },
                },
                {
                    "seq": 3,
                    "kind": "error",
                    "level": "error",
                    "text": "Unhandled rejection: Error: checkout failed",
                    "source": "checkout.js:12",
                    "error": { "origin": "rejection", "stack": null, "requestId": null },
                },
                {
                    "seq": 4,
                    "kind": "network",
                    "level": "info",
                    "text": "/assets/app.js",
                    "source": null,
                    "method": "GET",
                    "status": null,
                },
                {
                    "seq": 5,
                    "kind": "error",
                    "level": "error",
                    "text": "Unhandled rejection: Command plugin:notification|is_permission_granted not allowed by ACL",
                    "source": null,
                },
                {
                    "seq": 6,
                    "kind": "error",
                    "level": "error",
                    "text": "Unhandled rejection: Acme document update not allowed by ACL",
                    "source": null,
                },
            ],
        })
        .to_string();
        let read = answer_of(&answer, &Cursor::of(None, 0)).expect("reads");
        assert_eq!(seqs_of(&read), vec![3, 4, 6]);
        assert_eq!(read.entries[1].status, None);
        assert_eq!(read.entries[1].level, EntryLevel::Info);
    }

    #[test]
    fn the_runtime_joins_its_modules_in_order_inside_one_top_frame_closure() {
        let modules = [
            include_str!("page_runtime/prelude.js"),
            include_str!("page_runtime/console.js"),
            include_str!("page_runtime/errors.js"),
            include_str!("page_runtime/network.js"),
            include_str!("page_runtime/pick.js"),
            include_str!("page_runtime/reader.js"),
        ];
        let head = "(() => {\n  if (window.top !== window) {\n    return;\n  }\n";
        assert_eq!(RUNTIME, format!("{head}{}}})();\n", modules.concat()));
        assert!(RUNTIME.contains(READ_NAME_SLOT));
        assert!(include_str!("page_runtime/pick.js").is_empty());
    }

    #[test]
    fn the_runtime_keeps_a_ring_per_kind_of_the_same_sizes_as_rust() {
        assert!(RUNTIME.contains(&format!(
            "const RING_SIZES = {{ console: {CONSOLE_RING_SIZE}, network: {NETWORK_RING_SIZE}, error: {ERROR_RING_SIZE} }};"
        )));
        assert!(RUNTIME.contains("const ring = rings[entry.kind];"));
        assert!(RUNTIME.contains(&format!("const MAX_BODY = {MAX_BODY_CHARS};")));
        assert!(RUNTIME.contains(&format!("const MAX_STACK = {MAX_STACK_CHARS};")));
        assert!(RUNTIME.contains(&format!("const MAX_HEADERS = {MAX_HEADERS};")));
        for name in SENSITIVE_HEADERS {
            assert!(RUNTIME.contains(&format!("  '{name}',\n")), "{name}");
        }
    }

    #[test]
    fn the_runtime_records_every_request_kind() {
        assert!(RUNTIME.contains("answerFetch(request, response)"));
        assert!(RUNTIME.contains("saveRequest(request, statusOf(xhr.status), xhrAnswerOf(xhr))"));
        assert!(RUNTIME.contains("watchTimings('resource');"));
        assert!(RUNTIME.contains("watchTimings('navigation');"));
        assert!(RUNTIME.contains("openRequest('ws', 'GET', address)"));
        assert!(RUNTIME.contains("openRequest('sse', 'GET', address)"));
        assert!(RUNTIME.contains("storeError(\n      'request',"));
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
    fn the_runtime_holds_nothing_on_window_and_opens_no_channel() {
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
            "new WebSocket",
            "new EventSource",
            "new Native",
            "sendBeacon",
            "localStorage",
            "sessionStorage",
            "document.cookie",
            "eval(",
            "Function(",
        ] {
            assert!(!RUNTIME.contains(banned), "the runtime names {banned}");
        }
        assert_eq!(RUNTIME.matches("reflect.construct(").count(), 1);
        assert!(RUNTIME.contains("reflect.construct(Native, arguments, new.target)"));
        let mut assigned = Vec::new();
        let mut rest = RUNTIME;
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
        assert_eq!(assigned, vec!["fetch", "WebSocket", "EventSource"]);
    }

    #[test]
    fn one_tab_script_holds_the_runtime_with_its_read_name() {
        let script = tab_script();
        assert!(!script.contains(READ_NAME_SLOT));
        assert!(script.contains(READ_NAME.as_str()));
        assert!(script.starts_with("(() => {\n  if (window.top !== window) {"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn one_tab_script_also_holds_the_passkey_probe_on_macos() {
        let script = tab_script();
        assert!(script.contains(super::super::passkey::WATCH_SCRIPT));
        assert!(script.contains("goodboyPasskey"));
    }
}
