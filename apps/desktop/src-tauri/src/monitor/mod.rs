#![cfg_attr(not(any(target_os = "macos", target_os = "linux")), allow(dead_code))]

mod mask;
mod parse;
pub(crate) mod stop;
pub(crate) mod watched;

use std::collections::{BTreeSet, HashMap};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::proc::ledger::LedgerEntry;

#[cfg(target_os = "macos")]
use std::process::Command;
#[cfg(target_os = "macos")]
use std::time::{Duration, Instant};

#[cfg(target_os = "macos")]
const TOOL_DEADLINE: Duration = Duration::from_secs(2);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Listener {
    pub(crate) port: u16,
    pub(crate) address: String,
    pub(crate) protocol: &'static str,
    pub(crate) pid: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProcessInfo {
    pub(crate) pid: u32,
    pub(crate) ppid: u32,
    pub(crate) pgid: u32,
    pub(crate) name: String,
    pub(crate) cwd: Option<String>,
    pub(crate) started_at: u64,
    pub(crate) cpu_percent: f64,
    pub(crate) rss_bytes: u64,
    pub(crate) uid: u32,
    pub(crate) args_masked: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MonitorSnapshot {
    pub(crate) listeners: Vec<Listener>,
    pub(crate) processes: Vec<ProcessInfo>,
    pub(crate) taken_at: u64,
    #[serde(rename = "isPlatformSupported")]
    pub(crate) platform_supported: bool,
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or(0)
}

struct Scope {
    pids: BTreeSet<u32>,
    pgids: BTreeSet<u32>,
}

fn ledger_scope(ledger: &[LedgerEntry], listeners: &[parse::RawListener]) -> Scope {
    let mut pids: BTreeSet<u32> = listeners.iter().map(|listener| listener.pid).collect();
    let mut pgids = BTreeSet::new();
    for entry in ledger {
        pids.insert(entry.pid);
        if let Some(pgid) = entry.pgid {
            pgids.insert(pgid);
        }
    }
    Scope { pids, pgids }
}

fn is_in_scope(scope: &Scope, row: &parse::RawProcess) -> bool {
    scope.pids.contains(&row.pid) || scope.pgids.contains(&row.pgid)
}

fn assemble(
    rows: Vec<parse::RawProcess>,
    mut cwds: HashMap<u32, String>,
    mut args: HashMap<u32, String>,
    now: u64,
) -> Vec<ProcessInfo> {
    rows.into_iter()
        .map(|row| ProcessInfo {
            pid: row.pid,
            ppid: row.ppid,
            pgid: row.pgid,
            name: row.name,
            cwd: cwds.remove(&row.pid),
            started_at: now.saturating_sub(row.elapsed_secs.saturating_mul(1000)),
            cpu_percent: row.cpu_percent,
            rss_bytes: row.rss_kib.saturating_mul(1024),
            uid: row.uid,
            args_masked: mask::mask_args(&args.remove(&row.pid).unwrap_or_default()),
        })
        .collect()
}

fn csv(pids: impl IntoIterator<Item = u32>) -> String {
    pids.into_iter()
        .map(|pid| pid.to_string())
        .collect::<Vec<_>>()
        .join(",")
}

#[cfg(target_os = "macos")]
fn run_tool(program: &str, args: &[&str]) -> Result<String, String> {
    let mut command = Command::new(program);
    command.args(args);
    let output = crate::proc::probe::run(command, Instant::now() + TOOL_DEADLINE)
        .map_err(|error| format!("{program}: {error}"))?;
    if output.timed_out {
        return Err(format!("{program} timed out"));
    }
    match output.code {
        Some(0 | 1) => Ok(output.stdout),
        _ => Err(format!(
            "{program} failed: {}",
            output.stderr.lines().next().unwrap_or("no output")
        )),
    }
}

#[cfg(target_os = "macos")]
type Details = (HashMap<u32, String>, HashMap<u32, String>);

#[cfg(target_os = "macos")]
fn details(list: &str) -> Result<Details, String> {
    if list.is_empty() {
        return Ok((HashMap::new(), HashMap::new()));
    }
    let cwd_text = run_tool("lsof", &["-a", "-d", "cwd", "-p", list, "-Fn"])?;
    let args_text = run_tool("ps", &["-o", "pid=,args=", "-p", list])?;
    Ok((
        parse::parse_lsof_cwd(&cwd_text).into_iter().collect(),
        parse::parse_ps_args(&args_text).into_iter().collect(),
    ))
}

#[cfg(target_os = "macos")]
fn collect(ledger: &[LedgerEntry]) -> Result<MonitorSnapshot, String> {
    let listeners_text = run_tool("lsof", &["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpn"])?;
    let raw_listeners = parse::parse_lsof_listeners(&listeners_text);
    let scope = ledger_scope(ledger, &raw_listeners);
    let table = run_tool(
        "ps",
        &["-axo", "pid=,ppid=,pgid=,uid=,etime=,%cpu=,rss=,comm="],
    )?;
    let rows: Vec<parse::RawProcess> = parse::parse_ps_rows(&table)
        .into_iter()
        .filter(|row| is_in_scope(&scope, row))
        .collect();
    let list = csv(rows.iter().map(|row| row.pid));
    let (cwds, args) = details(&list)?;
    let now = now_millis();
    let alive: BTreeSet<u32> = rows.iter().map(|row| row.pid).collect();
    Ok(MonitorSnapshot {
        listeners: to_listeners(raw_listeners, &alive),
        processes: assemble(rows, cwds, args, now),
        taken_at: now,
        platform_supported: true,
    })
}

fn to_listeners(raw: Vec<parse::RawListener>, alive: &BTreeSet<u32>) -> Vec<Listener> {
    let mut listeners: Vec<Listener> = raw
        .into_iter()
        .filter(|listener| alive.contains(&listener.pid))
        .map(|listener| Listener {
            port: listener.port,
            address: listener.address,
            protocol: "tcp",
            pid: listener.pid,
        })
        .collect();
    listeners.sort_by(|a, b| a.port.cmp(&b.port).then_with(|| a.pid.cmp(&b.pid)));
    listeners
}

#[cfg(target_os = "linux")]
fn collect(ledger: &[LedgerEntry]) -> Result<MonitorSnapshot, String> {
    let sockets = linux::listening_sockets();
    let inode_owner = linux::inode_owners();
    let raw_listeners: Vec<parse::RawListener> = sockets
        .into_iter()
        .filter_map(|(address, port, inode)| {
            Some(parse::RawListener {
                port,
                address,
                pid: *inode_owner.get(&inode)?,
            })
        })
        .collect();
    let scope = ledger_scope(ledger, &raw_listeners);
    let now = now_millis();
    let mut rows = Vec::new();
    let mut cwds = HashMap::new();
    let mut args = HashMap::new();
    for pid in linux::all_pids() {
        let Some(row) = linux::read_process(pid, now) else {
            continue;
        };
        if !is_in_scope(&scope, &row) {
            continue;
        }
        if let Some(cwd) = linux::read_cwd(pid) {
            cwds.insert(pid, cwd);
        }
        args.insert(pid, linux::read_args(pid));
        rows.push(row);
    }
    let alive: BTreeSet<u32> = rows.iter().map(|row| row.pid).collect();
    Ok(MonitorSnapshot {
        listeners: to_listeners(raw_listeners, &alive),
        processes: assemble(rows, cwds, args, now),
        taken_at: now,
        platform_supported: true,
    })
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn collect(_ledger: &[LedgerEntry]) -> Result<MonitorSnapshot, String> {
    Ok(MonitorSnapshot {
        listeners: Vec::new(),
        processes: Vec::new(),
        taken_at: now_millis(),
        platform_supported: false,
    })
}

#[cfg(target_os = "linux")]
mod linux {
    use std::collections::HashMap;
    use std::fs;

    use super::parse;

    pub(super) fn listening_sockets() -> Vec<(String, u16, u64)> {
        ["/proc/net/tcp", "/proc/net/tcp6"]
            .iter()
            .filter_map(|path| fs::read_to_string(path).ok())
            .flat_map(|text| parse::parse_proc_net_tcp(&text))
            .collect()
    }

    pub(super) fn all_pids() -> Vec<u32> {
        let Ok(entries) = fs::read_dir("/proc") else {
            return Vec::new();
        };
        entries
            .filter_map(|entry| entry.ok()?.file_name().to_str()?.parse().ok())
            .collect()
    }

    pub(super) fn inode_owners() -> HashMap<u64, u32> {
        let mut owners = HashMap::new();
        for pid in all_pids() {
            let Ok(fds) = fs::read_dir(format!("/proc/{pid}/fd")) else {
                continue;
            };
            for fd in fds.flatten() {
                let Ok(target) = fs::read_link(fd.path()) else {
                    continue;
                };
                let text = target.to_string_lossy();
                let Some(inode) = text
                    .strip_prefix("socket:[")
                    .and_then(|rest| rest.strip_suffix(']'))
                    .and_then(|digits| digits.parse::<u64>().ok())
                else {
                    continue;
                };
                owners.entry(inode).or_insert(pid);
            }
        }
        owners
    }

    pub(super) fn read_cwd(pid: u32) -> Option<String> {
        fs::read_link(format!("/proc/{pid}/cwd"))
            .ok()
            .map(|path| path.to_string_lossy().into_owned())
    }

    pub(super) fn read_args(pid: u32) -> String {
        let Ok(raw) = fs::read(format!("/proc/{pid}/cmdline")) else {
            return String::new();
        };
        raw.split(|byte| *byte == 0)
            .filter(|part| !part.is_empty())
            .map(|part| String::from_utf8_lossy(part).into_owned())
            .collect::<Vec<_>>()
            .join(" ")
    }

    fn clock_ticks() -> u64 {
        let value = unsafe { libc::sysconf(libc::_SC_CLK_TCK) };
        u64::try_from(value)
            .ok()
            .filter(|ticks| *ticks > 0)
            .unwrap_or(100)
    }

    fn page_size() -> u64 {
        let value = unsafe { libc::sysconf(libc::_SC_PAGESIZE) };
        u64::try_from(value)
            .ok()
            .filter(|size| *size > 0)
            .unwrap_or(4096)
    }

    fn boot_secs() -> Option<u64> {
        fs::read_to_string("/proc/stat")
            .ok()?
            .lines()
            .find_map(|line| line.strip_prefix("btime ")?.trim().parse().ok())
    }

    pub(super) fn read_process(pid: u32, now_ms: u64) -> Option<parse::RawProcess> {
        let text = fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
        let open = text.find('(')?;
        let close = text.rfind(')')?;
        let name = text.get(open + 1..close)?.to_string();
        let fields: Vec<&str> = text.get(close + 1..)?.split_whitespace().collect();
        let ticks = clock_ticks();
        let cpu_ticks =
            fields.get(11)?.parse::<u64>().ok()? + fields.get(12)?.parse::<u64>().ok()?;
        let start_ticks: u64 = fields.get(19)?.parse().ok()?;
        let rss_pages: u64 = fields.get(21)?.parse().ok()?;
        let started_secs = boot_secs()? + start_ticks / ticks;
        let elapsed_secs = (now_ms / 1000).saturating_sub(started_secs);
        let cpu_percent = (cpu_ticks as f64 / ticks as f64) / elapsed_secs.max(1) as f64 * 100.0;
        let uid = fs::read_to_string(format!("/proc/{pid}/status"))
            .ok()?
            .lines()
            .find_map(|line| {
                line.strip_prefix("Uid:")?
                    .split_whitespace()
                    .next()?
                    .parse()
                    .ok()
            })?;
        Some(parse::RawProcess {
            pid,
            ppid: fields.get(1)?.parse().ok()?,
            pgid: fields.get(2)?.parse().ok()?,
            uid,
            elapsed_secs,
            cpu_percent,
            rss_kib: rss_pages * page_size() / 1024,
            name,
        })
    }
}

pub(crate) fn snapshot() -> Result<MonitorSnapshot, String> {
    collect(&crate::proc::ledger::global().list())
}

#[tauri::command]
pub(crate) async fn monitor_snapshot() -> Result<MonitorSnapshot, String> {
    tauri::async_runtime::spawn_blocking(snapshot)
        .await
        .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use std::net::TcpListener;

    use super::*;

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn finds_a_listener_in_this_process_with_its_pid_and_cwd() {
        let socket = TcpListener::bind("127.0.0.1:0").expect("bind ephemeral");
        let port = socket.local_addr().expect("local addr").port();
        let snapshot = snapshot().expect("snapshot");
        assert!(snapshot.platform_supported);
        let pid = std::process::id();
        let listener = snapshot
            .listeners
            .iter()
            .find(|listener| listener.port == port && listener.pid == pid)
            .expect("listener for the test socket");
        assert_eq!(listener.protocol, "tcp");
        let process = snapshot
            .processes
            .iter()
            .find(|process| process.pid == pid)
            .expect("process row for the test pid");
        let expected = std::env::current_dir()
            .expect("cwd")
            .canonicalize()
            .expect("canonical cwd");
        let actual = std::path::Path::new(process.cwd.as_deref().expect("cwd read"))
            .canonicalize()
            .expect("canonical process cwd");
        assert_eq!(actual, expected);
        assert!(process.rss_bytes > 0);
        drop(socket);
    }

    #[test]
    fn assemble_converts_units_and_masks_args() {
        let rows = vec![parse::RawProcess {
            pid: 5,
            ppid: 1,
            pgid: 5,
            uid: 501,
            elapsed_secs: 10,
            cpu_percent: 1.5,
            rss_kib: 2,
            name: "node".to_string(),
        }];
        let args = HashMap::from([(5, "node --token=abc".to_string())]);
        let out = assemble(rows, HashMap::new(), args, 100_000);
        assert_eq!(out[0].started_at, 90_000);
        assert_eq!(out[0].rss_bytes, 2048);
        assert_eq!(out[0].args_masked, "node --token=***");
        assert_eq!(out[0].cwd, None);
    }

    #[test]
    fn scope_includes_ledger_pids_and_process_groups() {
        let entry = LedgerEntry {
            spawn_id: "s".to_string(),
            kind: "script",
            pid: 10,
            pgid: Some(10),
            session_id: None,
            mount_path: None,
            cwd: None,
            started_at: 0,
        };
        let scope = ledger_scope(&[entry], &[]);
        let row = |pid, pgid| parse::RawProcess {
            pid,
            ppid: 1,
            pgid,
            uid: 0,
            elapsed_secs: 0,
            cpu_percent: 0.0,
            rss_kib: 0,
            name: "x".to_string(),
        };
        assert!(is_in_scope(&scope, &row(10, 10)));
        assert!(is_in_scope(&scope, &row(11, 10)));
        assert!(!is_in_scope(&scope, &row(12, 12)));
    }
}
