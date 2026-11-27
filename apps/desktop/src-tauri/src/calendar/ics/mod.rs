mod lines;
mod rrule;
mod time;

use std::collections::{HashMap, HashSet};

use chrono::{Days, NaiveDateTime};

use self::lines::{parse_components, Component};
use self::rrule::{expand, parse_rule, Expansion};
use self::time::{parse_duration_secs, parse_stamp, parse_stamps, Stamp, Zones};
use super::error::CalendarError;
use super::event::{CalendarEvent, EventStatus};
use super::links::call_link_of;

const CONFERENCE_FIELDS: [&str; 3] = [
    "CONFERENCE",
    "X-GOOGLE-CONFERENCE",
    "X-MICROSOFT-SKYPETEAMSMEETINGURL",
];

pub(crate) struct ParsedCalendar {
    pub name: Option<String>,
    events: Vec<Component>,
    zones: Zones,
}

pub(crate) fn parse_calendar(text: &str) -> Result<ParsedCalendar, CalendarError> {
    let calendar = parse_components(text)
        .into_iter()
        .find(|root| root.name == "VCALENDAR")
        .ok_or_else(|| CalendarError::Parse("the link did not return a calendar".to_string()))?;
    Ok(ParsedCalendar {
        name: calendar.text("X-WR-CALNAME"),
        zones: Zones::from_calendar(&calendar),
        events: calendar
            .children
            .into_iter()
            .filter(|child| child.name == "VEVENT")
            .collect(),
    })
}

pub(crate) struct Window<'a> {
    pub source_id: &'a str,
    pub calendar_id: &'a str,
    pub from_ms: i64,
    pub to_ms: i64,
}

fn status_of(event: &Component) -> EventStatus {
    match event
        .text("STATUS")
        .map(|status| status.to_ascii_uppercase())
        .as_deref()
    {
        Some("CANCELLED") => EventStatus::Cancelled,
        Some("TENTATIVE") => EventStatus::Tentative,
        _ => EventStatus::Confirmed,
    }
}

fn attendees_of(event: &Component) -> Vec<String> {
    let mut seen = HashSet::new();
    event
        .all("ATTENDEE")
        .filter_map(|attendee| attendee.param("CN"))
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty() && seen.insert(name.clone()))
        .collect()
}

struct Timing {
    start: Stamp,
    duration_ms: i64,
    days: u64,
}

impl ParsedCalendar {
    fn instant(&self, local: NaiveDateTime, stamp: &Stamp) -> i64 {
        self.zones.instant_ms(local, &stamp.zone)
    }

    fn timing_of(&self, event: &Component) -> Option<Timing> {
        let start = parse_stamp(event.first("DTSTART")?)?;
        let end = event.first("DTEND").and_then(parse_stamp);
        let duration = event
            .first("DURATION")
            .and_then(|property| parse_duration_secs(&property.value));
        if start.is_date {
            let days = match (&end, duration) {
                (Some(end), _) => (end.local.date() - start.local.date()).num_days(),
                (None, Some(seconds)) => seconds / 86_400,
                (None, None) => 1,
            };
            return Some(Timing {
                start,
                duration_ms: 0,
                days: u64::try_from(days.max(1)).unwrap_or(1),
            });
        }
        let start_ms = self.instant(start.local, &start);
        let duration_ms = match (&end, duration) {
            (Some(end), _) => self.instant(end.local, end) - start_ms,
            (None, Some(seconds)) => seconds * 1_000,
            (None, None) => 0,
        };
        Some(Timing {
            start,
            duration_ms: duration_ms.max(0),
            days: 0,
        })
    }

    fn end_of(&self, timing: &Timing, local: NaiveDateTime, at: i64) -> i64 {
        if !timing.start.is_date {
            return at + timing.duration_ms;
        }
        let end = local
            .checked_add_days(Days::new(timing.days))
            .unwrap_or(local);
        self.instant(end, &timing.start)
    }

    fn excluded_of(&self, event: &Component) -> HashSet<i64> {
        event
            .all("EXDATE")
            .flat_map(parse_stamps)
            .map(|stamp| self.instant(stamp.local, &stamp))
            .collect()
    }

