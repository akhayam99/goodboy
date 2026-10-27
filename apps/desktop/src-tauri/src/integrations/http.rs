use std::sync::OnceLock;
use std::time::Duration;

pub(crate) const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
pub(crate) const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
pub(crate) const USER_AGENT: &str = concat!("goodboy-desktop/", env!("CARGO_PKG_VERSION"));

#[derive(Debug, Clone, Copy)]
pub(crate) struct Timeouts {
    pub connect: Duration,
    pub request: Duration,
}

impl Timeouts {
    pub(crate) const PRODUCTION: Self = Self {
        connect: CONNECT_TIMEOUT,
        request: REQUEST_TIMEOUT,
    };
}

#[cfg(not(test))]
const ACTIVE: Timeouts = Timeouts::PRODUCTION;

#[cfg(test)]
const ACTIVE: Timeouts = Timeouts {
    connect: Duration::from_millis(300),
    request: Duration::from_millis(600),
};

const MAX_REDIRECTS: usize = 5;

type Origin = (String, Option<String>, Option<u16>);

fn origin_of(url: &reqwest::Url) -> Origin {
    (
        url.scheme().to_string(),
        url.host_str().map(str::to_string),
        url.port_or_known_default(),
    )
}

pub(crate) fn same_origin_redirects() -> reqwest::redirect::Policy {
    reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= MAX_REDIRECTS {
            return attempt.stop();
        }
        let Some(from) = attempt.previous().last() else {
            return attempt.stop();
        };
        if origin_of(from) == origin_of(attempt.url()) {
            return attempt.follow();
        }
        attempt.stop()
    })
}

fn is_loopback_host(host: &str) -> bool {
    let host = host.trim_start_matches('[').trim_end_matches(']');
    if host.eq_ignore_ascii_case("localhost") || host.to_ascii_lowercase().ends_with(".localhost") {
        return true;
    }
    host.parse::<std::net::IpAddr>()
        .is_ok_and(|address| address.is_loopback())
}

pub(crate) enum SchemeRefusal {
    Insecure(String),
    Invalid(String),
}

pub(crate) fn require_secure_scheme(url: &str) -> Result<(), SchemeRefusal> {
    let parsed = reqwest::Url::parse(url.trim())
        .map_err(|_| SchemeRefusal::Invalid(format!("invalid url: {url}")))?;
    match parsed.scheme() {
        "https" => Ok(()),
        "http" if parsed.host_str().is_some_and(is_loopback_host) => Ok(()),
        "http" => Err(SchemeRefusal::Insecure(format!(
            "plain http would send the token in the clear, use https (http is only allowed for localhost): {url}"
        ))),
        _ => Err(SchemeRefusal::Invalid(format!("invalid url: {url}"))),
    }
}

pub(crate) fn build_client(timeouts: Timeouts) -> reqwest::Client {
    reqwest::Client::builder()
        .redirect(same_origin_redirects())
        .connect_timeout(timeouts.connect)
        .timeout(timeouts.request)
        .user_agent(USER_AGENT)
        .build()
        .expect("the shared http client failed to build")
}

pub(crate) fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| build_client(ACTIVE))
}

pub(crate) const MAX_ATTEMPTS: u32 = 3;
const BASE_BACKOFF_MS: u64 = 400;
const MAX_RETRY_WAIT_MS: u64 = 5_000;

fn is_transient_status(status: reqwest::StatusCode) -> bool {
    matches!(status.as_u16(), 429 | 502 | 503 | 504)
}

const MONTHS: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let y = year - i64::from(month <= 2);
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (month + 9) % 12;
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn parse_http_date_ms(value: &str) -> Option<i64> {
    let parts: Vec<&str> = value.split_whitespace().collect();
    if parts.len() != 6 || parts[5] != "GMT" {
        return None;
    }
    let day: i64 = parts[1].parse().ok()?;
    let month = MONTHS.iter().position(|m| *m == parts[2])? as i64 + 1;
    let year: i64 = parts[3].parse().ok()?;
    let clock: Vec<i64> = parts[4]
        .split(':')
        .map(|p| p.parse().ok())
        .collect::<Option<_>>()?;
    if clock.len() != 3 {
        return None;
    }
    let days = days_from_civil(year, month, day);
    Some(((days * 86_400) + clock[0] * 3_600 + clock[1] * 60 + clock[2]) * 1_000)
}

