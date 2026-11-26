use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

#[cfg(unix)]
pub fn interface_addresses() -> Vec<(String, IpAddr)> {
    use std::ffi::CStr;

    let mut head: *mut libc::ifaddrs = std::ptr::null_mut();
    if unsafe { libc::getifaddrs(&mut head) } != 0 {
        return Vec::new();
    }
    let mut out = Vec::new();
    let mut cursor = head;
    while let Some(entry) = unsafe { cursor.as_ref() } {
        cursor = entry.ifa_next;
        let is_up = entry.ifa_flags & (libc::IFF_UP as u32) != 0
            && entry.ifa_flags & (libc::IFF_RUNNING as u32) != 0;
        if !is_up || entry.ifa_addr.is_null() {
            continue;
        }
        let name = unsafe { CStr::from_ptr(entry.ifa_name) }
            .to_string_lossy()
            .into_owned();
        let family = unsafe { (*entry.ifa_addr).sa_family } as i32;
        if family == libc::AF_INET {
            let sin = unsafe { &*(entry.ifa_addr as *const libc::sockaddr_in) };
            out.push((
                name,
                IpAddr::V4(Ipv4Addr::from(u32::from_be(sin.sin_addr.s_addr))),
            ));
            continue;
        }
        if family == libc::AF_INET6 {
            let sin6 = unsafe { &*(entry.ifa_addr as *const libc::sockaddr_in6) };
            out.push((name, IpAddr::V6(Ipv6Addr::from(sin6.sin6_addr.s6_addr))));
        }
    }
    unsafe { libc::freeifaddrs(head) };
    out
}

#[cfg(not(unix))]
pub fn interface_addresses() -> Vec<(String, IpAddr)> {
    Vec::new()
}
