use std::collections::HashMap;
use std::process::Child;
use std::sync::{Mutex, OnceLock};

use super::protocol::{BridgeError, AUTO_CHILD_ACT, CALLER_UNKNOWN};
use crate::proc::kernel::Identity;

pub(crate) const ACT_VERBS: &[(&str, &str)] = &[
    ("github", "push"),
    ("github", "pr-create"),
    ("github", "pr-ready"),
    ("github", "pr-merge"),
    ("gitlab", "mr-create"),
    ("gitlab", "mr-approve"),
    ("gitlab", "mr-unapprove"),
    ("gitlab", "mr-merge"),
    ("bitbucket", "pr-approve"),
    ("bitbucket", "pr-unapprove"),
    ("bitbucket", "pr-request-changes"),
    ("bitbucket", "pr-unrequest-changes"),
    ("bitbucket", "pr-merge"),
    ("bitbucket", "pr-decline"),
];

const MAX_ANCESTRY: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TurnKind {
    AutoChild,
    HandStarted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Caller {
    Turn(TurnKind),
    Unknown,
}

#[derive(Debug, Clone, Copy)]
struct Registered {
    start: Option<u64>,
    kind: TurnKind,
}

type Turns = HashMap<u32, Registered>;

fn turns() -> &'static Mutex<Turns> {
    static TURNS: OnceLock<Mutex<Turns>> = OnceLock::new();
    TURNS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn lock() -> std::sync::MutexGuard<'static, Turns> {
    turns().lock().unwrap_or_else(|error| error.into_inner())
}

pub(crate) struct TurnProcess {
    pid: u32,
}

impl Drop for TurnProcess {
    fn drop(&mut self) {
        lock().remove(&self.pid);
    }
}

pub(crate) fn spawn_turn(
    kind: TurnKind,
    spawn: impl FnOnce() -> std::io::Result<Child>,
) -> std::io::Result<(Child, TurnProcess)> {
    let mut registered = lock();
    let child = spawn()?;
    let pid = child.id();
    let start = crate::proc::kernel::identity(pid).map(|identity| identity.start);
    registered.insert(pid, Registered { start, kind });
    Ok((child, TurnProcess { pid }))
}

fn caller_in(turns: &Turns, pid: u32, identity: &dyn Fn(u32) -> Option<Identity>) -> Caller {
    let mut current = pid;
    for _ in 0..MAX_ANCESTRY {
        if current <= 1 || current == std::process::id() {
            return Caller::Unknown;
        }
        let Some(found) = identity(current) else {
            return Caller::Unknown;
        };
        if let Some(turn) = turns.get(&current) {
            if turn.start.is_none_or(|start| start == found.start) {
                return Caller::Turn(turn.kind);
            }
        }
        current = found.ppid;
    }
    Caller::Unknown
}

pub(crate) fn caller_of(peer_pid: Option<u32>) -> Caller {
    let Some(pid) = peer_pid else {
        return Caller::Unknown;
    };
    caller_in(&lock(), pid, &crate::proc::kernel::identity)
}

#[cfg(test)]
pub(crate) fn kind_of_pid(pid: u32) -> Option<TurnKind> {
    lock().get(&pid).map(|turn| turn.kind)
}

pub(crate) fn is_act(provider: &str, verb: &str) -> bool {
    ACT_VERBS.contains(&(provider, verb))
}

