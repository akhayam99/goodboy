use serde_json::json;

use super::*;
use crate::util::wire_shape::assert_wire_value;

#[test]
fn wire_shape_qr_payload() {
    assert_wire_value(
        &QrPayload {
            v: 1,
            device_name: "Harborline".to_string(),
            static_pub: "pub".to_string(),
            token: "t".to_string(),
            endpoints: vec![Endpoint {
                host: "10.0.0.2".to_string(),
                port: 4000,
            }],
            service_name: "goodboy".to_string(),
        },
        json!({
            "v": 1,
            "deviceName": "Harborline",
            "staticPub": "pub",
            "token": "t",
            "endpoints": [{ "host": "10.0.0.2", "port": 4000 }],
            "serviceName": "goodboy",
        }),
    );
}

#[test]
fn wire_shape_qr_info() {
    assert_wire_value(
        &QrInfo {
            payload: "{}".to_string(),
            svg: "<svg/>".to_string(),
            device_name: "Harborline".to_string(),
            port: 4000,
            expires_in_secs: 60,
        },
        json!({
            "payload": "{}",
            "svg": "<svg/>",
            "deviceName": "Harborline",
            "port": 4000,
            "expiresInSecs": 60,
        }),
    );
}

#[test]
fn wire_shape_bridge_status() {
    assert_wire_value(
        &BridgeStatus {
            running: true,
            port: Some(4000),
            enrolled_count: 2,
        },
        json!({ "running": true, "port": 4000, "enrolledCount": 2 }),
    );
}
