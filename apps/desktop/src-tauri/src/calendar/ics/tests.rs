use super::time::{floating_ms, parse_local};
use super::*;

const ZONE: &str = "BEGIN:VTIMEZONE\r\nTZID:Europe/Rome\r\nBEGIN:DAYLIGHT\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\nDTSTART:19700329T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\nDTSTART:19701025T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n";

fn calendar(events: &str) -> String {
    format!("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Northwind team\r\n{ZONE}{events}END:VCALENDAR\r\n")
}

fn utc_ms(text: &str) -> i64 {
    parse_local(text).unwrap().0.and_utc().timestamp_millis()
}

fn local_ms(text: &str) -> i64 {
    floating_ms(parse_local(text).unwrap().0)
}

fn window(from: &str, to: &str) -> (i64, i64) {
    (utc_ms(from), utc_ms(to))
}

fn read(text: &str, from: &str, to: &str) -> Vec<CalendarEvent> {
    let (from_ms, to_ms) = window(from, to);
    parse_calendar(text).unwrap().events(&Window {
        source_id: "src-ics",
        calendar_id: "cal-ics",
        from_ms,
        to_ms,
    })
}

#[test]
fn the_calendar_name_comes_from_the_feed() {
    assert_eq!(
        parse_calendar(&calendar("")).unwrap().name.as_deref(),
        Some("Northwind team")
    );
}

#[test]
fn a_page_that_is_not_a_calendar_is_a_parse_error() {
    let Err(error) = parse_calendar("<html>sign in</html>") else {
        panic!("html is not a calendar");
    };
    assert!(matches!(error, CalendarError::Parse(_)));
}

#[test]
fn an_event_with_a_tzid_lands_on_its_utc_instant() {
    let events = read(
        &calendar("BEGIN:VEVENT\r\nUID:plan@northwind\r\nSUMMARY:Northwind planning\r\nDTSTART;TZID=Europe/Rome:20261127T100000\r\nDTEND;TZID=Europe/Rome:20261127T110000\r\nEND:VEVENT\r\n"),
        "20261127T000000",
        "20261128T000000",
    );
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].start, utc_ms("20261127T090000"));
    assert_eq!(events[0].end, utc_ms("20261127T100000"));
    assert_eq!(events[0].title, "Northwind planning");
    assert_eq!(events[0].id, format!("src-ics:plan@northwind:{}", utc_ms("20261127T090000")));
    assert!(!events[0].is_all_day);
}

#[test]
fn a_utc_event_and_a_duration_event_read_right() {
    let events = read(
        &calendar("BEGIN:VEVENT\r\nUID:sync@acme\r\nSUMMARY:Acme sync\r\nDTSTART:20261127T140000Z\r\nDURATION:PT45M\r\nEND:VEVENT\r\n"),
        "20261127T000000",
        "20261128T000000",
    );
    assert_eq!(events[0].start, utc_ms("20261127T140000"));
    assert_eq!(events[0].end, utc_ms("20261127T144500"));
}

#[test]
fn an_all_day_event_spans_its_local_days() {
    let events = read(
        &calendar("BEGIN:VEVENT\r\nUID:offsite@harborline\r\nSUMMARY:Harborline offsite\r\nDTSTART;VALUE=DATE:20261127\r\nDTEND;VALUE=DATE:20261129\r\nEND:VEVENT\r\n"),
        "20261120T000000",
        "20261205T000000",
    );
    assert!(events[0].is_all_day);
    assert_eq!(events[0].start, local_ms("20261127T000000"));
    assert_eq!(events[0].end, local_ms("20261129T000000"));
}

#[test]
fn a_weekly_series_drops_its_exdate_and_keeps_the_rest() {
    let events = read(
        &calendar("BEGIN:VEVENT\r\nUID:standup@ledger-core\r\nSUMMARY:ledger-core standup\r\nDTSTART;TZID=Europe/Rome:20261102T093000\r\nDTEND;TZID=Europe/Rome:20261102T094500\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,TH;UNTIL=20261130T225959Z\r\nEXDATE;TZID=Europe/Rome:20261112T093000,20261119T093000\r\nEND:VEVENT\r\n"),
        "20261101T000000",
        "20261231T000000",
    );
    let starts: Vec<i64> = events.iter().map(|event| event.start).collect();
    assert_eq!(
        starts,
        vec![
            utc_ms("20261102T083000"),
            utc_ms("20261105T083000"),
            utc_ms("20261109T083000"),
            utc_ms("20261116T083000"),
            utc_ms("20261123T083000"),
            utc_ms("20261126T083000"),
            utc_ms("20261130T083000"),
        ]
    );
    assert!(events.iter().all(|event| event.uid == "standup@ledger-core"));
    assert_eq!(events[0].end - events[0].start, 15 * 60_000);
}

#[test]
fn a_series_across_the_clock_change_keeps_its_local_hour() {
    let events = read(
        &calendar("BEGIN:VEVENT\r\nUID:review@payments-api\r\nSUMMARY:payments-api review\r\nDTSTART;TZID=Europe/Rome:20261022T100000\r\nDTEND;TZID=Europe/Rome:20261022T110000\r\nRRULE:FREQ=WEEKLY;COUNT=2\r\nEND:VEVENT\r\n"),
        "20261001T000000",
        "20261231T000000",
    );
    assert_eq!(events[0].start, utc_ms("20261022T080000"));
    assert_eq!(events[1].start, utc_ms("20261029T090000"));
}

