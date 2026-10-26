#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum FailureKind {
    Network,
    AuthRefused,
    NotFound,
    Other,
}

const NETWORK_MARKERS: [&str; 10] = [
    "could not resolve host",
    "connection refused",
    "connection timed out",
    "connection reset",
    "network is unreachable",
    "network is down",
    "operation timed out",
    "early eof",
    "the remote end hung up",
    "tls connection",
];

const AUTH_MARKERS: [&str; 7] = [
    "authentication failed",
    "could not read username",
    "could not read password",
    "terminal prompts disabled",
    "permission denied",
    "access denied",
    "http 401",
];

const NOT_FOUND_MARKERS: [&str; 3] = ["repository not found", "not found", "does not exist"];

pub(crate) fn classify_failure(stderr: &str) -> FailureKind {
    let lowered = stderr.to_ascii_lowercase();
    let has = |markers: &[&str]| markers.iter().any(|marker| lowered.contains(marker));
    if has(&NETWORK_MARKERS) {
        return FailureKind::Network;
    }
    if has(&AUTH_MARKERS) {
        return FailureKind::AuthRefused;
    }
    if has(&NOT_FOUND_MARKERS) {
        return FailureKind::NotFound;
    }
    FailureKind::Other
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub(crate) enum PhaseKind {
    #[serde(rename = "Enumerating objects")]
    Enumerating,
    #[serde(rename = "Counting objects")]
    Counting,
    #[serde(rename = "Compressing objects")]
    Compressing,
    #[serde(rename = "Receiving objects")]
    Receiving,
    #[serde(rename = "Resolving deltas")]
    Resolving,
    #[serde(rename = "Updating files")]
    Updating,
    #[serde(rename = "Working")]
    Generic,
}

const PHASES: [(&str, PhaseKind); 6] = [
    ("Enumerating objects", PhaseKind::Enumerating),
    ("Counting objects", PhaseKind::Counting),
    ("Compressing objects", PhaseKind::Compressing),
    ("Receiving objects", PhaseKind::Receiving),
    ("Resolving deltas", PhaseKind::Resolving),
    ("Updating files", PhaseKind::Updating),
];

fn phase_of(label: &str) -> PhaseKind {
    PHASES
        .iter()
        .find(|(known, _)| *known == label)
        .map_or(PhaseKind::Generic, |(_, kind)| *kind)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Progress {
    pub(crate) phase: PhaseKind,
    pub(crate) percent: u8,
}

pub(crate) fn progress_of(line: &str) -> Option<Progress> {
    let line = line.trim().trim_start_matches("remote:").trim();
    let (phase, rest) = line.split_once(':')?;
    let percent_end = rest.find('%')?;
    let digits: String = rest[..percent_end]
        .chars()
        .rev()
        .take_while(char::is_ascii_digit)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    let percent = digits.parse::<u8>().ok().filter(|value| *value <= 100)?;
    Some(Progress {
        phase: phase_of(phase.trim()),
        percent,
    })
}
