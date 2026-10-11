use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use regex::Regex;
use serde::Serialize;
use serde_json::Value;

const MAX_FILE_BYTES: u64 = 1_048_576;
const ENV_FILES: [&str; 3] = [".env", ".env.local", ".env.development"];
const VITE_FILES: [&str; 3] = ["vite.config.ts", "vite.config.js", "vite.config.mjs"];
const COMPOSE_FILES: [&str; 2] = ["compose.yaml", "docker-compose.yml"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WatchedPort {
    pub(crate) port: u16,
    pub(crate) label: String,
    pub(crate) source: &'static str,
}

fn read_capped(path: &Path) -> Option<String> {
    let meta = fs::metadata(path).ok()?;
    if !meta.is_file() || meta.len() > MAX_FILE_BYTES {
        return None;
    }
    fs::read_to_string(path).ok()
}

fn valid_port(digits: &str) -> Option<u16> {
    if digits.is_empty() || digits.len() > 5 || !digits.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    digits.parse::<u16>().ok().filter(|port| *port > 0)
}

fn script_port(body: &str) -> Option<u16> {
    let flag = Regex::new(r"(?:^|\s)(?:-p|--port)(?:=|\s+)(\d{1,5})(?:\s|$)").ok()?;
    let env = Regex::new(r"(?:^|\s)PORT=(\d{1,5})(?:\s|$)").ok()?;
    [flag, env]
        .iter()
        .find_map(|pattern| valid_port(pattern.captures(body)?.get(1)?.as_str()))
}

fn package_ports(root: &Path) -> Vec<WatchedPort> {
    let Some(text) = read_capped(&root.join("package.json")) else {
        return Vec::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(&text) else {
        return Vec::new();
    };
    let Some(scripts) = value.get("scripts").and_then(Value::as_object) else {
        return Vec::new();
    };
    scripts
        .iter()
        .filter_map(|(name, body)| {
            Some(WatchedPort {
                port: script_port(body.as_str()?)?,
                label: name.clone(),
                source: "script",
            })
        })
        .collect()
}

fn env_ports(root: &Path) -> Vec<WatchedPort> {
    let mut out = Vec::new();
    for file in ENV_FILES {
        let Some(text) = read_capped(&root.join(file)) else {
            continue;
        };
        for line in text.lines() {
            let line = line.trim();
            let line = line.strip_prefix("export ").unwrap_or(line).trim_start();
            let Some((key, value)) = line.split_once('=') else {
                continue;
            };
            let key = key.trim();
            if key != "PORT" && !key.ends_with("_PORT") {
                continue;
            }
            let value = value.trim().trim_matches(['"', '\'']);
            if let Some(port) = valid_port(value) {
                out.push(WatchedPort {
                    port,
                    label: key.to_string(),
                    source: "env",
                });
            }
        }
    }
    out
}

fn vite_ports(root: &Path) -> Vec<WatchedPort> {
    let Ok(pattern) = Regex::new(r"server\s*:\s*\{[^}]*?\bport\s*:\s*(\d{1,5})\b") else {
        return Vec::new();
    };
    VITE_FILES
        .iter()
        .filter_map(|file| read_capped(&root.join(file)))
        .filter_map(|text| valid_port(pattern.captures(&text)?.get(1)?.as_str()))
        .map(|port| WatchedPort {
            port,
            label: "vite".to_string(),
            source: "vite",
        })
        .collect()
}

fn indent_of(line: &str) -> usize {
    line.len() - line.trim_start().len()
}

fn published_port(entry: &str) -> Option<u16> {
    let entry = entry.trim().trim_matches(['"', '\'']);
    let parts: Vec<&str> = entry.split(':').collect();
    let published = match parts.as_slice() {
        [host, _container] => host,
        [_ip, host, _container] => host,
        _ => return None,
    };
    valid_port(published)
}

fn compose_ports_in(text: &str) -> Vec<WatchedPort> {
    let mut out = Vec::new();
    let mut in_services = false;
    let mut service_indent: Option<usize> = None;
    let mut service = String::new();
    let mut ports_indent: Option<usize> = None;
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let indent = indent_of(line);
        if indent == 0 {
            in_services = trimmed == "services:";
            service_indent = None;
            ports_indent = None;
            continue;
        }
        if !in_services {
            continue;
        }
        let level = *service_indent.get_or_insert(indent);
        if indent == level {
            service = trimmed.trim_end_matches(':').to_string();
            ports_indent = None;
            continue;
        }
        if let Some(base) = ports_indent {
            if indent <= base && !trimmed.starts_with('-') {
                ports_indent = None;
            }
        }
        if ports_indent.is_none() {
            if trimmed == "ports:" {
                ports_indent = Some(indent);
            }
            continue;
        }
        let Some(entry) = trimmed.strip_prefix('-') else {
            continue;
        };
        if let Some(port) = published_port(entry) {
            out.push(WatchedPort {
                port,
                label: service.clone(),
                source: "compose",
            });
        }
    }
    out
}

fn compose_ports(root: &Path) -> Vec<WatchedPort> {
    COMPOSE_FILES
        .iter()
        .filter_map(|file| read_capped(&root.join(file)))
        .flat_map(|text| compose_ports_in(&text))
        .collect()
}

pub(crate) fn scan(root: &Path) -> Vec<WatchedPort> {
    let mut seen = BTreeSet::new();
    let mut out = Vec::new();
    let found = package_ports(root)
        .into_iter()
        .chain(env_ports(root))
        .chain(vite_ports(root))
        .chain(compose_ports(root));
    for item in found {
        if seen.insert((item.port, item.source)) {
            out.push(item);
        }
    }
    out
}

#[tauri::command]
pub(crate) async fn monitor_watched_ports(
    project_root: String,
) -> Result<Vec<WatchedPort>, String> {
    tauri::async_runtime::spawn_blocking(move || scan(Path::new(&project_root)))
        .await
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU64, Ordering};

    use super::*;

    static NEXT_DIR: AtomicU64 = AtomicU64::new(0);

    struct TestDir(std::path::PathBuf);

    impl TestDir {
        fn new() -> Self {
            let id = NEXT_DIR.fetch_add(1, Ordering::SeqCst);
            let path =
                std::env::temp_dir().join(format!("goodboy-watched-{}-{id}", std::process::id()));
            fs::create_dir_all(&path).expect("create dir");
            Self(path)
        }

        fn write(&self, name: &str, body: &str) {
            fs::write(self.0.join(name), body).expect("write file");
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn ports(found: &[WatchedPort]) -> Vec<(u16, &str, &str)> {
        found
            .iter()
            .map(|item| (item.port, item.label.as_str(), item.source))
            .collect()
    }

    #[test]
    fn package_json_script_flag_shapes() {
        let dir = TestDir::new();
        dir.write(
            "package.json",
            r#"{"scripts":{"dev":"vite -p 5173","api":"node s.js --port 4000","web":"next --port=3000","srv":"PORT=8080 node s.js","build":"tsc -p tsconfig.json","big":"x --port 70000","zero":"x --port 0","none":"echo hi"}}"#,
        );
        assert_eq!(
            ports(&scan(&dir.0)),
            vec![
                (4000, "api", "script"),
                (5173, "dev", "script"),
                (8080, "srv", "script"),
                (3000, "web", "script"),
            ]
        );
    }

    #[test]
    fn env_files_keep_only_integer_port_values() {
        let dir = TestDir::new();
        dir.write(
            ".env",
            "PORT=3000\nAPI_PORT=\"4000\"\nDB_PORT=abc\nREDIS_PORT=redis://localhost:6379\nSECRET=hunter2\nexport WEB_PORT=5000\nPORTAL=9000\n",
        );
        dir.write(".env.local", "# PORT=1111\nPORT=3001\n");
        dir.write(".env.development", "CACHE_PORT=6379\n");
        assert_eq!(
            ports(&scan(&dir.0)),
            vec![
                (3000, "PORT", "env"),
                (4000, "API_PORT", "env"),
                (5000, "WEB_PORT", "env"),
                (3001, "PORT", "env"),
                (6379, "CACHE_PORT", "env"),
            ]
        );
    }

    #[test]
    fn vite_config_server_port() {
        let dir = TestDir::new();
        dir.write(
            "vite.config.ts",
            "export default defineConfig({ plugins: [], server: {\n  host: true,\n  port: 5199,\n} });",
        );
        assert_eq!(ports(&scan(&dir.0)), vec![(5199, "vite", "vite")]);
    }

    #[test]
    fn compose_published_ports_use_the_service_name() {
        let dir = TestDir::new();
        dir.write(
            "compose.yaml",
            "services:\n  db:\n    image: postgres\n    ports:\n      - \"5432:5432\"\n    volumes:\n      - ./data:/var/lib\n  web:\n    ports:\n      - 8081:80\n      - \"127.0.0.1:9090:90\"\n      - \"3000-3005:3000\"\n    environment:\n      - A=1\n",
        );
        assert_eq!(
            ports(&scan(&dir.0)),
            vec![
                (5432, "db", "compose"),
                (8081, "web", "compose"),
                (9090, "web", "compose"),
            ]
        );
    }

    #[test]
    fn empty_missing_and_broken_inputs_yield_nothing() {
        let dir = TestDir::new();
        assert!(scan(&dir.0).is_empty());
        dir.write("package.json", "{not json");
        dir.write(".env", "   \n=\nPORT\n");
        dir.write("compose.yaml", "");
        assert!(scan(&dir.0).is_empty());
        assert!(scan(&dir.0.join("missing")).is_empty());
    }
}
