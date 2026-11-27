use serde_json::json;

use super::network::RawAddress;
use super::*;
use crate::util::wire_shape::assert_wire_value;

fn endpoints_for(raw: &[RawAddress], selected: Option<&[String]>, port: u16) -> Vec<Endpoint> {
    let ips: Vec<IpAddr> = offered_addresses(raw, selected)
        .into_iter()
        .map(|a| a.ip)
        .collect();
    endpoints_of(&ips, port)
}

#[test]
fn wire_shape_qr_payload() {
    assert_wire_value(
        &QrPayload {
            v: QR_VERSION,
            device_name: "Harborline".to_string(),
            static_pub: "pub".to_string(),
            token: "t".to_string(),
            endpoints: vec![Endpoint {
                host: "10.0.0.2".to_string(),
                port: 4000,
            }],
            service_name: "goodboy".to_string(),
            permissions: Permissions::default().wire(),
        },
        json!({
            "v": 2,
            "deviceName": "Harborline",
            "staticPub": "pub",
            "token": "t",
            "endpoints": [{ "host": "10.0.0.2", "port": 4000 }],
            "serviceName": "goodboy",
            "permissions": { "canRead": true, "canDecide": true, "canMerge": true, "canStart": false },
        }),
    );
}

#[test]
fn wire_shape_phone_view() {
    assert_wire_value(
        &PhoneView {
            id: "key".to_string(),
            name: "Harborline iPhone".to_string(),
            paired_at: "2026-11-25T10:00:00.000Z".to_string(),
            last_seen: None,
            permissions: Permissions::default(),
        },
        json!({
            "id": "key",
            "name": "Harborline iPhone",
            "pairedAt": "2026-11-25T10:00:00.000Z",
            "lastSeen": null,
            "permissions": { "canDecide": true, "canMerge": true, "canStart": false },
        }),
    );
}

#[test]
fn wire_shape_network_interface() {
    assert_wire_value(
        &NetworkInterface {
            name: "en0".to_string(),
            addresses: vec!["192.168.1.20".to_string()],
            is_selected: true,
        },
        json!({ "name": "en0", "addresses": ["192.168.1.20"], "isSelected": true }),
    );
}

fn raw(interface: &str, ip: &str) -> RawAddress {
    RawAddress {
        interface: interface.to_string(),
        ip: ip.parse().unwrap(),
    }
}

#[test]
fn the_qr_is_version_two() {
    assert_eq!(QR_VERSION, 2);
}

#[test]
fn a_public_address_is_never_in_the_qr_endpoints() {
    let all = [
        raw("en0", "192.168.1.20"),
        raw("en0", "203.0.113.9"),
        raw("en0", "2001:db8::5"),
        raw("en0", "fd12:3456::7"),
        raw("utun4", "100.101.102.103"),
        raw("en5", "8.8.4.4"),
    ];

    let endpoints = endpoints_for(&all, None, 4000);

    let hosts: Vec<&str> = endpoints.iter().map(|e| e.host.as_str()).collect();
    assert_eq!(hosts, ["192.168.1.20", "fd12:3456::7", "100.101.102.103"]);
    assert!(endpoints.iter().all(|e| e.port == 4000));
}

#[test]
fn the_qr_endpoints_follow_the_chosen_interfaces_only() {
    let all = [raw("en0", "192.168.1.20"), raw("utun4", "100.101.102.103")];
    let chosen = ["utun4".to_string()];

    let endpoints = endpoints_for(&all, Some(&chosen), 4000);

    assert_eq!(endpoints.len(), 1);
    assert_eq!(endpoints[0].host, "100.101.102.103");
}

#[test]
fn no_chosen_interface_means_no_endpoint() {
    let all = [raw("en0", "192.168.1.20")];

    assert!(endpoints_for(&all, Some(&[]), 4000).is_empty());
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
            is_advertised: true,
            pending_pairing: Some(PendingPairing {
                id: "a1".to_string(),
                name: "Harborline iPhone".to_string(),
                code: "482 913".to_string(),
                asked_at: "2026-11-27T10:00:00Z".to_string(),
            }),
            fault: Some(BridgeFault {
                code: "file_unreadable",
                message: "m",
            }),
        },
        json!({
            "running": true,
            "port": 4000,
            "enrolledCount": 2,
            "isAdvertised": true,
            "pendingPairing": { "id": "a1", "name": "Harborline iPhone", "code": "482 913", "askedAt": "2026-11-27T10:00:00Z" },
            "fault": { "code": "file_unreadable", "message": "m" },
        }),
    );
}
