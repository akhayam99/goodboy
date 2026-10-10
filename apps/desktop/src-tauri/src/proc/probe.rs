use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

const POLL_INTERVAL: Duration = Duration::from_millis(20);
const DRAIN_GRACE: Duration = Duration::from_millis(300);

#[derive(Debug, Clone, Default, PartialEq)]
pub(crate) struct ProbeOutput {
    pub(crate) code: Option<i32>,
    pub(crate) stdout: String,
    pub(crate) stderr: String,
    pub(crate) timed_out: bool,
    pub(crate) elapsed: Duration,
}

impl ProbeOutput {
    pub(crate) fn primary_text(&self) -> &str {
        if self.stdout.trim().is_empty() {
            &self.stderr
        } else {
            &self.stdout
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct Budget {
    pub(crate) timeout: Duration,
    pub(crate) retry_delay: Duration,
}

fn pipe_stdio(command: &mut Command) {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
}

pub(crate) fn spawn(command: &mut Command) -> std::io::Result<Child> {
    pipe_stdio(command);
    crate::aux_spawn::tag_spawn(command, crate::aux_spawn::SpawnKind::Probe);
    crate::process_group::isolate(command);
    command.spawn()
}

#[cfg(unix)]
fn spawn_in_session(command: &mut Command) -> std::io::Result<Child> {
    use std::os::unix::process::CommandExt;
    pipe_stdio(command);
    crate::aux_spawn::tag_spawn(command, crate::aux_spawn::SpawnKind::Probe);
    unsafe {
        command.pre_exec(|| {
            libc::setsid();
            Ok(())
        });
    }
    command.spawn()
}

#[cfg(not(unix))]
fn spawn_in_session(command: &mut Command) -> std::io::Result<Child> {
    pipe_stdio(command);
    command.spawn()
}

pub(crate) fn run(mut command: Command, deadline: Instant) -> std::io::Result<ProbeOutput> {
    let child = spawn(&mut command)?;
    Ok(wait_or_kill(child, deadline))
}

pub(crate) fn run_in_session(
    mut command: Command,
    deadline: Instant,
) -> std::io::Result<ProbeOutput> {
    let child = spawn_in_session(&mut command)?;
    Ok(wait_or_kill(child, deadline))
}

pub(crate) fn run_retrying(
    build: impl Fn() -> Command,
    budget: Budget,
) -> std::io::Result<ProbeOutput> {
    let first = run(build(), Instant::now() + budget.timeout)?;
    if !first.timed_out {
        return Ok(first);
    }
    std::thread::sleep(budget.retry_delay);
    run(build(), Instant::now() + budget.timeout)
}

pub(crate) fn wait_or_kill(mut child: Child, deadline: Instant) -> ProbeOutput {
    let started = Instant::now();
    let stdout = drain(child.stdout.take());
    let stderr = drain(child.stderr.take());
    let (code, timed_out) = loop {
        match child.try_wait() {
            Ok(Some(status)) => break (status.code(), false),
            Ok(None) => {
                if Instant::now() >= deadline {
                    kill_and_reap(&mut child);
                    break (None, true);
                }
                std::thread::sleep(POLL_INTERVAL);
            }
            Err(_) => {
                kill_and_reap(&mut child);
                break (None, false);
            }
        }
    };
    let grace = Instant::now() + DRAIN_GRACE;
    ProbeOutput {
        code,
        stdout: collect(&stdout, grace),
        stderr: collect(&stderr, grace),
        timed_out,
        elapsed: started.elapsed(),
    }
}

fn kill_and_reap(child: &mut Child) {
    if !kill_group(child) {
        let _ = child.kill();
    }
    let _ = child.wait();
}

#[cfg(unix)]
fn kill_group(child: &Child) -> bool {
    let group = child.id() as libc::pid_t;
    unsafe { libc::killpg(group, libc::SIGKILL) == 0 }
}

#[cfg(not(unix))]
fn kill_group(_child: &Child) -> bool {
    false
}

fn drain<R: Read + Send + 'static>(reader: Option<R>) -> mpsc::Receiver<Vec<u8>> {
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        let mut bytes = Vec::new();
        if let Some(mut reader) = reader {
            let _ = reader.read_to_end(&mut bytes);
        }
        let _ = sender.send(bytes);
    });
    receiver
}

