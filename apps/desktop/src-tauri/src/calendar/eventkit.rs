use super::error::CalendarError;
use super::event::{AccessState, CalendarEvent, CalendarInfo, EventStatus};
use super::links::call_link_of;
use super::source::{CalendarSource, Range};

const STATUS_TENTATIVE: isize = 2;
const STATUS_CANCELLED: isize = 3;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct RawCalendar {
    pub id: String,
    pub title: String,
    pub account: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct RawEvent {
    pub identifier: String,
    pub external_id: Option<String>,
    pub calendar_id: String,
    pub title: Option<String>,
    pub start_ms: i64,
    pub end_ms: i64,
    pub is_all_day: bool,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub url: Option<String>,
    pub status: isize,
    pub attendees: Vec<String>,
}

pub(crate) trait EventStore {
    fn access(&self) -> AccessState;
    fn request_access(&self) -> AccessState;
    fn calendars(&self) -> Vec<RawCalendar>;
    fn events(&self, range: Range) -> Vec<RawEvent>;
}

pub(crate) fn access_state_of(status: isize) -> AccessState {
    match status {
        0 => AccessState::NotDetermined,
        1 => AccessState::Restricted,
        3 => AccessState::Granted,
        _ => AccessState::Denied,
    }
}

pub(crate) struct EventKitSource<'a> {
    pub source_id: &'a str,
    pub store: &'a dyn EventStore,
}

impl EventKitSource<'_> {
    fn require_access(&self) -> Result<(), CalendarError> {
        match self.store.access() {
            AccessState::Granted => Ok(()),
            AccessState::Unsupported => Err(CalendarError::Unsupported),
            _ => Err(CalendarError::NoAccess),
        }
    }

    fn event_of(&self, raw: RawEvent) -> Option<CalendarEvent> {
        let status = match raw.status {
            STATUS_CANCELLED => return None,
            STATUS_TENTATIVE => EventStatus::Tentative,
            _ => EventStatus::Confirmed,
        };
        let links = [raw.notes.as_deref(), raw.url.as_deref()]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .join("\n");
        let call = call_link_of(&[], raw.location.as_deref(), Some(links.as_str()));
        let uid = raw
            .external_id
            .filter(|uid| !uid.trim().is_empty())
            .unwrap_or_else(|| raw.identifier.clone());
        Some(CalendarEvent {
            id: format!("{}:{}:{}", self.source_id, raw.identifier, raw.start_ms),
            source_id: self.source_id.to_string(),
            calendar_id: raw.calendar_id,
            uid,
            title: raw.title.unwrap_or_default(),
            start: raw.start_ms,
            end: raw.end_ms.max(raw.start_ms),
            is_all_day: raw.is_all_day,
            location: raw.location.filter(|text| !text.trim().is_empty()),
            is_call_link_trusted: call.as_ref().is_some_and(|call| call.is_trusted),
            call_link: call.map(|call| call.url),
            attendees: raw
                .attendees
                .into_iter()
                .filter(|name| !name.trim().is_empty())
                .collect(),
            status,
            is_busy_only: false,
        })
    }
}

impl CalendarSource for EventKitSource<'_> {
    fn calendars(&self) -> Result<Vec<CalendarInfo>, CalendarError> {
        self.require_access()?;
        Ok(self
            .store
            .calendars()
            .into_iter()
            .map(|raw| CalendarInfo {
                id: raw.id,
                source_id: self.source_id.to_string(),
                title: raw.title,
                account: raw.account,
            })
            .collect())
    }

    fn events(&self, range: Range) -> Result<Vec<CalendarEvent>, CalendarError> {
        self.require_access()?;
        Ok(self
            .store
            .events(range)
            .into_iter()
            .filter_map(|raw| self.event_of(raw))
            .collect())
    }
}

pub(crate) struct NativeStore;

#[cfg(target_os = "macos")]
impl EventStore for NativeStore {
    fn access(&self) -> AccessState {
        access_state_of(crate::platform::event_kit::authorization_status())
    }

    fn request_access(&self) -> AccessState {
        crate::platform::event_kit::request_full_access(std::time::Duration::from_secs(300));
        self.access()
    }

    fn calendars(&self) -> Vec<RawCalendar> {
        crate::platform::event_kit::calendars()
    }

    fn events(&self, range: Range) -> Vec<RawEvent> {
        crate::platform::event_kit::events(range.from_ms, range.to_ms)
    }
}

#[cfg(not(target_os = "macos"))]
impl EventStore for NativeStore {
    fn access(&self) -> AccessState {
        AccessState::Unsupported
    }

    fn request_access(&self) -> AccessState {
        AccessState::Unsupported
    }

    fn calendars(&self) -> Vec<RawCalendar> {
        Vec::new()
    }

    fn events(&self, _range: Range) -> Vec<RawEvent> {
        Vec::new()
    }
}

#[cfg(test)]
pub(crate) mod test_support {
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Mutex;

