use std::collections::HashMap;
use std::io::Read;
use std::process::{Child, ChildStderr, ChildStdout, Command};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{channel, RecvTimeoutError};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use crate::proc::ledger::{self, LedgerContext};
use crate::proc::reap::{reap, tree_cpu, ReapParams, StoppedProcess};
use crate::proc::spawn::{spawn_command, take_pipes, StdinMode};
use crate::util::lock_or_recover;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IdlePolicy {
    pub cap: Duration,
    pub poll: Duration,
}

pub const SIDE_JOB_IDLE: IdlePolicy = IdlePolicy {
    cap: Duration::from_secs(10 * 60),
    poll: Duration::from_secs(15),
};

#[derive(Debug, Clone)]
pub struct Activity(Arc<AtomicU64>);

fn epoch() -> Instant {
    static EPOCH: OnceLock<Instant> = OnceLock::new();
    *EPOCH.get_or_init(Instant::now)
}

impl Activity {
    pub fn new() -> Self {
        let activity = Self(Arc::new(AtomicU64::new(0)));
        activity.touch();
        activity
    }

    pub fn touch(&self) {
        let elapsed = u64::try_from(epoch().elapsed().as_millis()).unwrap_or(u64::MAX);
        self.0.store(elapsed, Ordering::Relaxed);
    }

    pub fn idle_for(&self) -> Duration {
        let now = u64::try_from(epoch().elapsed().as_millis()).unwrap_or(u64::MAX);
        Duration::from_millis(now.saturating_sub(self.0.load(Ordering::Relaxed)))
    }
}

impl Default for Activity {
    fn default() -> Self {
        Self::new()
    }
}

pub type ChildSlot = Arc<Mutex<Option<Child>>>;

