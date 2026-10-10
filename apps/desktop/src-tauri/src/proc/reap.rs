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

#[cfg(unix)]
pub(crate) use unix::{reap, sweep_orphans};

#[cfg(unix)]
pub(crate) mod unix {
    use std::collections::{BTreeMap, HashMap, HashSet};
    use std::process::Command;
    use std::time::{Duration, Instant};

    use super::{ReapParams, ReapReport, StoppedProcess};
    use crate::aux_spawn::{SpawnKind, APP_PID_ENV, SPAWN_ID_ENV, SPAWN_KIND_ENV};

    const TERM_GRACE: Duration = Duration::from_millis(300);
    const KILL_GRACE: Duration = Duration::from_millis(200);
    const POLL_INTERVAL: Duration = Duration::from_millis(25);
    const SHELL_NAMES: [&str; 6] = ["sh", "bash", "zsh", "fish", "dash", "env"];

    #[derive(Debug, Clone, PartialEq, Eq)]
    pub(crate) struct ProcRow {
        pub(crate) pid: u32,
        pub(crate) ppid: u32,
        pub(crate) pgid: u32,
        pub(crate) uid: u32,
        pub(crate) stat: String,
        pub(crate) name: String,
    }

    #[derive(Debug, Clone, PartialEq, Eq)]
    pub(crate) struct TagInfo {
        pub(crate) spawn_id: String,
        pub(crate) kind: String,
        pub(crate) app_pid: u32,
    }

    #[derive(Debug, Clone, Copy)]
    pub(crate) struct Me {
        pub(crate) pid: u32,
        pub(crate) uid: u32,
        pub(crate) pgid: u32,
    }

    impl Me {
        pub(crate) fn current() -> Self {
            Self {
                pid: std::process::id(),
                uid: unsafe { libc::geteuid() },
                pgid: unsafe { libc::getpgrp() } as u32,
            }
        }
    }

