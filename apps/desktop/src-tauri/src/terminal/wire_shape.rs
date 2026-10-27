use serde_json::json;

use super::*;
use crate::util::wire_shape::assert_wire_value;

#[test]
fn wire_shape_terminal_output_payload() {
    assert_wire_value(
        &TerminalOutputPayload {
            session_id: "s1".to_string(),
            data: "out".to_string(),
            offset: 3,
        },
        json!({ "sessionId": "s1", "data": "out", "offset": 3 }),
    );
}

#[test]
fn wire_shape_terminal_exit_payload() {
    assert_wire_value(
        &TerminalExitPayload {
            session_id: "s1".to_string(),
            exit_code: 1,
        },
        json!({ "sessionId": "s1", "exitCode": 1 }),
    );
}

#[test]
fn wire_shape_live_terminal() {
    assert_wire_value(
        &LiveTerminal {
            id: "t1".to_string(),
            cwd: "/w".to_string(),
            pid: Some(10),
            foreground_pid: Some(11),
            foreground_command: Some("pnpm test".to_string()),
        },
        json!({
            "id": "t1",
            "cwd": "/w",
            "pid": 10,
            "foregroundPid": 11,
            "foregroundCommand": "pnpm test"
        }),
    );
}
