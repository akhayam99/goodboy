use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};

use serde::Serialize;

use crate::turn::TurnEventPayload;
use crate::util::lock_or_recover;

pub const MAX_RUN_BACKLOG_BYTES: usize = 16 * 1024 * 1024;
pub const MAX_RUN_BACKLOG_EVENTS: usize = 50_000;
pub const EVENT_OVERHEAD_BYTES: usize = 64;
pub const MAX_ENDED_RUNS: usize = 16;

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct SequencedEvent {
    pub seq: u64,
    #[serde(flatten)]
    pub event: TurnEventPayload,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AttachSnapshot {
    pub events: Vec<SequencedEvent>,
    pub has_gap: bool,
    pub is_live: bool,
}

#[derive(Default)]
struct RunBacklog {
    events: VecDeque<SequencedEvent>,
    bytes: usize,
    next_seq: u64,
    dropped_through: Option<u64>,
    has_ended: bool,
}

#[derive(Default)]
struct BacklogState {
    runs: HashMap<String, RunBacklog>,
    ended: VecDeque<String>,
}

#[derive(Default, Clone)]
pub struct TurnBacklog(Arc<Mutex<BacklogState>>);

fn event_bytes(event: &TurnEventPayload) -> usize {
    let payload: usize = match event {
        TurnEventPayload::Line { line } => line.len(),
        TurnEventPayload::End { stderr, .. } => stderr.len(),
        TurnEventPayload::Error { message } => message.len(),
        TurnEventPayload::Reaped { stopped } => {
            stopped.iter().map(|process| process.name.len()).sum()
        }
    };
    EVENT_OVERHEAD_BYTES + payload
}

impl RunBacklog {
    fn push(&mut self, event: TurnEventPayload) -> u64 {
        self.next_seq += 1;
        let seq = self.next_seq;
        self.bytes += event_bytes(&event);
        self.events.push_back(SequencedEvent { seq, event });
        while (self.bytes > MAX_RUN_BACKLOG_BYTES || self.events.len() > MAX_RUN_BACKLOG_EVENTS)
            && self.events.len() > 1
        {
            let Some(oldest) = self.events.pop_front() else {
                break;
            };
            self.bytes -= event_bytes(&oldest.event);
            self.dropped_through = Some(oldest.seq);
        }
        seq
    }
}

impl TurnBacklog {
    pub fn open(&self, run_id: &str) {
        let mut state = lock_or_recover(&self.0);
        state.runs.insert(run_id.to_string(), RunBacklog::default());
        state.ended.retain(|id| id != run_id);
    }

    pub fn record(&self, run_id: &str, event: TurnEventPayload) -> u64 {
        lock_or_recover(&self.0)
            .runs
            .entry(run_id.to_string())
            .or_default()
            .push(event)
    }

    pub fn finish(&self, run_id: &str) {
        let mut state = lock_or_recover(&self.0);
        let Some(run) = state.runs.get_mut(run_id) else {
            return;
        };
        run.has_ended = true;
        state.ended.push_back(run_id.to_string());
        while state.ended.len() > MAX_ENDED_RUNS {
            if let Some(oldest) = state.ended.pop_front() {
                state.runs.remove(&oldest);
            }
        }
    }

    pub fn release(&self, run_id: &str) {
        let mut state = lock_or_recover(&self.0);
        let is_ended = state.runs.get(run_id).is_some_and(|run| run.has_ended);
        if !is_ended {
            return;
        }
        state.runs.remove(run_id);
        state.ended.retain(|id| id != run_id);
    }

    pub fn snapshot(&self, run_id: &str, after_seq: u64) -> Option<AttachSnapshot> {
        let state = lock_or_recover(&self.0);
        let run = state.runs.get(run_id)?;
        let events = run
            .events
            .iter()
            .filter(|event| event.seq > after_seq)
            .cloned()
            .collect();
        Some(AttachSnapshot {
            events,
            has_gap: run
                .dropped_through
                .is_some_and(|dropped| dropped > after_seq),
            is_live: !run.has_ended,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(text: &str) -> TurnEventPayload {
        TurnEventPayload::Line {
            line: Arc::from(text),
        }
    }

    #[test]
    fn blank_lines_are_bounded_by_count() {
        let backlog = TurnBacklog::default();
        backlog.open("run-1");
        for _ in 0..MAX_RUN_BACKLOG_EVENTS + 10 {
            backlog.record("run-1", line(""));
        }

        let snapshot = backlog.snapshot("run-1", 0).expect("snapshot");

        assert_eq!(snapshot.events.len(), MAX_RUN_BACKLOG_EVENTS);
        assert!(snapshot.has_gap);
        assert_eq!(snapshot.events.first().map(|event| event.seq), Some(11));
    }

    #[test]
    fn every_event_weighs_its_overhead() {
        assert_eq!(event_bytes(&line("")), EVENT_OVERHEAD_BYTES);
        assert_eq!(event_bytes(&line("abc")), EVENT_OVERHEAD_BYTES + 3);
    }

    #[test]
    fn a_poisoned_backlog_keeps_recording() {
        let backlog = TurnBacklog::default();
        backlog.open("run-1");
        let held = backlog.clone();
        let _ = std::thread::spawn(move || {
            let _guard = held.0.lock().expect("lock");
            panic!("poison the backlog");
        })
        .join();
        assert!(backlog.0.is_poisoned());

        assert_eq!(backlog.record("run-1", line("a")), 1);
        assert_eq!(backlog.record("run-1", line("b")), 2);
        assert_eq!(
            backlog.snapshot("run-1", 0).expect("snapshot").events.len(),
            2
        );
    }

    #[test]
    fn a_recorded_line_is_shared_not_copied() {
        let backlog = TurnBacklog::default();
        backlog.open("run-1");
        let text: Arc<str> = Arc::from("shared");
        backlog.record(
            "run-1",
            TurnEventPayload::Line {
                line: Arc::clone(&text),
            },
        );

        let snapshot = backlog.snapshot("run-1", 0).expect("snapshot");

        let TurnEventPayload::Line { line: stored } = &snapshot.events[0].event else {
            panic!("expected a line");
        };
        assert!(Arc::ptr_eq(stored, &text));
    }

    #[test]
    fn snapshot_returns_only_events_after_the_cursor() {
        let backlog = TurnBacklog::default();
        backlog.open("run-1");
        assert_eq!(backlog.record("run-1", line("a")), 1);
        assert_eq!(backlog.record("run-1", line("b")), 2);
        assert_eq!(backlog.record("run-1", line("c")), 3);

        let snapshot = backlog.snapshot("run-1", 1).expect("snapshot");

        assert_eq!(
            snapshot.events,
            vec![
                SequencedEvent {
                    seq: 2,
                    event: line("b")
                },
                SequencedEvent {
                    seq: 3,
                    event: line("c")
                },
            ]
        );
        assert!(snapshot.is_live);
        assert!(!snapshot.has_gap);
    }

    #[test]
    fn an_ended_run_keeps_its_end_for_a_late_attach() {
        let backlog = TurnBacklog::default();
        backlog.open("run-1");
        backlog.record("run-1", line("a"));
        backlog.record(
            "run-1",
            TurnEventPayload::End {
                exit_code: Some(0),
                stderr: String::new(),
            },
        );
        backlog.finish("run-1");

        let snapshot = backlog.snapshot("run-1", 1).expect("snapshot");

        assert!(!snapshot.is_live);
        assert!(matches!(
            snapshot.events.as_slice(),
            [SequencedEvent {
                seq: 2,
                event: TurnEventPayload::End { .. }
            }]
        ));
    }

    #[test]
    fn eviction_past_the_cursor_reports_a_gap() {
        let backlog = TurnBacklog::default();
        backlog.open("run-1");
        let big = "x".repeat(MAX_RUN_BACKLOG_BYTES / 2 + 1);
        backlog.record("run-1", line(&big));
        backlog.record("run-1", line(&big));
        backlog.record("run-1", line("tail"));

        let from_start = backlog.snapshot("run-1", 0).expect("snapshot");
        let after_evicted = backlog.snapshot("run-1", 1).expect("snapshot");

        assert!(from_start.has_gap);
        assert!(!after_evicted.has_gap);
        assert_eq!(from_start.events.first().map(|event| event.seq), Some(2));
    }

    #[test]
    fn release_drops_only_an_ended_run() {
        let backlog = TurnBacklog::default();
        backlog.open("run-1");
        backlog.record("run-1", line("a"));

        backlog.release("run-1");
        assert!(backlog.snapshot("run-1", 0).is_some());

        backlog.finish("run-1");
        backlog.release("run-1");
        assert!(backlog.snapshot("run-1", 0).is_none());
    }

    #[test]
    fn only_the_newest_ended_runs_are_kept() {
        let backlog = TurnBacklog::default();
        for index in 0..=MAX_ENDED_RUNS {
            let run_id = format!("run-{index}");
            backlog.open(&run_id);
            backlog.record(&run_id, line("a"));
            backlog.finish(&run_id);
        }

        assert!(backlog.snapshot("run-0", 0).is_none());
        assert!(backlog
            .snapshot(&format!("run-{MAX_ENDED_RUNS}"), 0)
            .is_some());
    }

    #[test]
    fn an_unknown_run_has_no_snapshot() {
        assert!(TurnBacklog::default().snapshot("missing", 0).is_none());
    }
}
