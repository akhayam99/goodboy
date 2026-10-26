use serde_json::json;

use super::*;
use crate::util::wire_shape::assert_wire_value;

#[test]
fn wire_shape_script_output_payload() {
    assert_wire_value(
        &ScriptOutputPayload {
            run_id: "r1".to_string(),
            data: "out".to_string(),
            offset: 3,
        },
        json!({ "runId": "r1", "data": "out", "offset": 3 }),
    );
}

#[test]
fn wire_shape_script_exit_payload() {
    assert_wire_value(
        &ScriptExitPayload {
            run_id: "r1".to_string(),
            exit_code: 1,
        },
        json!({ "runId": "r1", "exitCode": 1 }),
    );
}

#[test]
fn wire_shape_live_script_run() {
    assert_wire_value(
        &LiveScriptRun {
            run_id: "r1".to_string(),
            script_id: "s1".to_string(),
            name: "build".to_string(),
            session_id: "se1".to_string(),
            cwd: "/w".to_string(),
            pid: Some(10),
            started_at: 5,
        },
        json!({
            "runId": "r1",
            "scriptId": "s1",
            "name": "build",
            "sessionId": "se1",
            "cwd": "/w",
            "pid": 10,
            "startedAt": 5,
        }),
    );
}
