use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::util::lock_or_recover;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnQuiet {
    pub run_id: String,
    pub quiet_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct LiveTurn {
    pub(crate) run_id: String,
    pub(crate) pid: u32,
    pub(crate) output_idle: Duration,
}

#[derive(Debug, Clone, Copy)]
struct CpuMark {
    cpu: u64,
    since: Instant,
}

#[derive(Default)]
pub struct QuietTracker {
    marks: Mutex<HashMap<String, CpuMark>>,
}

impl QuietTracker {
    pub(crate) fn measure(
        &self,
        turns: &[LiveTurn],
        cpus: &HashMap<u32, u64>,
        now: Instant,
    ) -> Vec<TurnQuiet> {
        let mut marks = lock_or_recover(&self.marks);
        marks.retain(|run_id, _| turns.iter().any(|turn| &turn.run_id == run_id));
        turns
            .iter()
            .filter_map(|turn| {
                let cpu = *cpus.get(&turn.pid)?;
                let mark = marks
                    .entry(turn.run_id.clone())
                    .or_insert(CpuMark { cpu, since: now });
                if mark.cpu != cpu {
                    *mark = CpuMark { cpu, since: now };
                }
                let cpu_idle = now.saturating_duration_since(mark.since);
                let quiet = turn.output_idle.min(cpu_idle);
                Some(TurnQuiet {
                    run_id: turn.run_id.clone(),
                    quiet_ms: u64::try_from(quiet.as_millis()).unwrap_or(u64::MAX),
                })
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn turn(run_id: &str, pid: u32, idle_secs: u64) -> LiveTurn {
        LiveTurn {
            run_id: run_id.to_string(),
            pid,
            output_idle: Duration::from_secs(idle_secs),
        }
    }

    fn cpus(pairs: &[(u32, u64)]) -> HashMap<u32, u64> {
        pairs.iter().copied().collect()
    }

    #[test]
    fn a_silent_turn_with_a_flat_cpu_grows_quieter_with_each_look() {
        let tracker = QuietTracker::default();
        let start = Instant::now();
        let turns = [turn("run-a", 10, 600)];

        let first = tracker.measure(&turns, &cpus(&[(10, 5)]), start);
        let later = tracker.measure(
            &[turn("run-a", 10, 660)],
            &cpus(&[(10, 5)]),
            start + Duration::from_secs(60),
        );

        assert_eq!(first[0].quiet_ms, 0);
        assert_eq!(later[0].quiet_ms, 60_000);
    }

    #[test]
    fn a_turn_that_burns_cpu_is_never_quiet_even_without_output() {
        let tracker = QuietTracker::default();
        let start = Instant::now();

        tracker.measure(&[turn("run-a", 10, 900)], &cpus(&[(10, 5)]), start);
        let busy = tracker.measure(
            &[turn("run-a", 10, 960)],
            &cpus(&[(10, 9)]),
            start + Duration::from_secs(60),
        );

        assert_eq!(busy[0].quiet_ms, 0);
    }

    #[test]
    fn output_resets_the_quiet_time_even_when_the_cpu_is_flat() {
        let tracker = QuietTracker::default();
        let start = Instant::now();
        tracker.measure(&[turn("run-a", 10, 900)], &cpus(&[(10, 5)]), start);

        let talked = tracker.measure(
            &[turn("run-a", 10, 3)],
            &cpus(&[(10, 5)]),
            start + Duration::from_secs(600),
        );

        assert_eq!(talked[0].quiet_ms, 3_000);
    }

    #[test]
    fn no_cpu_reading_means_no_claim() {
        let tracker = QuietTracker::default();

        let measured = tracker.measure(&[turn("run-a", 10, 900)], &cpus(&[]), Instant::now());

        assert!(measured.is_empty());
    }

    #[test]
    fn a_finished_turn_is_forgotten() {
        let tracker = QuietTracker::default();
        let start = Instant::now();
        tracker.measure(&[turn("run-a", 10, 900)], &cpus(&[(10, 5)]), start);
        tracker.measure(&[], &cpus(&[]), start + Duration::from_secs(5));

        let again = tracker.measure(
            &[turn("run-a", 10, 900)],
            &cpus(&[(10, 5)]),
            start + Duration::from_secs(600),
        );

        assert_eq!(again[0].quiet_ms, 0);
    }
}
