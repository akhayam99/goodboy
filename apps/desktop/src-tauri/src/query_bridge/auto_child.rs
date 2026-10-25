use std::collections::HashMap;
use std::process::Child;
use std::sync::{Mutex, OnceLock};

use super::protocol::{
    Access, BridgeError, VerbSpec, AUTO_CHILD_ACT, CALLER_UNKNOWN, SCOPE_MISMATCH,
};
use crate::proc::kernel::Identity;

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TurnScope {
    pub(crate) workspace_id: Option<String>,
    pub(crate) session_id: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct Peer {
    pub(crate) caller: Caller,
    pub(crate) scope: Option<TurnScope>,
}

#[derive(Debug, Clone)]
struct Registered {
    start: Option<u64>,
    kind: TurnKind,
    scope: TurnScope,
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

pub(crate) struct SpawnTurnParams<F> {
    pub(crate) kind: TurnKind,
    pub(crate) scope: TurnScope,
    pub(crate) spawn: F,
}

pub(crate) fn spawn_turn<F: FnOnce() -> std::io::Result<Child>>(
    SpawnTurnParams { kind, scope, spawn }: SpawnTurnParams<F>,
) -> std::io::Result<(Child, TurnProcess)> {
    let mut registered = lock();
    let child = spawn()?;
    let pid = child.id();
    let start = crate::proc::kernel::identity(pid).map(|identity| identity.start);
    registered.insert(pid, Registered { start, kind, scope });
    Ok((child, TurnProcess { pid }))
}

fn registered_in(
    turns: &Turns,
    pid: u32,
    identity: &dyn Fn(u32) -> Option<Identity>,
) -> Option<Registered> {
    let mut current = pid;
    for _ in 0..MAX_ANCESTRY {
        if current <= 1 || current == std::process::id() {
            return None;
        }
        let found = identity(current)?;
        if let Some(turn) = turns.get(&current) {
            if turn.start.is_none_or(|start| start == found.start) {
                return Some(turn.clone());
            }
        }
        current = found.ppid;
    }
    None
}

fn peer_in(turns: &Turns, pid: u32, identity: &dyn Fn(u32) -> Option<Identity>) -> Peer {
    match registered_in(turns, pid, identity) {
        Some(turn) => Peer {
            caller: Caller::Turn(turn.kind),
            scope: Some(turn.scope),
        },
        None => Peer {
            caller: Caller::Unknown,
            scope: None,
        },
    }
}

#[cfg(test)]
fn caller_in(turns: &Turns, pid: u32, identity: &dyn Fn(u32) -> Option<Identity>) -> Caller {
    peer_in(turns, pid, identity).caller
}

pub(crate) fn peer_of(peer_pid: Option<u32>) -> Peer {
    let Some(pid) = peer_pid else {
        return Peer {
            caller: Caller::Unknown,
            scope: None,
        };
    };
    peer_in(&lock(), pid, &crate::proc::kernel::identity)
}

#[cfg(test)]
pub(crate) fn caller_of(peer_pid: Option<u32>) -> Caller {
    peer_of(peer_pid).caller
}

#[cfg(test)]
pub(crate) fn kind_of_pid(pid: u32) -> Option<TurnKind> {
    lock().get(&pid).map(|turn| turn.kind)
}

pub(super) fn refuse_caller(spec: &VerbSpec, caller: Caller) -> Result<(), BridgeError> {
    let (provider, verb) = (spec.provider, spec.verb);
    match caller {
        Caller::Turn(TurnKind::HandStarted) => Ok(()),
        Caller::Turn(TurnKind::AutoChild) => match spec.access {
            Access::Publish => Err(BridgeError::coded(
                AUTO_CHILD_ACT,
                format!(
                    "{provider} {verb} is not available to an Auto child. Goodboy pushes after its checks. Say in your report what should be pushed."
                ),
            )),
            Access::Read | Access::Write => Ok(()),
        },
        Caller::Unknown => Err(BridgeError::coded(
            CALLER_UNKNOWN,
            format!(
                "{provider} {verb} runs only for a turn Goodboy started, and this request did not come from one. Ask from the turn's own shell."
            ),
        )),
    }
}

pub(super) fn refuse_scope(
    scope: Option<&TurnScope>,
    workspace_id: &str,
    session_id: &str,
) -> Result<(), BridgeError> {
    let Some(scope) = scope else {
        return Ok(());
    };
    if scope.workspace_id.as_deref() != Some(workspace_id) {
        return Err(BridgeError::coded(
            SCOPE_MISMATCH,
            "this turn belongs to another workspace. Leave --workspace out and use the one in your environment.",
        ));
    }
    if !session_id.is_empty() && scope.session_id.as_deref() != Some(session_id) {
        return Err(BridgeError::coded(
            SCOPE_MISMATCH,
            "this turn belongs to another session. Leave --session out and use the one in your environment.",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::super::protocol::CATALOG;
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

    const PUBLISH_VERBS: &[(&str, &str)] = &[
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

    fn acme() -> TurnScope {
        TurnScope {
            workspace_id: Some("ws-acme".to_string()),
            session_id: Some("session-acme".to_string()),
        }
    }

    fn registry() -> Turns {
        HashMap::from([
            (
                AUTO_ROOT,
                Registered {
                    start: Some(START),
                    kind: TurnKind::AutoChild,
                    scope: acme(),
                },
            ),
            (
                HAND_ROOT,
                Registered {
                    start: Some(START),
                    kind: TurnKind::HandStarted,
                    scope: acme(),
                },
            ),
        ])
    }

    #[test]
    fn the_publishing_verbs_are_exactly_the_ones_listed_by_name() {
        let derived: Vec<(&str, &str)> = CATALOG
            .iter()
            .filter(|spec| spec.access == Access::Publish)
            .map(|spec| (spec.provider, spec.verb))
            .collect();
        assert_eq!(derived.len(), PUBLISH_VERBS.len());
        for (provider, verb) in PUBLISH_VERBS {
            assert!(derived.contains(&(*provider, *verb)), "{provider} {verb}");
        }
    }

    #[test]
    fn a_peer_carries_the_scope_the_turn_was_spawned_with() {
        let turns = registry();
        let peer = peer_in(&turns, 900_012, &identity_of);
        assert_eq!(peer.caller, Caller::Turn(TurnKind::AutoChild));
        assert_eq!(peer.scope, Some(acme()));
        let outside = peer_in(&turns, 900_031, &identity_of);
        assert_eq!(outside.caller, Caller::Unknown);
        assert_eq!(outside.scope, None);
    }

    #[test]
    fn a_workspace_or_session_that_is_not_the_turns_is_a_scope_mismatch() {
        let scope = acme();
        assert!(refuse_scope(Some(&scope), "ws-acme", "session-acme").is_ok());
        assert!(refuse_scope(Some(&scope), "ws-acme", "").is_ok());
        let other_workspace =
            refuse_scope(Some(&scope), "ws-northwind", "session-acme").expect_err("refused");
        assert_eq!(other_workspace.code.as_deref(), Some(SCOPE_MISMATCH));
        let other_session =
            refuse_scope(Some(&scope), "ws-acme", "session-northwind").expect_err("refused");
        assert_eq!(other_session.code.as_deref(), Some(SCOPE_MISMATCH));
    }

    #[test]
    fn a_turn_recorded_without_a_workspace_matches_no_workspace() {
        let scope = TurnScope {
            workspace_id: None,
            session_id: None,
        };
        let refusal = refuse_scope(Some(&scope), "ws-acme", "").expect_err("refused");
        assert_eq!(refusal.code.as_deref(), Some(SCOPE_MISMATCH));
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
                scope: acme(),
            },
        );
        assert_eq!(caller_in(&reused, 900_012, &identity_of), Caller::Unknown);
        assert_eq!(caller_of(None), Caller::Unknown);
    }

    #[test]
    fn every_publishing_verb_is_refused_for_an_auto_child() {
        for spec in CATALOG.iter().filter(|spec| spec.access == Access::Publish) {
            let refusal =
                refuse_caller(spec, Caller::Turn(TurnKind::AutoChild)).expect_err("refused");
            assert_eq!(refusal.code.as_deref(), Some(AUTO_CHILD_ACT));
            assert!(refusal.message.contains("Goodboy pushes after its checks"));
        }
    }

    #[test]
    fn every_verb_is_refused_for_an_unknown_caller() {
        for spec in CATALOG {
            let refusal = refuse_caller(spec, Caller::Unknown).expect_err("refused");
            assert_eq!(
                refusal.code.as_deref(),
                Some(CALLER_UNKNOWN),
                "{} {}",
                spec.provider,
                spec.verb
            );
        }
    }

    #[test]
    fn every_verb_is_allowed_for_a_hand_started_turn() {
        for spec in CATALOG {
            assert!(refuse_caller(spec, Caller::Turn(TurnKind::HandStarted)).is_ok());
        }
    }

    #[test]
    fn reads_comments_replies_and_resolves_pass_for_an_auto_child() {
        for spec in CATALOG.iter().filter(|spec| spec.access != Access::Publish) {
            assert!(
                refuse_caller(spec, Caller::Turn(TurnKind::AutoChild)).is_ok(),
                "{} {}",
                spec.provider,
                spec.verb
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn a_grandchild_of_a_spawned_auto_child_is_known_by_its_real_ancestry() {
        use std::io::BufRead;

        let (mut child, guard) = spawn_turn(SpawnTurnParams {
            kind: TurnKind::AutoChild,
            scope: acme(),
            spawn: || {
                std::process::Command::new("sh")
                    .args(["-c", "sleep 30 & echo $!; wait"])
                    .stdout(std::process::Stdio::piped())
                    .spawn()
            },
        })
        .expect("a spawned shell");
        let mut line = String::new();
        std::io::BufReader::new(child.stdout.take().expect("stdout"))
            .read_line(&mut line)
            .expect("the sleeper pid");
        let sleeper: u32 = line.trim().parse().expect("a pid");

        assert_eq!(kind_of_pid(child.id()), Some(TurnKind::AutoChild));
        assert_eq!(caller_of(Some(sleeper)), Caller::Turn(TurnKind::AutoChild));
        assert_eq!(peer_of(Some(sleeper)).scope, Some(acme()));
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
