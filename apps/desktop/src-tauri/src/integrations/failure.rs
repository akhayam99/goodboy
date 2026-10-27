use reqwest::header::{HeaderMap, RETRY_AFTER};
use serde_json::{Map, Value};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum HostFailureKind {
    BadCredentials,
    Denied,
    NotFound,
    RateLimited,
    Network,
    Timeout,
    Failed,
}

impl HostFailureKind {
    #[cfg(test)]
    pub(crate) const ALL: [HostFailureKind; 7] = [
        HostFailureKind::BadCredentials,
        HostFailureKind::Denied,
        HostFailureKind::NotFound,
        HostFailureKind::RateLimited,
        HostFailureKind::Network,
        HostFailureKind::Timeout,
        HostFailureKind::Failed,
    ];

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            HostFailureKind::BadCredentials => "bad_credentials",
            HostFailureKind::Denied => "denied",
            HostFailureKind::NotFound => "not_found",
            HostFailureKind::RateLimited => "rate_limited",
            HostFailureKind::Network => "network",
            HostFailureKind::Timeout => "timeout",
            HostFailureKind::Failed => "failed",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct HostFailure {
    pub kind: HostFailureKind,
    pub status: Option<u16>,
    pub retry_after_seconds: Option<u64>,
    pub detail: Option<String>,
}

impl HostFailure {
    pub(crate) fn of_kind(kind: HostFailureKind, detail: &str) -> Self {
        HostFailure {
            kind,
            status: None,
            retry_after_seconds: None,
            detail: Some(detail.to_string()),
        }
    }

    pub(crate) fn insert_into(&self, map: &mut Map<String, Value>) {
        map.insert(
            "failureKind".to_string(),
            Value::String(self.kind.as_str().to_string()),
        );
        if let Some(status) = self.status {
            map.insert("status".to_string(), Value::from(status));
        }
        if let Some(seconds) = self.retry_after_seconds {
            map.insert("retryAfterSeconds".to_string(), Value::from(seconds));
        }
        if let Some(detail) = &self.detail {
            map.insert("detail".to_string(), Value::String(detail.clone()));
        }
    }
}

pub(crate) fn kind_of_status(status: u16) -> HostFailureKind {
    match status {
        0 => HostFailureKind::Network,
        401 => HostFailureKind::BadCredentials,
        403 => HostFailureKind::Denied,
        404 => HostFailureKind::NotFound,
        408 => HostFailureKind::Timeout,
        429 => HostFailureKind::RateLimited,
        _ => HostFailureKind::Failed,
    }
}

pub(crate) fn failure_of_status(
    status: u16,
    retry_after_seconds: Option<u64>,
    detail: &str,
) -> HostFailure {
    let kind = kind_of_status(status);
    HostFailure {
        kind,
        status: Some(status),
        retry_after_seconds: match kind {
            HostFailureKind::RateLimited => retry_after_seconds,
            _ => None,
        },
        detail: Some(detail.to_string()),
    }
}

pub(crate) fn retry_after_of(headers: &HeaderMap) -> Option<u64> {
    headers
        .get(RETRY_AFTER)?
        .to_str()
        .ok()?
        .trim()
        .parse::<u64>()
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::header::HeaderValue;

    #[test]
    fn every_status_has_one_kind() {
        for (status, kind) in [
            (0, HostFailureKind::Network),
            (401, HostFailureKind::BadCredentials),
            (403, HostFailureKind::Denied),
            (404, HostFailureKind::NotFound),
            (408, HostFailureKind::Timeout),
            (429, HostFailureKind::RateLimited),
            (400, HostFailureKind::Failed),
            (409, HostFailureKind::Failed),
            (422, HostFailureKind::Failed),
            (500, HostFailureKind::Failed),
            (502, HostFailureKind::Failed),
            (503, HostFailureKind::Failed),
        ] {
            assert_eq!(kind_of_status(status), kind, "status {status}");
        }
    }

    #[test]
    fn the_wire_names_are_stable_and_distinct() {
        let names: Vec<&str> = HostFailureKind::ALL
            .iter()
            .map(|kind| kind.as_str())
            .collect();
        assert_eq!(
            names,
            vec![
                "bad_credentials",
                "denied",
                "not_found",
                "rate_limited",
                "network",
                "timeout",
                "failed"
            ]
        );
    }

    #[test]
    fn only_a_rate_limit_carries_the_retry_hint() {
        assert_eq!(
            failure_of_status(429, Some(12), "slow down").retry_after_seconds,
            Some(12)
        );
        assert_eq!(
            failure_of_status(500, Some(12), "boom").retry_after_seconds,
            None
        );
    }

    #[test]
    fn the_wire_form_holds_kind_status_retry_and_detail() {
        let mut map = Map::new();
        failure_of_status(429, Some(7), "slow down").insert_into(&mut map);
        assert_eq!(map["failureKind"], "rate_limited");
        assert_eq!(map["status"], 429);
        assert_eq!(map["retryAfterSeconds"], 7);
        assert_eq!(map["detail"], "slow down");
    }

    #[test]
    fn a_failure_without_a_status_leaves_the_field_out() {
        let mut map = Map::new();
        HostFailure::of_kind(HostFailureKind::Timeout, "deadline").insert_into(&mut map);
        assert_eq!(map["failureKind"], "timeout");
        assert!(map.get("status").is_none());
        assert!(map.get("retryAfterSeconds").is_none());
    }

    #[test]
    fn retry_after_reads_whole_seconds_and_nothing_else() {
        let mut headers = HeaderMap::new();
        assert_eq!(retry_after_of(&headers), None);
        headers.insert(RETRY_AFTER, HeaderValue::from_static(" 30 "));
        assert_eq!(retry_after_of(&headers), Some(30));
        headers.insert(
            RETRY_AFTER,
            HeaderValue::from_static("Wed, 21 Oct 2026 07:28:00 GMT"),
        );
        assert_eq!(retry_after_of(&headers), None);
        headers.insert(RETRY_AFTER, HeaderValue::from_static("-4"));
        assert_eq!(retry_after_of(&headers), None);
    }
}
