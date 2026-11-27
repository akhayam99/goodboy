use std::collections::HashSet;

use super::error::CalendarError;
use super::event::{CalendarEvent, CalendarInfo, EventStatus};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Range {
    pub from_ms: i64,
    pub to_ms: i64,
}

const MAX_RANGE_MS: i64 = 366 * 86_400_000;

impl Range {
    pub(crate) fn checked(from_ms: i64, to_ms: i64) -> Result<Self, CalendarError> {
        if to_ms <= from_ms {
            return Err(CalendarError::Refused(
                "the range ends before it starts".to_string(),
            ));
        }
        if to_ms - from_ms > MAX_RANGE_MS {
            return Err(CalendarError::Refused(
                "the range is longer than a year".to_string(),
            ));
        }
        Ok(Self { from_ms, to_ms })
    }
}

pub(crate) trait CalendarSource {
    fn calendars(&self) -> Result<Vec<CalendarInfo>, CalendarError>;
    fn events(&self, range: Range) -> Result<Vec<CalendarEvent>, CalendarError>;
}

pub(crate) fn dedupe(events: Vec<CalendarEvent>) -> Vec<CalendarEvent> {
    let mut seen = HashSet::new();
    let mut kept: Vec<CalendarEvent> = events
        .into_iter()
        .filter(|event| event.status != EventStatus::Cancelled)
        .filter(|event| seen.insert((event.uid.clone(), event.start)))
        .collect();
    kept.sort_by(|left, right| {
        (left.start, left.end, &left.id).cmp(&(right.start, right.end, &right.id))
    });
    kept
}

#[cfg(test)]
pub(crate) mod test_support {
    use super::super::event::{CalendarEvent, EventStatus};

    pub(crate) fn event(calendar_id: &str, uid: &str, start: i64) -> CalendarEvent {
        CalendarEvent {
            id: format!("src:{calendar_id}:{uid}:{start}"),
            source_id: "src".to_string(),
            calendar_id: calendar_id.to_string(),
            uid: uid.to_string(),
            title: "Northwind review".to_string(),
            start,
            end: start + 1_800_000,
            is_all_day: false,
            location: None,
            call_link: None,
            is_call_link_trusted: false,
            attendees: Vec::new(),
            status: EventStatus::Confirmed,
            is_busy_only: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::event;
    use super::*;

    #[test]
    fn one_meeting_in_two_calendars_shows_once() {
        let kept = dedupe(vec![
            event("work", "review@northwind", 1_000),
            event("personal", "review@northwind", 1_000),
            event("work", "other@acme", 2_000),
        ]);
        assert_eq!(kept.len(), 2);
        assert_eq!(kept[0].calendar_id, "work");
        assert_eq!(kept[1].uid, "other@acme");
    }

    #[test]
    fn two_occurrences_of_one_series_both_stay() {
        let kept = dedupe(vec![
            event("work", "standup@ledger-core", 2_000),
            event("work", "standup@ledger-core", 1_000),
        ]);
        let starts: Vec<i64> = kept.iter().map(|event| event.start).collect();
        assert_eq!(starts, vec![1_000, 2_000]);
    }

    #[test]
    fn a_cancelled_event_is_dropped_and_does_not_hide_a_live_copy() {
        let mut cancelled = event("personal", "sync@acme", 1_000);
        cancelled.status = EventStatus::Cancelled;
        let kept = dedupe(vec![cancelled, event("work", "sync@acme", 1_000)]);
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].calendar_id, "work");
    }

    #[test]
    fn a_range_must_run_forward_and_stay_under_a_year() {
        assert!(Range::checked(0, 1).is_ok());
        assert!(matches!(Range::checked(5, 5), Err(CalendarError::Refused(_))));
        assert!(matches!(
            Range::checked(0, MAX_RANGE_MS + 1),
            Err(CalendarError::Refused(_))
        ));
    }
}
