use std::collections::HashMap;
use std::time::{Duration, Instant};

use serde::Serialize;

const EXIT_WAIT: Duration = Duration::from_secs(3);
const POLL_INTERVAL: Duration = Duration::from_millis(50);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum Outcome {
    Stopped,
    StillRunning,
    Refused,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct StopResult {
    pub(crate) outcome: Outcome,
    pub(crate) reason: Option<String>,
}

impl StopResult {
    fn refused(reason: &str) -> Self {
        Self {
            outcome: Outcome::Refused,
            reason: Some(reason.to_string()),
        }
    }

    fn stopped() -> Self {
        Self {
            outcome: Outcome::Stopped,
            reason: None,
        }
    }

    fn still_running(reason: &str) -> Self {
        Self {
            outcome: Outcome::StillRunning,
            reason: Some(reason.to_string()),
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct Context {
    pub(crate) app_pid: u32,
    pub(crate) app_uid: u32,
    pub(crate) ancestors: Vec<u32>,
    pub(crate) known: HashMap<u32, u32>,
}

pub(crate) fn refusal(context: &Context, pid: u32) -> Option<&'static str> {
    if pid <= 1 {
        return Some("This process is required by the system.");
    }
    if pid == context.app_pid {
        return Some("This is Goodboy itself.");
    }
    if context.ancestors.contains(&pid) {
        return Some("This process started Goodboy.");
    }
    let Some(uid) = context.known.get(&pid) else {
        return Some("Goodboy does not see this process anymore.");
    };
    if *uid != context.app_uid {
        return Some("This process belongs to another user.");
    }
    None
}

pub(crate) fn stop_pid(context: &Context, pid: u32, force: bool) -> StopResult {
    if let Some(reason) = refusal(context, pid) {
        return StopResult::refused(reason);
    }
    stop_pid_within(pid, force, EXIT_WAIT)
}

fn stop_pid_within(pid: u32, force: bool, wait: Duration) -> StopResult {
    if !platform::is_alive(pid) {
        return StopResult::stopped();
    }
    if let Err(reason) = platform::signal(pid, force) {
        return StopResult::refused(&reason);
    }
    let deadline = Instant::now() + wait;
    while Instant::now() < deadline {
        if !platform::is_alive(pid) {
            return StopResult::stopped();
        }
        std::thread::sleep(POLL_INTERVAL);
    }
    if platform::is_alive(pid) {
        return StopResult::still_running("The process did not exit in time.");
    }
    StopResult::stopped()
}

#[cfg(unix)]
mod platform {
    use crate::proc::kernel;

    pub(super) fn is_alive(pid: u32) -> bool {
        let reachable = unsafe { libc::kill(pid as libc::pid_t, 0) } == 0
            || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM);
        if !reachable {
            return false;
        }
        !kernel::identity(pid).is_some_and(|identity| identity.is_zombie)
    }

    pub(super) fn signal(pid: u32, force: bool) -> Result<(), String> {
        let mut signal = libc::SIGTERM;
        if force {
            signal = libc::SIGKILL;
        }
        if unsafe { libc::kill(pid as libc::pid_t, signal) } == 0 {
            return Ok(());
        }
        let error = std::io::Error::last_os_error();
        if error.raw_os_error() == Some(libc::ESRCH) {
            return Ok(());
        }
        Err(format!("Could not signal the process: {error}"))
    }

    pub(super) fn current_uid() -> u32 {
        unsafe { libc::geteuid() }
    }

    pub(super) fn ancestors() -> Vec<u32> {
        let mut chain = Vec::new();
        let mut pid = std::process::id();
        while let Some(identity) = kernel::identity(pid) {
            let parent = identity.ppid;
            if parent <= 1 || chain.contains(&parent) {
                break;
            }
            chain.push(parent);
            pid = parent;
        }
        chain
    }
}

#[cfg(windows)]
mod platform {
    use windows_sys::Win32::Foundation::{CloseHandle, WAIT_TIMEOUT};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, TerminateProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE, PROCESS_TERMINATE,
    };

    pub(super) fn is_alive(pid: u32) -> bool {
        let handle = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, 0, pid) };
        if handle.is_null() {
            return false;
        }
        let waited = unsafe { WaitForSingleObject(handle, 0) };
        unsafe { CloseHandle(handle) };
        waited == WAIT_TIMEOUT
    }

    pub(super) fn signal(pid: u32, _force: bool) -> Result<(), String> {
        let handle = unsafe { OpenProcess(PROCESS_TERMINATE, 0, pid) };
        if handle.is_null() {
            return Err("Could not open the process.".to_string());
        }
        let ended = unsafe { TerminateProcess(handle, 1) };
        unsafe { CloseHandle(handle) };
        if ended == 0 {
            return Err("Could not terminate the process.".to_string());
        }
        Ok(())
    }

    pub(super) fn current_uid() -> u32 {
        0
    }

    pub(super) fn ancestors() -> Vec<u32> {
        Vec::new()
    }
}