    fn occurrences(
        &self,
        event: &Component,
        timing: &Timing,
        window: &Window,
    ) -> Vec<(NaiveDateTime, i64)> {
        let instant = |local: NaiveDateTime| self.instant(local, &timing.start);
        let span = match timing.start.is_date {
            true => i64::try_from(timing.days).unwrap_or(1) * 86_400_000,
            false => timing.duration_ms,
        };
        let Some(rule) = event
            .first("RRULE")
            .and_then(|rule| parse_rule(&rule.value))
        else {
            let at = instant(timing.start.local);
            return vec![(timing.start.local, at)];
        };
        expand(&Expansion {
            rule: &rule,
            start: timing.start.local,
            duration_ms: span,
            from_ms: window.from_ms,
            to_ms: window.to_ms,
            instant: &instant,
        })
    }

    fn event_at(
        &self,
        event: &Component,
        timing: &Timing,
        local: NaiveDateTime,
        window: &Window,
        uid: &str,
    ) -> Option<CalendarEvent> {
        let at = self.instant(local, &timing.start);
        let end = self.end_of(timing, local, at).max(at);
        let is_visible = at < window.to_ms && (end > window.from_ms || at >= window.from_ms);
        if !is_visible {
            return None;
        }
        let location = event.text("LOCATION");
        let description = event.text("DESCRIPTION");
        let url = event.text("URL");
        let conference: Vec<String> = CONFERENCE_FIELDS
            .iter()
            .filter_map(|field| event.text(field))
            .collect();
        let conference: Vec<&str> = conference.iter().map(String::as_str).collect();
        let link_text = [description.as_deref(), url.as_deref()]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .join("\n");
        let call = call_link_of(&conference, location.as_deref(), Some(link_text.as_str()));
        Some(CalendarEvent {
            id: format!("{}:{uid}:{at}", window.source_id),
            source_id: window.source_id.to_string(),
            calendar_id: window.calendar_id.to_string(),
            uid: uid.to_string(),
            title: event.text("SUMMARY").unwrap_or_default(),
            start: at,
            end,
            is_all_day: timing.start.is_date,
            location,
            is_call_link_trusted: call.as_ref().is_some_and(|call| call.is_trusted),
            call_link: call.map(|call| call.url),
            attendees: attendees_of(event),
            status: status_of(event),
            is_busy_only: false,
        })
    }

    fn uid_of(event: &Component, index: usize, window: &Window) -> String {
        event
            .text("UID")
            .unwrap_or_else(|| format!("{}:no-uid:{index}", window.calendar_id))
    }

    fn moved_occurrences(&self) -> HashMap<String, HashSet<i64>> {
        let mut moved: HashMap<String, HashSet<i64>> = HashMap::new();
        for event in &self.events {
            let (Some(uid), Some(recurrence)) = (event.text("UID"), event.first("RECURRENCE-ID"))
            else {
                continue;
            };
            let Some(stamp) = parse_stamp(recurrence) else {
                continue;
            };
            moved
                .entry(uid)
                .or_default()
                .insert(self.instant(stamp.local, &stamp));
        }
        moved
    }

    pub(crate) fn events(&self, window: &Window) -> Vec<CalendarEvent> {
        let moved = self.moved_occurrences();
        let mut found = Vec::new();
        for (index, event) in self.events.iter().enumerate() {
            if status_of(event) == EventStatus::Cancelled {
                continue;
            }
            let Some(timing) = self.timing_of(event) else {
                continue;
            };
            let uid = Self::uid_of(event, index, window);
            if event.first("RECURRENCE-ID").is_some() {
                found.extend(self.event_at(event, &timing, timing.start.local, window, &uid));
                continue;
            }
            let excluded = self.excluded_of(event);
            let skipped = moved.get(&uid);
            for (local, at) in self.occurrences(event, &timing, window) {
                if excluded.contains(&at) || skipped.is_some_and(|set| set.contains(&at)) {
                    continue;
                }
                found.extend(self.event_at(event, &timing, local, window, &uid));
            }
        }
        found.sort_by_key(|event| (event.start, event.end));
        found
    }
}

#[cfg(test)]
mod tests;
