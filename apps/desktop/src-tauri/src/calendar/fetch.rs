use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use crate::integrations::http::{client, require_secure_scheme, send_retrying, TransportFailure};

use super::error::CalendarError;

const WEBCAL_SCHEME: &str = "webcal://";
const SECURE_SCHEME: &str = "https://";
const MAX_BODY_BYTES: usize = 8 * 1024 * 1024;
const FRESH_FOR_MS: i64 = 15 * 60_000;
const ACCEPTED_TYPES: &str = "text/calendar, text/plain;q=0.5";

pub(crate) fn checked_link(text: &str) -> Result<reqwest::Url, CalendarError> {
    let text = text.trim();
    let text = match text.get(..WEBCAL_SCHEME.len()) {
        Some(head) if head.eq_ignore_ascii_case(WEBCAL_SCHEME) => {
            format!("{SECURE_SCHEME}{}", &text[WEBCAL_SCHEME.len()..])
        }
        _ => text.to_string(),
    };
    let refused = || CalendarError::Refused("use an https calendar link".to_string());
    require_secure_scheme(&text).map_err(|_| refused())?;
    let url = reqwest::Url::parse(&text).map_err(|_| refused())?;
    if url.host_str().is_none() {
        return Err(refused());
    }
    Ok(url)
}

pub(crate) fn host_of(url: &reqwest::Url) -> String {
    url.host_str().unwrap_or_default().to_ascii_lowercase()
}

fn transport_error(error: reqwest::Error, host: &str) -> CalendarError {
    let reason = match TransportFailure::from(&error.without_url()) {
        TransportFailure::Timeout(reason) => reason,
        TransportFailure::Network(_) => "the connection failed".to_string(),
    };
    log::warn!("[calendar] link fetch failed for {host}");
    CalendarError::Fetch(format!("{host}: {reason}"))
}

pub(crate) async fn fetch_body(url: &reqwest::Url) -> Result<String, CalendarError> {
    let host = host_of(url);
    let mut response = send_retrying(|| {
        client()
            .get(url.clone())
            .header(reqwest::header::ACCEPT, ACCEPTED_TYPES)
    })
    .await
    .map_err(|error| transport_error(error, &host))?;
    let status = response.status();
    if !status.is_success() {
        log::warn!(
            "[calendar] link fetch for {host} answered {}",
            status.as_u16()
        );
        return Err(CalendarError::Fetch(format!(
            "{host} answered {}",
            status.as_u16()
        )));
    }
    let too_large = || CalendarError::Fetch(format!("{host} sent a calendar larger than 8 MB"));
    if response
        .content_length()
        .is_some_and(|length| length > MAX_BODY_BYTES as u64)
    {
        return Err(too_large());
    }
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| transport_error(error, &host))?
    {
        if body.len() + chunk.len() > MAX_BODY_BYTES {
            return Err(too_large());
        }
        body.extend_from_slice(&chunk);
    }
    Ok(String::from_utf8_lossy(&body).into_owned())
}

struct Fetched {
    at_ms: i64,
    body: String,
}

fn bodies() -> &'static Mutex<HashMap<String, Fetched>> {
    static BODIES: OnceLock<Mutex<HashMap<String, Fetched>>> = OnceLock::new();
    BODIES.get_or_init(|| Mutex::new(HashMap::new()))
}

pub(crate) fn fresh_body(id: &str, now_ms: i64) -> Option<String> {
    let bodies = bodies().lock().ok()?;
    let fetched = bodies.get(id)?;
    (now_ms - fetched.at_ms < FRESH_FOR_MS).then(|| fetched.body.clone())
}

pub(crate) fn remember_body(id: &str, body: &str, now_ms: i64) {
    let Ok(mut bodies) = bodies().lock() else {
        return;
    };
    bodies.insert(
        id.to_string(),
        Fetched {
            at_ms: now_ms,
            body: body.to_string(),
        },
    );
}

pub(crate) fn forget_body(id: &str) {
    let Ok(mut bodies) = bodies().lock() else {
        return;
    };
    bodies.remove(id);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::integrations::http::test_support::{
        http_response, serve_once, serve_sequence, within_bound,
    };

    #[test]
    fn a_webcal_link_becomes_https_and_plain_http_is_refused() {
        let url = checked_link(" webcal://calendar.northwind.example/ical/basic.ics ").unwrap();
        assert_eq!(url.scheme(), "https");
        assert_eq!(host_of(&url), "calendar.northwind.example");
        for refused in [
            "http://calendar.northwind.example/ical/basic.ics",
            "ftp://calendar.northwind.example/basic.ics",
            "calendar.northwind.example/basic.ics",
            "",
        ] {
            assert!(
                matches!(checked_link(refused), Err(CalendarError::Refused(_))),
                "{refused}"
            );
        }
    }

    #[test]
    fn the_refusal_never_repeats_the_secret_link() {
        let Err(error) = checked_link("http://calendar.northwind.example/private-8f2c/basic.ics")
        else {
            panic!("plain http must be refused");
        };
        assert!(!error.to_string().contains("private-8f2c"));
    }

    #[tokio::test]
    async fn a_calendar_body_is_read() {
        let base = serve_once(http_response(
            "200 OK",
            &[],
            "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
        ))
        .await;
        let url = reqwest::Url::parse(&format!("{base}/private-8f2c/basic.ics")).unwrap();
        let body = within_bound(fetch_body(&url)).await.unwrap();
        assert!(body.starts_with("BEGIN:VCALENDAR"));
    }

    #[tokio::test]
    async fn a_refused_link_names_the_host_and_hides_the_path() {
        let (base, _server) = serve_sequence(vec![http_response("404 Not Found", &[], "")]).await;
        let url = reqwest::Url::parse(&format!("{base}/private-8f2c/basic.ics")).unwrap();
        let error = within_bound(fetch_body(&url)).await.unwrap_err();
        let message = error.to_string();
        assert!(matches!(error, CalendarError::Fetch(_)));
        assert!(message.contains("127.0.0.1"));
        assert!(message.contains("404"));
        assert!(!message.contains("private-8f2c"));
    }

    #[tokio::test]
    async fn a_body_past_the_cap_is_refused() {
        let huge = "X".repeat(MAX_BODY_BYTES + 1);
        let base = serve_once(http_response("200 OK", &[], &huge)).await;
        let url = reqwest::Url::parse(&format!("{base}/basic.ics")).unwrap();
        let error = within_bound(fetch_body(&url)).await.unwrap_err();
        assert!(error.to_string().contains("larger than 8 MB"));
    }

    #[test]
    fn a_fetched_body_stays_fresh_for_fifteen_minutes() {
        let id = "fresh-test-0123456789abcdef";
        remember_body(id, "BODY", 1_000);
        assert_eq!(
            fresh_body(id, 1_000 + FRESH_FOR_MS - 1).as_deref(),
            Some("BODY")
        );
        assert_eq!(fresh_body(id, 1_000 + FRESH_FOR_MS), None);
        forget_body(id);
        assert_eq!(fresh_body(id, 1_001), None);
    }
}