pub(crate) fn context_from(snapshot: &super::MonitorSnapshot) -> Context {
    Context {
        app_pid: std::process::id(),
        app_uid: platform::current_uid(),
        ancestors: platform::ancestors(),
        known: snapshot
            .processes
            .iter()
            .map(|process| (process.pid, process.uid))
            .collect(),
    }
}

#[tauri::command]
pub(crate) async fn monitor_stop(pid: u32, force: bool) -> Result<StopResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let snapshot = super::snapshot()?;
        Ok(stop_pid(&context_from(&snapshot), pid, force))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(all(test, unix))]
mod tests {
    use std::os::unix::process::CommandExt;
    use std::process::{Child, Command, Stdio};

    use super::*;

    fn context(known: &[(u32, u32)]) -> Context {
        Context {
            app_pid: std::process::id(),
            app_uid: platform::current_uid(),
            ancestors: platform::ancestors(),
            known: known.iter().copied().collect(),
        }
    }

    fn reaped(mut child: Child) -> u32 {
        let pid = child.id();
        std::thread::spawn(move || {
            let _ = child.wait();
        });
        pid
    }

    fn assert_refused(result: &StopResult) {
        assert_eq!(result.outcome, Outcome::Refused, "{result:?}");
    }

    #[test]
    fn refuses_pid_one() {
        let context = context(&[(1, platform::current_uid())]);
        assert_refused(&stop_pid(&context, 1, true));
    }

    #[test]
    fn refuses_its_own_pid() {
        let me = std::process::id();
        let context = context(&[(me, platform::current_uid())]);
        assert_refused(&stop_pid(&context, me, true));
    }

    #[test]
    fn refuses_its_parent() {
        let parent = std::os::unix::process::parent_id();
        let context = context(&[(parent, platform::current_uid())]);
        assert_refused(&stop_pid(&context, parent, true));
    }

    #[test]
    fn refuses_a_foreign_uid() {
        let child = Command::new("sleep")
            .arg("60")
            .spawn()
            .expect("spawn sleep");
        let pid = child.id();
        let foreign = platform::current_uid().wrapping_add(1);
        let context = context(&[(pid, foreign)]);
        let result = stop_pid(&context, pid, true);
        assert_refused(&result);
        assert!(platform::is_alive(pid));
        let reaped_pid = reaped(child);
        platform::signal(reaped_pid, true).expect("cleanup");
    }

    #[test]
    fn refuses_an_unknown_pid() {
        let child = Command::new("sleep")
            .arg("60")
            .spawn()
            .expect("spawn sleep");
        let pid = child.id();
        let result = stop_pid(&context(&[]), pid, true);
        assert_refused(&result);
        assert!(platform::is_alive(pid));
        let reaped_pid = reaped(child);
        platform::signal(reaped_pid, true).expect("cleanup");
    }

    #[test]
    fn stops_a_sleep_with_sigterm() {
        let child = Command::new("sleep")
            .arg("60")
            .spawn()
            .expect("spawn sleep");
        let pid = reaped(child);
        let context = context(&[(pid, platform::current_uid())]);
        let result = stop_pid(&context, pid, false);
        assert_eq!(result.outcome, Outcome::Stopped, "{result:?}");
        assert!(!platform::is_alive(pid));
    }

    #[test]
    fn force_stops_a_child_that_traps_sigterm() {
        let child = Command::new("sh")
            .args(["-c", "trap '' TERM; while :; do sleep 1; done"])
            .stdout(Stdio::null())
            .process_group(0)
            .spawn()
            .expect("spawn trapper");
        let pid = reaped(child);
        std::thread::sleep(Duration::from_millis(300));
        let context = context(&[(pid, platform::current_uid())]);
        let soft = stop_pid_within(pid, false, Duration::from_millis(400));
        assert_eq!(soft.outcome, Outcome::StillRunning, "{soft:?}");
        let hard = stop_pid(&context, pid, true);
        assert_eq!(hard.outcome, Outcome::Stopped, "{hard:?}");
        assert!(!platform::is_alive(pid));
    }
}