#[test]
fn a_cancelled_event_and_a_cancelled_occurrence_are_dropped() {
    let events = read(
        &calendar("BEGIN:VEVENT\r\nUID:gone@acme\r\nSUMMARY:Acme gone\r\nSTATUS:CANCELLED\r\nDTSTART:20261127T080000Z\r\nDTEND:20261127T090000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:daily@notify-relay\r\nSUMMARY:notify-relay daily\r\nDTSTART:20261126T070000Z\r\nDTEND:20261126T071500Z\r\nRRULE:FREQ=DAILY;COUNT=3\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:daily@notify-relay\r\nRECURRENCE-ID:20261127T070000Z\r\nSTATUS:CANCELLED\r\nSUMMARY:notify-relay daily\r\nDTSTART:20261127T070000Z\r\nDTEND:20261127T071500Z\r\nEND:VEVENT\r\n"),
        "20261126T000000",
        "20261130T000000",
    );
    let starts: Vec<i64> = events.iter().map(|event| event.start).collect();
    assert_eq!(starts, vec![utc_ms("20261126T070000"), utc_ms("20261128T070000")]);
}

#[test]
fn a_moved_occurrence_replaces_the_one_it_moved() {
    let events = read(
        &calendar("BEGIN:VEVENT\r\nUID:one@cascadia\r\nSUMMARY:Cascadia one on one\r\nDTSTART:20261126T150000Z\r\nDTEND:20261126T153000Z\r\nRRULE:FREQ=DAILY;COUNT=2\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:one@cascadia\r\nRECURRENCE-ID:20261127T150000Z\r\nSUMMARY:Cascadia one on one, moved\r\nDTSTART:20261127T170000Z\r\nDTEND:20261127T173000Z\r\nEND:VEVENT\r\n"),
        "20261126T000000",
        "20261130T000000",
    );
    let seen: Vec<(i64, &str)> = events
        .iter()
        .map(|event| (event.start, event.title.as_str()))
        .collect();
    assert_eq!(
        seen,
        vec![
            (utc_ms("20261126T150000"), "Cascadia one on one"),
            (utc_ms("20261127T170000"), "Cascadia one on one, moved"),
        ]
    );
}

#[test]
fn tentative_status_attendee_names_and_the_conference_link_are_read() {
    let events = read(
        &calendar("BEGIN:VEVENT\r\nUID:demo@harborline\r\nSUMMARY:Harborline demo\r\nSTATUS:TENTATIVE\r\nDTSTART:20261127T100000Z\r\nDTEND:20261127T103000Z\r\nLOCATION:Room Acme\\, floor 2\r\nX-GOOGLE-CONFERENCE:https://meet.google.com/abc-defg-hij\r\nDESCRIPTION:Notes at https://wiki.harborline.example/demo\r\nATTENDEE;CN=Ana Acme;PARTSTAT=ACCEPTED:mailto:ana@acme.example\r\nATTENDEE;CN=\"Bo Northwind\":mailto:bo@northwind.example\r\nATTENDEE:mailto:nobody@cascadia.example\r\nATTENDEE;CN=Ana Acme:mailto:ana@acme.example\r\nEND:VEVENT\r\n"),
        "20261127T000000",
        "20261128T000000",
    );
    let event = &events[0];
    assert_eq!(event.status, EventStatus::Tentative);
    assert_eq!(event.location.as_deref(), Some("Room Acme, floor 2"));
    assert_eq!(event.call_link.as_deref(), Some("https://meet.google.com/abc-defg-hij"));
    assert!(event.is_call_link_trusted);
    assert_eq!(event.attendees, vec!["Ana Acme", "Bo Northwind"]);
    assert!(!event.is_busy_only);
}

#[test]
fn a_known_host_in_the_description_becomes_the_call_link() {
    let events = read(
        &calendar("BEGIN:VEVENT\r\nUID:zoom@acme\r\nSUMMARY:Acme call\r\nDTSTART:20261127T100000Z\r\nDTEND:20261127T103000Z\r\nDESCRIPTION:Join here: https://acme.zoom.us/j/123?pwd=x\\nthanks\r\nEND:VEVENT\r\n"),
        "20261127T000000",
        "20261128T000000",
    );
    assert_eq!(events[0].call_link.as_deref(), Some("https://acme.zoom.us/j/123?pwd=x"));
}

#[test]
fn events_outside_the_window_are_left_out() {
    let events = read(
        &calendar("BEGIN:VEVENT\r\nUID:early@acme\r\nDTSTART:20261126T100000Z\r\nDTEND:20261126T110000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:late@acme\r\nDTSTART:20261128T000000Z\r\nDTEND:20261128T010000Z\r\nEND:VEVENT\r\n"),
        "20261127T000000",
        "20261128T000000",
    );
    assert!(events.is_empty());
}
