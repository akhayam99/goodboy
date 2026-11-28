use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum EventStatus {
    Confirmed,
    Tentative,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CalendarEvent {
    pub id: String,
    pub source_id: String,
    pub calendar_id: String,
    pub uid: String,
    pub title: String,
    pub start: i64,
    pub end: i64,
    pub is_all_day: bool,
    pub location: Option<String>,
    pub call_link: Option<String>,
    pub is_call_link_trusted: bool,
    pub attendees: Vec<String>,
    pub status: EventStatus,
    pub is_busy_only: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CalendarInfo {
    pub id: String,
    pub source_id: String,
    pub title: String,
    pub account: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum SourceKind {
    Eventkit,
    Ics,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SourceRef {
    pub id: String,
    pub kind: SourceKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SourceFailure {
    pub source_id: String,
    pub kind: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Listing<T> {
    pub items: Vec<T>,
    pub failed_sources: Vec<SourceFailure>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum AccessState {
    NotDetermined,
    Denied,
    Granted,
    Restricted,
    Unsupported,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct IcsLink {
    pub id: String,
    pub label: String,
    pub host: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::util::wire_shape::assert_wire_roundtrip;
    use serde_json::json;

    #[test]
    fn an_event_crosses_the_wire_in_camel_case() {
        assert_wire_roundtrip::<CalendarEvent>(json!({
            "id": "src-1:standup@northwind:1795000000000",
            "sourceId": "src-1",
            "calendarId": "cal-1",
            "uid": "standup@northwind",
            "title": "Northwind standup",
            "start": 1_795_000_000_000_i64,
            "end": 1_795_000_900_000_i64,
            "isAllDay": false,
            "location": "Room Cascadia",
            "callLink": "https://meet.google.com/abc-defg-hij",
            "isCallLinkTrusted": true,
            "attendees": ["Ana Acme"],
            "status": "tentative",
            "isBusyOnly": false
        }));
    }

    #[test]
    fn a_calendar_a_source_and_a_listing_cross_the_wire_in_camel_case() {
        assert_wire_roundtrip::<CalendarInfo>(json!({
            "id": "cal-1",
            "sourceId": "src-1",
            "title": "Harborline",
            "account": null
        }));
        assert_wire_roundtrip::<SourceRef>(json!({ "id": "src-1", "kind": "eventkit" }));
        assert_wire_roundtrip::<SourceRef>(json!({ "id": "src-2", "kind": "ics" }));
        assert_wire_roundtrip::<Listing<CalendarInfo>>(json!({
            "items": [],
            "failedSources": [{ "sourceId": "src-2", "kind": "fetch", "message": "down" }]
        }));
        assert_wire_roundtrip::<IcsLink>(json!({
            "id": "0123456789abcdef0123456789abcdef",
            "label": "Northwind",
            "host": "calendar.northwind.example"
        }));
    }

    #[test]
    fn the_access_states_are_kebab_case_words() {
        for (state, word) in [
            (AccessState::NotDetermined, "not-determined"),
            (AccessState::Denied, "denied"),
            (AccessState::Granted, "granted"),
            (AccessState::Restricted, "restricted"),
            (AccessState::Unsupported, "unsupported"),
        ] {
            assert_eq!(serde_json::to_value(state).unwrap(), json!(word));
        }
    }
}
