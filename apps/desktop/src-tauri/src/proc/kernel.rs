#![cfg_attr(not(unix), allow(dead_code))]

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Identity {
    pub(crate) start: u64,
    pub(crate) ppid: u32,
    pub(crate) pgid: u32,
    pub(crate) uid: u32,
    pub(crate) is_zombie: bool,
}

#[cfg(target_os = "macos")]
pub(crate) fn identity(pid: u32) -> Option<Identity> {
    let mut info: libc::proc_bsdinfo = unsafe { std::mem::zeroed() };
    let size = std::mem::size_of::<libc::proc_bsdinfo>() as libc::c_int;
    let got = unsafe {
        libc::proc_pidinfo(
            pid as libc::c_int,
            libc::PROC_PIDTBSDINFO,
            0,
            &mut info as *mut libc::proc_bsdinfo as *mut libc::c_void,
            size,
        )
    };
    if got != size || info.pbi_pid != pid {
        return None;
    }
    Some(Identity {
        start: info.pbi_start_tvsec * 1_000_000 + info.pbi_start_tvusec,
        ppid: info.pbi_ppid,
        pgid: info.pbi_pgid,
        uid: info.pbi_uid,
        is_zombie: info.pbi_status == libc::SZOMB,
    })
}

#[cfg(target_os = "linux")]
pub(crate) fn identity(pid: u32) -> Option<Identity> {
    use std::os::unix::fs::MetadataExt;
    let text = std::fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
    let stat = parse_stat(&text)?;
    let uid = std::fs::metadata(format!("/proc/{pid}")).ok()?.uid();
    Some(Identity {
        start: stat.start,
        ppid: stat.ppid,
        pgid: stat.pgid,
        uid,
        is_zombie: stat.is_zombie,
    })
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub(crate) fn identity(_pid: u32) -> Option<Identity> {
    None
}

#[cfg(target_os = "macos")]
pub(crate) fn environ(pid: u32) -> Option<Vec<String>> {
    let mut mib = [libc::CTL_KERN, libc::KERN_PROCARGS2, pid as libc::c_int];
    let mut size: libc::size_t = 0;
    let sized = unsafe {
        libc::sysctl(
            mib.as_mut_ptr(),
            3,
            std::ptr::null_mut(),
            &mut size,
            std::ptr::null_mut(),
            0,
        )
    };
    if sized != 0 || size == 0 {
        return None;
    }
    let mut buf = vec![0u8; size + 4096];
    let mut filled: libc::size_t = buf.len();
    let read = unsafe {
        libc::sysctl(
            mib.as_mut_ptr(),
            3,
            buf.as_mut_ptr() as *mut libc::c_void,
            &mut filled,
            std::ptr::null_mut(),
            0,
        )
    };
    if read != 0 {
        return None;
    }
    buf.truncate(filled);
    parse_procargs2(&buf)
}

#[cfg(target_os = "linux")]
pub(crate) fn environ(pid: u32) -> Option<Vec<String>> {
    let raw = std::fs::read(format!("/proc/{pid}/environ")).ok()?;
    Some(
        raw.split(|byte| *byte == 0)
            .filter(|entry| !entry.is_empty())
            .map(|entry| String::from_utf8_lossy(entry).into_owned())
            .collect(),
    )
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub(crate) fn environ(_pid: u32) -> Option<Vec<String>> {
    None
}

#[cfg(target_os = "macos")]
pub(crate) fn cpu_time(pid: u32) -> Option<u64> {
    let mut info: libc::proc_taskinfo = unsafe { std::mem::zeroed() };
    let size = std::mem::size_of::<libc::proc_taskinfo>() as libc::c_int;
    let got = unsafe {
        libc::proc_pidinfo(
            pid as libc::c_int,
            libc::PROC_PIDTASKINFO,
            0,
            &mut info as *mut libc::proc_taskinfo as *mut libc::c_void,
            size,
        )
    };
    if got != size {
        return None;
    }
    Some(info.pti_total_user.saturating_add(info.pti_total_system))
}

#[cfg(target_os = "linux")]
pub(crate) fn cpu_time(pid: u32) -> Option<u64> {
    let text = std::fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
    parse_stat(&text).map(|stat| stat.cpu_ticks)
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub(crate) fn cpu_time(_pid: u32) -> Option<u64> {
    None
}

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct StatFields {
    pub(crate) ppid: u32,
    pub(crate) pgid: u32,
    pub(crate) start: u64,
    pub(crate) cpu_ticks: u64,
    pub(crate) is_zombie: bool,
}

#[cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]
pub(crate) fn parse_stat(text: &str) -> Option<StatFields> {
    let after_name = &text[text.rfind(')')? + 1..];
    let fields: Vec<&str> = after_name.split_whitespace().collect();
    let state = fields.first()?;
    Some(StatFields {
        ppid: fields.get(1)?.parse().ok()?,
        pgid: fields.get(2)?.parse().ok()?,
        cpu_ticks: fields
            .get(11)?
            .parse::<u64>()
            .ok()?
            .saturating_add(fields.get(12)?.parse::<u64>().ok()?),
        start: fields.get(19)?.parse().ok()?,
        is_zombie: matches!(*state, "Z" | "X"),
    })
}

#[cfg_attr(not(any(target_os = "macos", test)), allow(dead_code))]
pub(crate) fn parse_procargs2(buf: &[u8]) -> Option<Vec<String>> {
    let head: [u8; 4] = buf.get(..4)?.try_into().ok()?;
    let argc = usize::try_from(i32::from_ne_bytes(head)).ok()?;
    let mut at = 4;
    while at < buf.len() && buf[at] != 0 {
        at += 1;
    }
    while at < buf.len() && buf[at] == 0 {
        at += 1;
    }
    for _ in 0..argc {
        if at >= buf.len() {
            return Some(Vec::new());
        }
        while at < buf.len() && buf[at] != 0 {
            at += 1;
        }
        at += 1;
    }
    let mut entries: Vec<String> = Vec::new();
    while at < buf.len() {
        let begin = at;
        while at < buf.len() && buf[at] != 0 {
            at += 1;
        }
        if at > begin {
            entries.push(String::from_utf8_lossy(&buf[begin..at]).into_owned());
        }
        at += 1;
    }
    Some(entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn procargs(exec: &str, args: &[&str], env: &[&str]) -> Vec<u8> {
        let mut buf = (args.len() as i32).to_ne_bytes().to_vec();
        buf.extend_from_slice(exec.as_bytes());
        buf.extend_from_slice(&[0, 0, 0]);
        for arg in args {
            buf.extend_from_slice(arg.as_bytes());
            buf.push(0);
        }
        for entry in env {
            buf.extend_from_slice(entry.as_bytes());
            buf.push(0);
        }
        buf
    }

    #[test]
    fn procargs_keeps_arguments_out_of_the_environment() {
        let buf = procargs(
            "/bin/node",
            &["node", "GOODBOY_SPAWN_ID=from-an-argument", "--flag"],
            &["PATH=/bin", "GOODBOY_SPAWN_ID=from-the-env"],
        );

        let entries = parse_procargs2(&buf).expect("a parsed buffer");

        assert_eq!(entries, vec!["PATH=/bin", "GOODBOY_SPAWN_ID=from-the-env"]);
    }

    #[test]
    fn procargs_counts_empty_arguments() {
        let buf = procargs("/bin/x", &["x", "", "last"], &["A=1"]);

        assert_eq!(parse_procargs2(&buf), Some(vec!["A=1".to_string()]));
    }

    #[test]
    fn procargs_with_no_environment_is_empty() {
        let buf = procargs("/bin/x", &["x"], &[]);

        assert_eq!(parse_procargs2(&buf), Some(Vec::new()));
    }

    #[test]
    fn procargs_rejects_a_buffer_without_a_count() {
        assert_eq!(parse_procargs2(&[1, 0]), None);
        assert_eq!(parse_procargs2(&(-1i32).to_ne_bytes()), None);
    }

    #[test]
    fn procargs_survives_a_truncated_argument_list() {
        let mut buf = procargs("/bin/x", &["x", "y", "z"], &[]);
        buf.truncate(14);

        assert_eq!(parse_procargs2(&buf), Some(Vec::new()));
    }

    #[test]
    fn stat_reads_the_fields_after_a_name_with_spaces_and_parens() {
        let text = "4242 (my (odd) app) S 1 4242 4242 0 -1 4194560 100 0 0 0 7 5 0 0 20 0 1 0 987654 1000 100 18446744073709551615";

        let fields = parse_stat(text).expect("parsed");

        assert_eq!(fields.ppid, 1);
        assert_eq!(fields.pgid, 4242);
        assert_eq!(fields.cpu_ticks, 12);
        assert_eq!(fields.start, 987654);
        assert!(!fields.is_zombie);
    }

    #[test]
    fn stat_flags_a_zombie_and_rejects_garbage() {
        let text = "9 (x) Z 1 9 9 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 55 0 0";

        assert!(parse_stat(text).expect("parsed").is_zombie);
        assert_eq!(parse_stat("no parens here"), None);
        assert_eq!(parse_stat("1 (x) S 1"), None);
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn identity_of_this_process_is_stable_and_names_its_parent() {
        let first = identity(std::process::id()).expect("identity of self");
        let second = identity(std::process::id()).expect("identity of self");

        assert_eq!(first, second);
        assert!(first.start > 0);
        assert_eq!(first.uid, unsafe { libc::geteuid() });
        assert_eq!(first.ppid, unsafe { libc::getppid() } as u32);
        assert!(!first.is_zombie);
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn identity_of_a_pid_that_does_not_exist_is_none() {
        let mut child = std::process::Command::new("/bin/sh")
            .args(["-c", "exit 0"])
            .spawn()
            .expect("spawn a short child");
        let pid = child.id();
        let _ = child.wait();

        assert_eq!(identity(pid), None);
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn two_processes_never_share_an_identity() {
        let mut one = std::process::Command::new("/bin/sleep")
            .arg("30")
            .spawn()
            .expect("spawn");
        let mut two = std::process::Command::new("/bin/sleep")
            .arg("30")
            .spawn()
            .expect("spawn");

        let a = identity(one.id()).expect("identity");
        let b = identity(two.id()).expect("identity");

        assert_ne!((one.id(), a.start), (two.id(), b.start));
        let _ = one.kill();
        let _ = two.kill();
        let _ = one.wait();
        let _ = two.wait();
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn environ_holds_the_environment_and_never_the_arguments() {
        let mut command = crate::proc::reap::unix::test_support::helper_command();
        command
            .arg("GOODBOY_SPAWN_ID=from-an-argument")
            .env("GOODBOY_KERNEL_PROBE", "from-the-env");
        let mut child = command.spawn().expect("spawn");
        let pid = child.id();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
        let mut entries = environ(pid).unwrap_or_default();
        while !entries
            .iter()
            .any(|entry| entry.starts_with("GOODBOY_KERNEL_PROBE="))
        {
            assert!(
                std::time::Instant::now() < deadline,
                "no environment read: {entries:?}"
            );
            std::thread::sleep(std::time::Duration::from_millis(25));
            entries = environ(pid).unwrap_or_default();
        }
        let _ = child.kill();
        let _ = child.wait();

        assert!(entries.contains(&"GOODBOY_KERNEL_PROBE=from-the-env".to_string()));
        assert!(!entries
            .iter()
            .any(|entry| entry == "GOODBOY_SPAWN_ID=from-an-argument"));
    }
}
