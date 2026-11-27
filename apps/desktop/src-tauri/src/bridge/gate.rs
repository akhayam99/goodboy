use std::collections::{HashMap, VecDeque};
use std::net::IpAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub const MAX_UNAUTHENTICATED: usize = 8;
pub const MAX_PER_SOURCE: usize = 2;
pub const FREE_FAILURES: u32 = 2;
pub const BACKOFF_BASE: Duration = Duration::from_secs(2);
pub const BACKOFF_MAX: Duration = Duration::from_secs(300);
pub const FORGET_AFTER: Duration = Duration::from_secs(900);
pub const GLOBAL_WINDOW: Duration = Duration::from_secs(60);
pub const GLOBAL_FAILURES: usize = 30;
pub const GLOBAL_PAUSE: Duration = Duration::from_secs(30);
pub const MAX_SOURCES: usize = 4096;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Refusal {
    Full,
    SourceBusy,
    BackedOff { retry_after: Duration },
    Paused { retry_after: Duration },
}

#[derive(Default)]
struct Source {
    in_flight: usize,
    failures: u32,
    blocked_until: Option<Instant>,
    last_failure: Option<Instant>,
    last_seen: Option<Instant>,
}

#[derive(Default)]
struct State {
    in_flight: usize,
    sources: HashMap<IpAddr, Source>,
    recent_failures: VecDeque<Instant>,
    paused_until: Option<Instant>,
}

#[derive(Clone)]
pub struct HandshakeGate {
    max: usize,
    state: Arc<Mutex<State>>,
}

enum Settle {
    Success,
    Neutral,
    Failure(Instant),
    SourceOnly(Instant),
}

pub fn source_key(ip: IpAddr) -> IpAddr {
    match ip {
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => IpAddr::V4(v4),
            None => {
                let mut segments = v6.segments();
                for segment in &mut segments[4..] {
                    *segment = 0;
                }
                IpAddr::V6(segments.into())
            }
        },
        IpAddr::V4(_) => ip,
    }
}

fn evict_least_recent(state: &mut State) -> bool {
    let oldest = state
        .sources
        .iter()
        .filter(|(_, s)| s.in_flight == 0)
        .min_by_key(|(_, s)| s.last_seen)
        .map(|(ip, _)| *ip);
    match oldest {
        Some(ip) => {
            state.sources.remove(&ip);
            true
        }
        None => false,
    }
}

pub struct HandshakePermit {
    state: Arc<Mutex<State>>,
    ip: IpAddr,
    is_settled: bool,
}

pub fn backoff_after(failures: u32) -> Duration {
    if failures <= FREE_FAILURES {
        return Duration::ZERO;
    }
    let steps = (failures - FREE_FAILURES - 1).min(16);
    BACKOFF_BASE.saturating_mul(1u32 << steps).min(BACKOFF_MAX)
}

impl HandshakeGate {
    pub fn new(max: usize) -> Self {
        Self {
            max,
            state: Arc::new(Mutex::new(State::default())),
        }
    }

    pub fn try_enter(&self, ip: IpAddr) -> Result<HandshakePermit, Refusal> {
        self.try_enter_at(ip, Instant::now())
    }

    pub fn try_enter_at(&self, ip: IpAddr, now: Instant) -> Result<HandshakePermit, Refusal> {
        let ip = source_key(ip);
        let mut state = self.state.lock().map_err(|_| Refusal::Full)?;
        if let Some(until) = state.paused_until {
            if until > now {
                return Err(Refusal::Paused {
                    retry_after: until - now,
                });
            }
            state.paused_until = None;
        }
        if state.in_flight >= self.max {
            return Err(Refusal::Full);
        }
        forget_idle(&mut state, now);
        if !state.sources.contains_key(&ip)
            && state.sources.len() >= MAX_SOURCES
            && !evict_least_recent(&mut state)
        {
            return Err(Refusal::Full);
        }
        let source = state.sources.entry(ip).or_default();
        source.last_seen = Some(now);
        if let Some(until) = source.blocked_until {
            if until > now {
                return Err(Refusal::BackedOff {
                    retry_after: until - now,
                });
            }
        }
        if source.in_flight >= MAX_PER_SOURCE {
            return Err(Refusal::SourceBusy);
        }
        source.in_flight += 1;
        state.in_flight += 1;
        Ok(HandshakePermit {
            state: self.state.clone(),
            ip,
            is_settled: false,
        })
    }
}