fn retry_after_ms(value: &str, now_ms: i64) -> Option<u64> {
    let value = value.trim();
    if let Ok(seconds) = value.parse::<f64>() {
        return (seconds.is_finite() && seconds >= 0.0).then(|| (seconds * 1000.0).ceil() as u64);
    }
    parse_http_date_ms(value).map(|at| at.saturating_sub(now_ms).max(0) as u64)
}

fn retry_wait(attempt: u32, retry_after: Option<&str>) -> std::time::Duration {
    let backoff = BASE_BACKOFF_MS.saturating_mul(1u64 << attempt.min(8));
    let wait = retry_after
        .and_then(|value| retry_after_ms(value, crate::util::now_ms()))
        .unwrap_or(backoff);
    std::time::Duration::from_millis(wait.min(MAX_RETRY_WAIT_MS))
}

pub(crate) async fn send_retrying<F>(build: F) -> Result<reqwest::Response, reqwest::Error>
where
    F: Fn() -> reqwest::RequestBuilder,
{
    let mut attempt = 0;
    loop {
        let is_last = attempt + 1 >= MAX_ATTEMPTS;
        let wait = match build().send().await {
            Ok(res) if !is_last && is_transient_status(res.status()) => retry_wait(
                attempt,
                res.headers()
                    .get(reqwest::header::RETRY_AFTER)
                    .and_then(|v| v.to_str().ok()),
            ),
            Ok(res) => return Ok(res),
            Err(e) if !is_last && e.is_connect() && !e.is_timeout() => retry_wait(attempt, None),
            Err(e) => return Err(e),
        };
        tokio::time::sleep(wait).await;
        attempt += 1;
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Paged<T> {
    pub items: Vec<T>,
    pub is_truncated: bool,
}

impl<T> Paged<T> {
    pub(crate) fn into_items(self, source: &str) -> Vec<T> {
        if self.is_truncated {
            log::warn!(
                "[hosts] {source} stopped at the page cap, the list of {} is incomplete",
                self.items.len()
            );
        }
        self.items
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum TransportFailure {
    Timeout(String),
    Network(String),
}

impl From<&reqwest::Error> for TransportFailure {
    fn from(error: &reqwest::Error) -> Self {
        if error.is_timeout() && error.is_connect() {
            return TransportFailure::Timeout(
                "the server did not accept the connection in time".to_string(),
            );
        }
        if error.is_timeout() {
            return TransportFailure::Timeout("the server did not answer in time".to_string());
        }
        TransportFailure::Network(error.to_string())
    }
}

#[cfg(test)]
pub(crate) mod test_support {
    use std::future::Future;
    use std::net::TcpListener;
    use std::time::Duration;

    pub(crate) const OUTER_BOUND: Duration = Duration::from_secs(3);

    pub(crate) struct SilentServer {
        pub base: String,
        _listener: TcpListener,
    }

    pub(crate) fn silent_server() -> SilentServer {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind a local listener");
        let base = format!("http://{}", listener.local_addr().expect("local addr"));
        SilentServer {
            base,
            _listener: listener,
        }
    }

    pub(crate) async fn within_bound<T>(request: impl Future<Output = T>) -> T {
        tokio::time::timeout(OUTER_BOUND, request)
            .await
            .expect("the request outlived the configured timeout")
    }

    pub(crate) fn closed_base() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind a local listener");
        format!("http://{}", listener.local_addr().expect("local addr"))
    }

    pub(crate) fn http_response(status_line: &str, headers: &[(&str, &str)], body: &str) -> String {
        let extra: String = headers
            .iter()
            .map(|(name, value)| format!("{name}: {value}\r\n"))
            .collect();
        format!(
            "HTTP/1.1 {status_line}\r\n{extra}Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
    }

    pub(crate) async fn serve_once(response: String) -> String {
        serve_sequence(vec![response]).await.0
    }

    pub(crate) async fn serve_sequence(
        responses: Vec<String>,
    ) -> (String, tokio::task::JoinHandle<Vec<String>>) {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind a local listener");
        let base = format!("http://{}", listener.local_addr().expect("local addr"));
        let handle = tokio::spawn(async move {
            let mut requests = Vec::new();
            for response in responses {
                let (mut socket, _) = listener.accept().await.expect("accept");
                let mut buffer = [0u8; 8192];
                let read = socket.read(&mut buffer).await.unwrap_or(0);
                requests.push(String::from_utf8_lossy(&buffer[..read]).to_string());
                socket
                    .write_all(response.as_bytes())
                    .await
                    .expect("write the canned answer");
                socket.shutdown().await.expect("close the socket");
            }
            requests
        });
        (base, handle)
    }

    pub(crate) fn assert_error_shape(error: &impl serde::Serialize, kind: &str) {
        let value = serde_json::to_value(error).expect("the error serializes");
        assert_eq!(value["kind"], kind);
        assert!(value["message"]
            .as_str()
            .is_some_and(|message| !message.is_empty()));
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::{closed_base, silent_server, within_bound};
    use super::*;
    use std::time::Instant;

    #[test]
    fn the_client_is_shared() {
        assert!(std::ptr::eq(client(), client()));
    }

    #[test]
    fn the_production_bounds_are_ten_and_thirty_seconds() {
        assert_eq!(Timeouts::PRODUCTION.connect, Duration::from_secs(10));
        assert_eq!(Timeouts::PRODUCTION.request, Duration::from_secs(30));
    }

    #[tokio::test]
    async fn a_server_that_never_answers_times_out_within_the_request_bound() {
        let server = silent_server();
        let started = Instant::now();
        let error = within_bound(client().get(&server.base).send())
            .await
            .expect_err("a silent server must not answer");
        assert!(error.is_timeout());
        assert!(started.elapsed() < Duration::from_secs(3));
        assert_eq!(
            TransportFailure::from(&error),
            TransportFailure::Timeout("the server did not answer in time".to_string())
        );
    }

    #[tokio::test]
    async fn the_body_read_is_bounded_by_the_same_request_timeout() {
        use tokio::io::AsyncWriteExt;
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind");
        let url = format!("http://{}", listener.local_addr().expect("addr"));
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.expect("accept");
            socket
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\npartial")
                .await
                .expect("write");
            tokio::time::sleep(Duration::from_secs(10)).await;
        });
        let started = Instant::now();
        let outcome = within_bound(async {
            let res = client().get(&url).send().await?;
            res.text().await
        })
        .await;
        server.abort();
        let error = outcome.expect_err("a stalled body must not finish");
        assert!(error.is_timeout());
        assert!(started.elapsed() < Duration::from_secs(3));
    }

    #[tokio::test]
    async fn a_refused_connection_maps_to_a_network_failure() {
        let error = within_bound(client().get(closed_base()).send())
            .await
            .expect_err("nothing listens there");
        assert!(matches!(
            TransportFailure::from(&error),
            TransportFailure::Network(_)
        ));
    }

    #[tokio::test]
    async fn every_request_carries_the_shared_user_agent() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind");
        let url = format!("http://{}", listener.local_addr().expect("addr"));
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.expect("accept");
            let mut buf = [0u8; 2048];
            let read = socket.read(&mut buf).await.expect("read");
            socket
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                .await
                .expect("write");
            String::from_utf8_lossy(&buf[..read]).to_string()
        });
        within_bound(client().get(&url).send())
            .await
            .expect("the request succeeds");
        let head = server.await.expect("server task").to_lowercase();
        assert!(head.contains(&format!("user-agent: {}", USER_AGENT.to_lowercase())));
    }
    #[test]
    fn a_rate_limit_or_a_gateway_error_is_transient_and_a_client_error_is_not() {
        for code in [429u16, 502, 503, 504] {
            assert!(is_transient_status(
                reqwest::StatusCode::from_u16(code).unwrap()
            ));
        }
        for code in [200u16, 400, 401, 403, 404, 500] {
            assert!(!is_transient_status(
                reqwest::StatusCode::from_u16(code).unwrap()
            ));
        }
    }

    #[test]
    fn the_retry_wait_honors_retry_after_and_stays_capped() {
        assert_eq!(retry_wait(0, Some("2")), std::time::Duration::from_secs(2));
        assert_eq!(
            retry_wait(0, Some("0.25")),
            std::time::Duration::from_millis(250)
        );
        assert_eq!(
            retry_wait(0, Some("600")),
            std::time::Duration::from_millis(MAX_RETRY_WAIT_MS)
        );
        assert_eq!(
            retry_wait(0, Some("soon")),
            std::time::Duration::from_millis(BASE_BACKOFF_MS)
        );
        assert_eq!(
            retry_wait(1, None),
            std::time::Duration::from_millis(BASE_BACKOFF_MS * 2)
        );
        assert_eq!(
            retry_wait(30, None),
            std::time::Duration::from_millis(MAX_RETRY_WAIT_MS)
        );
    }

    #[test]
    fn the_retry_wait_reads_an_http_date() {
        let at = parse_http_date_ms("Wed, 21 Oct 2026 07:28:00 GMT").unwrap();
        assert_eq!(at, 1_792_567_680_000);
        assert_eq!(
            retry_after_ms("Wed, 21 Oct 2026 07:28:00 GMT", at - 3_000),
            Some(3_000)
        );
        assert_eq!(
            retry_after_ms("Wed, 21 Oct 2026 07:28:00 GMT", at + 10_000),
            Some(0)
        );
        assert_eq!(retry_after_ms("Wed, 21 Oct 2026 07:28:00 CET", at), None);
        assert_eq!(parse_http_date_ms("Thu, 01 Jan 1970 00:00:00 GMT"), Some(0));
    }

    async fn serve(responses: Vec<&'static str>) -> (String, tokio::task::JoinHandle<usize>) {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/issues/", listener.local_addr().unwrap());
        let handle = tokio::spawn(async move {
            let mut served = 0;
            for response in responses {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut buf = [0u8; 4096];
                let _ = socket.read(&mut buf).await.unwrap();
                socket.write_all(response.as_bytes()).await.unwrap();
                socket.shutdown().await.unwrap();
                served += 1;
            }
            served
        });
        (url, handle)
    }

    const RATE_LIMITED: &str = "HTTP/1.1 429 Too Many Requests\r\nRetry-After: 0\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    const OK_EMPTY: &str =
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n[]";

    #[tokio::test]
    async fn a_rate_limited_first_call_is_retried_and_recovers() {
        let (url, server) = serve(vec![RATE_LIMITED, OK_EMPTY]).await;
        let client = reqwest::Client::new();
        let res = send_retrying(|| client.get(&url)).await.unwrap();
        assert_eq!(res.status(), reqwest::StatusCode::OK);
        assert_eq!(server.await.unwrap(), 2);
    }

    #[tokio::test]
    async fn a_rate_limit_that_never_clears_surfaces_after_the_last_attempt() {
        let (url, server) = serve(vec![RATE_LIMITED; MAX_ATTEMPTS as usize]).await;
        let client = reqwest::Client::new();
        let res = send_retrying(|| client.get(&url)).await.unwrap();
        assert_eq!(res.status(), reqwest::StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(server.await.unwrap(), MAX_ATTEMPTS as usize);
    }

    #[tokio::test]
    async fn a_redirect_to_another_origin_is_not_followed_and_the_token_stays_home() {
        use super::test_support::{http_response, serve_sequence};
        let (other, other_server) =
            serve_sequence(vec![http_response("200 OK", &[], "stolen")]).await;
        let location = format!("{other}/api/v4/user");
        let redirect = http_response("302 Found", &[("Location", location.as_str())], "");
        let (origin, origin_server) = serve_sequence(vec![redirect]).await;

        let res = within_bound(
            client()
                .get(format!("{origin}/api/v4/user"))
                .header("PRIVATE-TOKEN", "glpat-secret")
                .send(),
        )
        .await
        .unwrap();

        assert_eq!(res.status(), reqwest::StatusCode::FOUND);
        let seen = origin_server.await.unwrap();
        assert_eq!(seen.len(), 1);
        assert!(seen[0]
            .to_lowercase()
            .contains("private-token: glpat-secret"));
        let reached = tokio::time::timeout(Duration::from_millis(300), other_server).await;
        assert!(reached.is_err(), "the other origin must never be asked");
    }

    #[tokio::test]
    async fn a_redirect_inside_the_same_origin_is_followed() {
        use super::test_support::{http_response, serve_sequence};
        let redirect = http_response("301 Moved Permanently", &[("Location", "/next")], "");
        let done = http_response("200 OK", &[], "arrived");
        let (origin, server) = serve_sequence(vec![redirect, done]).await;

        let res = within_bound(client().get(format!("{origin}/start")).send())
            .await
            .unwrap();

        assert_eq!(res.status(), reqwest::StatusCode::OK);
        assert_eq!(res.text().await.unwrap(), "arrived");
        let seen = server.await.unwrap();
        assert!(seen[0].starts_with("GET /start "));
        assert!(seen[1].starts_with("GET /next "));
    }

    #[tokio::test]
    async fn a_redirect_loop_inside_one_origin_stops_at_the_cap() {
        use super::test_support::{http_response, serve_sequence};
        let again = http_response("302 Found", &[("Location", "/again")], "");
        let (origin, server) = serve_sequence(vec![again; MAX_REDIRECTS]).await;

        let res = within_bound(client().get(format!("{origin}/again")).send())
            .await
            .unwrap();

        assert_eq!(res.status(), reqwest::StatusCode::FOUND);
        assert_eq!(server.await.unwrap().len(), MAX_REDIRECTS);
    }

    #[test]
    fn plain_http_is_allowed_only_for_loopback() {
        for allowed in [
            "https://gitlab.com",
            "https://gitlab.internal:8443/",
            "http://localhost",
            "http://localhost:8080",
            "http://127.0.0.1:9000",
            "http://127.9.9.9",
            "http://[::1]:3000",
            "http://gitlab.localhost",
        ] {
            assert!(require_secure_scheme(allowed).is_ok(), "{allowed}");
        }
        for refused in [
            "http://gitlab.internal",
            "http://gitlab.com",
            "http://192.168.1.20",
            "http://10.0.0.5:8080",
            "http://localhost.evil.test",
            "http://127.0.0.1.evil.test",
            "ftp://gitlab.com",
            "gitlab.com",
            "",
        ] {
            assert!(require_secure_scheme(refused).is_err(), "{refused}");
        }
    }

    #[test]
    fn the_refusal_names_the_fix() {
        let Err(SchemeRefusal::Insecure(message)) = require_secure_scheme("http://gitlab.internal")
        else {
            panic!("plain http must be refused as insecure");
        };
        assert!(message.contains("use https"));
        assert!(message.contains("localhost"));
    }

    #[tokio::test]
    async fn a_read_timeout_is_not_retried_so_a_hanging_host_costs_one_wait() {
        let server = silent_server();
        let started = Instant::now();
        let error = within_bound(send_retrying(|| client().get(&server.base)))
            .await
            .expect_err("a silent server must not answer");
        assert!(error.is_timeout());
        assert!(started.elapsed() < Duration::from_millis(1_500));
    }

    #[test]
    fn a_paged_read_that_hit_its_cap_says_so_and_still_hands_back_what_it_read() {
        let truncated = Paged {
            items: vec![1, 2, 3],
            is_truncated: true,
        };
        assert_eq!(truncated.into_items("test"), vec![1, 2, 3]);
        let complete = Paged {
            items: vec![1],
            is_truncated: false,
        };
        assert_eq!(complete.into_items("test"), vec![1]);
    }
}
