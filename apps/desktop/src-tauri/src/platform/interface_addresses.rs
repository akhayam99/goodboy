use std::net::IpAddr;

#[cfg(unix)]
pub fn interface_addresses() -> Vec<(String, IpAddr)> {
    use nix::ifaddrs::getifaddrs;
    use nix::net::if_::InterfaceFlags;

    let Ok(entries) = getifaddrs() else {
        return Vec::new();
    };
    let live = InterfaceFlags::IFF_UP | InterfaceFlags::IFF_RUNNING;
    entries
        .filter(|entry| entry.flags.contains(live))
        .filter_map(|entry| {
            let address = entry.address?;
            if let Some(v4) = address.as_sockaddr_in() {
                return Some((entry.interface_name, IpAddr::V4(v4.ip())));
            }
            address
                .as_sockaddr_in6()
                .map(|v6| (entry.interface_name, IpAddr::V6(v6.ip())))
        })
        .collect()
}

#[cfg(not(unix))]
pub fn interface_addresses() -> Vec<(String, IpAddr)> {
    Vec::new()
}