fn forget_idle(state: &mut State, now: Instant) {
    state.sources.retain(|_, s| {
        s.in_flight > 0
            || s.blocked_until.is_some_and(|until| until > now)
            || s.last_failure
                .is_some_and(|at| now.saturating_duration_since(at) < FORGET_AFTER)
    });
}

impl HandshakePermit {
    pub fn succeed(mut self) {
        self.settle(Settle::Success);
    }

    pub fn release(mut self) {
        self.settle(Settle::Neutral);
    }

    pub fn fail(mut self) {
        self.settle(Settle::Failure(Instant::now()));
    }

    pub fn fail_source(mut self) {
        self.settle(Settle::SourceOnly(Instant::now()));
    }

    #[cfg(test)]
    pub fn fail_at(mut self, now: Instant) {
        self.settle(Settle::Failure(now));
    }

    fn settle(&mut self, outcome: Settle) {
        if self.is_settled {
            return;
        }
        self.is_settled = true;
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        state.in_flight = state.in_flight.saturating_sub(1);
        let Some(source) = state.sources.get_mut(&self.ip) else {
            return;
        };
        source.in_flight = source.in_flight.saturating_sub(1);
        let now = match outcome {
            Settle::Neutral => return,
            Settle::Success => {
                source.failures = 0;
                source.blocked_until = None;
                source.last_failure = None;
                return;
            }
            Settle::Failure(now) | Settle::SourceOnly(now) => now,
        };
        let is_global = matches!(outcome, Settle::Failure(_));
        source.failures = source.failures.saturating_add(1);
        source.last_failure = Some(now);
        let wait = backoff_after(source.failures);
        source.blocked_until = match wait.is_zero() {
            true => None,
            false => Some(now + wait),
        };
        if !is_global {
            return;
        }
        while state
            .recent_failures
            .front()
            .is_some_and(|at| now.saturating_duration_since(*at) > GLOBAL_WINDOW)
        {
            state.recent_failures.pop_front();
        }
        state.recent_failures.push_back(now);
        if state.recent_failures.len() >= GLOBAL_FAILURES {
            state.paused_until = Some(now + GLOBAL_PAUSE);
            state.recent_failures.clear();
        }
    }
}

impl Drop for HandshakePermit {
    fn drop(&mut self) {
        self.settle(Settle::Neutral);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_polite_release_keeps_the_history_of_the_source() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let last = fail_spaced(&gate, ip(9), FREE_FAILURES + 1, Instant::now());
        let later = last + BACKOFF_MAX + secs(1);
        gate.try_enter_at(ip(9), later).unwrap().release();
        gate.try_enter_at(ip(9), later).unwrap().fail_at(later);

        assert!(gate.try_enter_at(ip(9), later + secs(1)).is_err());
    }

    fn ip(last: u8) -> IpAddr {
        IpAddr::from([192, 168, 1, last])
    }

    fn secs(n: u64) -> Duration {
        Duration::from_secs(n)
    }

    #[test]
    fn a_source_holds_at_most_two_unauthenticated_connections() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let _one = gate.try_enter(ip(1)).unwrap();
        let _two = gate.try_enter(ip(1)).unwrap();

