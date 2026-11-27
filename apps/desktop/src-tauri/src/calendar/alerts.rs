use std::collections::{HashMap, HashSet};
use std::time::Duration;

use serde::{Deserialize, Serialize};

pub(crate) const FIVE_MINUTES_MS: i64 = 5 * 60_000;
pub(crate) const ONE_MINUTE_MS: i64 = 60_000;
const STARTED_FOR_MS: i64 = 10 * 60_000;
const ENDED_FOR_MS: i64 = 30 * 60_000;
const FIRED_KEPT_MS: i64 = 6 * 60 * 60_000;
const MAX_ARMED: usize = 200;
const MIN_WAIT_MS: i64 = 200;
pub(crate) const MAX_WAIT_MS: i64 = 15_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ArmedCall {
    pub event_id: String,
    pub start: i64,
    pub end: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum Moment {
    FiveMinutes,
    OneMinute,
    Snoozed,
    Ended,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CallAlert {
    pub event_id: String,
    pub moment: Moment,
    pub start: i64,
    pub end: i64,
}

#[derive(Debug, Default)]
pub(crate) struct AlertBook {
    calls: Vec<ArmedCall>,
    snoozes: HashMap<String, i64>,
    fired: HashSet<(String, Moment, i64)>,
}

struct Window {
    moment: Moment,
    from: i64,
    until: i64,
}

fn windows_of(call: &ArmedCall) -> [Window; 3] {
    [
        Window {
            moment: Moment::FiveMinutes,
            from: call.start - FIVE_MINUTES_MS,
            until: call.start - ONE_MINUTE_MS,
        },
        Window {
            moment: Moment::OneMinute,
            from: call.start - ONE_MINUTE_MS,
            until: call.end.min(call.start + STARTED_FOR_MS),
        },
        Window {
            moment: Moment::Ended,
            from: call.end,
            until: call.end + ENDED_FOR_MS,
        },
    ]
}

fn alert_of(call: &ArmedCall, moment: Moment) -> CallAlert {
    CallAlert {
        event_id: call.event_id.clone(),
        moment,
        start: call.start,
        end: call.end,
    }
}

impl AlertBook {
    pub(crate) fn arm(&mut self, calls: Vec<ArmedCall>) -> usize {
        let mut seen = HashSet::new();
        self.calls = calls
            .into_iter()
            .filter(|call| call.end > call.start && !call.event_id.is_empty())
            .filter(|call| seen.insert(call.event_id.clone()))
            .take(MAX_ARMED)
            .collect();
        let armed: HashSet<&str> = self
            .calls
            .iter()
            .map(|call| call.event_id.as_str())
            .collect();
        self.snoozes.retain(|id, _| armed.contains(id.as_str()));
        self.calls.len()
    }

    pub(crate) fn snooze(&mut self, event_id: &str, at: i64) -> bool {
        if !self.calls.iter().any(|call| call.event_id == event_id) {
            return false;
        }
        self.snoozes.insert(event_id.to_string(), at);
        true
    }

    fn call(&self, event_id: &str) -> Option<&ArmedCall> {
        self.calls.iter().find(|call| call.event_id == event_id)
    }

    pub(crate) fn due(&mut self, now: i64) -> Vec<CallAlert> {
        self.fired
            .retain(|(_, _, from)| *from > now - FIRED_KEPT_MS);
        let mut alerts = Vec::new();
        for call in &self.calls {
            for window in windows_of(call) {
                if now < window.from || now >= window.until {
                    continue;
                }
                if self
                    .fired
                    .insert((call.event_id.clone(), window.moment, window.from))
                {
                    alerts.push(alert_of(call, window.moment));
                }
            }
        }
        let ready: Vec<(String, i64)> = self
            .snoozes
            .iter()
            .filter(|(_, at)| **at <= now)
            .map(|(id, at)| (id.clone(), *at))
            .collect();
        for (event_id, at) in ready {
            self.snoozes.remove(&event_id);
            let Some(call) = self.call(&event_id) else {
                continue;
            };
            if now >= call.end {
                continue;
            }
            let alert = alert_of(call, Moment::Snoozed);
            if self.fired.insert((event_id, Moment::Snoozed, at)) {
                alerts.push(alert);
            }
        }
        alerts
    }

    pub(crate) fn next_at(&self, now: i64) -> Option<i64> {
        let windows = self
            .calls
            .iter()
            .flat_map(|call| windows_of(call).map(|window| window.from));
        windows
            .chain(self.snoozes.values().copied())
            .filter(|at| *at > now)
            .min()
    }
}

pub(crate) fn wait_until(next: Option<i64>, now: i64) -> Duration {
    let wait = match next {
        Some(at) => (at - now).clamp(MIN_WAIT_MS, MAX_WAIT_MS),
        None => MAX_WAIT_MS,
    };
    Duration::from_millis(u64::try_from(wait).unwrap_or(0))
}

#[cfg(test)]
mod tests {
    use super::*;

    const START: i64 = 1_795_000_000_000;
    const HOUR: i64 = 60 * 60_000;

    fn call(id: &str) -> ArmedCall {
        ArmedCall {
            event_id: id.to_string(),
            start: START,
            end: START + 30 * 60_000,
        }
    }

    fn moments(alerts: &[CallAlert]) -> Vec<Moment> {
        alerts.iter().map(|alert| alert.moment).collect()
    }

    fn book_with(calls: Vec<ArmedCall>) -> AlertBook {
        let mut book = AlertBook::default();
        book.arm(calls);
        book
    }

    #[test]
    fn fires_five_minutes_and_one_minute_before_the_start() {
        let mut book = book_with(vec![call("northwind-sync")]);
        assert!(book.due(START - FIVE_MINUTES_MS - 1).is_empty());
        assert_eq!(
            moments(&book.due(START - FIVE_MINUTES_MS)),
            vec![Moment::FiveMinutes]
        );
        assert!(book.due(START - 2 * ONE_MINUTE_MS).is_empty());
        assert_eq!(
            moments(&book.due(START - ONE_MINUTE_MS)),
            vec![Moment::OneMinute]
        );
        assert!(book.due(START).is_empty());
    }

    #[test]
    fn never_fires_one_moment_twice_even_when_armed_again() {
        let mut book = book_with(vec![call("northwind-sync")]);
        assert_eq!(book.due(START - FIVE_MINUTES_MS).len(), 1);
        book.arm(vec![call("northwind-sync")]);
        assert!(book.due(START - FIVE_MINUTES_MS + 1_000).is_empty());
        assert!(book.due(START - FIVE_MINUTES_MS + 2_000).is_empty());
    }

    #[test]
    fn a_moved_meeting_fires_again_at_its_new_time() {
        let mut book = book_with(vec![call("northwind-sync")]);
        assert_eq!(book.due(START - FIVE_MINUTES_MS).len(), 1);
        let mut moved = call("northwind-sync");
        moved.start += HOUR;
        moved.end += HOUR;
        book.arm(vec![moved]);
        assert_eq!(
            moments(&book.due(START + HOUR - FIVE_MINUTES_MS)),
            vec![Moment::FiveMinutes]
        );
    }

    #[test]
    fn after_a_wake_only_the_moment_still_open_fires() {
        let mut book = book_with(vec![call("northwind-sync")]);
        assert!(book.due(START - 20 * ONE_MINUTE_MS).is_empty());
        assert_eq!(moments(&book.due(START - 30_000)), vec![Moment::OneMinute]);
    }

    #[test]
    fn after_a_wake_past_every_window_nothing_fires() {
        let mut book = book_with(vec![call("northwind-sync")]);
        assert!(book.due(START - 20 * ONE_MINUTE_MS).is_empty());
        assert!(book.due(START + 3 * HOUR).is_empty());
    }

    #[test]
    fn a_wake_after_the_start_still_offers_the_call_for_a_while() {
        let mut book = book_with(vec![call("northwind-sync")]);
        assert_eq!(
            moments(&book.due(START + 4 * ONE_MINUTE_MS)),
            vec![Moment::OneMinute]
        );
        let mut late = book_with(vec![call("northwind-sync")]);
        assert!(late.due(START + STARTED_FOR_MS).is_empty());
    }

    #[test]
    fn the_end_fires_once_when_the_meeting_ends() {
        let mut book = book_with(vec![call("northwind-sync")]);
        let end = START + 30 * 60_000;
        assert_eq!(moments(&book.due(end)), vec![Moment::Ended]);
        assert!(book.due(end + 1_000).is_empty());
    }

    #[test]
    fn a_snooze_fires_once_at_its_time() {
        let mut book = book_with(vec![call("northwind-sync")]);
        book.due(START - ONE_MINUTE_MS);
        assert!(book.snooze("northwind-sync", START + 4 * ONE_MINUTE_MS));
        assert!(book.due(START + 3 * ONE_MINUTE_MS).is_empty());
        let fired = book.due(START + 4 * ONE_MINUTE_MS);
        assert_eq!(moments(&fired), vec![Moment::Snoozed]);
        assert_eq!(fired[0].event_id, "northwind-sync");
        assert!(book.due(START + 5 * ONE_MINUTE_MS).is_empty());
    }

    #[test]
    fn a_snooze_that_wakes_after_the_end_stays_quiet() {
        let mut book = book_with(vec![call("northwind-sync")]);
        book.snooze("northwind-sync", START + 2 * ONE_MINUTE_MS);
        let fired = book.due(START + HOUR);
        assert!(!moments(&fired).contains(&Moment::Snoozed));
    }

    #[test]
    fn a_snooze_needs_an_armed_call() {
        let mut book = book_with(vec![call("northwind-sync")]);
        assert!(!book.snooze("acme-review", START));
        book.snooze("northwind-sync", START);
        book.arm(vec![call("acme-review")]);
        assert!(!moments(&book.due(START)).contains(&Moment::Snoozed));
    }

    #[test]
    fn arming_drops_duplicates_and_meetings_that_end_before_they_start() {
        let mut broken = call("ledger-core-review");
        broken.end = broken.start;
        let mut book = AlertBook::default();
        assert_eq!(
            book.arm(vec![call("northwind-sync"), call("northwind-sync"), broken]),
            1
        );
    }

    #[test]
    fn an_empty_arming_clears_every_alert() {
        let mut book = book_with(vec![call("northwind-sync")]);
        book.arm(Vec::new());
        assert!(book.due(START - FIVE_MINUTES_MS).is_empty());
        assert_eq!(book.next_at(START - HOUR), None);
    }

    #[test]
    fn the_next_wake_is_the_nearest_window_or_snooze() {
        let mut book = book_with(vec![call("northwind-sync")]);
        assert_eq!(book.next_at(START - HOUR), Some(START - FIVE_MINUTES_MS));
        book.snooze("northwind-sync", START - 3 * ONE_MINUTE_MS);
        assert_eq!(
            book.next_at(START - 4 * ONE_MINUTE_MS),
            Some(START - 3 * ONE_MINUTE_MS)
        );
    }

    #[test]
    fn the_wait_is_capped_so_a_wake_recomputes_soon() {
        assert_eq!(wait_until(None, 0), Duration::from_millis(15_000));
        assert_eq!(wait_until(Some(HOUR), 0), Duration::from_millis(15_000));
        assert_eq!(wait_until(Some(5_000), 0), Duration::from_millis(5_000));
        assert_eq!(wait_until(Some(-5), 0), Duration::from_millis(200));
    }

    #[test]
    fn an_alert_crosses_the_wire_in_camel_case() {
        let alert = alert_of(&call("northwind-sync"), Moment::OneMinute);
        assert_eq!(
            serde_json::to_value(alert).unwrap(),
            serde_json::json!({
                "eventId": "northwind-sync",
                "moment": "one-minute",
                "start": START,
                "end": START + 30 * 60_000
            })
        );
    }
}
