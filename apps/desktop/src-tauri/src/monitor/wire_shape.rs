use serde_json::json;

use super::*;
use crate::util::wire_shape::assert_wire_value;

#[test]
fn wire_shape_monitor_snapshot_keeps_the_platform_rename() {
    assert_wire_value(
        &MonitorSnapshot {
            listeners: vec![Listener {
                port: 3000,
                address: "127.0.0.1".to_string(),
                protocol: "tcp",
                pid: 10,
            }],
            processes: vec![ProcessInfo {
                pid: 10,
                ppid: 1,
                pgid: 10,
                name: "node".to_string(),
                cwd: Some("/w".to_string()),
                started_at: 5,
                cpu_percent: 1.5,
                rss_bytes: 2048,
                uid: 501,
                args_masked: "node server.js".to_string(),
            }],
            taken_at: 99,
            platform_supported: true,
        },
        json!({
            "listeners": [{
                "port": 3000,
                "address": "127.0.0.1",
                "protocol": "tcp",
                "pid": 10,
            }],
            "processes": [{
                "pid": 10,
                "ppid": 1,
                "pgid": 10,
                "name": "node",
                "cwd": "/w",
                "startedAt": 5,
                "cpuPercent": 1.5,
                "rssBytes": 2048,
                "uid": 501,
                "argsMasked": "node server.js",
            }],
            "takenAt": 99,
            "isPlatformSupported": true,
        }),
    );
}