    #[derive(Debug, Default)]
    pub(crate) struct Selection {
        pub(crate) targets: Vec<ProcRow>,
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
        })
    }

    pub(crate) fn tag_from_tokens<'a>(tokens: impl Iterator<Item = &'a str>) -> Option<TagInfo> {
        let id_prefix = format!("{SPAWN_ID_ENV}=");
        let kind_prefix = format!("{SPAWN_KIND_ENV}=");
        let app_prefix = format!("{APP_PID_ENV}=");
        let mut spawn_id: Option<String> = None;
        let mut kind: Option<String> = None;
        let mut app_pid: Option<u32> = None;
        for token in tokens {
            if let Some(value) = token.strip_prefix(id_prefix.as_str()) {
                spawn_id = Some(value.to_string());
            }
            if let Some(value) = token.strip_prefix(kind_prefix.as_str()) {
                kind = Some(value.to_string());
            }
            if let Some(value) = token.strip_prefix(app_prefix.as_str()) {
                app_pid = value.parse().ok();
            }
        }
        let spawn_id = spawn_id.filter(|value| !value.is_empty())?;
        Some(TagInfo {
            spawn_id,
            kind: kind?,
            app_pid: app_pid?,
        })
    }

    fn snapshot_table() -> Vec<ProcRow> {
        let Ok(output) = Command::new("/bin/ps")
            .args(["-A", "-o", "pid=,ppid=,pgid=,uid=,stat=,comm="])
            .output()
        else {
            return Vec::new();
        };
        parse_table(&String::from_utf8_lossy(&output.stdout))
    }

    #[cfg(target_os = "linux")]
    pub(crate) fn scan_tagged(_uid: u32) -> Vec<(u32, TagInfo)> {
        let Ok(entries) = std::fs::read_dir("/proc") else {
            return Vec::new();
        };
        entries
            .flatten()
            .filter_map(|entry| {
                let pid: u32 = entry.file_name().to_str()?.parse().ok()?;
                let raw = std::fs::read(entry.path().join("environ")).ok()?;
                let text = String::from_utf8_lossy(&raw).into_owned();
                let tag = tag_from_tokens(text.split('\0'))?;
                Some((pid, tag))
            })
            .collect()
    }

    #[cfg(not(target_os = "linux"))]
    pub(crate) fn scan_tagged(uid: u32) -> Vec<(u32, TagInfo)> {
        let Ok(output) = Command::new("/bin/ps")
            .args(["-E", "-ww", "-U", &uid.to_string(), "-o", "pid=,command="])
            .output()
        else {
            return Vec::new();
        };
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|line| {
                let mut tokens = line.split_whitespace();
                let pid: u32 = tokens.next()?.parse().ok()?;
                let tag = tag_from_tokens(tokens)?;
                Some((pid, tag))
            })
            .collect()
    }

    fn is_signalable(row: &ProcRow, me: &Me) -> bool {
        row.pid > 1 && row.pid != me.pid && row.uid == me.uid
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
        let mut chosen: BTreeMap<u32, &ProcRow> = BTreeMap::new();
        let mut group: Option<u32> = None;
        let held = params
            .leader_pid
            .and_then(|pid| table.iter().find(|row| row.pid == pid))
            .filter(|row| row.ppid == me.pid);
        if let Some(leader) = held {
            chosen.insert(leader.pid, leader);
            for row in descendants(table, leader.pid) {
                chosen.insert(row.pid, row);
            }
            if leader.pgid == leader.pid && leader.pgid != me.pgid {
                group = Some(leader.pid);
                for row in table.iter().filter(|row| row.pgid == leader.pid) {
                    chosen.insert(row.pid, row);
                }
            }
        }
        if let Some(spawn_id) = params.spawn_id {
            for (pid, tag) in tagged {
                if tag.spawn_id != spawn_id || tag.app_pid != me.pid {
                    continue;
                }
                if let Some(row) = table.iter().find(|row| row.pid == *pid) {
                    chosen.insert(row.pid, row);
                }
            }
        }
        let targets: Vec<ProcRow> = chosen
            .into_values()
            .filter(|row| is_signalable(row, me))
            .cloned()
            .collect();
        Selection { targets, group }
    }

    pub(crate) fn orphan_pids(
        table: &[ProcRow],
        tagged: &[(u32, TagInfo)],
        me: &Me,
        is_app_alive: impl Fn(u32) -> bool,
    ) -> Vec<u32> {
        let rows: HashMap<u32, &ProcRow> = table.iter().map(|row| (row.pid, row)).collect();
        let mut candidates: HashSet<u32> = tagged
            .iter()
            .filter(|(pid, tag)| {
                let Some(kind) = SpawnKind::parse(&tag.kind) else {
                    return false;
                };
                let Some(row) = rows.get(pid) else {
                    return false;
                };
                kind.is_swept_at_startup()
                    && tag.app_pid != me.pid
                    && !is_app_alive(tag.app_pid)
                    && is_signalable(row, me)
            })
            .map(|(pid, _)| *pid)
            .collect();
        let mut orphans: HashSet<u32> = candidates
            .iter()
            .copied()
            .filter(|pid| rows.get(pid).is_some_and(|row| row.ppid == 1))
            .collect();
        loop {
            let adopted: Vec<u32> = candidates
                .iter()
                .copied()
                .filter(|pid| !orphans.contains(pid))
                .filter(|pid| rows.get(pid).is_some_and(|row| orphans.contains(&row.ppid)))
                .collect();
            if adopted.is_empty() {
                break;
            }
            orphans.extend(adopted);
        }
        candidates.retain(|pid| orphans.contains(pid));
        let mut pids: Vec<u32> = candidates.into_iter().collect();
        pids.sort_unstable();
        pids
    }

    fn signal(pid: u32, signal: libc::c_int) {
        unsafe { libc::kill(pid as libc::pid_t, signal) };
    }

    fn signal_group(group: u32, signal: libc::c_int) {
        unsafe { libc::killpg(group as libc::pid_t, signal) };
    }

    fn is_present(pid: u32, is_child: bool) -> bool {
        if is_child {
            let mut status: libc::c_int = 0;
            let reaped = unsafe { libc::waitpid(pid as libc::pid_t, &mut status, libc::WNOHANG) };
            if reaped == pid as libc::pid_t {
                return false;
            }
        }
        unsafe { libc::kill(pid as libc::pid_t, 0) == 0 }
    }

    fn wait_until_gone(pids: &[u32], children: &HashSet<u32>, budget: Duration) -> Vec<u32> {
        let deadline = Instant::now() + budget;
        let mut survivors: Vec<u32> = pids.to_vec();
        loop {
            survivors.retain(|pid| is_present(*pid, children.contains(pid)));
            if survivors.is_empty() || Instant::now() >= deadline {
                return survivors;
            }
            std::thread::sleep(POLL_INTERVAL);
        }
    }

    fn is_shell(name: &str) -> bool {
        SHELL_NAMES.contains(&name.trim_start_matches('-'))
    }

    fn describe(rows: &[&ProcRow]) -> Vec<StoppedProcess> {
        let mut stopped: Vec<StoppedProcess> = rows
            .iter()
            .map(|row| StoppedProcess {
                pid: row.pid,
                name: row.name.clone(),
                port: None,
            })
            .collect();
        stopped.sort_by_key(|process| (is_shell(&process.name), process.pid));
        stopped
    }

    pub(crate) fn reap(params: ReapParams<'_>) -> ReapReport {
        let table = snapshot_table();
        if table.is_empty() {
            return ReapReport::default();
        }
        let me = Me::current();
        let tagged = match params.spawn_id {
            Some(_) => scan_tagged(me.uid),
            None => Vec::new(),
        };
        let selection = select_targets(&table, &tagged, &params, &me);
        let leader = params.leader_pid;
        let alive_rows: Vec<&ProcRow> = selection
            .targets
            .iter()
            .filter(|row| Some(row.pid) != leader)
            .filter(|row| !row.stat.starts_with('Z'))
            .collect();
        let report = ReapReport {
            stopped: describe(&alive_rows),
            is_scanned: true,
        };
        let signalled: Vec<u32> = selection
            .targets
            .iter()
            .map(|row| row.pid)
            .filter(|pid| !(params.is_leader_exited && Some(*pid) == leader))
            .collect();
        if signalled.is_empty() && selection.group.is_none() {
            return report;
        }
        let children: HashSet<u32> = selection
            .targets
            .iter()
            .filter(|row| row.ppid == me.pid && Some(row.pid) != leader)
            .map(|row| row.pid)
            .collect();
        let watched: Vec<u32> = signalled
            .iter()
            .copied()
            .filter(|pid| Some(*pid) != leader || !params.is_leader_exited)
            .collect();
        if let Some(group) = selection.group {
            signal_group(group, libc::SIGTERM);
        }
        for pid in &signalled {
            signal(*pid, libc::SIGTERM);
        }
        let survivors = wait_until_gone(&watched, &children, TERM_GRACE);
        if survivors.is_empty() {
            return report;
        }
        if let Some(group) = selection.group {
            signal_group(group, libc::SIGKILL);
        }
        for pid in &survivors {
            signal(*pid, libc::SIGKILL);
        }
        wait_until_gone(&survivors, &children, KILL_GRACE);
        report
    }

    pub(crate) fn sweep_orphans() -> usize {
        let table = snapshot_table();
        if table.is_empty() {
            return 0;
        }
        let me = Me::current();
        let tagged = scan_tagged(me.uid);
        let pids = orphan_pids(&table, &tagged, &me, |pid| {
            let result = unsafe { libc::kill(pid as libc::pid_t, 0) };
            result == 0 || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
        });
        if pids.is_empty() {
            return 0;
        }
        for pid in &pids {
            signal(*pid, libc::SIGTERM);
        }
        let survivors = wait_until_gone(&pids, &HashSet::new(), TERM_GRACE);
        for pid in &survivors {
            signal(*pid, libc::SIGKILL);
        }
        wait_until_gone(&survivors, &HashSet::new(), KILL_GRACE);
        pids.len()
    }

    #[cfg(test)]
    pub(crate) mod test_support {
        use std::process::{Child, Command, Stdio};
        use std::sync::OnceLock;
        use std::time::{Duration, Instant};

        pub(crate) const HELPER_FLAG: &str = "GOODBOY_REAP_HELPER";
        pub(crate) const HELPER_EXE: &str = "GOODBOY_REAP_HELPER_EXE";
        pub(crate) const HELPER_TEST_ENV: &str = "GOODBOY_REAP_HELPER_TEST";
        pub(crate) const HELPER_TEST: &str = "proc::reap::unix::test_support::helper_sleeps";

        static EXE_PUBLISHED: OnceLock<()> = OnceLock::new();

        #[test]
        fn helper_sleeps() {
            if std::env::var_os(HELPER_FLAG).is_none() {
                return;
            }
            std::thread::sleep(Duration::from_secs(90));
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

        pub(crate) fn wait_until_visible(child: &Child, spawn_id: &str) {
            let me = super::Me::current();
            let deadline = Instant::now() + Duration::from_secs(10);
            loop {
                let seen = super::scan_tagged(me.uid)
                    .iter()
                    .any(|(pid, tag)| *pid == child.id() && tag.spawn_id == spawn_id);
                if seen {
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
    use std::process::Child;
    use std::time::Duration;

    use super::unix::test_support::{helper_command, is_gone, is_running, wait_until_visible};
    use super::unix::{
        orphan_pids, parse_table, select_targets, tag_from_tokens, Me, ProcRow, TagInfo,
    };
    use super::*;
    use crate::aux_spawn::{APP_PID_ENV, SPAWN_ID_ENV, SPAWN_KIND_ENV};

    fn row(pid: u32, ppid: u32, pgid: u32, uid: u32, name: &str) -> ProcRow {
        ProcRow {
            pid,
            ppid,
            pgid,
            uid,
            stat: "S".to_string(),
            name: name.to_string(),
        }
    }

    fn tag(spawn_id: &str, kind: &str, app_pid: u32) -> TagInfo {
        TagInfo {
            spawn_id: spawn_id.to_string(),
            kind: kind.to_string(),
            app_pid,
        }
    }

    fn me() -> Me {
        Me {
            pid: 100,
            uid: 501,
            pgid: 90,
        }
    }

    fn params(leader: Option<u32>, spawn_id: Option<&str>) -> ReapParams<'_> {
        ReapParams {
            leader_pid: leader,
            is_leader_exited: false,
            spawn_id,
        }
    }

    fn pids_of(targets: &[ProcRow]) -> Vec<u32> {
        targets.iter().map(|row| row.pid).collect()
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
    fn a_tag_needs_all_three_values() {
        let id = format!("{SPAWN_ID_ENV}=abc");
        let kind = format!("{SPAWN_KIND_ENV}=turn");
        let app = format!("{APP_PID_ENV}=77");
        let all = [id.as_str(), "PATH=/bin", kind.as_str(), app.as_str()];
        assert_eq!(
            tag_from_tokens(all.into_iter()),
            Some(tag("abc", "turn", 77))
        );
        assert_eq!(
            tag_from_tokens([id.as_str(), kind.as_str()].into_iter()),
            None
        );
        assert_eq!(tag_from_tokens(["PATH=/bin"].into_iter()), None);
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

        let pids = orphan_pids(&table, &tagged, &me(), |app| app == 9100);

        assert_eq!(pids, vec![700, 701]);
    }

    fn spawn_tagged_helper(spawn_id: &str, app_pid: u32, kind: &str) -> Child {
        let mut command = helper_command();
        command
            .env(SPAWN_ID_ENV, spawn_id)
            .env(SPAWN_KIND_ENV, kind)
            .env(APP_PID_ENV, app_pid.to_string());
        let child = command.spawn().expect("spawn the helper");
        wait_until_visible(&child, spawn_id);
        child
    }

    fn unique_id(label: &str) -> String {
        format!("reap-test-{label}-{}", std::process::id())
    }

    #[test]
    fn reap_stops_a_process_that_carries_this_spawn_and_this_app() {
        let id = unique_id("own");
        let mut child = spawn_tagged_helper(&id, std::process::id(), "turn");
        let pid = child.id();

        let report = reap(ReapParams {
            leader_pid: None,
            is_leader_exited: false,
            spawn_id: Some(&id),
        });

        let _ = child.wait();
        assert!(report.is_scanned);
        assert!(report.stopped.iter().any(|process| process.pid == pid));
        assert!(is_gone(pid));
    }

    #[test]
    fn reap_leaves_a_process_without_the_tag_alone() {
        let id = unique_id("untagged");
        let mut stranger = helper_command().spawn().expect("spawn the stranger");
        let stranger_pid = stranger.id();
        let mut own = spawn_tagged_helper(&id, std::process::id(), "turn");

        reap(ReapParams {
            leader_pid: None,
            is_leader_exited: false,
            spawn_id: Some(&id),
        });

        let _ = own.wait();
        assert!(is_running(stranger_pid));
        let _ = stranger.kill();
        let _ = stranger.wait();
    }

    #[test]
    fn reap_leaves_a_tag_with_another_app_pid_alone_while_its_parent_lives() {
        let id = unique_id("foreign");
        let mut foreign = spawn_tagged_helper(&id, std::process::id() + 1_000_000, "turn");
        let pid = foreign.id();

        reap(ReapParams {
            leader_pid: None,
            is_leader_exited: false,
            spawn_id: Some(&id),
        });

        assert!(is_running(pid));
        let _ = foreign.kill();
        let _ = foreign.wait();
    }

    #[test]
    fn reap_leaves_a_tag_with_another_spawn_id_alone() {
        let mine = unique_id("mine");
        let theirs = unique_id("theirs");
        let mut other = spawn_tagged_helper(&theirs, std::process::id(), "turn");
        let pid = other.id();

        let report = reap(ReapParams {
            leader_pid: None,
            is_leader_exited: false,
            spawn_id: Some(&mine),
        });

        assert!(report.stopped.is_empty());
        assert!(is_running(pid));
        let _ = other.kill();
        let _ = other.wait();
    }

    #[test]
    fn the_sweep_reaps_a_tagged_orphan_of_a_dead_app() {
        let id = unique_id("orphan");
        let dead_app = dead_pid();
        let mut launcher = std::process::Command::new("/bin/sh");
        let exe = std::env::current_exe().expect("test executable");
        launcher
            .arg("-c")
            .arg(r#"("$0" --exact "$1" --nocapture --test-threads=1 >/dev/null 2>&1 </dev/null &) ; exit 0"#)
            .arg(&exe)
            .arg(super::unix::test_support::HELPER_TEST)
            .env(super::unix::test_support::HELPER_FLAG, "1")
            .env(SPAWN_ID_ENV, &id)
            .env(SPAWN_KIND_ENV, "turn")
            .env(APP_PID_ENV, dead_app.to_string());
        launcher.status().expect("launch the orphan");
        let pid = wait_for_tagged_pid(&id);
        assert!(is_running(pid));

        let swept = sweep_orphans();

        assert!(swept >= 1);
        assert!(is_gone(pid));
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

    fn wait_for_tagged_pid(spawn_id: &str) -> u32 {
        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        loop {
            let found = super::unix::scan_tagged(unsafe { libc::geteuid() })
                .into_iter()
                .find(|(_, tag)| tag.spawn_id == spawn_id);
            if let Some((pid, _)) = found {
                return pid;
            }
            assert!(
                std::time::Instant::now() < deadline,
                "the orphan never appeared"
            );
            std::thread::sleep(Duration::from_millis(50));
        }
    }
}