#[derive(Clone)]
pub struct LiveChild {
    pub pid: u32,
    pub slot: ChildSlot,
    pub spawn_id: Option<String>,
    pub activity: Activity,
    pub is_timed_out: Arc<AtomicBool>,
    #[cfg(windows)]
    job: Option<Arc<crate::process_group::Job>>,
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Exited {
    pub code: Option<i32>,
    pub stopped: Vec<StoppedProcess>,
    pub is_timed_out: bool,
}

pub type LiveChildRegistry = Arc<Mutex<HashMap<String, LiveChild>>>;

static ANONYMOUS_KEYS: AtomicU64 = AtomicU64::new(0);

impl LiveChild {
    pub fn new(child: Child) -> Self {
        Self {
            pid: child.id(),
            #[cfg(windows)]
            job: crate::process_group::Job::assign(&child).map(Arc::new),
            slot: Arc::new(Mutex::new(Some(child))),
            spawn_id: None,
            activity: Activity::new(),
            is_timed_out: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn tagged(child: Child, tag: &crate::aux_spawn::SpawnTag, context: LedgerContext) -> Self {
        let live = Self {
            spawn_id: Some(tag.id.clone()),
            ..Self::new(child)
        };
        ledger::record(tag, live.pid, context);
        live
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
        reap(ReapParams {
            leader_pid: Some(self.pid),
            is_leader_exited: false,
            spawn_id: self.spawn_id.as_deref(),
        });
        self.terminate_job();
    }

    #[cfg(windows)]
    fn terminate_job(&self) {
        let Some(job) = self.job.as_ref() else {
            return;
        };
        job.terminate();
    }

    #[cfg(not(windows))]
    fn terminate_job(&self) {}

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

pub struct Spawned {
    pub live: LiveChild,
    pub stdout: ChildStdout,
    pub stderr: ChildStderr,
}

pub struct SpawnTaggedParams<'a> {
    pub command: &'a mut Command,
    pub tag: &'a crate::aux_spawn::SpawnTag,
    pub prompt: Option<String>,
    pub session_id: Option<String>,
    pub mount_path: Option<String>,
}

pub fn spawn_tagged(params: SpawnTaggedParams<'_>) -> std::io::Result<Spawned> {
    let (spawned, ()) = spawn_tagged_with(params, |command, stdin| {
        spawn_command(command, stdin).map(|child| (child, ()))
    })?;
    Ok(spawned)
}

pub fn spawn_tagged_with<X, E, L>(
    SpawnTaggedParams {
        command,
        tag,
        prompt,
        session_id,
        mount_path,
    }: SpawnTaggedParams<'_>,
    launch: L,
) -> Result<(Spawned, X), E>
where
    E: From<std::io::Error>,
    L: FnOnce(&mut Command, StdinMode) -> Result<(Child, X), E>,
{
    let stdin = StdinMode::for_prompt(prompt.as_deref());
    let (child, extra) = launch(command, stdin)?;
    let mut pipes = take_pipes(child)?;
    if let Some(prompt) = prompt {
        crate::providers::cli_args::feed_stdin(&mut pipes.child, prompt);
    }
    let live = LiveChild::tagged(
        pipes.child,
        tag,
        LedgerContext {
            session_id,
            mount_path,
            ..LedgerContext::from_command(command)
        },
    );
    let spawned = Spawned {
        live,
        stdout: pipes.stdout,
        stderr: pipes.stderr,
    };
    Ok((spawned, extra))
}

pub const MAX_SIDE_JOB_STDOUT_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct SideJobOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub is_timed_out: bool,
}

pub struct RunSideJobParams<'a> {
    pub registry: &'a LiveChildRegistry,
    pub kind: crate::aux_spawn::SpawnKind,
    pub binary: &'a str,
    pub cli_args: &'a [String],
    pub working_dir: Option<&'a str>,
    pub prompt: Option<String>,
    pub run_id: Option<&'a str>,
    pub idle: IdlePolicy,
    pub max_stdout_bytes: usize,
}

pub fn run_side_job(
    RunSideJobParams {
        registry,
        kind,
        binary,
        cli_args,
        working_dir,
        prompt,
        run_id,
        idle,
        max_stdout_bytes,
    }: RunSideJobParams<'_>,
) -> std::io::Result<SideJobOutput> {
    let mut command = crate::path_env::command(binary);
    crate::aux_spawn::scrub_nested_session_env(&mut command);
    if crate::aux_spawn::is_copilot_binary(binary) {
        crate::aux_spawn::strip_tokens_copilot_refuses(&mut command);
    }
    let tag = crate::aux_spawn::tag_spawn(&mut command, kind);
    crate::process_group::isolate(&mut command);
    if let Some(dir) = working_dir.filter(|dir| !dir.is_empty()) {
        command.current_dir(dir);
    }
    command.args(cli_args);
    let Spawned {
        live,
        stdout,
        stderr,
    } = spawn_tagged(SpawnTaggedParams {
        command: &mut command,
        tag: &tag,
        prompt,
        session_id: None,
        mount_path: None,
    })?;

    let key = run_id
        .map(str::to_string)
        .unwrap_or_else(|| anonymous_key(kind.as_str()));
    register(registry, &key, &live);

    let stdout_activity = live.activity.clone();
    let stderr_activity = live.activity.clone();
    let stdout_handle =
        std::thread::spawn(move || drain_tail_active(stdout, max_stdout_bytes, &stdout_activity));
    let stderr_handle =
        std::thread::spawn(move || drain_tail_active(stderr, MAX_STDERR_BYTES, &stderr_activity));
    let ((stdout, stderr), exited) = run_to_exit(&live, registry, &key, Some(idle), || {
        (
            stdout_handle.join().unwrap_or_default(),
            stderr_handle.join().unwrap_or_default(),
        )
    });
    Ok(SideJobOutput {
        stdout,
        stderr,
        exit_code: exited.code,
        is_timed_out: exited.is_timed_out,
    })
}

pub fn register(registry: &LiveChildRegistry, key: &str, live: &LiveChild) {
    lock_or_recover(registry).insert(key.to_string(), live.clone());
}

pub fn kill_one(registry: &LiveChildRegistry, key: &str) -> bool {
    let live = lock_or_recover(registry).get(key).cloned();
    let Some(live) = live else {
        return false;
    };
    live.kill();
    true
}

pub fn shutdown(registry: &LiveChildRegistry) {
    let drained: Vec<LiveChild> = lock_or_recover(registry)
        .drain()
        .map(|(_, live)| live)
        .collect();
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
    if let Some(spawn_id) = live.spawn_id.as_deref() {
        ledger::forget(spawn_id);
    }
    lock_or_recover(registry).remove(key);
    exited
}

fn wait_and_reap(live: &LiveChild) -> Exited {
    let mut guard = lock_or_recover(&live.slot);
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
        is_timed_out: live.is_timed_out.load(Ordering::SeqCst),
    }
}

