use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use tokio::net::TcpListener;

use super::network::is_private;
use super::BridgeError;

pub const HELLO_ENDPOINTS_MAX: usize = 8;
const BIND_ATTEMPTS: usize = 8;

pub struct Listening {
    pub listeners: Vec<TcpListener>,
    pub port: u16,
}

async fn bind_family(ip: IpAddr, port: u16) -> Option<TcpListener> {
    TcpListener::bind((ip, port)).await.ok()
}

async fn bind_all_on(port: u16) -> Option<Listening> {
    let everywhere = [
        IpAddr::V6(Ipv6Addr::UNSPECIFIED),
        IpAddr::V4(Ipv4Addr::UNSPECIFIED),
    ];
    let mut listeners: Vec<TcpListener> = Vec::new();
    let mut bound_port = port;
    for ip in everywhere {
        let Some(listener) = bind_family(ip, bound_port).await else {
            continue;
        };
        if listeners.is_empty() {
            bound_port = listener.local_addr().ok()?.port();
        }
        listeners.push(listener);
    }
    match listeners.is_empty() {
        true => None,
        false => Some(Listening {
            listeners,
            port: bound_port,
        }),
    }
}

pub async fn bind_all(preferred: Option<u16>) -> Result<Listening, BridgeError> {
    if let Some(port) = preferred.filter(|port| *port != 0) {
        if let Some(listening) = bind_all_on(port).await {
            return Ok(listening);
        }
    }
    for _ in 0..BIND_ATTEMPTS {
        if let Some(listening) = bind_all_on(0).await {
            return Ok(listening);
        }
    }
    Err(BridgeError::NoPrivateNetwork)
}

fn plain(ip: IpAddr) -> IpAddr {
    match ip {
        IpAddr::V6(v6) => v6.to_ipv4_mapped().map(IpAddr::V4).unwrap_or(ip),
        IpAddr::V4(_) => ip,
    }
}

pub fn is_accepted_source(peer: IpAddr, local: IpAddr, offered: &[IpAddr]) -> bool {
    if !is_private(peer) {
        return false;
    }
    let local = plain(local);
    offered.iter().any(|ip| plain(*ip) == local)
}

pub fn same_ips(left: &[IpAddr], right: &[IpAddr]) -> bool {
    let mut left = left.to_vec();
    let mut right = right.to_vec();
    left.sort();
    right.sort();
    left == right
}

pub fn endpoints_of(offered: &[IpAddr], port: u16) -> Vec<super::Endpoint> {
    let mut seen: Vec<IpAddr> = Vec::new();
    for ip in offered {
        let ip = plain(*ip);
        if is_private(ip) && !ip.is_loopback() && !seen.contains(&ip) {
            seen.push(ip);
        }
    }
    seen.into_iter()
        .take(HELLO_ENDPOINTS_MAX)
        .map(|ip| super::Endpoint {
            host: ip.to_string(),
            port,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(text: &str) -> IpAddr {
        text.parse().unwrap()
    }

    async fn free_port() -> u16 {
        let probe = TcpListener::bind(("0.0.0.0", 0)).await.unwrap();
        probe.local_addr().unwrap().port()
    }

    #[tokio::test]
    async fn the_remembered_port_is_asked_for_first_and_reused_after_a_restart() {
        let port = free_port().await;

        let first = bind_all(Some(port)).await.unwrap();
        assert_eq!(first.port, port);
        drop(first);
        let again = bind_all(Some(port)).await.unwrap();

        assert_eq!(again.port, port);
    }

    #[tokio::test]
    async fn a_taken_port_falls_back_to_a_new_one() {
        let held = bind_all(None).await.unwrap();

        let next = bind_all(Some(held.port)).await.unwrap();

        assert_ne!(next.port, held.port);
        assert!(!next.listeners.is_empty());
    }

    #[tokio::test]
    async fn the_listener_binds_every_interface_not_one_address() {
        let listening = bind_all(None).await.unwrap();

        let reaches_loopback = tokio::net::TcpStream::connect(("127.0.0.1", listening.port))
            .await
            .is_ok();

        assert!(reaches_loopback);
        assert!(listening
            .listeners
            .iter()
            .any(|l| l.local_addr().unwrap().ip().is_unspecified()));
    }

    #[test]
    fn only_private_sources_on_an_offered_address_are_accepted() {
        let offered = [ip("192.168.1.20"), ip("10.0.0.5")];

        assert!(is_accepted_source(
            ip("192.168.1.44"),
            ip("192.168.1.20"),
            &offered
        ));
        assert!(is_accepted_source(
            ip("100.64.3.2"),
            ip("10.0.0.5"),
            &offered
        ));
        assert!(is_accepted_source(
            ip("::ffff:192.168.1.44"),
            ip("::ffff:192.168.1.20"),
            &offered
        ));
        assert!(!is_accepted_source(
            ip("8.8.8.8"),
            ip("192.168.1.20"),
            &offered
        ));
        assert!(!is_accepted_source(
            ip("127.0.0.1"),
            ip("192.168.1.20"),
            &offered
        ));
        assert!(!is_accepted_source(
            ip("169.254.1.1"),
            ip("192.168.1.20"),
            &offered
        ));
        assert!(!is_accepted_source(
            ip("192.168.1.44"),
            ip("172.20.0.2"),
            &offered
        ));
        assert!(!is_accepted_source(
            ip("192.168.1.44"),
            ip("192.168.1.20"),
            &[]
        ));
    }

    #[test]
    fn hello_endpoints_are_private_unique_and_at_most_eight() {
        let mut offered = vec![ip("192.168.1.20"), ip("192.168.1.20"), ip("8.8.8.8")];
        offered.push(ip("127.0.0.1"));
        for last in 1..=12 {
            offered.push(ip(&format!("10.0.0.{last}")));
        }

        let endpoints = endpoints_of(&offered, 49160);

        assert_eq!(endpoints.len(), HELLO_ENDPOINTS_MAX);
        assert_eq!(endpoints[0].host, "192.168.1.20");
        assert!(endpoints.iter().all(|e| e.port == 49160));
        let hosts: Vec<_> = endpoints.iter().map(|e| e.host.clone()).collect();
        assert!(!hosts.contains(&"8.8.8.8".to_string()));
        assert!(!hosts.contains(&"127.0.0.1".to_string()));
    }

    #[test]
    fn address_sets_compare_without_order() {
        assert!(same_ips(
            &[ip("10.0.0.1"), ip("10.0.0.2")],
            &[ip("10.0.0.2"), ip("10.0.0.1")]
        ));
        assert!(!same_ips(&[ip("10.0.0.1")], &[ip("10.0.0.2")]));
    }
}
