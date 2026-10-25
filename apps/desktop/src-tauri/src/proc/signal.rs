use std::io;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Signal {
    Terminate,
    Kill,
}

impl Signal {
    fn number(self) -> libc::c_int {
        match self {
            Signal::Terminate => libc::SIGTERM,
            Signal::Kill => libc::SIGKILL,
        }
    }
}

fn as_pid(pid: u32) -> libc::pid_t {
    pid as libc::pid_t
}

fn outcome(result: libc::c_int) -> io::Result<()> {
    match result {
        0 => Ok(()),
        _ => Err(io::Error::last_os_error()),
    }
}

pub(crate) fn exists(pid: u32) -> bool {
    unsafe { libc::kill(as_pid(pid), 0) == 0 }
}

pub(crate) fn is_reachable(pid: u32) -> bool {
    exists(pid) || io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

fn refuse_reserved(pid: u32) -> io::Result<()> {
    match pid {
        0 | 1 => Err(io::Error::from(io::ErrorKind::InvalidInput)),
        _ => Ok(()),
    }
}

pub(crate) fn send(pid: u32, signal: Signal) -> io::Result<()> {
    refuse_reserved(pid)?;
    outcome(unsafe { libc::kill(as_pid(pid), signal.number()) })
}

pub(crate) fn send_to_group(group: u32, signal: Signal) -> io::Result<()> {
    refuse_reserved(group)?;
    outcome(unsafe { libc::killpg(as_pid(group), signal.number()) })
}

pub(crate) fn group_has_members(group: u32) -> bool {
    unsafe { libc::kill(-as_pid(group), 0) == 0 }
}

pub(crate) fn session_of(pid: u32) -> Option<u32> {
    let session = unsafe { libc::getsid(as_pid(pid)) };
    u32::try_from(session).ok()
}

pub(crate) fn effective_uid() -> u32 {
    unsafe { libc::geteuid() }
}

pub(crate) fn number_of_name(name: &str) -> Option<i32> {
    if name.is_empty() {
        return None;
    }
    (1..32).find(|signal| {
        let described = unsafe { libc::strsignal(*signal) };
        if described.is_null() {
            return false;
        }
        unsafe { std::ffi::CStr::from_ptr(described) }.to_string_lossy() == name
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    fn sleeper() -> std::process::Child {
        Command::new("sleep")
            .arg("30")
            .spawn()
            .expect("spawn sleep")
    }

    #[test]
    fn this_process_exists_and_an_unused_pid_does_not() {
        assert!(exists(std::process::id()));
        assert!(is_reachable(std::process::id()));
        assert!(!exists(0x7fff_fffe));
        assert!(!is_reachable(0x7fff_fffe));
    }

    #[test]
    fn a_signal_reaches_a_child_and_a_missing_pid_is_an_error() {
        let mut child = sleeper();
        assert!(exists(child.id()));

        send(child.id(), Signal::Kill).expect("kill the child");
        let status = child.wait().expect("reap the child");

        assert!(!status.success());
        assert!(send(0x7fff_fffe, Signal::Terminate).is_err());
    }

    #[test]
    fn pid_zero_and_one_are_never_signalled() {
        assert!(send(0, Signal::Kill).is_err());
        assert!(send(1, Signal::Kill).is_err());
        assert!(send_to_group(0, Signal::Kill).is_err());
        assert!(send_to_group(1, Signal::Kill).is_err());
    }

    #[test]
    fn a_group_signal_reaches_every_member() {
        use std::os::unix::process::CommandExt;
        let mut leader = Command::new("sleep")
            .arg("30")
            .process_group(0)
            .spawn()
            .expect("spawn the leader");
        let mut member = Command::new("sleep")
            .arg("30")
            .process_group(leader.id() as libc::pid_t)
            .spawn()
            .expect("spawn the member");
        assert!(group_has_members(leader.id()));

        send_to_group(leader.id(), Signal::Kill).expect("kill the group");
        let _ = leader.wait();
        let _ = member.wait();

        assert!(!group_has_members(leader.id()));
    }

    #[test]
    fn the_session_of_this_process_is_known() {
        assert!(session_of(std::process::id()).is_some());
        assert_eq!(session_of(0x7fff_fffe), None);
    }

    #[test]
    fn signal_names_map_back_to_their_number() {
        let killed = unsafe { std::ffi::CStr::from_ptr(libc::strsignal(libc::SIGKILL)) }
            .to_string_lossy()
            .into_owned();
        assert_eq!(number_of_name(&killed), Some(libc::SIGKILL));
        assert_eq!(number_of_name(""), None);
        assert_eq!(number_of_name("   "), None);
        assert_eq!(number_of_name("not a signal"), None);
        assert_eq!(number_of_name(&"x".repeat(100_000)), None);
    }

    #[test]
    fn the_effective_uid_is_the_one_the_kernel_reports() {
        assert_eq!(effective_uid(), unsafe { libc::geteuid() });
    }

    const UNSAFE_OUTSIDE_PROC: &[(&str, usize)] = &[
        ("artifact_mirror.rs", 2),
        ("bridge/mod.rs", 1),
        ("file_versions/folder_store.rs", 1),
        ("fullscreen_escape.rs", 12),
        ("history/reservation.rs", 1),
        ("lib.rs", 1),
        ("live_child.rs", 2),
        ("monitor/mod.rs", 2),
        ("monitor/stop.rs", 6),
        ("process_group.rs", 8),
        ("query_bridge/limits.rs", 1),
        ("query_bridge/protocol.rs", 1),
        ("scroller_style.rs", 1),
        ("storage.rs", 2),
        ("util/scoped_path.rs", 2),
    ];

    fn unsafe_lines_outside_proc() -> std::collections::BTreeMap<String, usize> {
        let mut counts = std::collections::BTreeMap::new();
        for hit in crate::util::source_scan::production_hits(&["unsafe"], &[]) {
            let file = hit.rsplit_once(':').map(|(file, _)| file).unwrap_or(&hit);
            if file.starts_with("proc/") || file.starts_with("platform/") {
                continue;
            }
            *counts.entry(file.to_string()).or_insert(0usize) += 1;
        }
        counts
    }

    #[test]
    fn unsafe_outside_proc_never_grows_and_the_baseline_follows_it_down() {
        let found = unsafe_lines_outside_proc();
        let baseline: std::collections::BTreeMap<String, usize> = UNSAFE_OUTSIDE_PROC
            .iter()
            .map(|(file, count)| (file.to_string(), *count))
            .collect();
        let grown: Vec<String> = found
            .iter()
            .filter(|(file, count)| **count > baseline.get(*file).copied().unwrap_or(0))
            .map(|(file, count)| format!("{file}: {count}"))
            .collect();
        assert!(
            grown.is_empty(),
            "unsafe belongs in proc/signal.rs, wrapped in a function named for its invariant: {grown:?}"
        );
        let fallen: Vec<String> = baseline
            .iter()
            .filter(|(file, count)| found.get(*file).copied().unwrap_or(0) < **count)
            .map(|(file, _)| file.clone())
            .collect();
        assert!(
            fallen.is_empty(),
            "lower UNSAFE_OUTSIDE_PROC for: {fallen:?}"
        );
    }
}
