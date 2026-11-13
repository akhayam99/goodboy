use std::sync::mpsc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{Runtime, Webview};

use crate::util::MessageError;

pub(crate) const MAX_PAGE_CHARS: usize = 60_000;

const READ_TIMEOUT: Duration = Duration::from_secs(3);
const READ_UNITS: usize = MAX_PAGE_CHARS * 2 + 2;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PageText {
    pub(crate) title: String,
    pub(crate) url: String,
    pub(crate) text: String,
    pub(crate) is_cut: bool,
}

#[derive(Debug, Deserialize)]
struct PageRead {
    title: String,
    url: String,
    text: String,
    length: usize,
}

pub(crate) fn read_script() -> String {
    format!(
        "(function(){{try{{var body=document.body;var full=body?body.innerText:'';return JSON.stringify({{title:document.title||'',url:location.href,text:full.slice(0,{READ_UNITS}),length:full.length}})}}catch(e){{return ''}}}})()"
    )
}

fn cut_note(length: usize) -> String {
    format!("\n\n[cut: the first {MAX_PAGE_CHARS} of about {length} characters of this page]")
}

fn capped(text: &str, length: usize) -> (String, bool) {
    if text.chars().count() <= MAX_PAGE_CHARS && length <= text.encode_utf16().count() {
        return (text.to_string(), false);
    }
    let kept: String = text.chars().take(MAX_PAGE_CHARS).collect();
    (format!("{}{}", kept.trim_end(), cut_note(length)), true)
}

pub(crate) fn page_text_of(raw: &str) -> Option<PageText> {
    let value: serde_json::Value = serde_json::from_str(raw.trim()).ok()?;
    let read: PageRead = match value {
        serde_json::Value::String(inner) => serde_json::from_str(&inner).ok()?,
        object @ serde_json::Value::Object(_) => serde_json::from_value(object).ok()?,
        _ => return None,
    };
    let (text, is_cut) = capped(&read.text, read.length);
    Some(PageText {
        title: read.title,
        url: read.url,
        text,
        is_cut,
    })
}

pub(crate) fn read_page_text<R: Runtime>(
    webview: &Webview<R>,
    unavailable: &str,
) -> Result<PageText, MessageError> {
    let (sender, receiver) = mpsc::channel();
    webview
        .eval_with_callback(read_script(), move |raw| {
            let _ = sender.send(raw);
        })
        .map_err(|error| MessageError::Failed(error.to_string()))?;
    receiver
        .recv_timeout(READ_TIMEOUT)
        .ok()
        .and_then(|raw| page_text_of(&raw))
        .ok_or_else(|| MessageError::Failed(unavailable.to_string()))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::util::wire_shape::assert_wire_value;

    fn answer(text: &str, length: usize) -> String {
        json!({ "title": "Checkout", "url": "https://acme.test/checkout", "text": text, "length": length })
            .to_string()
    }

    #[test]
    fn wire_shape_page_text() {
        assert_wire_value(
            &PageText {
                title: "Checkout".into(),
                url: "https://acme.test/checkout".into(),
                text: "Total".into(),
                is_cut: false,
            },
            json!({
                "title": "Checkout",
                "url": "https://acme.test/checkout",
                "text": "Total",
                "isCut": false,
            }),
        );
    }

    #[test]
    fn keeps_a_short_page_whole() {
        let read = page_text_of(&answer("Total 12.00", 11)).expect("reads");

        assert_eq!(read.text, "Total 12.00");
        assert!(!read.is_cut);
        assert_eq!(read.title, "Checkout");
    }

    #[test]
    fn cuts_a_long_page_at_the_cap_and_says_so_at_the_end() {
        let long = "a".repeat(MAX_PAGE_CHARS + 500);
        let read = page_text_of(&answer(&long, long.len())).expect("reads");

        assert!(read.is_cut);
        assert!(read.text.starts_with(&"a".repeat(MAX_PAGE_CHARS)));
        assert!(read.text.ends_with(&format!(
            "[cut: the first 60000 of about {} characters of this page]",
            MAX_PAGE_CHARS + 500
        )));
        let (kept, _) = read.text.split_once("\n\n[cut:").expect("a cut note");
        assert_eq!(kept.chars().count(), MAX_PAGE_CHARS);
    }

    #[test]
    fn cuts_by_characters_and_never_inside_one() {
        let long = "é".repeat(MAX_PAGE_CHARS + 1);
        let read = page_text_of(&answer(&long, long.chars().count())).expect("reads");

        assert!(read.is_cut);
        assert_eq!(
            read.text.chars().filter(|c| *c == 'é').count(),
            MAX_PAGE_CHARS
        );
    }

    #[test]
    fn says_cut_when_the_page_script_already_sliced_the_text() {
        let sliced = "a".repeat(MAX_PAGE_CHARS);
        let read = page_text_of(&answer(&sliced, MAX_PAGE_CHARS * 3)).expect("reads");

        assert!(read.is_cut);
        assert!(read.text.contains("about 180000 characters"));
    }

    #[test]
    fn reads_an_answer_the_page_returned_as_an_object() {
        let object = json!({ "title": "t", "url": "u", "text": "x", "length": 1 }).to_string();

        assert_eq!(page_text_of(&object).expect("reads").text, "x");
    }

    #[test]
    fn reads_nothing_from_an_answer_that_is_not_a_page() {
        assert_eq!(page_text_of(""), None);
        assert_eq!(page_text_of("null"), None);
        assert_eq!(page_text_of("\"\""), None);
        assert_eq!(page_text_of("42"), None);
    }

    #[test]
    fn asks_for_the_visible_text_only_and_bounds_what_leaves_the_page() {
        let script = read_script();

        assert!(script.contains("innerText"));
        assert!(script.contains(".slice(0,120002)"));
        assert!(!script.contains("outerHTML"));
        assert!(!script.contains("cookie"));
    }
}
