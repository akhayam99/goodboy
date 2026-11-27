use std::sync::Arc;

use super::*;
use crate::calendar::eventkit::test_support::{raw_event, FakeStore};
use crate::calendar::vault::test_support::FakeVault;
use crate::integrations::http::test_support::{http_response, serve_sequence, within_bound};

const START_MS: i64 = 1_795_773_600_000;

fn feed(uid: &str) -> String {
    format!(
        "BEGIN:VCALENDAR\r\nX-WR-CALNAME:Northwind team\r\nBEGIN:VEVENT\r\nUID:{uid}\r\nSUMMARY:Northwind review\r\nDTSTART:20261127T100000Z\r\nDTEND:20261127T103000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"
    )
}

fn deps(store: FakeStore, vault: Arc<FakeVault>) -> Deps {
    Deps {
        store: Arc::new(store),
        vault,
    }
}

fn mac() -> SourceRef {
    SourceRef {
        id: "mac".to_string(),
        kind: SourceKind::Eventkit,
    }
}

fn link(id: &str) -> SourceRef {
    SourceRef {
        id: id.to_string(),
        kind: SourceKind::Ics,
    }
}

fn day() -> Range {
    Range::checked(START_MS - 3_600_000, START_MS + 86_400_000).unwrap()
}

#[tokio::test]
async fn access_is_asked_only_while_it_was_never_decided() {
    let store = Arc::new(FakeStore::with(AccessState::NotDetermined));
    let deps = Deps {
        store: store.clone(),
        vault: Arc::new(FakeVault::default()),
    };
    assert_eq!(request_access_with(&deps).await.unwrap(), AccessState::Granted);
    assert_eq!(store.request_count(), 1);
    assert_eq!(request_access_with(&deps).await.unwrap(), AccessState::Granted);
    assert_eq!(store.request_count(), 1);

    let denied = Arc::new(FakeStore::with(AccessState::Denied));
    let deps = Deps {
        store: denied.clone(),
        vault: Arc::new(FakeVault::default()),
    };
    assert_eq!(request_access_with(&deps).await.unwrap(), AccessState::Denied);
    assert_eq!(denied.request_count(), 0);
}

#[tokio::test]
async fn one_meeting_on_the_mac_and_in_a_link_is_listed_once() {
    let (base, _server) = serve_sequence(vec![http_response("200 OK", &[], &feed("review@northwind"))]).await;
    let id = new_link_id();
    let vault = Arc::new(FakeVault::holding(&id, &format!("{base}/basic.ics")));
    let mut store = FakeStore::with(AccessState::Granted);
    let mut raw = raw_event("e1", "cal-work", START_MS);
    raw.external_id = Some("review@northwind".to_string());
    store.events = vec![raw];
    let listing = within_bound(events_with(vec![mac(), link(&id)], day(), &deps(store, vault))).await;
    assert_eq!(listing.failed_sources, vec![]);
    assert_eq!(listing.items.len(), 1);
    assert_eq!(listing.items[0].source_id, "mac");
}

#[tokio::test]
async fn a_failing_source_is_reported_and_the_others_still_list() {
    let (base, _server) = serve_sequence(vec![http_response("200 OK", &[], &feed("sync@acme"))]).await;
    let good = new_link_id();
    let missing = new_link_id();
    let vault = Arc::new(FakeVault::holding(&good, &format!("{base}/basic.ics")));
    let listing = within_bound(events_with(
        vec![mac(), link(&missing), link(&good), link("not-an-id")],
        day(),
        &deps(FakeStore::with(AccessState::Denied), vault),
    ))
    .await;
    let kinds: Vec<(&str, &str)> = listing
        .failed_sources
        .iter()
        .map(|failure| (failure.source_id.as_str(), failure.kind.as_str()))
        .collect();
    assert_eq!(
        kinds,
        vec![("mac", "no_access"), (missing.as_str(), "keychain"), ("not-an-id", "refused")]
    );
    assert_eq!(listing.items.len(), 1);
    assert_eq!(listing.items[0].uid, "sync@acme");
}