pub(super) fn refuse_act(provider: &str, verb: &str, caller: Caller) -> Result<(), BridgeError> {
    if !is_act(provider, verb) {
        return Ok(());
    }
    match caller {
        Caller::Turn(TurnKind::HandStarted) => Ok(()),
        Caller::Turn(TurnKind::AutoChild) => Err(BridgeError::coded(
            AUTO_CHILD_ACT,
            format!(
                "{provider} {verb} is not available to an Auto child. Goodboy pushes after its checks. Say in your report what should be pushed."
            ),
        )),
        Caller::Unknown => Err(BridgeError::coded(
            CALLER_UNKNOWN,
            format!(
                "{provider} {verb} runs only for a turn Goodboy started, and this request did not come from one. Ask from the turn's own shell."
            ),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::super::protocol::{spec_for, Access};
    use super::*;

    const AUTO_ROOT: u32 = 900_001;
    const HAND_ROOT: u32 = 900_002;
    const START: u64 = 42;

    fn identity_of(pid: u32) -> Option<Identity> {
        let (ppid, start) = match pid {
            AUTO_ROOT | HAND_ROOT => (std::process::id(), START),
            900_011 => (AUTO_ROOT, 7),
            900_012 => (900_011, 7),
            900_021 => (HAND_ROOT, 7),
            900_031 => (1, 7),
            _ => return None,
        };
        Some(Identity {
            start,
            ppid,
            pgid: pid,
            uid: 501,
            is_zombie: false,
        })
    }

    fn registry() -> Turns {
        HashMap::from([
            (
                AUTO_ROOT,
                Registered {
                    start: Some(START),
                    kind: TurnKind::AutoChild,
                },
            ),
            (
                HAND_ROOT,
                Registered {
                    start: Some(START),
                    kind: TurnKind::HandStarted,
                },
            ),
        ])
    }

    #[test]
    fn every_act_verb_is_a_catalogued_write() {
        for (provider, verb) in ACT_VERBS {
            let spec = spec_for(provider, verb).expect("catalogued");
            assert!(matches!(spec.access, Access::Write), "{provider} {verb}");
        }
    }

    #[test]
    fn a_descendant_of_an_auto_child_is_the_auto_child_whatever_it_says() {
        let turns = registry();
        assert_eq!(
            caller_in(&turns, 900_012, &identity_of),
            Caller::Turn(TurnKind::AutoChild)
        );
        assert_eq!(
            caller_in(&turns, AUTO_ROOT, &identity_of),
            Caller::Turn(TurnKind::AutoChild)
        );
        assert_eq!(
            caller_in(&turns, 900_021, &identity_of),
            Caller::Turn(TurnKind::HandStarted)
        );
    }

    #[test]
    fn a_process_outside_every_turn_or_a_reused_pid_is_unknown() {
        let turns = registry();
        assert_eq!(caller_in(&turns, 900_031, &identity_of), Caller::Unknown);
        assert_eq!(caller_in(&turns, 900_099, &identity_of), Caller::Unknown);
        let mut reused = registry();
        reused.insert(
            AUTO_ROOT,
            Registered {
                start: Some(START + 1),
                kind: TurnKind::HandStarted,
            },
        );
        assert_eq!(caller_in(&reused, 900_012, &identity_of), Caller::Unknown);
        assert_eq!(caller_of(None), Caller::Unknown);
    }

    #[test]
    fn every_act_verb_is_refused_for_an_auto_child_and_an_unknown_caller() {
        for (provider, verb) in ACT_VERBS {
            let refusal =
                refuse_act(provider, verb, Caller::Turn(TurnKind::AutoChild)).expect_err("refused");
            assert_eq!(refusal.code.as_deref(), Some(AUTO_CHILD_ACT));
            assert!(refusal.message.contains("Goodboy pushes after its checks"));
            let unknown = refuse_act(provider, verb, Caller::Unknown).expect_err("refused");
            assert_eq!(unknown.code.as_deref(), Some(CALLER_UNKNOWN));
        }
    }

    #[test]
    fn every_act_verb_is_allowed_for_a_hand_started_turn() {
        for (provider, verb) in ACT_VERBS {
            assert!(refuse_act(provider, verb, Caller::Turn(TurnKind::HandStarted)).is_ok());
        }
    }

    #[test]
    fn reads_comments_replies_and_resolves_pass_for_any_caller() {
        for spec in super::super::protocol::CATALOG {
            if is_act(spec.provider, spec.verb) {
                continue;
            }
            for caller in [Caller::Turn(TurnKind::AutoChild), Caller::Unknown] {
                assert!(
                    refuse_act(spec.provider, spec.verb, caller).is_ok(),
                    "{} {}",
                    spec.provider,
                    spec.verb
                );
            }
        }
    }

    #[cfg(unix)]
    #[test]
    fn a_grandchild_of_a_spawned_auto_child_is_known_by_its_real_ancestry() {
        use std::io::BufRead;

        let (mut child, guard) = spawn_turn(TurnKind::AutoChild, || {
            std::process::Command::new("sh")
                .args(["-c", "sleep 30 & echo $!; wait"])
                .stdout(std::process::Stdio::piped())
                .spawn()
        })
        .expect("a spawned shell");
        let mut line = String::new();
        std::io::BufReader::new(child.stdout.take().expect("stdout"))
            .read_line(&mut line)
            .expect("the sleeper pid");
        let sleeper: u32 = line.trim().parse().expect("a pid");

        assert_eq!(kind_of_pid(child.id()), Some(TurnKind::AutoChild));
        assert_eq!(caller_of(Some(sleeper)), Caller::Turn(TurnKind::AutoChild));
        assert_eq!(caller_of(Some(std::process::id())), Caller::Unknown);

        let pid = child.id();
        unsafe {
            libc::kill(sleeper as libc::pid_t, libc::SIGKILL);
        }
        let _ = child.kill();
        let _ = child.wait();
        drop(guard);
        assert_eq!(kind_of_pid(pid), None);
    }
}
