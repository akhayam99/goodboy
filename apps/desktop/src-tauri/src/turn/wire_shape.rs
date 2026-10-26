use serde_json::json;

use super::*;
use crate::proc::reap::StoppedProcess;
use crate::util::wire_shape::assert_wire_value;

#[test]
fn wire_shape_turn_event_envelope_line() {
    assert_wire_value(
        &TurnEventEnvelope {
            run_id: "r1".to_string(),
            seq: 3,
            event: TurnEventPayload::Line {
                line: "hello".into(),
            },
        },
        json!({ "runId": "r1", "seq": 3, "type": "line", "line": "hello" }),
    );
}

#[test]
fn wire_shape_turn_event_envelope_end_keeps_snake_case_exit_code() {
    assert_wire_value(
        &TurnEventEnvelope {
            run_id: "r1".to_string(),
            seq: 4,
            event: TurnEventPayload::End {
                exit_code: Some(0),
                stderr: String::new(),
            },
        },
        json!({ "runId": "r1", "seq": 4, "type": "end", "exit_code": 0, "stderr": "" }),
    );
}

#[test]
fn wire_shape_turn_event_envelope_error_and_reaped() {
    assert_wire_value(
        &TurnEventEnvelope {
            run_id: "r1".to_string(),
            seq: 5,
            event: TurnEventPayload::Error {
                message: "boom".to_string(),
            },
        },
        json!({ "runId": "r1", "seq": 5, "type": "error", "message": "boom" }),
    );
    assert_wire_value(
        &TurnEventEnvelope {
            run_id: "r1".to_string(),
            seq: 6,
            event: TurnEventPayload::Reaped {
                stopped: vec![StoppedProcess {
                    pid: 10,
                    name: "node".to_string(),
                    port: Some(3000),
                }],
            },
        },
        json!({
            "runId": "r1",
            "seq": 6,
            "type": "reaped",
            "stopped": [{ "pid": 10, "name": "node", "port": 3000 }],
        }),
    );
}

#[test]
fn wire_shape_spawn_args_reads_camel_case() {
    let args: SpawnArgs = serde_json::from_value(json!({
        "runId": "r1",
        "model": "m",
        "workingDir": "/w",
        "writableRoots": ["/w"],
        "prompt": "p",
        "binary": "claude",
        "allowedTools": ["Read"],
        "disallowedTools": ["Bash"],
        "permissionMode": "plan",
        "resumeSessionId": "rs",
        "systemPrompt": "sp",
        "effort": "high",
        "workspaceId": "w1",
        "sessionId": "s1",
        "mountId": "m1",
        "apiKeyEnv": "KEY",
        "credentialId": "c1",
        "cursorMaxMode": true,
        "confinedRole": "planner",
        "blocksPush": true,
        "isAutoChild": true,
        "excludesTmp": true,
        "deliveryId": "d1",
    }))
    .unwrap();
    assert_eq!(args.run_id, "r1");
    assert_eq!(args.working_dir, "/w");
    assert_eq!(args.writable_roots, vec!["/w".to_string()]);
    assert_eq!(args.allowed_tools, vec!["Read".to_string()]);
    assert_eq!(args.disallowed_tools, vec!["Bash".to_string()]);
    assert_eq!(args.permission_mode.as_deref(), Some("plan"));
    assert_eq!(args.resume_session_id.as_deref(), Some("rs"));
    assert_eq!(args.system_prompt.as_deref(), Some("sp"));
    assert_eq!(args.workspace_id.as_deref(), Some("w1"));
    assert_eq!(args.session_id.as_deref(), Some("s1"));
    assert_eq!(args.mount_id.as_deref(), Some("m1"));
    assert_eq!(args.api_key_env.as_deref(), Some("KEY"));
    assert_eq!(args.credential_id.as_deref(), Some("c1"));
    assert!(args.cursor_max_mode);
    assert_eq!(args.confined_role.as_deref(), Some("planner"));
    assert!(args.blocks_push);
    assert!(args.is_auto_child);
    assert!(args.excludes_tmp);
    assert_eq!(args.delivery_id.as_deref(), Some("d1"));
}

#[test]
fn wire_shape_writer_lease_binding_reads_camel_case() {
    let binding: WriterLeaseBinding =
        serde_json::from_value(json!({ "path": "/w", "holder": "h", "token": "t" })).unwrap();
    assert_eq!(binding.path, "/w");
    assert_eq!(binding.holder, "h");
    assert_eq!(binding.token, "t");
}
