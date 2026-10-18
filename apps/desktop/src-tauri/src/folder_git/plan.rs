use std::collections::BTreeMap;

use serde::Serialize;

const DEPENDENCY_ANYWHERE: &[&str] = &["node_modules", "__pycache__", ".venv", "venv", "Pods"];

const OUTPUT_AT_TOP: &[&str] = &[
    "dist",
    "build",
    "out",
    "target",
    "DerivedData",
    ".next",
    "vendor",
];

const SECRET_NAMES: &[&str] = &[
    "id_rsa",
    "id_rsa.pub",
    "id_dsa",
    "id_dsa.pub",
    "id_ecdsa",
    "id_ecdsa.pub",
    "id_ed25519",
    "id_ed25519.pub",
    ".npmrc",
    ".pypirc",
    ".netrc",
    "credentials.json",
];

const SECRET_EXTENSIONS: &[&str] = &["pem", "key", "p12", "pfx", "jks", "keystore"];

const SYSTEM_NAME: &str = ".DS_Store";

const ROOT_SAMPLE: usize = 3;

pub(crate) const ROOT_KEY: &str = ".";

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EntryKind {
    Included,
    Dependencies,
    Output,
    Secret,
    System,
    Goodboy,
    Repository,
}

impl EntryKind {
    fn is_left_out(self) -> bool {
        !matches!(self, EntryKind::Included)
    }

    fn can_toggle(self) -> bool {
        matches!(self, EntryKind::Dependencies | EntryKind::Output)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanEntry {
    pub key: String,
    pub kind: EntryKind,
    pub files: u32,
    pub sample: Vec<String>,
    pub is_left_out: bool,
    pub can_toggle: bool,
    pub ignore: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Bucket {
    kind: EntryKind,
    key: String,
    ignore: Option<String>,
}

pub(crate) fn is_secret_name(name: &str) -> bool {
    if name == ".env" || name.starts_with(".env.") {
        return true;
    }
    if SECRET_NAMES.contains(&name) {
        return true;
    }
    let Some((stem, extension)) = name.rsplit_once('.') else {
        return false;
    };
    !stem.is_empty() && SECRET_EXTENSIONS.contains(&extension)
}

fn secret_pattern(name: &str) -> String {
    if name == ".env" || name.starts_with(".env.") {
        return ".env*".to_string();
    }
    if SECRET_NAMES.contains(&name) {
        return name.to_string();
    }
    match name.rsplit_once('.') {
        Some((_, extension)) => format!("*.{extension}"),
        None => name.to_string(),
    }
}

fn bucket_of(path: &str, has_goodboy_sessions: bool) -> Bucket {
    let parts: Vec<&str> = path.split('/').filter(|part| !part.is_empty()).collect();
    let first = parts.first().copied().unwrap_or_default();
    let last = parts.last().copied().unwrap_or_default();
    if path.ends_with('/') {
        return Bucket {
            kind: EntryKind::Repository,
            key: path.to_string(),
            ignore: Some(format!("/{path}")),
        };
    }
    if first == ".goodboy" && parts.len() > 1 {
        return Bucket {
            kind: EntryKind::Goodboy,
            key: ".goodboy/".to_string(),
            ignore: Some("/.goodboy".to_string()),
        };
    }
    if first == "sessions" && parts.len() > 1 && has_goodboy_sessions {
        return Bucket {
            kind: EntryKind::Goodboy,
            key: "sessions/".to_string(),
            ignore: Some("/sessions/".to_string()),
        };
    }
    if is_secret_name(last) {
        let pattern = secret_pattern(last);
        return Bucket {
            kind: EntryKind::Secret,
            key: pattern.clone(),
            ignore: Some(pattern),
        };
    }
    let folders = &parts[..parts.len().saturating_sub(1)];
    if let Some(found) = folders
        .iter()
        .find(|part| DEPENDENCY_ANYWHERE.contains(part))
    {
        return Bucket {
            kind: EntryKind::Dependencies,
            key: format!("{found}/"),
            ignore: Some(format!("{found}/")),
        };
    }
    if parts.len() > 1 && OUTPUT_AT_TOP.contains(&first) {
        return Bucket {
            kind: EntryKind::Output,
            key: format!("{first}/"),
            ignore: Some(format!("/{first}/")),
        };
    }
    if last == SYSTEM_NAME {
        return Bucket {
            kind: EntryKind::System,
            key: SYSTEM_NAME.to_string(),
            ignore: Some(SYSTEM_NAME.to_string()),
        };
    }
    if parts.len() <= 1 {
        return Bucket {
            kind: EntryKind::Included,
            key: ROOT_KEY.to_string(),
            ignore: None,
        };
    }
    Bucket {
        kind: EntryKind::Included,
        key: format!("{first}/"),
        ignore: None,
    }
}

pub(crate) fn plan_entries(paths: &[String], has_goodboy_sessions: bool) -> Vec<PlanEntry> {
    let mut grouped: BTreeMap<(EntryKind, String), PlanEntry> = BTreeMap::new();
    for path in paths {
        let bucket = bucket_of(path, has_goodboy_sessions);
        let entry = grouped
            .entry((bucket.kind, bucket.key.clone()))
            .or_insert_with(|| PlanEntry {
                key: bucket.key.clone(),
                kind: bucket.kind,
                files: 0,
                sample: Vec::new(),
                is_left_out: bucket.kind.is_left_out(),
                can_toggle: bucket.kind.can_toggle(),
                ignore: bucket.ignore.clone(),
            });
        entry.files = entry.files.saturating_add(1);
        if entry.sample.len() < ROOT_SAMPLE {
            entry.sample.push(path.trim_end_matches('/').to_string());
        }
    }
    let mut entries: Vec<PlanEntry> = grouped.into_values().collect();
    entries.sort_by(|left, right| {
        left.kind
            .cmp(&right.kind)
            .then((left.key == ROOT_KEY).cmp(&(right.key == ROOT_KEY)))
            .then(right.files.cmp(&left.files))
            .then(left.key.cmp(&right.key))
    });
    entries
}