    use super::*;

    pub(crate) struct FakeStore {
        pub state: Mutex<AccessState>,
        pub answer: AccessState,
        pub calendars: Vec<RawCalendar>,
        pub events: Vec<RawEvent>,
        pub requests: AtomicUsize,
    }

    impl FakeStore {
        pub(crate) fn with(state: AccessState) -> Self {
            Self {
                state: Mutex::new(state),
                answer: AccessState::Granted,
                calendars: Vec::new(),
                events: Vec::new(),
                requests: AtomicUsize::new(0),
            }
        }

        pub(crate) fn request_count(&self) -> usize {
            self.requests.load(Ordering::SeqCst)
        }
    }

    impl EventStore for FakeStore {
        fn access(&self) -> AccessState {
            *self.state.lock().unwrap()
        }

        fn request_access(&self) -> AccessState {
            self.requests.fetch_add(1, Ordering::SeqCst);
            *self.state.lock().unwrap() = self.answer;
            self.answer
        }

        fn calendars(&self) -> Vec<RawCalendar> {
            self.calendars.clone()
        }

        fn events(&self, range: Range) -> Vec<RawEvent> {
            self.events
                .iter()
                .filter(|event| event.start_ms < range.to_ms && event.end_ms > range.from_ms)
                .cloned()
                .collect()
        }
    }

    pub(crate) fn raw_event(identifier: &str, calendar_id: &str, start_ms: i64) -> RawEvent {
        RawEvent {
            identifier: identifier.to_string(),
            external_id: Some(format!("{identifier}@northwind")),
            calendar_id: calendar_id.to_string(),
            title: Some("Northwind sync".to_string()),
            start_ms,
            end_ms: start_ms + 1_800_000,
            is_all_day: false,
            location: None,
            notes: None,
            url: None,
            status: 1,
            attendees: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::{raw_event, FakeStore};
    use super::*;

    fn range() -> Range {
        Range::checked(0, 10_000_000).unwrap()
    }

    #[test]
    fn the_authorization_codes_map_to_access_states() {
        assert_eq!(access_state_of(0), AccessState::NotDetermined);
        assert_eq!(access_state_of(1), AccessState::Restricted);
        assert_eq!(access_state_of(2), AccessState::Denied);
        assert_eq!(access_state_of(3), AccessState::Granted);
        assert_eq!(access_state_of(4), AccessState::Denied);
    }

    #[test]
    fn reading_without_access_is_refused_and_never_asks() {
        for state in [
            AccessState::NotDetermined,
            AccessState::Denied,
            AccessState::Restricted,
        ] {
            let store = FakeStore::with(state);
            let source = EventKitSource {
                source_id: "mac",
                store: &store,
            };
            assert_eq!(source.events(range()), Err(CalendarError::NoAccess));
            assert_eq!(source.calendars(), Err(CalendarError::NoAccess));
            assert_eq!(store.request_count(), 0);
        }
        let store = FakeStore::with(AccessState::Unsupported);
        let source = EventKitSource {
            source_id: "mac",
            store: &store,
        };
        assert_eq!(source.events(range()), Err(CalendarError::Unsupported));
    }

    #[test]
    fn granted_access_reads_calendars_and_maps_events() {
        let mut store = FakeStore::with(AccessState::Granted);
        store.calendars = vec![RawCalendar {
            id: "cal-work".to_string(),
            title: "Harborline".to_string(),
            account: Some("Exchange".to_string()),
        }];
        let mut tentative = raw_event("e1", "cal-work", 1_000);
        tentative.status = STATUS_TENTATIVE;
        tentative.location = Some("https://acme.zoom.us/j/42".to_string());
        tentative.attendees = vec!["Ana Acme".to_string(), " ".to_string()];
        let mut cancelled = raw_event("e2", "cal-work", 2_000);
        cancelled.status = STATUS_CANCELLED;
        let mut no_uid = raw_event("e3", "cal-work", 3_000);
        no_uid.external_id = None;
        no_uid.notes = Some("Agenda at https://wiki.acme.example".to_string());
        store.events = vec![tentative, cancelled, no_uid];
        let source = EventKitSource {
            source_id: "mac",
            store: &store,
        };
        let calendars = source.calendars().unwrap();
        assert_eq!(calendars[0].source_id, "mac");
        assert_eq!(calendars[0].account.as_deref(), Some("Exchange"));
        let events = source.events(range()).unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].status, EventStatus::Tentative);
        assert_eq!(events[0].uid, "e1@northwind");
        assert_eq!(events[0].id, "mac:e1:1000");
        assert_eq!(events[0].call_link.as_deref(), Some("https://acme.zoom.us/j/42"));
        assert!(events[0].is_call_link_trusted);
        assert_eq!(events[0].attendees, vec!["Ana Acme"]);
        assert_eq!(events[1].uid, "e3");
        assert_eq!(events[1].call_link, None);
        assert_eq!(store.request_count(), 0);
    }
}