#[tokio::test]
async fn a_link_read_once_is_served_from_memory_for_the_next_range() {
    let (base, server) = serve_sequence(vec![http_response("200 OK", &[], &feed("plan@cascadia"))]).await;
    let id = new_link_id();
    let vault = Arc::new(FakeVault::holding(&id, &format!("{base}/basic.ics")));
    let deps = deps(FakeStore::with(AccessState::Unsupported), vault);
    let first = within_bound(calendars_with(vec![link(&id)], &deps)).await;
    assert_eq!(first.items[0].title, "Northwind team");
    let second = within_bound(events_with(vec![link(&id)], day(), &deps)).await;
    assert_eq!(second.items.len(), 1);
    assert_eq!(server.await.unwrap().len(), 1);
}

#[tokio::test]
async fn adding_a_link_reads_it_first_then_keeps_it_in_the_keychain() {
    let (base, _server) = serve_sequence(vec![http_response("200 OK", &[], &feed("one@harborline"))]).await;
    let vault = Arc::new(FakeVault::default());
    let deps = deps(FakeStore::with(AccessState::Unsupported), vault.clone());
    let added = within_bound(add_link_with("  ", &format!("{base}/private-8f2c/basic.ics"), &deps))
        .await
        .unwrap();
    assert_eq!(added.host, "127.0.0.1");
    assert_eq!(added.label, "127.0.0.1");
    assert_eq!(vault.keys(), vec![format!("goodboy.calendar.ics.{}", added.id)]);
    let stored = vault.entries.lock().unwrap().values().next().cloned().unwrap();
    assert!(stored.ends_with("/private-8f2c/basic.ics"));
    let serialized = serde_json::to_string(&added).unwrap();
    assert!(!serialized.contains("private-8f2c"));

    let listing = within_bound(events_with(vec![link(&added.id)], day(), &deps)).await;
    assert_eq!(listing.items.len(), 1);

    remove_link_with(&added.id, &deps).await.unwrap();
    assert!(vault.keys().is_empty());
}

#[tokio::test]
async fn a_link_that_is_not_https_or_not_a_calendar_is_never_kept() {
    let vault = Arc::new(FakeVault::default());
    let deps = deps(FakeStore::with(AccessState::Unsupported), vault.clone());
    let refused = add_link_with("Northwind", "http://calendar.northwind.example/basic.ics", &deps)
        .await
        .unwrap_err();
    assert!(matches!(refused, CalendarError::Refused(_)));

    let (base, _server) = serve_sequence(vec![http_response("200 OK", &[], "<html>sign in</html>")]).await;
    let parse = within_bound(add_link_with("Northwind", &format!("{base}/basic.ics"), &deps))
        .await
        .unwrap_err();
    assert!(matches!(parse, CalendarError::Parse(_)));
    assert!(vault.keys().is_empty());
}

#[tokio::test]
async fn a_locked_keychain_keeps_nothing_and_says_so() {
    let (base, _server) = serve_sequence(vec![http_response("200 OK", &[], &feed("locked@acme"))]).await;
    let vault = Arc::new(FakeVault {
        is_locked: true,
        ..FakeVault::default()
    });
    let deps = deps(FakeStore::with(AccessState::Unsupported), vault.clone());
    let error = within_bound(add_link_with("Acme", &format!("{base}/basic.ics"), &deps))
        .await
        .unwrap_err();
    assert!(matches!(error, CalendarError::Keychain(_)));
    assert!(vault.keys().is_empty());
}

#[tokio::test]
async fn removing_refuses_an_id_goodboy_did_not_make() {
    let deps = deps(FakeStore::with(AccessState::Unsupported), Arc::new(FakeVault::default()));
    assert!(matches!(
        remove_link_with("goodboy.credential.x", &deps).await,
        Err(CalendarError::Refused(_))
    ));
}

#[test]
fn the_commands_are_registered_and_none_reads_the_link_back() {
    let lib = include_str!("../../lib.rs");
    for command in [
        "calendar::commands::calendar_access_state",
        "calendar::commands::calendar_request_access",
        "calendar::commands::calendar_list_calendars",
        "calendar::commands::calendar_list_events",
        "calendar::commands::calendar_ics_add",
        "calendar::commands::calendar_ics_remove",
    ] {
        assert!(lib.contains(command), "{command}");
    }
    assert!(!lib.contains("calendar_ics_read"));
}
