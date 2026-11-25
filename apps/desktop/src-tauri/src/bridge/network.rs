use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use serde::Serialize;

pub fn is_private_ipv4(ip: Ipv4Addr) -> bool {
    let [a, b, _, _] = ip.octets();
    a == 10
        || (a == 172 && (16..=31).contains(&b))
        || (a == 192 && b == 168)
        || (a == 100 && (64..=127).contains(&b))
}

pub fn is_private_ipv6(ip: Ipv6Addr) -> bool {
    ip.segments()[0] & 0xfe00 == 0xfc00
}

pub fn is_private(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_private_ipv4(v4),
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => is_private_ipv4(v4),
            None => is_private_ipv6(v6),
        },
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawAddress {
    pub interface: String,
    pub ip: IpAddr,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInterface {
    pub name: String,
    pub addresses: Vec<String>,
    pub is_selected: bool,
}

fn is_chosen(selected: Option<&[String]>, interface: &str) -> bool {
    selected.is_none_or(|names| names.iter().any(|n| n == interface))
}

pub fn offered_addresses(raw: &[RawAddress], selected: Option<&[String]>) -> Vec<RawAddress> {
    raw.iter()
        .filter(|a| !a.ip.is_loopback() && is_private(a.ip))
        .filter(|a| is_chosen(selected, &a.interface))
        .cloned()
        .collect()
}

pub fn interfaces_of(raw: &[RawAddress], selected: Option<&[String]>) -> Vec<NetworkInterface> {
    let mut out: Vec<NetworkInterface> = Vec::new();
    for a in raw
        .iter()
        .filter(|a| !a.ip.is_loopback() && is_private(a.ip))
    {
        let text = a.ip.to_string();
        match out.iter_mut().find(|i| i.name == a.interface) {
            Some(existing) => existing.addresses.push(text),
            None => out.push(NetworkInterface {
                name: a.interface.clone(),
                addresses: vec![text],
                is_selected: is_chosen(selected, &a.interface),
            }),
        }
    }
    out.sort_by(|x, y| x.name.cmp(&y.name));
    out
}

pub fn raw_addresses() -> Vec<RawAddress> {
    crate::platform::interface_addresses::interface_addresses()
        .into_iter()
        .map(|(interface, ip)| RawAddress { interface, ip })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn raw(interface: &str, ip: &str) -> RawAddress {
        RawAddress {
            interface: interface.to_string(),
            ip: ip.parse().unwrap(),
        }
    }

    #[test]
    fn the_private_ranges_are_private() {
        for ip in [
            "10.0.0.1",
            "10.255.255.254",
            "172.16.0.1",
            "172.31.255.1",
            "192.168.1.20",
            "100.64.0.1",
            "100.127.255.254",
            "fd7a:115c:a1e0::1",
            "fc00::1",
            "fdff::1",
        ] {
            assert!(is_private(ip.parse().unwrap()), "{ip}");
        }
    }

    #[test]
    fn public_loopback_and_link_local_addresses_are_never_private() {
        for ip in [
            "8.8.8.8",
            "1.1.1.1",
            "172.15.0.1",
            "172.32.0.1",
            "100.63.255.255",
            "100.128.0.1",
            "192.169.0.1",
            "11.0.0.1",
            "127.0.0.1",
            "169.254.1.1",
            "::1",
            "fe80::1",
            "fbff::1",
            "fe00::1",
            "2001:db8::1",
            "2a00:1450:4001::1",
            "::ffff:8.8.8.8",
        ] {
            assert!(!is_private(ip.parse().unwrap()), "{ip}");
        }
    }

    #[test]
    fn an_ipv4_mapped_private_address_follows_the_ipv4_rule() {
        assert!(is_private("::ffff:192.168.1.5".parse().unwrap()));
    }

    #[test]
    fn a_public_address_is_never_offered_even_when_its_interface_is_chosen() {
        let all = [
            raw("en0", "192.168.1.20"),
            raw("en0", "203.0.113.9"),
            raw("en0", "2001:db8::5"),
            raw("lo0", "127.0.0.1"),
            raw("utun4", "100.101.102.103"),
        ];
        let chosen = ["en0".to_string(), "utun4".to_string(), "lo0".to_string()];

        let offered = offered_addresses(&all, Some(&chosen));

        let ips: Vec<String> = offered.iter().map(|a| a.ip.to_string()).collect();
        assert_eq!(ips, ["192.168.1.20", "100.101.102.103"]);
    }

    #[test]
    fn only_the_chosen_interfaces_are_offered() {
        let all = [raw("en0", "192.168.1.20"), raw("utun4", "100.101.102.103")];
        let chosen = ["utun4".to_string()];

        let offered = offered_addresses(&all, Some(&chosen));

        assert_eq!(offered.len(), 1);
        assert_eq!(offered[0].interface, "utun4");
    }

    #[test]
    fn with_no_choice_made_every_private_interface_is_offered() {
        let all = [raw("en0", "192.168.1.20"), raw("utun4", "100.101.102.103")];

        assert_eq!(offered_addresses(&all, None).len(), 2);
    }

    #[test]
    fn an_empty_choice_offers_nothing() {
        let all = [raw("en0", "192.168.1.20")];

        assert!(offered_addresses(&all, Some(&[])).is_empty());
    }

    #[test]
    fn the_interface_list_groups_addresses_and_hides_public_only_interfaces() {
        let all = [
            raw("en0", "192.168.1.20"),
            raw("en0", "fd12::7"),
            raw("en5", "203.0.113.9"),
            raw("lo0", "127.0.0.1"),
        ];
        let chosen = ["en0".to_string()];

        let list = interfaces_of(&all, Some(&chosen));

        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "en0");
        assert_eq!(list[0].addresses, ["192.168.1.20", "fd12::7"]);
        assert!(list[0].is_selected);
    }
}
