use serde_json::json;

use super::*;
use crate::util::wire_shape::{assert_wire_reads, assert_wire_value};

#[test]
fn wire_shape_chat_event_envelope() {
    assert_wire_value(
        &ChatEventEnvelope {
            run_id: "r1".to_string(),
            chat_id: "c1".to_string(),
            seq: 2,
            event: TurnEventPayload::Line {
                line: "hello".into(),
            },
        },
        json!({
            "runId": "r1",
            "chatId": "c1",
            "seq": 2,
            "type": "line",
            "line": "hello",
        }),
    );
}

#[test]
fn wire_shape_chat_turn_args() {
    assert_wire_reads::<ChatTurnArgs>(json!({
        "runId": "r1",
        "chatId": "c1",
        "provider": "claude",
        "model": "m",
        "prompt": "p",
        "systemPrompt": "sp",
        "effort": "high",
        "images": true,
        "messageId": "m1",
    }));
}

#[test]
fn wire_shape_ask_turn_args() {
    assert_wire_reads::<AskTurnArgs>(json!({
        "runId": "r1",
        "threadId": "t1",
        "sessionId": "s1",
        "provider": "claude",
        "model": "m",
        "prompt": "p",
        "systemPrompt": "sp",
        "effort": "high",
        "dossier": [{ "name": "notes.md", "content": "text" }],
    }));
}