fn collect(receiver: &mpsc::Receiver<Vec<u8>>, grace: Instant) -> String {
    let wait = grace.saturating_duration_since(Instant::now());
    let bytes = receiver.recv_timeout(wait).unwrap_or_default();
    String::from_utf8_lossy(&bytes).trim().to_string()
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    fn is_alive(pid: libc::pid_t) -> bool {
        unsafe { libc::kill(pid, 0) == 0 }
    }

    fn sh(script: &str) -> Command {
        let mut command = Command::new("/bin/sh");
        command.arg("-c").arg(script);
        command
    }

    fn stat_of(pid: u32) -> String {
        let out = Command::new("ps")
            .args(["-o", "stat=", "-p", &pid.to_string()])
            .output()
            .expect("run ps");
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    #[test]
    fn a_finished_command_reports_its_code_and_both_streams() {
        let out = run(
            sh("echo out; echo err >&2; exit 3"),
            Instant::now() + Duration::from_secs(5),
        )
        .expect("spawn");

        assert_eq!(out.code, Some(3));
        assert!(!out.timed_out);
        assert_eq!(out.stdout, "out");
        assert_eq!(out.stderr, "err");
    }

    #[test]
    fn a_timed_out_command_is_killed_and_reaped_with_no_zombie() {
        let mut command = sh("exec sleep 30");
        let child = spawn(&mut command).expect("spawn");
        let pid = child.id();

        let out = wait_or_kill(child, Instant::now() + Duration::from_millis(200));

        assert!(out.timed_out);
        assert_eq!(out.code, None);
        assert_eq!(stat_of(pid), "");
    }

    #[test]
    fn a_timed_out_command_takes_its_backgrounded_helper_down_with_it() {
        let out = run(
            sh("sleep 30 & echo $!; wait"),
            Instant::now() + Duration::from_millis(400),
        )
        .expect("spawn");
        assert!(out.timed_out);
        let helper: libc::pid_t = out.stdout.trim().parse().expect("helper pid");

        let mut alive = true;
        for _ in 0..60 {
            if !is_alive(helper) {
                alive = false;
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }

        assert!(!alive, "the helper outlived its probe");
    }

    #[test]
    fn a_large_stdout_does_not_stall_the_child() {
        let out = run(
            sh("dd if=/dev/zero bs=1024 count=200 2>/dev/null | tr '\\0' 'x'"),
            Instant::now() + Duration::from_secs(10),
        )
        .expect("spawn");

        assert!(!out.timed_out);
        assert_eq!(out.code, Some(0));
        assert_eq!(out.stdout.len(), 200 * 1024);
    }

    #[test]
    fn a_missing_binary_is_a_spawn_error() {
        let result = run(
            Command::new("goodboy-no-such-binary-xyz"),
            Instant::now() + Duration::from_secs(1),
        );

        assert_eq!(
            result.expect_err("spawn must fail").kind(),
            std::io::ErrorKind::NotFound
        );
    }

    #[test]
    fn a_timeout_is_retried_once_after_the_delay() {
        let budget = Budget {
            timeout: Duration::from_millis(150),
            retry_delay: Duration::from_millis(100),
        };
        let started = Instant::now();

        let out = run_retrying(|| sh("exec sleep 30"), budget).expect("spawn");

        assert!(out.timed_out);
        assert!(started.elapsed() >= Duration::from_millis(400));
    }

    #[test]
    fn a_command_that_answers_is_not_retried() {
        let budget = Budget {
            timeout: Duration::from_secs(5),
            retry_delay: Duration::from_secs(5),
        };
        let started = Instant::now();

        let out = run_retrying(|| sh("exit 1"), budget).expect("spawn");

        assert_eq!(out.code, Some(1));
        assert!(started.elapsed() < Duration::from_secs(2));
    }
}
