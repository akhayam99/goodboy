use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

const ALLOWLIST: &str = include_str!("outbound_hosts.allowlist");
const SCHEMES: [&str; 2] = ["https://", "http://"];

fn source_files(directory: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let Ok(entries) = fs::read_dir(directory) else {
        return files;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if path.file_name().and_then(|name| name.to_str()) == Some("tests") {
                continue;
            }
            files.extend(source_files(&path));
            continue;
        }
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("");
        if name.ends_with(".rs") && name != "tests.rs" {
            files.push(path);
        }
    }
    files.sort();
    files
}

fn production_text(text: &str) -> &str {
    let mut offset = 0;
    for line in text.split_inclusive('\n') {
        if line.starts_with("#[cfg(test)]") {
            return &text[..offset];
        }
        offset += line.len();
    }
    text
}

fn hosts_in(text: &str) -> BTreeSet<String> {
    let mut hosts = BTreeSet::new();
    for scheme in SCHEMES {
        for (index, _) in text.match_indices(scheme) {
            let rest = &text[index + scheme.len()..];
            let host: String = rest
                .chars()
                .take_while(|character| {
                    character.is_ascii_alphanumeric() || matches!(character, '.' | '-')
                })
                .collect();
            let starts_like_a_host = host
                .chars()
                .next()
                .is_some_and(|first| first.is_ascii_alphanumeric());
            if starts_like_a_host {
                hosts.insert(host.trim_end_matches('.').to_string());
            }
        }
    }
    hosts
}

fn parse_allowlist(text: &str) -> Result<BTreeMap<String, String>, String> {
    let mut entries = BTreeMap::new();
    for (number, line) in text.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let Some((host, reason)) = line.split_once(" | ") else {
            return Err(format!(
                "line {} has no ` | reason` after the host: {line}",
                number + 1
            ));
        };
        if host.trim().is_empty() || reason.trim().is_empty() {
            return Err(format!(
                "line {} has an empty host or reason: {line}",
                number + 1
            ));
        }
        if entries
            .insert(host.trim().to_string(), reason.trim().to_string())
            .is_some()
        {
            return Err(format!("host {} is listed twice", host.trim()));
        }
    }
    Ok(entries)
}

fn unlisted_hosts(
    found: &BTreeMap<String, BTreeSet<String>>,
    allowed: &BTreeMap<String, String>,
) -> Vec<String> {
    found
        .iter()
        .filter(|(host, _)| !allowed.contains_key(*host))
        .map(|(host, files)| {
            format!(
                "{host} in {}",
                files.iter().cloned().collect::<Vec<_>>().join(", ")
            )
        })
        .collect()
}

fn stale_entries(
    found: &BTreeMap<String, BTreeSet<String>>,
    allowed: &BTreeMap<String, String>,
) -> Vec<String> {
    allowed
        .keys()
        .filter(|host| !found.contains_key(*host))
        .cloned()
        .collect()
}

fn found_in_sources() -> BTreeMap<String, BTreeSet<String>> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut found: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for file in source_files(&root) {
        let text = fs::read_to_string(&file).expect("a source file is readable");
        let name = file
            .strip_prefix(&root)
            .unwrap_or(&file)
            .to_string_lossy()
            .replace('\\', "/");
        for host in hosts_in(production_text(&text)) {
            found.entry(host).or_default().insert(name.clone());
        }
    }
    found
}

fn found_of(pairs: &[(&str, &str)]) -> BTreeMap<String, BTreeSet<String>> {
    let mut found: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for (host, file) in pairs {
        found
            .entry(host.to_string())
            .or_default()
            .insert(file.to_string());
    }
    found
}

#[test]
fn every_host_the_app_may_call_is_listed_with_a_reason() {
    let allowed = parse_allowlist(ALLOWLIST).expect("the allowlist parses");
    let unlisted = unlisted_hosts(&found_in_sources(), &allowed);
    assert!(
        unlisted.is_empty(),
        "a host in the Rust sources is not in tests/outbound_hosts.allowlist, add `host | reason` only with the owner: {unlisted:?}"
    );
}

#[test]
fn a_listed_host_that_no_source_names_is_removed() {
    let allowed = parse_allowlist(ALLOWLIST).expect("the allowlist parses");
    let stale = stale_entries(&found_in_sources(), &allowed);
    assert!(
        stale.is_empty(),
        "tests/outbound_hosts.allowlist lists a host no source names any more, delete the line: {stale:?}"
    );
}

#[test]
fn a_new_host_is_reported_with_its_file() {
    let allowed = parse_allowlist("api.acme.dev | chosen provider\n").expect("parses");
    let found = found_of(&[
        ("api.acme.dev", "acme.rs"),
        ("telemetry.northwind.dev", "notify.rs"),
    ]);
    assert_eq!(
        unlisted_hosts(&found, &allowed),
        vec!["telemetry.northwind.dev in notify.rs".to_string()]
    );
}

#[test]
fn a_host_without_a_reason_is_rejected() {
    assert!(parse_allowlist("api.acme.dev\n").is_err());
    assert!(parse_allowlist("api.acme.dev | \n").is_err());
    assert!(parse_allowlist("api.acme.dev | a\napi.acme.dev | b\n").is_err());
}

#[test]
fn an_unused_entry_is_stale() {
    let allowed = parse_allowlist("api.acme.dev | chosen provider\n").expect("parses");
    assert_eq!(
        stale_entries(&found_of(&[]), &allowed),
        vec!["api.acme.dev".to_string()]
    );
}

#[test]
fn hosts_are_read_from_literals_and_not_from_test_modules() {
    let text = "const A: &str = \"https://api.acme.dev/v1\";\nlet b = \"http://{address}\";\n#[cfg(test)]\nmod tests {\n    const C: &str = \"https://payments-api.test\";\n}\n";
    let hosts = hosts_in(production_text(text));
    assert_eq!(
        hosts.into_iter().collect::<Vec<_>>(),
        vec!["api.acme.dev".to_string()]
    );
}
