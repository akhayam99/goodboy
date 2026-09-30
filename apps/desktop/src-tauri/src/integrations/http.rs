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

pub(crate) fn build_client(timeouts: Timeouts) -> reqwest::Client {
    reqwest::Client::builder()
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
}
