use std::io::Write;
use std::sync::mpsc::{sync_channel, SyncSender, TrySendError};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use portable_pty::ExitStatus;

use crate::util::lock_or_recover;

#[cfg(unix)]
use crate::proc::signal::{self, Signal};

pub(crate) type PtyChild = Box<dyn portable_pty::Child + Send + Sync>;

#[cfg(unix)]
const SESSION_DRAIN_POLLS: usize = 6;
#[cfg(unix)]
const SESSION_DRAIN_INTERVAL: Duration = Duration::from_millis(50);
const EXIT_POLL_INTERVAL: Duration = Duration::from_millis(20);
const INPUT_QUEUE_DEPTH: usize = 256;

#[cfg(unix)]
fn session_descendants(sid: libc::pid_t) -> Vec<libc::pid_t> {
    let Ok(output) = crate::path_env::command("ps")
        .args(["-Ao", "pid="])
        .output()
    else {
        return Vec::new();
    };
    let Ok(text) = String::from_utf8(output.stdout) else {
        return Vec::new();
    };
    text.split_whitespace()
        .filter_map(|token| token.parse::<libc::pid_t>().ok())
        .filter(|pid| *pid != sid && *pid > 1)
        .filter(|pid| signal::session_of(*pid as u32) == Some(sid as u32))
        .collect()
}

#[cfg(unix)]
fn signal_session(sid: libc::pid_t, which: Signal) {
    for pid in session_descendants(sid) {
        let _ = signal::send(pid as u32, which);
    }
    let _ = signal::send(sid as u32, which);
}

#[cfg(unix)]
pub(crate) fn terminate_session(leader_pid: u32) -> usize {
    let sid = leader_pid as libc::pid_t;
    let signalled = session_descendants(sid).len();
    if signalled == 0 {
        return 0;
    }
    signal_session(sid, Signal::Terminate);
    for _ in 0..SESSION_DRAIN_POLLS {
        thread::sleep(SESSION_DRAIN_INTERVAL);
        if session_descendants(sid).is_empty() {
            return signalled;
        }
    }
    signal_session(sid, Signal::Kill);
    signalled
}

#[cfg(not(unix))]
pub(crate) fn terminate_session(_leader_pid: u32) -> usize {
    0
}

pub(crate) fn reap_session(leader_pid: Option<u32>, spawn_id: &str) -> usize {
    crate::proc::ledger::forget(spawn_id);
    let signalled = leader_pid.map(terminate_session).unwrap_or(0);
    let report = crate::proc::reap::reap(crate::proc::reap::ReapParams {
        leader_pid,
        is_leader_exited: true,
        spawn_id: Some(spawn_id),
    });
    signalled + report.stopped.len()
}

pub(crate) fn stop(child: &mut PtyChild, spawn_id: &str, label: &str) -> usize {
    let signalled = reap_session(child.process_id(), spawn_id);
    crate::logging::note_kill_failure(label, child.kill());
    signalled
}

pub(crate) fn wait_for_exit<T>(
    slot: &Mutex<Option<T>>,
    child_of: fn(&mut T) -> &mut PtyChild,
) -> Option<ExitStatus> {
    loop {
        {
            let mut guard = lock_or_recover(slot);
            let run = guard.as_mut()?;
            match child_of(run).try_wait() {
                Ok(Some(status)) => return Some(status),
                Ok(None) => {}
                Err(_) => return None,
            }
        }
        thread::sleep(EXIT_POLL_INTERVAL);
    }
}

pub(crate) fn exit_code_of(status: Option<ExitStatus>) -> i32 {
    status.map_or(-1, |status| status.exit_code() as i32)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum InputError {
    Backlogged,
    Closed,
}

#[derive(Clone)]
pub(crate) struct PtyInput(SyncSender<Vec<u8>>);

impl PtyInput {
    pub(crate) fn spawn(writer: Box<dyn Write + Send>) -> Self {
        let (sender, receiver) = sync_channel::<Vec<u8>>(INPUT_QUEUE_DEPTH);
        thread::spawn(move || {
            let mut writer = writer;
            for chunk in receiver {
                let delivered = writer.write_all(&chunk).and_then(|()| writer.flush());
                if delivered.is_err() {
                    break;
                }
            }
        });
        Self(sender)
    }

    pub(crate) fn send(&self, bytes: Vec<u8>) -> Result<(), InputError> {
        match self.0.try_send(bytes) {
            Ok(()) => Ok(()),
            Err(TrySendError::Full(_)) => Err(InputError::Backlogged),
            Err(TrySendError::Disconnected(_)) => Err(InputError::Closed),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io;
    use std::sync::mpsc::{channel, Receiver};
    use std::sync::{Arc, Mutex};
    use std::time::Instant;

    struct StuckWriter(Receiver<()>);

    impl Write for StuckWriter {
        fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
            let _ = self.0.recv();
            Ok(bytes.len())
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    struct SharedSink(Arc<Mutex<Vec<u8>>>);

    impl Write for SharedSink {
        fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
            lock_or_recover(&self.0).extend_from_slice(bytes);
            Ok(bytes.len())
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    struct BrokenWriter;

    impl Write for BrokenWriter {
        fn write(&mut self, _bytes: &[u8]) -> io::Result<usize> {
            Err(io::Error::new(io::ErrorKind::BrokenPipe, "gone"))
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    #[test]
    fn input_reaches_the_writer_in_order() {
        let sink = Arc::new(Mutex::new(Vec::new()));
        let input = PtyInput::spawn(Box::new(SharedSink(Arc::clone(&sink))));
        input.send(b"ab".to_vec()).expect("first");
        input.send(b"cd".to_vec()).expect("second");
        for _ in 0..100 {
            if lock_or_recover(&sink).len() == 4 {
                break;
            }
            thread::sleep(Duration::from_millis(10));
        }
        assert_eq!(*lock_or_recover(&sink), b"abcd".to_vec());
    }

    #[test]
    fn a_writer_that_never_returns_backlogs_instead_of_blocking() {
        let (release, wait) = channel::<()>();
        let input = PtyInput::spawn(Box::new(StuckWriter(wait)));
        let started = Instant::now();
        let mut refused = None;
        for _ in 0..(INPUT_QUEUE_DEPTH * 4) {
            if let Err(error) = input.send(vec![0u8; 4096]) {
                refused = Some(error);
                break;
            }
        }
        assert_eq!(refused, Some(InputError::Backlogged));
        assert!(started.elapsed() < Duration::from_secs(2));
        drop(release);
    }

    #[test]
    fn the_exit_code_is_the_real_one_and_minus_one_when_unknown() {
        assert_eq!(exit_code_of(Some(ExitStatus::with_exit_code(0))), 0);
        assert_eq!(exit_code_of(Some(ExitStatus::with_exit_code(2))), 2);
        assert_eq!(exit_code_of(Some(ExitStatus::with_exit_code(137))), 137);
        assert_eq!(exit_code_of(None), -1);
    }

    #[test]
    fn a_writer_that_fails_closes_the_input() {
        let input = PtyInput::spawn(Box::new(BrokenWriter));
        let _ = input.send(b"x".to_vec());
        let mut closed = false;
        for _ in 0..100 {
            if input.send(b"y".to_vec()) == Err(InputError::Closed) {
                closed = true;
                break;
            }
            thread::sleep(Duration::from_millis(10));
        }
        assert!(closed);
    }
}
