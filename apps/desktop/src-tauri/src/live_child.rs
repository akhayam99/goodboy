use std::collections::HashMap;
use std::io::Read;
use std::process::Child;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{channel, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::proc::reap::{reap, ReapParams, StoppedProcess};

pub const SIDE_JOB_DEADLINE: Duration = Duration::from_secs(10 * 60);

pub type ChildSlot = Arc<Mutex<Option<Child>>>;

#[derive(Clone)]
pub struct LiveChild {
    pub pid: u32,
    pub slot: ChildSlot,
    pub spawn_id: Option<String>,
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Exited {
    pub code: Option<i32>,
    pub stopped: Vec<StoppedProcess>,
}

pub type LiveChildRegistry = Arc<Mutex<HashMap<String, LiveChild>>>;

static ANONYMOUS_KEYS: AtomicU64 = AtomicU64::new(0);

impl LiveChild {
    pub fn new(child: Child) -> Self {
        Self {
            pid: child.id(),
            slot: Arc::new(Mutex::new(Some(child))),
            spawn_id: None,
        }
    }

    pub fn tagged(child: Child, tag: &crate::aux_spawn::SpawnTag) -> Self {
        Self {
            spawn_id: Some(tag.id.clone()),
            ..Self::new(child)
        }
    }

    pub fn kill(&self) {
        let live = self.clone();
        std::thread::spawn(move || live.terminate_tree());
        self.kill_leader_fallback();
    }

    fn terminate_now(&self) {
        self.terminate_tree();
        self.kill_leader_fallback();
    }

    fn terminate_tree(&self) {
        let report = reap(ReapParams {
            leader_pid: Some(self.pid),
            is_leader_exited: false,
            spawn_id: self.spawn_id.as_deref(),
        });
        if report.is_scanned {
            return;
        }
        crate::process_group::terminate(self.pid);
    }

    #[cfg(unix)]
    fn kill_leader_fallback(&self) {}

    #[cfg(not(unix))]
    fn kill_leader_fallback(&self) {
        if let Ok(mut guard) = self.slot.try_lock() {
            if let Some(child) = guard.as_mut() {
                crate::logging::note_kill_failure("live child kill", child.kill());
            }
        }
    }
}

pub fn anonymous_key(prefix: &str) -> String {
    let next = ANONYMOUS_KEYS.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{next}")
}

pub fn register(registry: &LiveChildRegistry, key: &str, live: &LiveChild) {
    if let Ok(mut map) = registry.lock() {
        map.insert(key.to_string(), live.clone());
    }
}

pub fn kill_one(registry: &LiveChildRegistry, key: &str) -> bool {
    let live = match registry.lock() {
        Ok(map) => map.get(key).cloned(),
        Err(_) => return false,
    };
    let Some(live) = live else {
        return false;
    };
    live.kill();
    true
}

pub fn shutdown(registry: &LiveChildRegistry) {
    let drained: Vec<LiveChild> = match registry.lock() {
        Ok(mut map) => map.drain().map(|(_, live)| live).collect(),
        Err(_) => return,
    };
    std::thread::scope(|scope| {
        for live in &drained {
            scope.spawn(move || live.terminate_now());
        }
    });
}

#[cfg(unix)]
fn hold_until_exited(pid: u32) {
    loop {
        let mut info: libc::siginfo_t = unsafe { std::mem::zeroed() };
        let result = unsafe {
            libc::waitid(
                libc::P_PID,
                pid as libc::id_t,
                &mut info,
                libc::WEXITED | libc::WNOWAIT,
            )
        };
        if result == 0 {
            return;
        }
        if std::io::Error::last_os_error().kind() != std::io::ErrorKind::Interrupted {
            return;
        }
    }
}

#[cfg(not(unix))]
fn hold_until_exited(_pid: u32) {}

pub fn wait_and_remove(live: &LiveChild, registry: &LiveChildRegistry, key: &str) -> Exited {
    let exited = wait_and_reap(live);
    if let Ok(mut map) = registry.lock() {
        map.remove(key);
    }
    exited
}

fn wait_and_reap(live: &LiveChild) -> Exited {
    let Ok(mut guard) = live.slot.lock() else {
        return Exited::default();
    };
    let Some(child) = guard.as_mut() else {
        return Exited::default();
    };
    hold_until_exited(child.id());
    let report = reap(ReapParams {
        leader_pid: Some(child.id()),
        is_leader_exited: true,
        spawn_id: live.spawn_id.as_deref(),
    });
    if !report.stopped.is_empty() {
        log::info!(
            "[reap] pid {}: stopped {} processes the run left running",
            live.pid,
            report.stopped.len()
        );
    }
    Exited {
        code: child.wait().ok().and_then(|status| status.code()),
        stopped: report.stopped,
    }
}

pub fn wait_with_deadline(
    live: &LiveChild,
    registry: &LiveChildRegistry,
    key: &str,
    deadline: Option<Duration>,
) -> Exited {
    let Some(deadline) = deadline else {
        return wait_and_remove(live, registry, key);
    };
    let (finished, watch) = channel::<()>();
    std::thread::scope(|scope| {
        scope.spawn(move || {
            if watch.recv_timeout(deadline) == Err(RecvTimeoutError::Timeout) {
                log::warn!("[reap] a side job outlived its deadline, stopping it");
                live.kill();
            }
        });
        let exited = wait_and_remove(live, registry, key);
        drop(finished);
        exited
    })
}

pub fn run_to_exit<R>(
    live: &LiveChild,
    registry: &LiveChildRegistry,
    key: &str,
    deadline: Option<Duration>,
    pump: impl FnOnce() -> R,
) -> (R, Exited) {
    std::thread::scope(|scope| {
        let waiter = scope.spawn(|| wait_with_deadline(live, registry, key, deadline));
        let pumped = pump();
        let exited = waiter
            .join()
            .unwrap_or_else(|panic| std::panic::resume_unwind(panic));
        (pumped, exited)
    })
}

pub fn drain_lossy<R: Read>(mut source: R) -> String {
    let mut buf = Vec::new();
    let _ = source.read_to_end(&mut buf);
    String::from_utf8_lossy(&buf).into_owned()
}

pub const MAX_STDERR_BYTES: usize = 256 * 1024;

pub fn drain_tail_lossy<R: Read>(mut source: R, max_bytes: usize) -> String {
    let mut tail: Vec<u8> = Vec::new();
    let mut chunk = [0u8; 8192];
    loop {
        match source.read(&mut chunk) {
            Ok(0) => break,
            Ok(read) => {
                tail.extend_from_slice(&chunk[..read]);
                if tail.len() > max_bytes {
                    let excess = tail.len() - max_bytes;
                    tail.drain(..excess);
                }
            }
            Err(err) if err.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(_) => break,
        }
    }
    String::from_utf8_lossy(&tail).into_owned()
}

#[cfg(test)]
pub mod test_support {
    use super::*;
    use std::time::{Duration, Instant};

    pub fn register_sleeping(registry: &LiveChildRegistry, key: &str) -> LiveChild {
        let child = std::process::Command::new("sleep")
            .arg("30")
            .spawn()
            .expect("spawn sleep");
        let live = LiveChild::new(child);
        register(registry, key, &live);
        live
    }

    pub fn assert_waiter_returns(
        waiter: std::thread::JoinHandle<Option<i32>>,
        budget: Duration,
        message: &str,
    ) {
        let deadline = Instant::now() + budget;
        while !waiter.is_finished() {
            assert!(Instant::now() < deadline, "{message}");
            std::thread::sleep(Duration::from_millis(20));
        }
        let _ = waiter.join();
    }

    pub fn spawn_waiter(
        registry: &LiveChildRegistry,
        key: &str,
        live: &LiveChild,
    ) -> std::thread::JoinHandle<Option<i32>> {
        let registry = Arc::clone(registry);
        let key = key.to_string();
        let live = live.clone();
        let waiter = std::thread::spawn(move || wait_and_remove(&live, &registry, &key).code);
        std::thread::sleep(Duration::from_millis(50));
        waiter
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::test_support::*;
    use super::*;
    use std::time::Duration;

    #[test]
    fn kill_reaches_a_child_whose_slot_is_held_by_its_waiter() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let live = register_sleeping(&registry, "run-1");
        let waiter = spawn_waiter(&registry, "run-1", &live);

        assert!(kill_one(&registry, "run-1"));

        assert_waiter_returns(
            waiter,
            Duration::from_secs(2),
            "kill left the child running",
        );
        assert!(registry.lock().expect("registry").is_empty());
    }

    #[test]
    fn kill_for_an_unknown_key_is_a_no_op() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        assert!(!kill_one(&registry, "missing"));
    }

    #[test]
    fn drain_tail_keeps_the_last_bytes() {
        let source: &[u8] = b"0123456789";
        assert_eq!(drain_tail_lossy(source, 4), "6789");
    }

    #[test]
    fn drain_tail_survives_invalid_utf8() {
        let source: &[u8] = b"ok \xff\xfe done";
        assert_eq!(drain_tail_lossy(source, 64), "ok \u{fffd}\u{fffd} done");
    }

    #[test]
    fn anonymous_keys_never_repeat() {
        assert_ne!(anonymous_key("planner"), anonymous_key("planner"));
    }

    #[test]
    fn a_side_job_past_its_deadline_is_stopped() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let live = register_sleeping(&registry, "side-1");
        let started = std::time::Instant::now();

        let exited =
            wait_with_deadline(&live, &registry, "side-1", Some(Duration::from_millis(200)));

        assert!(started.elapsed() < Duration::from_secs(5));
        assert_eq!(exited.code, None);
        assert!(registry.lock().expect("registry").is_empty());
    }

    #[test]
    fn a_job_that_ends_before_its_deadline_is_left_alone() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let child = std::process::Command::new("sh")
            .args(["-c", "exit 3"])
            .spawn()
            .expect("spawn sh");
        let live = LiveChild::new(child);
        register(&registry, "side-2", &live);

        let exited = wait_with_deadline(&live, &registry, "side-2", Some(Duration::from_secs(60)));

        assert_eq!(exited.code, Some(3));
        assert!(exited.stopped.is_empty());
    }

    #[test]
    fn a_normal_exit_stops_what_the_leader_left_in_its_group() {
        use std::io::{BufRead, BufReader};
        use std::process::Stdio;
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let mut command = std::process::Command::new("sh");
        command
            .args(["-c", "sleep 30 & echo $!"])
            .stdout(Stdio::piped());
        crate::process_group::isolate(&mut command);
        let mut child = command.spawn().expect("spawn sh");
        let mut line = String::new();
        BufReader::new(child.stdout.take().expect("stdout"))
            .read_line(&mut line)
            .expect("read the pid");
        let sleeper: u32 = line.trim().parse().expect("a pid");
        let live = LiveChild::new(child);
        register(&registry, "run-9", &live);

        let exited = wait_and_remove(&live, &registry, "run-9");

        assert_eq!(exited.code, Some(0));
        assert!(exited.stopped.iter().any(|process| process.pid == sleeper));
        assert!(crate::proc::reap::unix::test_support::is_gone(sleeper));
    }

    #[test]
    fn a_kill_never_touches_a_bystander_process() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let bystander = std::process::Command::new("sleep")
            .arg("30")
            .spawn()
            .expect("spawn bystander");
        let bystander_pid = bystander.id();
        let live = register_sleeping(&registry, "run-8");
        live.kill();
        wait_and_remove(&live, &registry, "run-8");

        assert!(crate::proc::reap::unix::test_support::is_running(
            bystander_pid
        ));
        let mut bystander = bystander;
        let _ = bystander.kill();
        let _ = bystander.wait();
    }
}