pub fn wait_with_idle_cap(
    live: &LiveChild,
    registry: &LiveChildRegistry,
    key: &str,
    idle: Option<IdlePolicy>,
) -> Exited {
    let Some(policy) = idle else {
        return wait_and_remove(live, registry, key);
    };
    let (finished, watch) = channel::<()>();
    std::thread::scope(|scope| {
        scope.spawn(move || watch_idle(live, &watch, policy));
        let exited = wait_and_remove(live, registry, key);
        drop(finished);
        exited
    })
}

fn watch_idle(live: &LiveChild, watch: &std::sync::mpsc::Receiver<()>, policy: IdlePolicy) {
    let mut last_cpu = tree_cpu(live.pid);
    loop {
        if watch.recv_timeout(policy.poll) != Err(RecvTimeoutError::Timeout) {
            return;
        }
        let cpu = tree_cpu(live.pid);
        if cpu != last_cpu {
            live.activity.touch();
            last_cpu = cpu;
        }
        if live.activity.idle_for() < policy.cap {
            continue;
        }
        log::warn!("[reap] a side job went quiet past its cap, stopping it");
        live.is_timed_out.store(true, Ordering::SeqCst);
        live.kill();
        return;
    }
}

pub fn run_to_exit<R>(
    live: &LiveChild,
    registry: &LiveChildRegistry,
    key: &str,
    idle: Option<IdlePolicy>,
    pump: impl FnOnce() -> R,
) -> (R, Exited) {
    std::thread::scope(|scope| {
        let waiter = scope.spawn(|| wait_with_idle_cap(live, registry, key, idle));
        let pumped = pump();
        let exited = waiter
            .join()
            .unwrap_or_else(|panic| std::panic::resume_unwind(panic));
        (pumped, exited)
    })
}

pub const MAX_STDERR_BYTES: usize = 256 * 1024;

pub fn drain_tail_lossy<R: Read>(source: R, max_bytes: usize) -> String {
    drain_tail_with(source, max_bytes, None)
}

pub fn drain_tail_active<R: Read>(source: R, max_bytes: usize, activity: &Activity) -> String {
    drain_tail_with(source, max_bytes, Some(activity))
}

