use std::collections::BTreeSet;
use std::net::{Ipv4Addr, Ipv6Addr};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct RawListener {
    pub(crate) port: u16,
    pub(crate) address: String,
    pub(crate) pid: u32,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct RawProcess {
    pub(crate) pid: u32,
    pub(crate) ppid: u32,
    pub(crate) pgid: u32,
    pub(crate) uid: u32,
    pub(crate) elapsed_secs: u64,
    pub(crate) cpu_percent: f64,
    pub(crate) rss_kib: u64,
    pub(crate) name: String,
}

fn split_endpoint(endpoint: &str) -> Option<(String, u16)> {
    let (address, port) = endpoint.rsplit_once(':')?;
    let port: u16 = port.parse().ok()?;
    Some((address.trim_matches(['[', ']']).to_string(), port))
}

pub(crate) fn parse_lsof_listeners(text: &str) -> Vec<RawListener> {
    let mut pid: Option<u32> = None;
    let mut seen = BTreeSet::new();
    let mut out = Vec::new();
    for line in text.lines() {
        let Some(tag) = line.chars().next() else {
            continue;
        };
        let rest = &line[tag.len_utf8()..];
        if tag == 'p' {
            pid = rest.parse().ok();
            continue;
        }
        if tag != 'n' {
            continue;
        }
        let (Some(owner), Some((address, port))) = (pid, split_endpoint(rest)) else {
            continue;
        };
        if seen.insert((owner, port, address.clone())) {
            out.push(RawListener {
                port,
                address,
                pid: owner,
            });
        }
    }
    out
}

pub(crate) fn parse_lsof_cwd(text: &str) -> Vec<(u32, String)> {
    let mut pid: Option<u32> = None;
    let mut out = Vec::new();
    for line in text.lines() {
        if let Some(rest) = line.strip_prefix('p') {
            pid = rest.parse().ok();
            continue;
        }
        let (Some(owner), Some(path)) = (pid, line.strip_prefix('n')) else {
            continue;
        };
        if !path.is_empty() {
            out.push((owner, path.to_string()));
        }
    }
    out
}

pub(crate) fn parse_etime(value: &str) -> Option<u64> {
    let (days, clock) = match value.split_once('-') {
        Some((days, clock)) => (days.parse::<u64>().ok()?, clock),
        None => (0, value),
    };
    let parts: Vec<u64> = clock
        .split(':')
        .map(|part| part.parse::<u64>().ok())
        .collect::<Option<Vec<_>>>()?;
    let [hours, minutes, seconds] = match parts.as_slice() {
        [minutes, seconds] => [0, *minutes, *seconds],
        [hours, minutes, seconds] => [*hours, *minutes, *seconds],
        _ => return None,
    };
    Some(days * 86_400 + hours * 3_600 + minutes * 60 + seconds)
}

pub(crate) fn parse_ps_rows(text: &str) -> Vec<RawProcess> {
    text.lines().filter_map(parse_ps_row).collect()
}

fn parse_ps_row(line: &str) -> Option<RawProcess> {
    let mut rest = line.trim_start();
    let mut fields = Vec::with_capacity(7);
    for _ in 0..7 {
        let end = rest.find(char::is_whitespace)?;
        fields.push(&rest[..end]);
        rest = rest[end..].trim_start();
    }
    let name = rest.trim_end();
    if name.is_empty() {
        return None;
    }
    let base = name.rsplit('/').next().unwrap_or(name);
    Some(RawProcess {
        pid: fields[0].parse().ok()?,
        ppid: fields[1].parse().ok()?,
        pgid: fields[2].parse().ok()?,
        uid: fields[3].parse().ok()?,
        elapsed_secs: parse_etime(fields[4])?,
        cpu_percent: fields[5].parse().ok()?,
        rss_kib: fields[6].parse().ok()?,
        name: base.to_string(),
    })
}

pub(crate) fn parse_ps_args(text: &str) -> Vec<(u32, String)> {
    text.lines()
        .filter_map(|line| {
            let line = line.trim_start();
            let (pid, args) = line.split_once(char::is_whitespace)?;
            Some((pid.parse().ok()?, args.trim().to_string()))
        })
        .collect()
}

#[cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]
fn hex_words(hex: &str) -> Option<Vec<u32>> {
    if !hex.len().is_multiple_of(8) {
        return None;
    }
    (0..hex.len() / 8)
        .map(|index| u32::from_str_radix(&hex[index * 8..index * 8 + 8], 16).ok())
        .collect()
}

#[cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]
fn proc_address(hex: &str) -> Option<String> {
    let words = hex_words(hex)?;
    match words.as_slice() {
        [word] => Some(Ipv4Addr::from(word.swap_bytes()).to_string()),
        [a, b, c, d] => {
            let mut octets = [0u8; 16];
            for (index, word) in [a, b, c, d].into_iter().enumerate() {
                octets[index * 4..index * 4 + 4].copy_from_slice(&word.swap_bytes().to_be_bytes());
            }
            Some(Ipv6Addr::from(octets).to_string())
        }
        _ => None,
    }
}

#[cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]
pub(crate) fn parse_proc_net_tcp(text: &str) -> Vec<(String, u16, u64)> {
    text.lines()
        .skip(1)
        .filter_map(|line| {
            let columns: Vec<&str> = line.split_whitespace().collect();
            if columns.get(3) != Some(&"0A") {
                return None;
            }
            let (address, port) = columns.get(1)?.split_once(':')?;
            let port = u16::from_str_radix(port, 16).ok()?;
            let inode: u64 = columns.get(9)?.parse().ok()?;
            Some((proc_address(address)?, port, inode))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lsof_listeners_dedupe_and_split_ipv6() {
        let text = "p101\nn*:5173\nn*:5173\nn[::1]:8080\np202\nn127.0.0.1:5005\nnnot-an-endpoint\n";
        let rows = parse_lsof_listeners(text);
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].pid, 101);
        assert_eq!(rows[0].address, "*");
        assert_eq!(rows[1].address, "::1");
        assert_eq!(rows[1].port, 8080);
        assert_eq!(rows[2].pid, 202);
        assert_eq!(rows[2].port, 5005);
    }

    #[test]
    fn lsof_listeners_empty_and_garbage() {
        assert!(parse_lsof_listeners("").is_empty());
        assert!(parse_lsof_listeners("n*:80\n").is_empty());
        assert!(parse_lsof_listeners("pabc\nn*:80\n").is_empty());
        assert!(parse_lsof_listeners("p1\nn*:99999\n").is_empty());
    }

    #[test]
    fn lsof_cwd_pairs_paths_with_pids() {
        let rows = parse_lsof_cwd("p7\nn/tmp/a b\np8\nn/\n");
        assert_eq!(
            rows,
            vec![(7, "/tmp/a b".to_string()), (8, "/".to_string())]
        );
    }

    #[test]
    fn etime_shapes() {
        assert_eq!(parse_etime("05:09"), Some(309));
        assert_eq!(parse_etime("01:02:03"), Some(3723));
        assert_eq!(parse_etime("2-00:00:01"), Some(172_801));
        assert_eq!(parse_etime("x"), None);
        assert_eq!(parse_etime(""), None);
    }

    #[test]
    fn ps_rows_keep_names_with_spaces() {
        let text =
            "  321     1   321   501  01:00  2.5  10240 /Applications/My App/bin/node\n  9 bad\n";
        let rows = parse_ps_rows(text);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].pid, 321);
        assert_eq!(rows[0].pgid, 321);
        assert_eq!(rows[0].uid, 501);
        assert_eq!(rows[0].elapsed_secs, 60);
        assert_eq!(rows[0].rss_kib, 10240);
        assert_eq!(rows[0].name, "node");
    }

    #[test]
    fn ps_args_split_on_first_space() {
        let rows = parse_ps_args(" 12 node server.js --port 3000\n99\n");
        assert_eq!(rows, vec![(12, "node server.js --port 3000".to_string())]);
    }

    #[test]
    fn proc_net_tcp_listen_rows_only() {
        let text = "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n   0: 0100007F:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 4242 1 0000 100 0 0 10 0\n   1: 0100007F:1F91 0100007F:C350 01 00000000:00000000 00:00000000 00000000  1000        0 4343 1 0000 100 0 0 10 0\n";
        assert_eq!(
            parse_proc_net_tcp(text),
            vec![("127.0.0.1".to_string(), 8080, 4242)]
        );
    }

    #[test]
    fn proc_net_tcp6_loopback() {
        let text = "header\n0: 00000000000000000000000001000000:1F90 00000000000000000000000000000000:0000 0A 0:0 0:0 0 1000 0 77 1\n";
        assert_eq!(
            parse_proc_net_tcp(text),
            vec![("::1".to_string(), 8080, 77)]
        );
    }
}
