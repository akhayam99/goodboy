use serde_json::json;

use super::*;
use crate::providers::{AuthState, AuthStateKind, ProbeErrorKind, ProviderStatus};
use crate::util::wire_shape::assert_wire_value;

#[test]
fn wire_shape_lifecycle_output_payload() {
    assert_wire_value(
        &LifecycleOutputPayload {
            run_id: "r1".to_string(),
            provider_id: "claude".to_string(),
            action: "login".to_string(),
            data: "out".to_string(),
        },
        json!({ "runId": "r1", "providerId": "claude", "action": "login", "data": "out" }),
    );
}

#[test]
fn wire_shape_lifecycle_exit_payload() {
    assert_wire_value(
        &LifecycleExitPayload {
            run_id: "r1".to_string(),
            provider_id: "claude".to_string(),
            action: "login".to_string(),
            exit_code: 0,
            status: ProviderStatus {
                id: "claude".to_string(),
                binary: "claude".to_string(),
                available: false,
                version: None,
                error: Some("missing".to_string()),
                path: None,
                error_kind: Some(ProbeErrorKind::NotFound),
            },
            auth: AuthState {
                state: AuthStateKind::Disconnected,
                identity: None,
                plan: None,
                verified: false,
                reason: None,
            },
        },
        json!({
            "runId": "r1",
            "providerId": "claude",
            "action": "login",
            "exitCode": 0,
            "status": {
                "id": "claude",
                "binary": "claude",
                "available": false,
                "version": null,
                "error": "missing",
                "path": null,
                "errorKind": "notFound",
            },
            "auth": {
                "state": "disconnected",
                "identity": null,
                "plan": null,
                "verified": false,
                "reason": null,
            },
        }),
    );
}