        assert_eq!(gate.try_enter(ip(1)).err(), Some(Refusal::SourceBusy));
        assert!(gate.try_enter(ip(2)).is_ok());
    }

    #[test]
    fn two_phones_behind_one_address_are_not_locked_out_by_a_third_holder() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let _holder = gate.try_enter(ip(1)).unwrap();

        assert!(gate.try_enter(ip(1)).is_ok());
    }

    #[test]
    fn the_total_of_unauthenticated_connections_is_capped() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let held: Vec<_> = (0..MAX_UNAUTHENTICATED as u8)
            .map(|n| gate.try_enter(ip(n)))
            .collect();

        assert!(held.iter().all(Result::is_ok));
        assert_eq!(gate.try_enter(ip(200)).err(), Some(Refusal::Full));
    }

    #[test]
    fn finishing_the_handshake_frees_the_slot() {
        let gate = HandshakeGate::new(1);
        let permit = gate.try_enter(ip(1)).unwrap();
        assert_eq!(gate.try_enter(ip(2)).err(), Some(Refusal::Full));

        permit.succeed();

        assert!(gate.try_enter(ip(2)).is_ok());
    }

    #[test]
    fn the_wait_after_failures_grows_and_stops_at_the_ceiling() {
        assert_eq!(backoff_after(0), Duration::ZERO);
        assert_eq!(backoff_after(FREE_FAILURES), Duration::ZERO);
        assert_eq!(backoff_after(FREE_FAILURES + 1), secs(2));
        assert_eq!(backoff_after(FREE_FAILURES + 2), secs(4));
        assert_eq!(backoff_after(FREE_FAILURES + 3), secs(8));
        assert_eq!(backoff_after(40), BACKOFF_MAX);
        assert_eq!(backoff_after(u32::MAX), BACKOFF_MAX);
    }

    #[test]
    fn a_source_that_keeps_failing_waits_longer_each_time_then_gets_back_in() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let t0 = Instant::now();
        for _ in 0..FREE_FAILURES {
            gate.try_enter_at(ip(1), t0).unwrap().fail_at(t0);
        }
        gate.try_enter_at(ip(1), t0).unwrap().fail_at(t0);

        assert_eq!(
            gate.try_enter_at(ip(1), t0 + secs(1)).err(),
            Some(Refusal::BackedOff {
                retry_after: secs(1)
            })
        );
        assert!(gate.try_enter_at(ip(1), t0 + secs(2)).is_ok());
    }

    #[test]
    fn a_second_wait_is_longer_than_the_first() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let t0 = Instant::now();
        for _ in 0..FREE_FAILURES + 1 {
            gate.try_enter_at(ip(1), t0).unwrap().fail_at(t0);
        }
        let t1 = t0 + secs(2);
        gate.try_enter_at(ip(1), t1).unwrap().fail_at(t1);

        assert_eq!(
            gate.try_enter_at(ip(1), t1 + secs(3)).err(),
            Some(Refusal::BackedOff {
                retry_after: secs(1)
            })
        );
        assert!(gate.try_enter_at(ip(1), t1 + secs(4)).is_ok());
    }

    fn fail_spaced(gate: &HandshakeGate, source: IpAddr, times: u32, start: Instant) -> Instant {
        let mut at = start;
        for _ in 0..times {
            gate.try_enter_at(source, at).unwrap().fail_at(at);
            at += BACKOFF_MAX + secs(1);
        }
        at - BACKOFF_MAX - secs(1)
    }

    #[test]
    fn a_failing_source_does_not_slow_down_another_address() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let last = fail_spaced(&gate, ip(1), FREE_FAILURES + 3, Instant::now());

        assert!(gate.try_enter_at(ip(1), last).is_err());
        assert!(gate.try_enter_at(ip(2), last).is_ok());
    }

    #[test]
    fn a_successful_handshake_clears_the_source_history() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let t0 = Instant::now();
        for _ in 0..FREE_FAILURES {
            gate.try_enter_at(ip(1), t0).unwrap().fail_at(t0);
        }
        gate.try_enter_at(ip(1), t0).unwrap().succeed();
        gate.try_enter_at(ip(1), t0).unwrap().fail_at(t0);

        assert!(gate.try_enter_at(ip(1), t0).is_ok());
    }

    #[test]
    fn a_bare_connect_and_close_counts_for_nothing() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        for _ in 0..GLOBAL_FAILURES * 3 {
            drop(gate.try_enter(ip(1)).unwrap());
        }

        assert!(gate.try_enter(ip(1)).is_ok());
        assert!(gate.try_enter(ip(2)).is_ok());
    }

    #[test]
    fn a_failed_handshake_backs_its_source_off() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        for _ in 0..FREE_FAILURES + 1 {
            gate.try_enter(ip(1)).unwrap().fail();
        }

        assert!(matches!(
            gate.try_enter(ip(1)).err(),
            Some(Refusal::BackedOff { .. })
        ));
    }

    #[test]
    fn a_stalled_handshake_slows_its_source_without_pausing_everyone() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        for _ in 0..GLOBAL_FAILURES + FREE_FAILURES as usize {
            let _ = gate.try_enter(ip(1)).map(|p| p.fail_source());
        }

        assert!(gate.try_enter(ip(1)).is_err());
        assert!(gate.try_enter(ip(2)).is_ok());
    }

    #[test]
    fn one_ipv6_prefix_is_one_source() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let in_prefix = |n: u16| -> IpAddr { format!("fd00:1:2:3::{n:x}").parse().unwrap() };
        for n in 0..FREE_FAILURES + 1 {
            gate.try_enter(in_prefix(n as u16 + 1)).unwrap().fail();
        }

        assert!(gate.try_enter(in_prefix(999)).is_err());
        assert!(gate.try_enter("fd00:1:2:4::1".parse().unwrap()).is_ok());
        assert_eq!(source_key("::ffff:192.168.1.7".parse().unwrap()), ip(7));
    }

    #[test]
    fn a_full_source_table_evicts_the_least_recent_instead_of_locking_out() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let base = Instant::now();
        for n in 0..MAX_SOURCES as u32 {
            let source: IpAddr = IpAddr::from([10, 1, (n >> 8) as u8, n as u8]);
            gate.try_enter_at(source, base + Duration::from_millis(u64::from(n)))
                .unwrap()
                .release();
        }

        let newcomer = IpAddr::from([172, 16, 0, 9]);

        assert!(gate
            .try_enter_at(newcomer, base + Duration::from_secs(60))
            .is_ok());
    }

    #[test]
    fn many_sources_failing_together_pause_new_attempts_for_everyone() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let t0 = Instant::now();
        for n in 0..GLOBAL_FAILURES as u8 {
            gate.try_enter_at(ip(n), t0).unwrap().fail_at(t0);
        }

        assert_eq!(
            gate.try_enter_at(ip(250), t0 + secs(1)).err(),
            Some(Refusal::Paused {
                retry_after: GLOBAL_PAUSE - secs(1)
            })
        );
        assert!(gate.try_enter_at(ip(250), t0 + GLOBAL_PAUSE).is_ok());
    }

    #[test]
    fn failures_older_than_the_window_do_not_add_up_to_a_pause() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let t0 = Instant::now();
        for n in 0..(GLOBAL_FAILURES as u8 - 1) {
            gate.try_enter_at(ip(n), t0).unwrap().fail_at(t0);
        }
        let later = t0 + GLOBAL_WINDOW + secs(5);
        gate.try_enter_at(ip(100), later).unwrap().fail_at(later);

        assert!(gate.try_enter_at(ip(101), later).is_ok());
    }

    #[test]
    fn a_source_forgotten_after_a_quiet_spell_starts_clean() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let last = fail_spaced(&gate, ip(1), FREE_FAILURES + 4, Instant::now());
        assert!(gate.try_enter_at(ip(1), last).is_err());

        assert!(gate
            .try_enter_at(ip(1), last + FORGET_AFTER + secs(1))
            .is_ok());
    }

    #[test]
    fn a_completed_handshake_clears_the_failure_count_of_its_source() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let last = fail_spaced(&gate, ip(5), FREE_FAILURES + 1, Instant::now());
        let later = last + BACKOFF_MAX + secs(1);

        gate.try_enter_at(ip(5), later).unwrap().succeed();

        for _ in 0..FREE_FAILURES {
            gate.try_enter_at(ip(5), later).unwrap().fail_at(later);
        }
        assert!(gate.try_enter_at(ip(5), later).is_ok());
    }
}
