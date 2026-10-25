use serde_json::json;

use super::*;
use crate::util::wire_shape::assert_wire_value;

#[test]
fn wire_shape_provider_status() {
    assert_wire_value(
        &ProviderStatus::failed(
            "claude",
            "claude",
            ProbeErrorKind::NotFound,
            "missing".to_string(),
        ),
        json!({
            "id": "claude",
            "binary": "claude",
            "available": false,
            "version": null,
            "error": "missing",
            "path": null,
            "errorKind": "notFound",
        }),
    );
}

#[test]
fn wire_shape_auth_state() {
    assert_wire_value(
        &AuthState {
            state: AuthStateKind::Connected,
            identity: Some("acme".to_string()),
            plan: Some("pro".to_string()),
            verified: true,
            reason: None,
        },
        json!({
            "state": "connected",
            "identity": "acme",
            "plan": "pro",
            "verified": true,
            "reason": null,
        }),
    );
}