fn drain_tail_with<R: Read>(
    mut source: R,
    max_bytes: usize,
    activity: Option<&Activity>,
) -> String {
    let mut tail: Vec<u8> = Vec::new();
    let mut chunk = [0u8; 8192];
    loop {
        match source.read(&mut chunk) {
            Ok(0) => break,
            Ok(read) => {
                tail.extend_from_slice(&chunk[..read]);
                if let Some(activity) = activity {
                    activity.touch();
                }
                if tail.len() > max_bytes.saturating_mul(2) {
                    let excess = tail.len() - max_bytes;
                    tail.drain(..excess);
                }
            }
            Err(err) if err.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(_) => break,
        }
    }
    if tail.len() > max_bytes {
        let excess = tail.len() - max_bytes;
        tail.drain(..excess);
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

    fn quick_policy(cap_ms: u64) -> IdlePolicy {
        IdlePolicy {
            cap: Duration::from_millis(cap_ms),
            poll: Duration::from_millis(40),
        }
    }

    fn piped_live(
        registry: &LiveChildRegistry,
        key: &str,
        program: &str,
        args: &[&str],
    ) -> (LiveChild, impl FnOnce() -> (String, String)) {
        use std::process::Stdio;
        let mut child = std::process::Command::new(program)
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("spawn the job");
        let stdout = child.stdout.take().expect("stdout");
        let stderr = child.stderr.take().expect("stderr");
        let live = LiveChild::new(child);
        register(registry, key, &live);
        let out_activity = live.activity.clone();
        let err_activity = live.activity.clone();
        let pump = move || {
            std::thread::scope(|scope| {
                let out = scope.spawn(|| drain_tail_active(stdout, usize::MAX, &out_activity));
                let err = scope.spawn(|| drain_tail_active(stderr, usize::MAX, &err_activity));
                (
                    out.join().unwrap_or_default(),
                    err.join().unwrap_or_default(),
                )
            })
        };
        (live, pump)
    }

    #[test]
    fn a_silent_idle_job_is_stopped_and_reported_as_timed_out() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let live = register_sleeping(&registry, "side-1");
        let started = std::time::Instant::now();

        let exited = wait_with_idle_cap(&live, &registry, "side-1", Some(quick_policy(250)));

        assert!(started.elapsed() < Duration::from_secs(5));
        assert!(exited.is_timed_out);
        assert_eq!(exited.code, None);
        assert!(registry.lock().expect("registry").is_empty());
    }

    #[test]
    fn a_killed_job_that_was_not_idle_is_not_reported_as_timed_out() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let live = register_sleeping(&registry, "side-6");
        let waiter = spawn_waiter(&registry, "side-6", &live);

        assert!(kill_one(&registry, "side-6"));

        assert_waiter_returns(
            waiter,
            Duration::from_secs(2),
            "kill left the child running",
        );
        assert!(!live.is_timed_out.load(Ordering::SeqCst));
    }

    #[test]
    fn a_job_that_keeps_writing_is_not_stopped_by_the_idle_cap() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let (live, pump) = piped_live(
            &registry,
            "side-3",
            "/bin/sh",
            &[
                "-c",
                "for i in 1 2 3 4 5 6 7 8 9 10 11 12; do echo tick; sleep 0.1; done",
            ],
        );
        let started = std::time::Instant::now();

        let ((out, _), exited) =
            run_to_exit(&live, &registry, "side-3", Some(quick_policy(450)), pump);

        assert!(started.elapsed() > Duration::from_millis(1000));
        assert!(!exited.is_timed_out);
        assert_eq!(exited.code, Some(0));
        assert_eq!(out.lines().count(), 12);
    }

    #[test]
    fn a_silent_job_that_is_busy_is_not_stopped_by_the_idle_cap() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let (live, pump) = piped_live(
            &registry,
            "side-4",
            "/usr/bin/perl",
            &["-e", "my $until = time + 2; 1 while time < $until;"],
        );

        let (_, exited) = run_to_exit(&live, &registry, "side-4", Some(quick_policy(600)), pump);

        assert!(!exited.is_timed_out);
        assert_eq!(exited.code, Some(0));
    }

    #[test]
    fn a_silent_job_whose_child_is_busy_is_not_stopped_by_the_idle_cap() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let (live, pump) = piped_live(
            &registry,
            "side-5",
            "/bin/sh",
            &[
                "-c",
                "/usr/bin/perl -e 'my $until = time + 2; 1 while time < $until;'",
            ],
        );

        let (_, exited) = run_to_exit(&live, &registry, "side-5", Some(quick_policy(600)), pump);

        assert!(!exited.is_timed_out);
        assert_eq!(exited.code, Some(0));
    }

    #[test]
    fn a_job_that_ends_before_its_cap_is_left_alone() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let child = std::process::Command::new("sh")
            .args(["-c", "exit 3"])
            .spawn()
            .expect("spawn sh");
        let live = LiveChild::new(child);
        register(&registry, "side-2", &live);

        let exited = wait_with_idle_cap(&live, &registry, "side-2", Some(quick_policy(60_000)));

        assert_eq!(exited.code, Some(3));
        assert!(exited.stopped.is_empty());
        assert!(!exited.is_timed_out);
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
    fn a_kill_reaches_a_restricted_child_in_its_own_session_while_its_parent_lives() {
        use std::io::{BufRead, BufReader};
        use std::process::Stdio;
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let mut command = std::process::Command::new("/bin/sh");
        command
            .args([
                "-c",
                "perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' -- /bin/sleep 30 & echo $!; wait",
            ])
            .stdout(Stdio::piped());
        crate::process_group::isolate(&mut command);
        let mut child = command.spawn().expect("spawn sh");
        let mut line = String::new();
        BufReader::new(child.stdout.take().expect("stdout"))
            .read_line(&mut line)
            .expect("read the pid");
        let sleeper: u32 = line.trim().parse().expect("a pid");
        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        while unsafe { libc::getsid(sleeper as libc::pid_t) } != sleeper as libc::pid_t {
            assert!(std::time::Instant::now() < deadline, "no new session");
            std::thread::sleep(Duration::from_millis(20));
        }
        let live = LiveChild::new(child);
        register(&registry, "run-7", &live);
        let waiter = spawn_waiter(&registry, "run-7", &live);

        assert!(kill_one(&registry, "run-7"));

        assert_waiter_returns(
            waiter,
            Duration::from_secs(3),
            "the leader outlived the kill",
        );
        assert!(crate::proc::reap::unix::test_support::is_gone(sleeper));
    }

    #[test]
    fn a_tagged_child_is_in_the_ledger_until_it_is_reaped() {
        use crate::aux_spawn::{tag_spawn, SpawnKind};
        use crate::proc::ledger::{process_ledger_list, test_support::scratch_dir};
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let dir = scratch_dir("turn");
        let mut command = std::process::Command::new("sleep");
        command.arg("30").current_dir(&dir);
        let tag = tag_spawn(&mut command, SpawnKind::Turn);
        crate::process_group::isolate(&mut command);
        let child = command.spawn().expect("spawn sleep");
        let live = LiveChild::tagged(
            child,
            &tag,
            LedgerContext {
                session_id: Some("session-5".to_string()),
                mount_path: Some("/work/ledger-core".to_string()),
                ..LedgerContext::from_command(&command)
            },
        );
        register(&registry, "turn-1", &live);

        let rows: Vec<_> = process_ledger_list()
            .into_iter()
            .filter(|row| row.spawn_id == tag.id)
            .collect();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].kind, "turn");
        assert_eq!(rows[0].pid, live.pid);
        assert_eq!(rows[0].pgid, Some(live.pid));
        assert_eq!(rows[0].session_id.as_deref(), Some("session-5"));
        assert_eq!(rows[0].mount_path.as_deref(), Some("/work/ledger-core"));
        assert_eq!(rows[0].cwd.as_deref(), Some(dir.to_string_lossy().as_ref()));

        let waiter = spawn_waiter(&registry, "turn-1", &live);
        assert!(kill_one(&registry, "turn-1"));
        assert_waiter_returns(waiter, Duration::from_secs(3), "the turn outlived the kill");

        assert!(!process_ledger_list()
            .iter()
            .any(|row| row.spawn_id == tag.id));
        let _ = std::fs::remove_dir_all(&dir);
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

    fn poisoned_registry() -> LiveChildRegistry {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let held = Arc::clone(&registry);
        let _ = std::thread::spawn(move || {
            let _guard = held.lock().expect("lock");
            panic!("poison the registry");
        })
        .join();
        assert!(registry.is_poisoned());
        registry
    }

    #[test]
    fn a_poisoned_registry_still_tracks_and_kills_the_child() {
        let registry = poisoned_registry();
        let live = register_sleeping(&registry, "run-poison");
        let waiter = spawn_waiter(&registry, "run-poison", &live);

        assert!(kill_one(&registry, "run-poison"));

        assert_waiter_returns(
            waiter,
            Duration::from_secs(2),
            "a poisoned registry left the child running",
        );
        assert!(lock_or_recover(&registry).is_empty());
    }

    #[test]
    fn a_poisoned_registry_still_shuts_every_child_down() {
        let registry = poisoned_registry();
        let live = register_sleeping(&registry, "run-poison-1");
        let waiter = spawn_waiter(&registry, "run-poison-1", &live);

        shutdown(&registry);

        assert_waiter_returns(
            waiter,
            Duration::from_secs(2),
            "shutdown skipped a child behind a poisoned registry",
        );
    }

    fn side_job(registry: &LiveChildRegistry, script: &str, run_id: Option<&str>, cap: usize) {
        let cli_args = vec!["-c".to_string(), script.to_string()];
        let output = run_side_job(RunSideJobParams {
            registry,
            kind: crate::aux_spawn::SpawnKind::Planner,
            binary: "/bin/sh",
            cli_args: &cli_args,
            working_dir: None,
            prompt: None,
            run_id,
            idle: quick_policy(60_000),
            max_stdout_bytes: cap,
        })
        .expect("the side job runs");
        assert_eq!(output.exit_code, Some(0));
        assert!(output.stdout.len() <= cap);
    }

    #[test]
    fn a_side_job_keeps_only_the_tail_of_a_flood() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let cli_args = vec![
            "-c".to_string(),
            "i=0; while [ $i -lt 2000 ]; do echo 0123456789abcdef0123456789abcdef; i=$((i+1)); done; echo last".to_string(),
        ];

        let output = run_side_job(RunSideJobParams {
            registry: &registry,
            kind: crate::aux_spawn::SpawnKind::Planner,
            binary: "/bin/sh",
            cli_args: &cli_args,
            working_dir: None,
            prompt: None,
            run_id: None,
            idle: quick_policy(60_000),
            max_stdout_bytes: 1024,
        })
        .expect("the side job runs");

        assert_eq!(output.exit_code, Some(0));
        assert!(output.stdout.len() <= 1024);
        assert!(output.stdout.ends_with("last\n"));
        assert!(lock_or_recover(&registry).is_empty());
    }

    #[test]
    fn a_side_job_caps_a_flood_on_stderr_too() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let cli_args = vec![
            "-c".to_string(),
            "i=0; while [ $i -lt 20000 ]; do echo 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef >&2; i=$((i+1)); done".to_string(),
        ];

        let output = run_side_job(RunSideJobParams {
            registry: &registry,
            kind: crate::aux_spawn::SpawnKind::Summary,
            binary: "/bin/sh",
            cli_args: &cli_args,
            working_dir: None,
            prompt: None,
            run_id: None,
            idle: quick_policy(60_000),
            max_stdout_bytes: 1024,
        })
        .expect("the side job runs");

        assert!(output.stderr.len() <= MAX_STDERR_BYTES);
        assert!(output.stderr.len() > 1024);
    }

    #[test]
    fn a_side_job_runs_under_the_run_id_it_was_given() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let runner_registry = Arc::clone(&registry);
        let runner = std::thread::spawn(move || {
            side_job(&runner_registry, "sleep 30", Some("plan-1"), 1024);
        });
        let deadline = Instant::now() + Duration::from_secs(5);
        while !lock_or_recover(&registry).contains_key("plan-1") {
            assert!(Instant::now() < deadline, "the run never registered");
            std::thread::sleep(Duration::from_millis(20));
        }

        assert!(kill_one(&registry, "plan-1"));

        let _ = runner.join();
        assert!(lock_or_recover(&registry).is_empty());
    }

    #[test]
    fn a_side_job_without_a_prompt_has_dev_null_on_fd_zero() {
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        let cli_args = vec![
            "-e".to_string(),
            r#"my @in = stat(STDIN); my @null = stat("/dev/null"); print(($in[1] == $null[1] && $in[6] == $null[6]) ? "null" : "other");"#.to_string(),
        ];

        let output = run_side_job(RunSideJobParams {
            registry: &registry,
            kind: crate::aux_spawn::SpawnKind::Summary,
            binary: "/usr/bin/perl",
            cli_args: &cli_args,
            working_dir: None,
            prompt: None,
            run_id: None,
            idle: quick_policy(60_000),
            max_stdout_bytes: 1024,
        })
        .expect("the side job runs");

        assert_eq!(output.stdout, "null");
    }

    #[test]
    fn a_tagged_spawn_without_a_prompt_has_dev_null_on_fd_zero() {
        use crate::aux_spawn::{tag_spawn, SpawnKind};
        let mut command = std::process::Command::new("/usr/bin/perl");
        command.args([
            "-e",
            r#"my @in = stat(STDIN); my @null = stat("/dev/null"); print(($in[1] == $null[1] && $in[6] == $null[6]) ? "null" : "other");"#,
        ]);
        let tag = tag_spawn(&mut command, SpawnKind::Turn);
        crate::process_group::isolate(&mut command);
        command.stdin(std::process::Stdio::piped());

        let Spawned { live, stdout, .. } = spawn_tagged(SpawnTaggedParams {
            command: &mut command,
            tag: &tag,
            prompt: None,
            session_id: None,
            mount_path: None,
        })
        .expect("spawn the probe");
        let registry: LiveChildRegistry = Arc::new(Mutex::new(HashMap::new()));
        register(&registry, "turn-fd0", &live);
        let (report, exited) = run_to_exit(&live, &registry, "turn-fd0", None, || {
            drain_tail_lossy(stdout, 64)
        });

        assert_eq!(exited.code, Some(0));
        assert_eq!(report, "null");
    }
}
