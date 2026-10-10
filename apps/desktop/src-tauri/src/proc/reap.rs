use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct StoppedProcess {
    pub(crate) pid: u32,
    pub(crate) name: String,
    pub(crate) port: Option<u16>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct ReapReport {
    pub(crate) stopped: Vec<StoppedProcess>,
    pub(crate) is_scanned: bool,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct ReapParams<'a> {
    pub(crate) leader_pid: Option<u32>,
    pub(crate) is_leader_exited: bool,
    pub(crate) spawn_id: Option<&'a str>,
}

#[cfg(not(unix))]
pub(crate) fn reap(_params: ReapParams<'_>) -> ReapReport {
    ReapReport::default()
}

#[cfg(not(unix))]
pub(crate) fn sweep_orphans() -> usize {
    0
}

#[cfg(not(unix))]
pub(crate) fn tree_cpu(_leader_pid: u32) -> Option<u64> {
    None
}

#[cfg(unix)]
pub(crate) use unix::{reap, sweep_orphans, tree_cpu};

#[cfg(unix)]
pub(crate) mod unix {
    use std::collections::{BTreeMap, HashMap, HashSet};
    use std::process::Command;
    use std::time::{Duration, Instant};

    use super::{ReapParams, ReapReport, StoppedProcess};
    use crate::aux_spawn::{SpawnKind, APP_PID_ENV, APP_START_ENV, SPAWN_ID_ENV, SPAWN_KIND_ENV};
    use crate::proc::kernel::{self, Identity};

    const TERM_GRACE: Duration = Duration::from_millis(300);
    const KILL_GRACE: Duration = Duration::from_millis(200);
    const POLL_INTERVAL: Duration = Duration::from_millis(25);
    const MAX_ROUNDS: usize = 6;
    const SHELL_NAMES: [&str; 6] = ["sh", "bash", "zsh", "fish", "dash", "env"];

    #[derive(Debug, Clone, PartialEq, Eq)]
    pub(crate) struct ProcRow {
        pub(crate) pid: u32,
        pub(crate) ppid: u32,
        pub(crate) pgid: u32,
        pub(crate) uid: u32,
        pub(crate) stat: String,
        pub(crate) name: String,
        pub(crate) start: u64,
    }

    #[derive(Debug, Clone, PartialEq, Eq)]
    pub(crate) struct TagInfo {
        pub(crate) spawn_id: String,
        pub(crate) kind: String,
        pub(crate) app_pid: u32,
        pub(crate) app_start: u64,
    }

    #[derive(Debug, Clone, PartialEq, Eq)]
    pub(crate) struct Selected {
        pub(crate) row: ProcRow,
        pub(crate) tag: Option<TagInfo>,
    }

    #[derive(Debug, Clone, Copy)]
    pub(crate) struct Me {
        pub(crate) pid: u32,
        pub(crate) uid: u32,
        pub(crate) pgid: u32,
        pub(crate) app_start: u64,
    }

    impl Me {
        pub(crate) fn current() -> Self {
            Self {
                pid: std::process::id(),
                uid: unsafe { libc::geteuid() },
                pgid: unsafe { libc::getpgrp() } as u32,
                app_start: crate::aux_spawn::app_start(),
            }
        }
    }

    #[derive(Debug, Clone, Copy)]
    pub(crate) struct Probe {
        pub(crate) table: fn() -> Vec<ProcRow>,
        pub(crate) identity: fn(u32) -> Option<Identity>,
        pub(crate) environ: fn(u32) -> Option<Vec<String>>,
    }

    pub(crate) const LIVE: Probe = Probe {
        table: live_table,
        identity: kernel::identity,
        environ: kernel::environ,
    };

    #[derive(Debug, Default)]
    pub(crate) struct Selection {
        pub(crate) targets: Vec<Selected>,
        pub(crate) group: Option<u32>,
    }

    pub(crate) fn parse_table(text: &str) -> Vec<ProcRow> {
        text.lines().filter_map(parse_row).collect()
    }

    fn parse_row(line: &str) -> Option<ProcRow> {
        let mut rest = line.trim_start();
        let mut fields: Vec<&str> = Vec::with_capacity(5);
        for _ in 0..5 {
            let (field, tail) = rest.split_once(char::is_whitespace)?;
            fields.push(field);
            rest = tail.trim_start();
        }
        let name = std::path::Path::new(rest.trim())
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_else(|| rest.trim().to_string());
        Some(ProcRow {
            pid: fields[0].parse().ok()?,
            ppid: fields[1].parse().ok()?,
            pgid: fields[2].parse().ok()?,
            uid: fields[3].parse().ok()?,
            stat: fields[4].to_string(),
            name,
            start: 0,
        })
    }

    pub(crate) fn tag_from_env<'a>(entries: impl Iterator<Item = &'a str>) -> Option<TagInfo> {
        let mut spawn_id: Option<String> = None;
        let mut kind: Option<String> = None;
        let mut app_pid: Option<u32> = None;
        let mut app_start: Option<u64> = None;
        for entry in entries {
            let Some((key, value)) = entry.split_once('=') else {
                continue;
            };
            match key {
                SPAWN_ID_ENV if spawn_id.is_none() => spawn_id = Some(value.to_string()),
                SPAWN_KIND_ENV if kind.is_none() => kind = Some(value.to_string()),
                APP_PID_ENV if app_pid.is_none() => app_pid = value.parse().ok(),
                APP_START_ENV if app_start.is_none() => app_start = value.parse().ok(),
                _ => {}
            }
        }
        let spawn_id = spawn_id.filter(|value| !value.is_empty())?;
        Some(TagInfo {
            spawn_id,
            kind: kind?,
            app_pid: app_pid?,
            app_start: app_start?,
        })
    }

    fn ps() -> Command {
        match std::path::Path::new("/bin/ps").exists() {
            true => Command::new("/bin/ps"),
            false => Command::new("ps"),
        }
    }

    fn live_table() -> Vec<ProcRow> {
        let Ok(output) = ps()
            .args(["-A", "-o", "pid=,ppid=,pgid=,uid=,stat=,comm="])
            .output()
        else {
            return Vec::new();
        };
        parse_table(&String::from_utf8_lossy(&output.stdout))
            .into_iter()
            .filter_map(|mut row| {
                let Some(identity) = kernel::identity(row.pid) else {
                    return row.stat.starts_with('Z').then_some(row);
                };
                if identity.ppid != row.ppid || identity.pgid != row.pgid || identity.uid != row.uid
                {
                    return None;
                }
                row.start = identity.start;
                Some(row)
            })
            .collect()
    }

    pub(crate) fn scan_tagged(probe: &Probe, table: &[ProcRow], me: &Me) -> Vec<(u32, TagInfo)> {
        table
            .iter()
            .filter(|row| is_signalable(row, me))
            .filter_map(|row| {
                let entries = (probe.environ)(row.pid)?;
                let tag = tag_from_env(entries.iter().map(String::as_str))?;
                Some((row.pid, tag))
            })
            .collect()
    }

    fn is_signalable(row: &ProcRow, me: &Me) -> bool {
        row.pid > 1 && row.pid != me.pid && row.uid == me.uid
    }

    fn is_own_tag(tag: &TagInfo, me: &Me) -> bool {
        let is_same_start =
            tag.app_start == 0 || me.app_start == 0 || tag.app_start == me.app_start;
        tag.app_pid == me.pid && is_same_start
    }

    fn descendants(table: &[ProcRow], root: u32) -> Vec<&ProcRow> {
        let mut children: HashMap<u32, Vec<&ProcRow>> = HashMap::new();
        for row in table {
            children.entry(row.ppid).or_default().push(row);
        }
        let mut found: Vec<&ProcRow> = Vec::new();
        let mut seen: HashSet<u32> = HashSet::from([root]);
        let mut queue = vec![root];
        while let Some(parent) = queue.pop() {
            for child in children.get(&parent).into_iter().flatten() {
                if !seen.insert(child.pid) {
                    continue;
                }
                found.push(child);
                queue.push(child.pid);
            }
        }
        found
    }

    pub(crate) fn select_targets(
        table: &[ProcRow],
        tagged: &[(u32, TagInfo)],
        params: &ReapParams<'_>,
        me: &Me,
    ) -> Selection {
        let mut chosen: BTreeMap<u32, Selected> = BTreeMap::new();
        let mut group: Option<u32> = None;
        let held = params
            .leader_pid
            .and_then(|pid| table.iter().find(|row| row.pid == pid))
            .filter(|row| row.ppid == me.pid);
        if let Some(leader) = held {
            let mut members: Vec<&ProcRow> = vec![leader];
            members.extend(descendants(table, leader.pid));
            if leader.pgid == leader.pid && leader.pgid != me.pgid {
                group = Some(leader.pid);
                members.extend(table.iter().filter(|row| row.pgid == leader.pid));
            }
            for row in members {
                chosen.insert(
                    row.pid,
                    Selected {
                        row: row.clone(),
                        tag: None,
                    },
                );
            }
        }
        if let Some(spawn_id) = params.spawn_id {
            for (pid, tag) in tagged {
                if tag.spawn_id != spawn_id || !is_own_tag(tag, me) {
                    continue;
                }
                if let Some(row) = table.iter().find(|row| row.pid == *pid) {
                    chosen.insert(
                        row.pid,
                        Selected {
                            row: row.clone(),
                            tag: Some(tag.clone()),
                        },
                    );
                }
            }
        }
        let targets: Vec<Selected> = chosen
            .into_values()
            .filter(|selected| is_signalable(&selected.row, me))
            .collect();
        Selection { targets, group }
    }

    pub(crate) fn orphans(
        table: &[ProcRow],
        tagged: &[(u32, TagInfo)],
        me: &Me,
        is_app_alive: impl Fn(u32, u64) -> bool,
    ) -> Vec<Selected> {
        let rows: HashMap<u32, &ProcRow> = table.iter().map(|row| (row.pid, row)).collect();
        let mut candidates: BTreeMap<u32, Selected> = BTreeMap::new();
        for (pid, tag) in tagged {
            let Some(kind) = SpawnKind::parse(&tag.kind) else {
                continue;
            };
            let Some(row) = rows.get(pid) else {
                continue;
            };
            let is_candidate = kind.is_swept_at_startup()
                && !is_own_tag(tag, me)
                && !is_app_alive(tag.app_pid, tag.app_start)
                && is_signalable(row, me);
            if !is_candidate {
                continue;
            }
            candidates.insert(
                *pid,
                Selected {
                    row: (*row).clone(),
                    tag: Some(tag.clone()),
                },
            );
        }
        let mut orphaned: HashSet<u32> = candidates
            .values()
            .filter(|selected| selected.row.ppid == 1)
            .map(|selected| selected.row.pid)
            .collect();
        loop {
            let adopted: Vec<u32> = candidates
                .values()
                .filter(|selected| !orphaned.contains(&selected.row.pid))
                .filter(|selected| orphaned.contains(&selected.row.ppid))
                .map(|selected| selected.row.pid)
                .collect();
            if adopted.is_empty() {
                break;
            }
            orphaned.extend(adopted);
        }
        candidates
            .into_values()
            .filter(|selected| orphaned.contains(&selected.row.pid))
            .collect()
    }

    fn signal(pid: u32, sig: libc::c_int) {
        unsafe { libc::kill(pid as libc::pid_t, sig) };
    }

    fn signal_group(group: u32, sig: libc::c_int) {
        unsafe { libc::killpg(group as libc::pid_t, sig) };
    }

    pub(crate) fn live_identity_if_same(
        probe: &Probe,
        me: &Me,
        selected: &Selected,
    ) -> Option<Identity> {
        let pid = selected.row.pid;
        if pid <= 1 || pid == me.pid {
            return None;
        }
        let identity = (probe.identity)(pid)?;
        if identity.start != selected.row.start || identity.uid != me.uid || identity.is_zombie {
            return None;
        }
        let Some(expected) = &selected.tag else {
            return Some(identity);
        };
        let entries = (probe.environ)(pid)?;
        let current = tag_from_env(entries.iter().map(String::as_str))?;
        match &current == expected {
            true => Some(identity),
            false => None,
        }
    }

    pub(crate) fn signal_selected(
        probe: &Probe,
        me: &Me,
        targets: &[Selected],
        sig: libc::c_int,
    ) -> Vec<u32> {
        let mut signalled: Vec<u32> = Vec::new();
        for selected in targets {
            if live_identity_if_same(probe, me, selected).is_none() {
                continue;
            }
            signal(selected.row.pid, sig);
            signalled.push(selected.row.pid);
        }
        signalled
    }

    pub(crate) fn signal_group_if_ours(
        probe: &Probe,
        me: &Me,
        group: u32,
        members: &[Selected],
        sig: libc::c_int,
    ) -> bool {
        if group <= 1 || group == me.pgid {
            return false;
        }
        let is_ours = members.iter().any(|selected| {
            selected.row.pgid == group
                && live_identity_if_same(probe, me, selected)
                    .is_some_and(|identity| identity.pgid == group)
        });
        if !is_ours {
            return false;
        }
        signal_group(group, sig);
        true
    }

    fn is_present(probe: &Probe, selected: &Selected, is_child: bool) -> bool {
        let pid = selected.row.pid;
        if is_child {
            let mut status: libc::c_int = 0;
            let reaped = unsafe { libc::waitpid(pid as libc::pid_t, &mut status, libc::WNOHANG) };
            if reaped == pid as libc::pid_t {
                return false;
            }
        }
        (probe.identity)(pid)
            .is_some_and(|identity| identity.start == selected.row.start && !identity.is_zombie)
    }

    fn wait_until_gone(
        probe: &Probe,
        targets: &[Selected],
        children: &HashSet<u32>,
        budget: Duration,
    ) -> Vec<Selected> {
        let deadline = Instant::now() + budget;
        let mut survivors: Vec<Selected> = targets.to_vec();
        loop {
            survivors.retain(|selected| {
                is_present(probe, selected, children.contains(&selected.row.pid))
            });
            if survivors.is_empty() || Instant::now() >= deadline {
                return survivors;
            }
            std::thread::sleep(POLL_INTERVAL);
        }
    }

    fn stop(
        probe: &Probe,
        me: &Me,
        targets: &[Selected],
        group: Option<u32>,
        children: &HashSet<u32>,
    ) -> Vec<u32> {
        if targets.is_empty() {
            return Vec::new();
        }
        if let Some(group) = group {
            signal_group_if_ours(probe, me, group, targets, libc::SIGTERM);
        }
        let signalled = signal_selected(probe, me, targets, libc::SIGTERM);
        let survivors = wait_until_gone(probe, targets, children, TERM_GRACE);
        if survivors.is_empty() {
            return signalled;
        }
        if let Some(group) = group {
            signal_group_if_ours(probe, me, group, &survivors, libc::SIGKILL);
        }
        signal_selected(probe, me, &survivors, libc::SIGKILL);
        wait_until_gone(probe, &survivors, children, KILL_GRACE);
        signalled
    }

    fn is_shell(name: &str) -> bool {
        SHELL_NAMES.contains(&name.trim_start_matches('-'))
    }

    fn terminate_held_group(probe: &Probe, me: &Me, leader: Option<u32>) {
        let Some(leader) = leader else {
            return;
        };
        let Some(identity) = (probe.identity)(leader) else {
            return;
        };
        let is_held_leader = leader > 1
            && identity.ppid == me.pid
            && identity.pgid == leader
            && leader != me.pgid
            && identity.uid == me.uid;
        if !is_held_leader {
            return;
        }
        crate::process_group::terminate(leader);
    }

    pub(crate) fn reap(params: ReapParams<'_>) -> ReapReport {
        reap_with(&LIVE, params)
    }

    pub(crate) fn reap_with(probe: &Probe, params: ReapParams<'_>) -> ReapReport {
        let me = Me::current();
        let leader = params.leader_pid;
        let mut seen: HashSet<(u32, u64)> = HashSet::new();
        let mut stopped: Vec<StoppedProcess> = Vec::new();
        let mut is_scanned = false;
        let mut is_settled = false;
        for _ in 0..MAX_ROUNDS {
            let table = (probe.table)();
            if table.is_empty() {
                if !is_scanned {
                    terminate_held_group(probe, &me, leader);
                }
                is_settled = true;
                break;
            }
            is_scanned = true;
            let tagged = match params.spawn_id {
                Some(_) => scan_tagged(probe, &table, &me),
                None => Vec::new(),
            };
            let selection = select_targets(&table, &tagged, &params, &me);
            let fresh: Vec<Selected> = selection
                .targets
                .into_iter()
                .filter(|selected| seen.insert((selected.row.pid, selected.row.start)))
                .filter(|selected| !selected.row.stat.starts_with('Z'))
                .filter(|selected| !(params.is_leader_exited && Some(selected.row.pid) == leader))
                .collect();
            if fresh.is_empty() {
                is_settled = true;
                break;
            }
            let children: HashSet<u32> = fresh
                .iter()
                .filter(|selected| selected.row.ppid == me.pid && Some(selected.row.pid) != leader)
                .map(|selected| selected.row.pid)
                .collect();
            let signalled = stop(probe, &me, &fresh, selection.group, &children);
            stopped.extend(
                fresh
                    .iter()
                    .filter(|selected| signalled.contains(&selected.row.pid))
                    .filter(|selected| Some(selected.row.pid) != leader)
                    .map(|selected| StoppedProcess {
                        pid: selected.row.pid,
                        name: selected.row.name.clone(),
                        port: None,
                    }),
            );
        }
        if !is_settled {
            log::warn!(
                "[reap] still finding new processes after {MAX_ROUNDS} rounds, giving up on the rest"
            );
        }
        stopped.sort_by_key(|process| (is_shell(&process.name), process.pid));
        ReapReport {
            stopped,
            is_scanned,
        }
    }

    pub(crate) fn sweep_orphans() -> usize {
        sweep_with(&LIVE)
    }

    pub(crate) fn tree_cpu(leader_pid: u32) -> Option<u64> {
        let table = (LIVE.table)();
        let leader = table.iter().find(|row| row.pid == leader_pid)?;
        let total = std::iter::once(leader)
            .chain(descendants(&table, leader_pid))
            .filter_map(|row| kernel::cpu_time(row.pid))
            .fold(0u64, u64::saturating_add);
        Some(total)
    }

    fn is_app_alive(probe: &Probe, pid: u32, start: u64) -> bool {
        let is_reachable = unsafe { libc::kill(pid as libc::pid_t, 0) } == 0
            || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM);
        if !is_reachable {
            return false;
        }
        if start == 0 {
            return true;
        }
        match (probe.identity)(pid) {
            Some(identity) => identity.start == start,
            None => true,
        }
    }

    pub(crate) fn sweep_with(probe: &Probe) -> usize {
        let table = (probe.table)();
        if table.is_empty() {
            return 0;
        }
        let me = Me::current();
        let tagged = scan_tagged(probe, &table, &me);
        let found = orphans(&table, &tagged, &me, |pid, start| {
            is_app_alive(probe, pid, start)
        });
        if found.is_empty() {
            return 0;
        }
        stop(probe, &me, &found, None, &HashSet::new()).len()
    }

    #[cfg(test)]
    pub(crate) mod test_support {
        use std::process::{Child, Command, Stdio};
        use std::sync::atomic::{AtomicBool, Ordering};
        use std::sync::OnceLock;
        use std::time::{Duration, Instant};

        pub(crate) const HELPER_FLAG: &str = "GOODBOY_REAP_HELPER";
        pub(crate) const HELPER_MODE_ENV: &str = "GOODBOY_REAP_HELPER_MODE";
        pub(crate) const HELPER_EXE: &str = "GOODBOY_REAP_HELPER_EXE";
        pub(crate) const HELPER_TEST_ENV: &str = "GOODBOY_REAP_HELPER_TEST";
        pub(crate) const HELPER_TEST: &str = "proc::reap::unix::test_support::helper_sleeps";

        static EXE_PUBLISHED: OnceLock<()> = OnceLock::new();
        static TERMED: AtomicBool = AtomicBool::new(false);

        extern "C" fn on_term(_signal: libc::c_int) {
            TERMED.store(true, Ordering::SeqCst);
        }

        #[test]
        fn helper_sleeps() {
            if std::env::var_os(HELPER_FLAG).is_none() {
                return;
            }
            let mode = std::env::var(HELPER_MODE_ENV).unwrap_or_default();
            match mode.as_str() {
                "ignore-term" => {
                    unsafe { libc::signal(libc::SIGTERM, libc::SIG_IGN) };
                    std::thread::sleep(Duration::from_secs(90));
                }
                "forker" => {
                    let handler = on_term as extern "C" fn(libc::c_int) as libc::sighandler_t;
                    unsafe { libc::signal(libc::SIGTERM, handler) };
                    let deadline = Instant::now() + Duration::from_secs(90);
                    while !TERMED.load(Ordering::SeqCst) && Instant::now() < deadline {
                        std::thread::sleep(Duration::from_millis(10));
                    }
                    spawn_plain_helper();
                    std::thread::sleep(Duration::from_millis(250));
                }
                _ => std::thread::sleep(Duration::from_secs(90)),
            }
        }

        fn spawn_plain_helper() {
            let exe = std::env::current_exe().expect("test executable");
            let _ = Command::new(exe)
                .args(["--exact", HELPER_TEST, "--nocapture", "--test-threads=1"])
                .env_remove(HELPER_MODE_ENV)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn();
        }

        pub(crate) fn publish_helper_env() {
            EXE_PUBLISHED.get_or_init(|| {
                let exe = std::env::current_exe().expect("test executable");
                std::env::set_var(HELPER_EXE, exe);
                std::env::set_var(HELPER_TEST_ENV, HELPER_TEST);
            });
        }

        pub(crate) fn helper_command() -> Command {
            let exe = std::env::current_exe().expect("test executable");
            let mut command = Command::new(exe);
            command
                .args(["--exact", HELPER_TEST, "--nocapture", "--test-threads=1"])
                .env(HELPER_FLAG, "1")
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            command
        }

        pub(crate) fn is_gone(pid: u32) -> bool {
            let deadline = Instant::now() + Duration::from_secs(5);
            loop {
                let listed = Command::new("/bin/ps")
                    .args(["-o", "stat=", "-p", &pid.to_string()])
                    .output()
                    .expect("run ps");
                let stat = String::from_utf8_lossy(&listed.stdout).trim().to_string();
                if stat.is_empty() || stat.starts_with('Z') {
                    return true;
                }
                if Instant::now() >= deadline {
                    return false;
                }
                std::thread::sleep(Duration::from_millis(25));
            }
        }

        pub(crate) fn is_running(pid: u32) -> bool {
            let listed = Command::new("/bin/ps")
                .args(["-o", "stat=", "-p", &pid.to_string()])
                .output()
                .expect("run ps");
            let stat = String::from_utf8_lossy(&listed.stdout).trim().to_string();
            !stat.is_empty() && !stat.starts_with('Z')
        }

        pub(crate) fn tagged_pids(spawn_id: &str) -> Vec<u32> {
            let me = super::Me::current();
            let table = (super::LIVE.table)();
            super::scan_tagged(&super::LIVE, &table, &me)
                .into_iter()
                .filter(|(_, tag)| tag.spawn_id == spawn_id)
                .map(|(pid, _)| pid)
                .collect()
        }

        pub(crate) fn wait_until_visible(child: &Child, spawn_id: &str) {
            let deadline = Instant::now() + Duration::from_secs(10);
            loop {
                if tagged_pids(spawn_id).contains(&child.id()) {
                    return;
                }
                assert!(
                    Instant::now() < deadline,
                    "the helper never showed its tag to the scan"
                );
                std::thread::sleep(Duration::from_millis(50));
            }
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use std::collections::HashMap;
    use std::process::Child;
    use std::sync::Mutex;
    use std::time::{Duration, Instant};

    use super::unix::test_support::{
        helper_command, is_gone, is_running, tagged_pids, wait_until_visible, HELPER_FLAG,
        HELPER_MODE_ENV, HELPER_TEST,
    };
    use super::unix::{
        live_identity_if_same, orphans, parse_table, reap_with, select_targets, signal_selected,
        sweep_with, tag_from_env, Me, Probe, ProcRow, Selected, TagInfo, LIVE,
    };
    use super::*;
    use crate::aux_spawn::{app_start, APP_PID_ENV, APP_START_ENV, SPAWN_ID_ENV, SPAWN_KIND_ENV};
    use crate::proc::kernel::{self, Identity};

    fn row(pid: u32, ppid: u32, pgid: u32, uid: u32, name: &str) -> ProcRow {
        ProcRow {
            pid,
            ppid,
            pgid,
            uid,
            stat: "S".to_string(),
            name: name.to_string(),
            start: 1000 + u64::from(pid),
        }
    }

    fn tag(spawn_id: &str, kind: &str, app_pid: u32) -> TagInfo {
        TagInfo {
            spawn_id: spawn_id.to_string(),
            kind: kind.to_string(),
            app_pid,
            app_start: 500,
        }
    }

    fn me() -> Me {
        Me {
            pid: 100,
            uid: 501,
            pgid: 90,
            app_start: 500,
        }
    }

    fn params(leader: Option<u32>, spawn_id: Option<&str>) -> ReapParams<'_> {
        ReapParams {
            leader_pid: leader,
            is_leader_exited: false,
            spawn_id,
        }
    }

    fn pids_of(targets: &[Selected]) -> Vec<u32> {
        targets.iter().map(|selected| selected.row.pid).collect()
    }

    #[test]
    fn the_table_parser_reads_names_with_spaces_and_skips_noise() {
        let text = "  12   1  12 501 Ss   /Applications/Some App/server\n bad line\n 13 12 12 501 S+ node\n";
        let rows = parse_table(text);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].name, "server");
        assert_eq!(rows[0].stat, "Ss");
        assert_eq!(rows[1].ppid, 12);
    }

    #[test]
    fn a_tag_needs_all_four_values() {
        let id = format!("{SPAWN_ID_ENV}=abc");
        let kind = format!("{SPAWN_KIND_ENV}=turn");
        let app = format!("{APP_PID_ENV}=77");
        let start = format!("{APP_START_ENV}=123456");
        let all = [
            id.as_str(),
            "PATH=/bin",
            kind.as_str(),
            app.as_str(),
            start.as_str(),
        ];
        let expected = TagInfo {
            spawn_id: "abc".to_string(),
            kind: "turn".to_string(),
            app_pid: 77,
            app_start: 123456,
        };
        assert_eq!(tag_from_env(all.into_iter()), Some(expected));
        assert_eq!(
            tag_from_env([id.as_str(), kind.as_str(), app.as_str()].into_iter()),
            None
        );
        assert_eq!(tag_from_env(["PATH=/bin"].into_iter()), None);
    }

    #[test]
    fn a_tag_key_must_match_exactly() {
        let lookalikes = [
            "--env=GOODBOY_SPAWN_ID=abc",
            "XGOODBOY_SPAWN_ID=abc",
            "GOODBOY_SPAWN_ID_EXTRA=abc",
            "GOODBOY_SPAWN_KIND =turn",
            "GOODBOY_APP_PID",
            "GOODBOY_APP_START=1",
        ];

        assert_eq!(tag_from_env(lookalikes.into_iter()), None);
    }

    #[test]
    fn the_first_value_of_a_repeated_key_wins() {
        let entries = [
            "GOODBOY_SPAWN_ID=first",
            "GOODBOY_SPAWN_ID=second",
            "GOODBOY_SPAWN_KIND=turn",
            "GOODBOY_APP_PID=5",
            "GOODBOY_APP_START=9",
        ];

        let found = tag_from_env(entries.into_iter()).expect("a tag");

        assert_eq!(found.spawn_id, "first");
    }

    #[test]
    fn a_process_without_the_tag_is_never_selected() {
        let table = vec![row(500, 1, 500, 501, "node"), row(501, 1, 501, 501, "vite")];
        let tagged = vec![(501, tag("other-spawn", "turn", 100))];

        let selection = select_targets(&table, &tagged, &params(None, Some("mine")), &me());

        assert!(selection.targets.is_empty());
        assert_eq!(selection.group, None);
    }

    #[test]
    fn a_tag_with_another_app_pid_is_never_selected_while_its_parent_lives() {
        let table = vec![row(500, 400, 400, 501, "node")];
        let tagged = vec![(500, tag("mine", "turn", 999))];

        let selection = select_targets(&table, &tagged, &params(None, Some("mine")), &me());

        assert!(selection.targets.is_empty());
    }

    #[test]
    fn a_tag_from_an_earlier_app_with_the_same_pid_is_not_ours() {
        let table = vec![row(500, 400, 400, 501, "node")];
        let mut earlier = tag("mine", "turn", 100);
        earlier.app_start = 499;
        let tagged = vec![(500, earlier)];

        let selection = select_targets(&table, &tagged, &params(None, Some("mine")), &me());

        assert!(selection.targets.is_empty());
    }

    #[test]
    fn pid_one_this_app_and_other_users_are_refused_even_with_the_tag() {
        let table = vec![
            row(1, 0, 1, 501, "launchd"),
            row(100, 50, 90, 501, "goodboy"),
            row(600, 1, 600, 0, "rootd"),
            row(601, 1, 601, 501, "node"),
        ];
        let tagged = vec![
            (1, tag("mine", "turn", 100)),
            (100, tag("mine", "turn", 100)),
            (600, tag("mine", "turn", 100)),
            (601, tag("mine", "turn", 100)),
        ];

        let selection = select_targets(&table, &tagged, &params(None, Some("mine")), &me());

        assert_eq!(pids_of(&selection.targets), vec![601]);
    }

    #[test]
    fn a_held_leader_brings_its_tree_and_its_group_but_nothing_else() {
        let table = vec![
            row(200, 100, 200, 501, "claude"),
            row(201, 200, 200, 501, "sh"),
            row(202, 201, 202, 501, "next-server"),
            row(203, 1, 200, 501, "watcher"),
            row(300, 1, 300, 501, "stranger"),
        ];

        let selection = select_targets(&table, &[], &params(Some(200), None), &me());

        assert_eq!(pids_of(&selection.targets), vec![200, 201, 202, 203]);
        assert_eq!(selection.group, Some(200));
    }

    #[test]
    fn a_leader_that_is_not_our_child_is_never_trusted() {
        let table = vec![
            row(200, 77, 200, 501, "recycled"),
            row(201, 200, 200, 501, "innocent"),
        ];

        let selection = select_targets(&table, &[], &params(Some(200), None), &me());

        assert!(selection.targets.is_empty());
        assert_eq!(selection.group, None);
    }

    #[test]
    fn a_leader_in_the_app_group_never_triggers_a_group_signal() {
        let table = vec![row(200, 100, 90, 501, "sleep")];

        let selection = select_targets(&table, &[], &params(Some(200), None), &me());

        assert_eq!(pids_of(&selection.targets), vec![200]);
        assert_eq!(selection.group, None);
    }

    #[test]
    fn the_sweep_takes_only_agent_kinds_with_a_dead_app_and_parent_one() {
        let table = vec![
            row(700, 1, 700, 501, "turn-orphan"),
            row(701, 700, 700, 501, "its-child"),
            row(702, 1, 702, 501, "script-orphan"),
            row(703, 1, 703, 501, "live-app-orphan"),
            row(704, 650, 650, 501, "has-a-living-parent"),
            row(705, 1, 705, 501, "this-app"),
            row(706, 1, 706, 0, "other-user"),
        ];
        let tagged = vec![
            (700, tag("a", "turn", 9000)),
            (701, tag("a", "turn", 9000)),
            (702, tag("b", "script", 9000)),
            (703, tag("c", "chat", 9100)),
            (704, tag("d", "planner", 9000)),
            (705, tag("e", "turn", 100)),
            (706, tag("f", "turn", 9000)),
        ];

        let found = orphans(&table, &tagged, &me(), |app, _| app == 9100);

        assert_eq!(pids_of(&found), vec![700, 701]);
    }

    #[test]
    fn the_sweep_compares_the_app_start_time_and_not_only_its_pid() {
        let table = vec![
            row(700, 1, 700, 501, "orphan-of-a-recycled-app-pid"),
            row(701, 1, 701, 501, "orphan-of-the-live-app"),
        ];
        let mut recycled = tag("a", "turn", 9100);
        recycled.app_start = 111;
        let mut live = tag("b", "turn", 9100);
        live.app_start = 222;
        let tagged = vec![(700, recycled), (701, live)];

        let found = orphans(&table, &tagged, &me(), |app, start| {
            app == 9100 && start == 222
        });

        assert_eq!(pids_of(&found), vec![700]);
    }

    fn app_start_for_test() -> u64 {
        app_start()
    }

    fn spawn_tagged_helper_with(
        spawn_id: &str,
        app_pid: u32,
        app_start: u64,
        kind: &str,
        mode: Option<&str>,
    ) -> Child {
        let mut command = helper_command();
        command
            .env(SPAWN_ID_ENV, spawn_id)
            .env(SPAWN_KIND_ENV, kind)
            .env(APP_PID_ENV, app_pid.to_string())
            .env(APP_START_ENV, app_start.to_string());
        if let Some(mode) = mode {
            command.env(HELPER_MODE_ENV, mode);
        }
        let child = command.spawn().expect("spawn the helper");
        wait_until_visible(&child, spawn_id);
        child
    }

    fn spawn_tagged_helper(spawn_id: &str, app_pid: u32, kind: &str) -> Child {
        spawn_tagged_helper_with(spawn_id, app_pid, app_start_for_test(), kind, None)
    }

    fn unique_id(label: &str) -> String {
        format!("reap-test-{label}-{}", std::process::id())
    }

    fn live_selected(pid: u32, tag: Option<TagInfo>) -> Selected {
        let row = (LIVE.table)()
            .into_iter()
            .find(|row| row.pid == pid)
            .expect("the helper in the process table");
        Selected { row, tag }
    }

    fn cleanup(mut child: Child) {
        let _ = child.kill();
        let _ = child.wait();
    }

    fn reap_spawn(id: &str) -> ReapReport {
        reap(ReapParams {
            leader_pid: None,
            is_leader_exited: false,
            spawn_id: Some(id),
        })
    }

    #[test]
    fn reap_stops_a_process_that_carries_this_spawn_and_this_app() {
        let id = unique_id("own");
        let mut child = spawn_tagged_helper(&id, std::process::id(), "turn");
        let pid = child.id();

        let report = reap_spawn(&id);

        let _ = child.wait();
        assert!(report.is_scanned);
        assert!(report.stopped.iter().any(|process| process.pid == pid));
        assert!(is_gone(pid));
    }

    #[test]
    fn reap_leaves_a_process_without_the_tag_alone() {
        let id = unique_id("untagged");
        let stranger = helper_command().spawn().expect("spawn the stranger");
        let stranger_pid = stranger.id();
        let mut own = spawn_tagged_helper(&id, std::process::id(), "turn");

        reap_spawn(&id);

        let _ = own.wait();
        assert!(is_running(stranger_pid));
        cleanup(stranger);
    }

    #[test]
    fn reap_leaves_a_tag_with_another_app_pid_alone_while_its_parent_lives() {
        let id = unique_id("foreign");
        let foreign = spawn_tagged_helper(&id, std::process::id() + 1_000_000, "turn");
        let pid = foreign.id();

        reap_spawn(&id);

        assert!(is_running(pid));
        cleanup(foreign);
    }

    #[test]
    fn reap_leaves_a_tag_with_another_spawn_id_alone() {
        let mine = unique_id("mine");
        let theirs = unique_id("theirs");
        let other = spawn_tagged_helper(&theirs, std::process::id(), "turn");
        let pid = other.id();

        let report = reap_spawn(&mine);

        assert!(report.stopped.is_empty());
        assert!(is_running(pid));
        cleanup(other);
    }

    #[test]
    fn reap_leaves_alone_a_process_whose_arguments_look_like_a_tag() {
        let id = unique_id("args");
        let mut command = helper_command();
        command.args([
            format!("{SPAWN_ID_ENV}={id}"),
            format!("{SPAWN_KIND_ENV}=turn"),
            format!("{APP_PID_ENV}={}", std::process::id()),
            format!("{APP_START_ENV}={}", app_start_for_test()),
        ]);
        let decoy = command.spawn().expect("spawn the decoy");
        let pid = decoy.id();
        std::thread::sleep(Duration::from_millis(400));

        let report = reap_spawn(&id);

        assert!(tagged_pids(&id).is_empty());
        assert!(report.stopped.is_empty());
        assert!(is_running(pid));
        cleanup(decoy);
    }

    static SKEWS: Mutex<Vec<(u32, Instant)>> = Mutex::new(Vec::new());

    fn skew_from(pid: u32, delay: Duration) {
        SKEWS
            .lock()
            .expect("skews")
            .push((pid, Instant::now() + delay));
    }

    fn skewing_identity(pid: u32) -> Option<Identity> {
        let mut identity = kernel::identity(pid)?;
        let is_skewed = SKEWS
            .lock()
            .expect("skews")
            .iter()
            .any(|(skewed, from)| *skewed == pid && Instant::now() >= *from);
        if is_skewed {
            identity.start += 1;
        }
        Some(identity)
    }

    fn skewing_probe() -> Probe {
        Probe {
            identity: skewing_identity,
            ..LIVE
        }
    }

    static ENV_FLIPS: Mutex<Vec<u32>> = Mutex::new(Vec::new());
    static ENV_CALLS: Mutex<Option<HashMap<u32, usize>>> = Mutex::new(None);

    fn flipping_environ(pid: u32) -> Option<Vec<String>> {
        let real = kernel::environ(pid)?;
        if !ENV_FLIPS.lock().expect("flips").contains(&pid) {
            return Some(real);
        }
        let mut guard = ENV_CALLS.lock().expect("calls");
        let calls = guard.get_or_insert_with(HashMap::new);
        let count = calls.entry(pid).or_insert(0);
        *count += 1;
        if *count == 1 {
            return Some(real);
        }
        Some(vec!["PATH=/bin".to_string()])
    }

    #[test]
    fn a_pid_that_now_belongs_to_another_process_is_not_signalled() {
        let id = unique_id("reused");
        let helper = spawn_tagged_helper(&id, std::process::id(), "turn");
        let pid = helper.id();
        skew_from(pid, Duration::ZERO);

        let report = reap_with(&skewing_probe(), params(None, Some(&id)));

        assert!(report.stopped.is_empty());
        assert!(is_running(pid));
        cleanup(helper);
    }

    #[test]
    fn a_pid_that_changes_hands_after_the_term_is_never_killed() {
        let id = unique_id("reused-late");
        let helper = spawn_tagged_helper_with(
            &id,
            std::process::id(),
            app_start_for_test(),
            "turn",
            Some("ignore-term"),
        );
        let pid = helper.id();
        std::thread::sleep(Duration::from_millis(300));
        skew_from(pid, Duration::from_millis(120));

        reap_with(&skewing_probe(), params(None, Some(&id)));

        assert!(is_running(pid), "the new owner of the pid was killed");
        cleanup(helper);
    }

    #[test]
    fn a_stale_selection_is_refused_before_a_kill() {
        let id = unique_id("stale-kill");
        let helper = spawn_tagged_helper(&id, std::process::id(), "turn");
        let pid = helper.id();
        let selected = live_selected(pid, None);
        skew_from(pid, Duration::ZERO);

        let signalled =
            signal_selected(&skewing_probe(), &Me::current(), &[selected], libc::SIGKILL);

        assert!(signalled.is_empty());
        assert!(is_running(pid));
        cleanup(helper);
    }

    #[test]
    fn a_selection_that_still_matches_is_signalled() {
        let id = unique_id("fresh-kill");
        let mut helper = spawn_tagged_helper(&id, std::process::id(), "turn");
        let pid = helper.id();
        let selected = live_selected(pid, None);
        assert!(live_identity_if_same(&LIVE, &Me::current(), &selected).is_some());

        let signalled = signal_selected(&LIVE, &Me::current(), &[selected], libc::SIGKILL);

        let _ = helper.wait();
        assert_eq!(signalled, vec![pid]);
        assert!(is_gone(pid));
    }

    #[test]
    fn a_process_that_lost_its_tag_after_the_scan_is_not_signalled() {
        let id = unique_id("tag-lost");
        let helper = spawn_tagged_helper(&id, std::process::id(), "turn");
        let pid = helper.id();
        ENV_FLIPS.lock().expect("flips").push(pid);
        let probe = Probe {
            environ: flipping_environ,
            ..LIVE
        };

        let report = reap_with(&probe, params(None, Some(&id)));

        assert!(report.stopped.is_empty());
        assert!(is_running(pid));
        cleanup(helper);
    }

    #[test]
    fn a_process_that_vanished_before_the_signal_is_skipped() {
        let id = unique_id("vanished");
        let mut helper = spawn_tagged_helper(&id, std::process::id(), "turn");
        let pid = helper.id();
        let selected = live_selected(pid, None);
        let _ = helper.kill();
        let _ = helper.wait();

        let signalled = signal_selected(&LIVE, &Me::current(), &[selected], libc::SIGTERM);

        assert!(signalled.is_empty());
    }

    #[test]
    fn a_descendant_spawned_during_the_cleanup_is_found_by_the_next_round() {
        let id = unique_id("forker");
        let mut forker = spawn_tagged_helper_with(
            &id,
            std::process::id(),
            app_start_for_test(),
            "turn",
            Some("forker"),
        );

        let report = reap_spawn(&id);

        let _ = forker.wait();
        let deadline = Instant::now() + Duration::from_secs(5);
        while !tagged_pids(&id).is_empty() {
            assert!(
                Instant::now() < deadline,
                "a process spawned during the cleanup survived it"
            );
            std::thread::sleep(Duration::from_millis(50));
        }
        assert!(report.stopped.len() >= 2, "{:?}", report.stopped);
    }

    static ORPHANS: Mutex<()> = Mutex::new(());

    fn orphan_lock() -> std::sync::MutexGuard<'static, ()> {
        ORPHANS
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn orphan_with_own_group(spawn_id: &str, app_pid: u32, app_start: u64) -> u32 {
        let exe = std::env::current_exe().expect("test executable");
        let mut launcher = std::process::Command::new("/bin/sh");
        launcher
            .arg("-c")
            .arg(r#"(perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' -- "$0" --exact "$1" --nocapture --test-threads=1 >/dev/null 2>&1 </dev/null &) ; exit 0"#)
            .arg(&exe)
            .arg(HELPER_TEST)
            .env(HELPER_FLAG, "1")
            .env(SPAWN_ID_ENV, spawn_id)
            .env(SPAWN_KIND_ENV, "turn")
            .env(APP_PID_ENV, app_pid.to_string())
            .env(APP_START_ENV, app_start.to_string());
        launcher.status().expect("launch the orphan");
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            if let Some(pid) = tagged_pids(spawn_id).into_iter().next() {
                return pid;
            }
            assert!(Instant::now() < deadline, "the orphan never appeared");
            std::thread::sleep(Duration::from_millis(50));
        }
    }

    #[test]
    fn the_sweep_reaps_a_tagged_orphan_of_a_dead_app() {
        let _lock = orphan_lock();
        let id = unique_id("orphan");
        let pid = orphan_with_own_group(&id, dead_pid(), app_start_for_test());
        assert!(is_running(pid));

        sweep_with(&LIVE);

        assert!(is_gone(pid));
    }

    #[test]
    fn the_sweep_reaps_the_orphan_of_an_app_pid_that_was_recycled() {
        let _lock = orphan_lock();
        let id = unique_id("orphan-recycled");
        let bystander = helper_command().spawn().expect("spawn the new pid owner");
        let before_this_pid_started =
            kernel::identity(bystander.id()).expect("identity").start - 5_000_000;
        let pid = orphan_with_own_group(&id, bystander.id(), before_this_pid_started);
        assert!(is_running(pid));

        sweep_with(&LIVE);

        assert!(is_gone(pid), "an orphan of a recycled app pid survived");
        assert!(is_running(bystander.id()));
        cleanup(bystander);
    }

    #[test]
    fn the_sweep_leaves_the_orphan_of_a_live_app_alone() {
        let _lock = orphan_lock();
        let id = unique_id("orphan-live-app");
        let app = helper_command().spawn().expect("spawn the other app");
        let app_start = kernel::identity(app.id()).expect("identity").start;
        let pid = orphan_with_own_group(&id, app.id(), app_start);

        sweep_with(&LIVE);
        std::thread::sleep(Duration::from_millis(500));

        assert!(is_running(pid), "the orphan of a live app was swept");
        let _ = signal_selected(
            &LIVE,
            &Me::current(),
            &[live_selected(pid, None)],
            libc::SIGKILL,
        );
        assert!(is_gone(pid));
        cleanup(app);
    }

    fn dead_pid() -> u32 {
        let mut child = std::process::Command::new("/bin/sh")
            .args(["-c", "exit 0"])
            .spawn()
            .expect("spawn a short child");
        let pid = child.id();
        let _ = child.wait();
        pid
    }

    fn blind_probe() -> Probe {
        Probe {
            table: Vec::new,
            ..LIVE
        }
    }

    #[test]
    fn when_the_process_table_is_unreadable_the_held_group_still_dies() {
        use std::os::unix::process::CommandExt;
        let mut command = std::process::Command::new("/bin/sh");
        command
            .args(["-c", "sleep 30 & sleep 30 & wait"])
            .process_group(0);
        let mut leader = command.spawn().expect("spawn the leader");
        let pid = leader.id();
        std::thread::sleep(Duration::from_millis(300));

        let report = reap_with(
            &blind_probe(),
            ReapParams {
                leader_pid: Some(pid),
                is_leader_exited: false,
                spawn_id: None,
            },
        );

        let deadline = Instant::now() + Duration::from_secs(3);
        while leader.try_wait().expect("poll the leader").is_none() {
            assert!(
                Instant::now() < deadline,
                "the blind cleanup left the group"
            );
            std::thread::sleep(Duration::from_millis(20));
        }
        assert!(!report.is_scanned);
        assert_eq!(unsafe { libc::killpg(pid as libc::pid_t, 0) }, -1);
    }

    #[test]
    fn when_the_process_table_is_unreadable_a_group_leader_that_is_not_our_child_is_left_alone() {
        let _lock = orphan_lock();
        let id = unique_id("not-our-child");
        let pid = orphan_with_own_group(&id, dead_pid(), app_start_for_test());

        let report = reap_with(
            &blind_probe(),
            ReapParams {
                leader_pid: Some(pid),
                is_leader_exited: false,
                spawn_id: None,
            },
        );

        assert!(report.stopped.is_empty());
        assert!(is_running(pid));
        signal_selected(
            &LIVE,
            &Me::current(),
            &[live_selected(pid, None)],
            libc::SIGKILL,
        );
        assert!(is_gone(pid));
    }

    #[test]
    fn an_exited_child_that_is_not_yet_waited_stays_in_the_table() {
        let mut child = std::process::Command::new("/bin/sh")
            .args(["-c", "exit 0"])
            .spawn()
            .expect("spawn a short child");
        let pid = child.id();
        let deadline = Instant::now() + Duration::from_secs(5);
        let mut found = (LIVE.table)().into_iter().find(|row| row.pid == pid);
        while !found.as_ref().is_some_and(|row| row.stat.starts_with('Z')) {
            assert!(Instant::now() < deadline, "no zombie row: {found:?}");
            std::thread::sleep(Duration::from_millis(20));
            found = (LIVE.table)().into_iter().find(|row| row.pid == pid);
        }
        let _ = child.wait();

        assert_eq!(found.expect("row").ppid, std::process::id());
    }
}
