use std::sync::mpsc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{Runtime, Webview};

use super::console;
use super::reason::{self, PICK_UNAVAILABLE};
use crate::util::MessageError;

pub(crate) const MAX_PICKS: usize = 4;
pub(crate) const MAX_PICK_HTML_CHARS: usize = 4_000;
pub(crate) const MAX_PICK_TEXT_CHARS: usize = 1_000;
pub(crate) const MAX_PICK_SELECTOR_CHARS: usize = 300;
pub(crate) const MAX_PICK_NAME_CHARS: usize = 80;
pub(crate) const MAX_PICK_STYLES: usize = 20;
const MAX_PICK_PATH_CHARS: usize = 500;
const MAX_PICK_URL_CHARS: usize = 2_000;
const MAX_PICK_ANSWER_BYTES: usize = 200_000;
const MAX_RECT_EDGE: f64 = 100_000.0;
const PICK_TIMEOUT: Duration = Duration::from_secs(1);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PickOp {
    Start,
    Stop,
    Read,
}

impl PickOp {
    fn word(self) -> &'static str {
        match self {
            Self::Start => "start",
            Self::Stop => "stop",
            Self::Read => "read",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PickRect {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
}

impl PickRect {
    pub(crate) fn is_drawable(&self) -> bool {
        [self.x, self.y, self.width, self.height]
            .iter()
            .all(|value| value.is_finite() && value.abs() <= MAX_RECT_EDGE)
            && self.width >= 1.0
            && self.height >= 1.0
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PickStyle {
    name: String,
    value: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PickSource {
    path: String,
    line: u32,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PickedElement {
    tag: String,
    label: String,
    selector: String,
    text: String,
    html: String,
    is_html_cut: bool,
    styles: Vec<PickStyle>,
    component: Option<String>,
    source: Option<PickSource>,
    is_source_settled: bool,
    rect: Option<PickRect>,
    url: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PickRead {
    pub(crate) doc: Option<String>,
    pub(crate) is_heard: bool,
    pub(crate) is_on: bool,
    pub(crate) is_left: bool,
    pub(crate) round: u64,
    pub(crate) scale: f64,
    pub(crate) picks: Vec<PickedElement>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawPick {
    #[serde(default)]
    tag: String,
    #[serde(default)]
    label: String,
    #[serde(default)]
    selector: String,
    #[serde(default)]
    text: String,
    #[serde(default)]
    html: String,
    #[serde(default)]
    is_html_cut: bool,
    #[serde(default)]
    styles: Vec<PickStyle>,
    #[serde(default)]
    component: Option<String>,
    #[serde(default)]
    source: Option<PickSource>,
    #[serde(default)]
    is_source_settled: bool,
    #[serde(default)]
    rect: Option<PickRect>,
    #[serde(default)]
    url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawPickAnswer {
    doc: String,
    #[serde(default)]
    is_on: bool,
    #[serde(default)]
    is_left: bool,
    #[serde(default)]
    round: u64,
    #[serde(default)]
    scale: f64,
    #[serde(default)]
    picks: Vec<serde_json::Value>,
}

fn clipped(text: &str, max: usize) -> String {
    text.chars().take(max).collect()
}

fn name_of(raw: Option<String>) -> Option<String> {
    raw.map(|text| clipped(text.trim(), MAX_PICK_NAME_CHARS))
        .filter(|text| !text.is_empty())
}

fn source_of(raw: Option<PickSource>) -> Option<PickSource> {
    let source = raw?;
    if !source.path.starts_with('/') || source.line == 0 {
        return None;
    }
    Some(PickSource {
        path: clipped(&source.path, MAX_PICK_PATH_CHARS),
        line: source.line,
    })
}

fn pick_of(value: serde_json::Value) -> Option<PickedElement> {
    let raw: RawPick = serde_json::from_value(value).ok()?;
    let html_chars = raw.html.chars().count();
    Some(PickedElement {
        tag: clipped(&raw.tag, MAX_PICK_NAME_CHARS),
        label: clipped(&raw.label, MAX_PICK_NAME_CHARS),
        selector: clipped(&raw.selector, MAX_PICK_SELECTOR_CHARS),
        text: clipped(&raw.text, MAX_PICK_TEXT_CHARS),
        html: clipped(&raw.html, MAX_PICK_HTML_CHARS),
        is_html_cut: raw.is_html_cut || html_chars > MAX_PICK_HTML_CHARS,
        styles: raw
            .styles
            .into_iter()
            .take(MAX_PICK_STYLES)
            .map(|style| PickStyle {
                name: clipped(&style.name, MAX_PICK_NAME_CHARS),
                value: clipped(&style.value, MAX_PICK_NAME_CHARS),
            })
            .collect(),
        component: name_of(raw.component),
        source: source_of(raw.source),
        is_source_settled: raw.is_source_settled,
        rect: raw.rect.filter(PickRect::is_drawable),
        url: clipped(&raw.url, MAX_PICK_URL_CHARS),
    })
}

fn unheard() -> PickRead {
    PickRead {
        doc: None,
        is_heard: false,
        is_on: false,
        is_left: false,
        round: 0,
        scale: 1.0,
        picks: Vec::new(),
    }
}

fn scale_of(raw: f64) -> f64 {
    if raw.is_finite() && (0.5..=8.0).contains(&raw) {
        return raw;
    }
    1.0
}

pub(crate) fn pick_answer_of(raw: &str) -> Option<PickRead> {
    if raw.len() > MAX_PICK_ANSWER_BYTES {
        return None;
    }
    let value: serde_json::Value = serde_json::from_str(raw.trim()).ok()?;
    let answer: RawPickAnswer = match value {
        serde_json::Value::Null => return Some(unheard()),
        serde_json::Value::String(inner) => serde_json::from_str(&inner).ok()?,
        object @ serde_json::Value::Object(_) => serde_json::from_value(object).ok()?,
        _ => return None,
    };
    if !console::is_doc_id(&answer.doc) {
        return None;
    }
    let scale = scale_of(answer.scale);
    Some(PickRead {
        doc: Some(answer.doc),
        is_heard: true,
        is_on: answer.is_on,
        is_left: answer.is_left,
        round: answer.round,
        scale,
        picks: answer
            .picks
            .into_iter()
            .take(MAX_PICKS)
            .filter_map(pick_of)
            .collect(),
    })
}

pub(crate) fn pick_script(op: PickOp) -> String {
    let name = serde_json::to_string(&console::pick_event_name()).unwrap_or_default();
    let word = op.word();
    format!(
        "(function(){{try{{var box={{op:\"{word}\"}};window.dispatchEvent(new CustomEvent({name},{{detail:box}}));return typeof box.answer==='string'?box.answer:null}}catch(e){{return null}}}})()"
    )
}

pub(crate) fn drive_pick<R: Runtime>(
    webview: &Webview<R>,
    op: PickOp,
) -> Result<PickRead, MessageError> {
    let (sender, receiver) = mpsc::channel();
    webview
        .eval_with_callback(pick_script(op), move |raw| {
            let _ = sender.send(raw);
        })
        .map_err(|error| MessageError::Failed(error.to_string()))?;
    receiver
        .recv_timeout(PICK_TIMEOUT)
        .ok()
        .and_then(|raw| pick_answer_of(&raw))
        .ok_or_else(|| reason::failed(PICK_UNAVAILABLE))
}

pub(crate) fn has_new_pick(read: &PickRead, seen_round: u64) -> bool {
    read.is_on && read.round > seen_round && !read.picks.is_empty()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::util::wire_shape::assert_wire_value;

    fn pick(extra: serde_json::Value) -> serde_json::Value {
        let mut base = json!({
            "tag": "button",
            "label": "button.pay",
            "selector": "#root > main > button.pay",
            "text": "Pay $85.00",
            "html": "<button class=\"pay\">Pay $85.00</button>",
            "isHtmlCut": false,
            "styles": [{ "name": "display", "value": "block" }],
            "component": "PayButton",
            "source": { "path": "/src/checkout/PayButton.tsx", "line": 42 },
            "isSourceSettled": true,
            "rect": { "x": 8.0, "y": 99.5, "width": 101.0, "height": 34.0 },
            "url": "http://localhost:5173/checkout"
        });
        if let (Some(base), Some(extra)) = (base.as_object_mut(), extra.as_object()) {
            for (key, value) in extra {
                base.insert(key.clone(), value.clone());
            }
        }
        base
    }

    fn answer(picks: Vec<serde_json::Value>) -> String {
        json!({ "doc": "k3x9", "isOn": true, "isLeft": false, "round": 2, "scale": 2.0, "picks": picks })
            .to_string()
    }

    #[test]
    fn wire_shape_pick_read() {
        let read = pick_answer_of(&answer(vec![pick(json!({}))])).expect("reads");
        assert_wire_value(
            &read,
            json!({
                "doc": "k3x9",
                "isHeard": true,
                "isOn": true,
                "isLeft": false,
                "round": 2,
                "scale": 2.0,
                "picks": [{
                    "tag": "button",
                    "label": "button.pay",
                    "selector": "#root > main > button.pay",
                    "text": "Pay $85.00",
                    "html": "<button class=\"pay\">Pay $85.00</button>",
                    "isHtmlCut": false,
                    "styles": [{ "name": "display", "value": "block" }],
                    "component": "PayButton",
                    "source": { "path": "/src/checkout/PayButton.tsx", "line": 42 },
                    "isSourceSettled": true,
                    "rect": { "x": 8.0, "y": 99.5, "width": 101.0, "height": 34.0 },
                    "url": "http://localhost:5173/checkout"
                }]
            }),
        );
    }

    #[test]
    fn says_unheard_when_the_page_has_no_picker() {
        let read = pick_answer_of("null").expect("reads");
        assert!(!read.is_heard);
        assert!(read.picks.is_empty());
    }

    #[test]
    fn cuts_what_the_page_wrote_whatever_it_claims() {
        let read = pick_answer_of(&answer(vec![pick(json!({
            "html": "x".repeat(MAX_PICK_HTML_CHARS + 50),
            "isHtmlCut": false,
            "text": "y".repeat(MAX_PICK_TEXT_CHARS + 5),
            "selector": "z".repeat(MAX_PICK_SELECTOR_CHARS + 5),
            "component": "   ",
            "styles": (0..40).map(|index| json!({ "name": format!("s{index}"), "value": "v" })).collect::<Vec<_>>()
        }))]))
        .expect("reads");
        let element = &read.picks[0];
        assert_eq!(element.html.chars().count(), MAX_PICK_HTML_CHARS);
        assert!(element.is_html_cut);
        assert_eq!(element.text.chars().count(), MAX_PICK_TEXT_CHARS);
        assert_eq!(element.selector.chars().count(), MAX_PICK_SELECTOR_CHARS);
        assert_eq!(element.component, None);
        assert_eq!(element.styles.len(), MAX_PICK_STYLES);
    }

    #[test]
    fn keeps_at_most_the_pick_limit_and_drops_malformed_picks() {
        let mut picks: Vec<serde_json::Value> = (0..6).map(|_| pick(json!({}))).collect();
        picks.insert(0, json!("not a pick"));
        let read = pick_answer_of(&answer(picks)).expect("reads");
        assert_eq!(read.picks.len(), MAX_PICKS - 1);
    }

    #[test]
    fn drops_a_rect_or_source_that_cannot_be_used() {
        let read = pick_answer_of(&answer(vec![
            pick(json!({ "rect": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 10.0 } })),
            pick(json!({ "rect": { "x": 1e9, "y": 0.0, "width": 10.0, "height": 10.0 } })),
            pick(json!({ "source": { "path": "src/a.tsx", "line": 3 } })),
            pick(json!({ "source": { "path": "/src/a.tsx", "line": 0 } })),
        ]))
        .expect("reads");
        assert_eq!(read.picks[0].rect, None);
        assert_eq!(read.picks[1].rect, None);
        assert_eq!(read.picks[2].source, None);
        assert_eq!(read.picks[3].source, None);
    }

    #[test]
    fn refuses_an_answer_from_a_forged_load_or_too_large() {
        let forged = json!({ "doc": "\");alert(1);(\"", "picks": [] }).to_string();
        assert_eq!(pick_answer_of(&forged), None);
        let huge = answer(vec![pick(
            json!({ "text": "a".repeat(MAX_PICK_ANSWER_BYTES) }),
        )]);
        assert_eq!(pick_answer_of(&huge), None);
    }

    #[test]
    fn falls_back_to_one_when_the_scale_is_not_sane() {
        let raw = json!({ "doc": "k3x9", "scale": 99.0, "picks": [] }).to_string();
        assert_eq!(pick_answer_of(&raw).map(|read| read.scale), Some(1.0));
    }

    #[test]
    fn the_script_dispatches_one_named_event_and_reaches_nothing_else() {
        let script = pick_script(PickOp::Start);
        assert!(script.contains(&serde_json::to_string(&console::pick_event_name()).expect("name")));
        assert!(script.contains("op:\"start\""));
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
    fn a_new_pick_is_one_with_elements_in_a_later_round_while_picking() {
        let mut read = pick_answer_of(&answer(vec![pick(json!({}))])).expect("reads");
        assert!(has_new_pick(&read, 1));
        assert!(!has_new_pick(&read, 2));
        read.is_on = false;
        assert!(!has_new_pick(&read, 1));
        read.is_on = true;
        read.picks.clear();
        assert!(!has_new_pick(&read, 1));
    }
}
