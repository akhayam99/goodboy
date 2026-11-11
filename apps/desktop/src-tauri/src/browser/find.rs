use std::sync::mpsc;
use std::time::Duration;

use serde::Serialize;
use tauri::{Runtime, Webview};

use super::reason::{self, FIND_UNAVAILABLE, NEEDLE_TOO_LONG};
use crate::util::MessageError;

pub(crate) const MAX_NEEDLE_CHARS: usize = 200;

const FIND_TIMEOUT: Duration = Duration::from_secs(1);
const CLEAR_SCRIPT: &str =
    "(function(){try{window.getSelection().removeAllRanges()}catch(e){}return false})()";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FindOutcome {
    pub(crate) is_found: bool,
}

pub(crate) fn find_script(needle: &str, is_backwards: bool) -> String {
    let quoted = serde_json::to_string(needle).unwrap_or_else(|_| String::from("\"\""));
    format!(
        "(function(){{try{{return window.find({quoted},false,{is_backwards},true,false,false,false)===true}}catch(e){{return false}}}})()"
    )
}

fn script_of(needle: &str, is_backwards: bool) -> String {
    if needle.is_empty() {
        return CLEAR_SCRIPT.to_string();
    }
    find_script(needle, is_backwards)
}

pub(crate) fn outcome_of(raw: &str) -> Option<FindOutcome> {
    match raw.trim() {
        "true" => Some(FindOutcome { is_found: true }),
        "false" => Some(FindOutcome { is_found: false }),
        _ => None,
    }
}

pub(crate) fn find_in_page<R: Runtime>(
    webview: &Webview<R>,
    needle: &str,
    is_backwards: bool,
) -> Result<FindOutcome, MessageError> {
    if needle.chars().count() > MAX_NEEDLE_CHARS {
        return Err(reason::refused(NEEDLE_TOO_LONG));
    }
    let (sender, receiver) = mpsc::channel();
    webview
        .eval_with_callback(script_of(needle, is_backwards), move |raw| {
            let _ = sender.send(raw);
        })
        .map_err(|error| MessageError::Failed(error.to_string()))?;
    receiver
        .recv_timeout(FIND_TIMEOUT)
        .ok()
        .and_then(|raw| outcome_of(&raw))
        .ok_or_else(|| reason::failed(FIND_UNAVAILABLE))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::util::wire_shape::assert_wire_value;

    #[test]
    fn wire_shape_find_outcome() {
        assert_wire_value(&FindOutcome { is_found: true }, json!({ "isFound": true }));
    }

    #[test]
    fn searches_forward_and_wraps_around() {
        assert_eq!(
            find_script("retry", false),
            "(function(){try{return window.find(\"retry\",false,false,true,false,false,false)===true}catch(e){return false}})()"
        );
    }

    #[test]
    fn searches_backward_for_the_previous_match() {
        assert!(find_script("retry", true).contains("\"retry\",false,true,true"));
    }

    #[test]
    fn quotes_a_needle_that_would_break_out_of_the_script() {
        let script = find_script("\");alert(1);(\"\n\\", false);

        assert!(script.contains(r#"window.find("\");alert(1);(\"\n\\","#));
    }

    #[test]
    fn reads_found_and_not_found_from_the_page_answer() {
        assert_eq!(outcome_of("true"), Some(FindOutcome { is_found: true }));
        assert_eq!(
            outcome_of(" false\n"),
            Some(FindOutcome { is_found: false })
        );
    }

    #[test]
    fn reads_no_outcome_from_an_answer_that_is_not_a_boolean() {
        assert_eq!(outcome_of("null"), None);
        assert_eq!(outcome_of(""), None);
        assert_eq!(outcome_of("\"true\""), None);
    }

    #[test]
    fn clears_the_selection_for_an_empty_needle_and_reports_nothing_found() {
        let script = script_of("", false);

        assert!(script.contains("removeAllRanges"));
        assert!(script.ends_with("return false})()"));
        assert!(!script.contains("window.find"));
    }
}
