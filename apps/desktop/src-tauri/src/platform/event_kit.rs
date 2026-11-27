use std::sync::mpsc;
use std::time::Duration;

use block2::RcBlock;
use objc2::rc::{autoreleasepool, Retained};
use objc2::runtime::{AnyObject, Bool};
use objc2::{class, msg_send, sel};

use crate::calendar::eventkit::{RawCalendar, RawEvent};
use crate::platform::web_site_data::text_of;

#[link(name = "EventKit", kind = "framework")]
extern "C" {}

const ENTITY_TYPE_EVENT: usize = 0;

fn non_null(object: *mut AnyObject) -> Option<*mut AnyObject> {
    (!object.is_null()).then_some(object)
}

fn objects_of(list: *mut AnyObject) -> Vec<*mut AnyObject> {
    let Some(list) = non_null(list) else {
        return Vec::new();
    };
    let count: usize = unsafe { msg_send![list, count] };
    (0..count)
        .filter_map(|index| non_null(unsafe { msg_send![list, objectAtIndex: index] }))
        .collect()
}

fn seconds_of(date: *mut AnyObject) -> Option<f64> {
    let date = non_null(date)?;
    Some(unsafe { msg_send![date, timeIntervalSince1970] })
}

fn date_at(ms: i64) -> *mut AnyObject {
    let seconds = ms as f64 / 1_000.0;
    unsafe { msg_send![class!(NSDate), dateWithTimeIntervalSince1970: seconds] }
}

fn new_store_without_prompt() -> Option<Retained<AnyObject>> {
    unsafe { msg_send![class!(EKEventStore), new] }
}

pub(crate) fn authorization_status() -> isize {
    unsafe { msg_send![class!(EKEventStore), authorizationStatusForEntityType: ENTITY_TYPE_EVENT] }
}

fn ask_for_full_access(store: &AnyObject, handler: &block2::Block<dyn Fn(Bool, *mut AnyObject)>) {
    let has_full_access_call: bool = unsafe {
        msg_send![store, respondsToSelector: sel!(requestFullAccessToEventsWithCompletion:)]
    };
    if has_full_access_call {
        let _: () = unsafe { msg_send![store, requestFullAccessToEventsWithCompletion: handler] };
        return;
    }
    let _: () = unsafe {
        msg_send![store, requestAccessToEntityType: ENTITY_TYPE_EVENT, completion: handler]
    };
}

pub(crate) fn request_full_access(wait: Duration) -> Option<bool> {
    let store = new_store_without_prompt()?;
    let (sender, receiver) = mpsc::sync_channel(1);
    let handler = RcBlock::new(move |is_granted: Bool, _error: *mut AnyObject| {
        let _ = sender.try_send(is_granted.as_bool());
    });
    ask_for_full_access(&store, &handler);
    let answer = receiver.recv_timeout(wait).ok();
    drop(store);
    answer
}

fn calendar_of(calendar: *mut AnyObject) -> Option<RawCalendar> {
    let id = text_of(unsafe { msg_send![calendar, calendarIdentifier] })?;
    let title = text_of(unsafe { msg_send![calendar, title] }).unwrap_or_default();
    let account = non_null(unsafe { msg_send![calendar, source] })
        .and_then(|source| text_of(unsafe { msg_send![source, title] }));
    Some(RawCalendar { id, title, account })
}

pub(crate) fn calendars() -> Vec<RawCalendar> {
    autoreleasepool(|_| {
        let Some(store) = new_store_without_prompt() else {
            return Vec::new();
        };
        let list: *mut AnyObject =
            unsafe { msg_send![&*store, calendarsForEntityType: ENTITY_TYPE_EVENT] };
        objects_of(list).into_iter().filter_map(calendar_of).collect()
    })
}

fn attendee_names(event: *mut AnyObject) -> Vec<String> {
    objects_of(unsafe { msg_send![event, attendees] })
        .into_iter()
        .filter_map(|attendee| text_of(unsafe { msg_send![attendee, name] }))
        .collect()
}

fn url_text(event: *mut AnyObject) -> Option<String> {
    let url = non_null(unsafe { msg_send![event, URL] })?;
    text_of(unsafe { msg_send![url, absoluteString] })
}

fn event_of(event: *mut AnyObject) -> Option<RawEvent> {
    let identifier = text_of(unsafe { msg_send![event, eventIdentifier] })?;
    let calendar_id = non_null(unsafe { msg_send![event, calendar] })
        .and_then(|calendar| text_of(unsafe { msg_send![calendar, calendarIdentifier] }))?;
    let start = seconds_of(unsafe { msg_send![event, startDate] })?;
    let end = seconds_of(unsafe { msg_send![event, endDate] }).unwrap_or(start);
    let is_all_day: bool = unsafe { msg_send![event, isAllDay] };
    let status: isize = unsafe { msg_send![event, status] };
    Some(RawEvent {
        identifier,
        external_id: text_of(unsafe { msg_send![event, calendarItemExternalIdentifier] }),
        calendar_id,
        title: text_of(unsafe { msg_send![event, title] }),
        start_ms: (start * 1_000.0).round() as i64,
        end_ms: (end * 1_000.0).round() as i64,
        is_all_day,
        location: text_of(unsafe { msg_send![event, location] }),
        notes: text_of(unsafe { msg_send![event, notes] }),
        url: url_text(event),
        status,
        attendees: attendee_names(event),
    })
}

pub(crate) fn events(from_ms: i64, to_ms: i64) -> Vec<RawEvent> {
    autoreleasepool(|_| {
        let Some(store) = new_store_without_prompt() else {
            return Vec::new();
        };
        let every_calendar: *mut AnyObject = std::ptr::null_mut();
        let predicate: *mut AnyObject = unsafe {
            msg_send![&*store, predicateForEventsWithStartDate: date_at(from_ms), endDate: date_at(to_ms), calendars: every_calendar]
        };
        let Some(predicate) = non_null(predicate) else {
            return Vec::new();
        };
        let list: *mut AnyObject = unsafe { msg_send![&*store, eventsMatchingPredicate: predicate] };
        objects_of(list).into_iter().filter_map(event_of).collect()
    })
}
