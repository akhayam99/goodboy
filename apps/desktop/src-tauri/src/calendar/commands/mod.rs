use std::collections::HashSet;
use std::sync::Arc;

use super::error::CalendarError;
use super::event::{
    AccessState, CalendarEvent, CalendarInfo, IcsLink, Listing, SourceFailure, SourceKind,
    SourceRef,
};
use super::eventkit::{EventKitSource, EventStore, NativeStore};
use super::fetch::{checked_link, fetch_body, forget_body, fresh_body, host_of, remember_body};
use super::ics_source::IcsSource;
use super::source::{dedupe, CalendarSource, Range};
use super::vault::{key_of, new_link_id, Keychain, LinkVault};
use crate::util::now_ms;

pub(crate) struct Deps {
    pub store: Arc<dyn EventStore + Send + Sync>,
    pub vault: Arc<dyn LinkVault>,
}

fn native() -> Deps {
    Deps {
        store: Arc::new(NativeStore),
        vault: Arc::new(Keychain),
    }
}

async fn blocking<T, Work>(work: Work) -> Result<T, CalendarError>
where
    T: Send + 'static,
    Work: FnOnce() -> T + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|error| CalendarError::Failed(error.to_string()))
}

fn missing_link() -> CalendarError {
    CalendarError::Keychain("the link for this calendar is missing from the Keychain".to_string())
}

async fn load_ics(id: &str, deps: &Deps) -> Result<IcsSource, CalendarError> {
    let key = key_of(id)?;
    let vault = deps.vault.clone();
    let link = blocking(move || vault.read(&key))
        .await??
        .ok_or_else(missing_link)?;
    let url = checked_link(&link)?;
    let host = host_of(&url);
    let now = now_ms();
    if let Some(body) = fresh_body(id, now) {
        return IcsSource::parse(id, &host, &body);
    }
    let body = fetch_body(&url).await?;
    let source = IcsSource::parse(id, &host, &body)?;
    remember_body(id, &body, now);
    Ok(source)
}

type Reader<T> = Arc<dyn Fn(&dyn CalendarSource) -> Result<Vec<T>, CalendarError> + Send + Sync>;

async fn read_one<T: Send + 'static>(
    source: &SourceRef,
    deps: &Deps,
    read: &Reader<T>,
) -> Result<Vec<T>, CalendarError> {
    if source.kind == SourceKind::Ics {
        let ics = load_ics(&source.id, deps).await?;
        return read(&ics);
    }
    let store = deps.store.clone();
    let source_id = source.id.clone();
    let read = read.clone();
    blocking(move || {
        read(&EventKitSource {
            source_id: &source_id,
            store: &*store,
        })
    })
    .await?
}

async fn listing<T: Send + 'static>(
    sources: Vec<SourceRef>,
    deps: &Deps,
    read: Reader<T>,
) -> Listing<T> {
    let mut seen = HashSet::new();
    let mut items = Vec::new();
    let mut failed_sources = Vec::new();
    for source in sources {
        if !seen.insert(source.id.clone()) {
            continue;
        }
        match read_one(&source, deps, &read).await {
            Ok(found) => items.extend(found),
            Err(error) => failed_sources.push(SourceFailure {
                source_id: source.id,
                kind: error.kind().to_string(),
                message: error.to_string(),
            }),
        }
    }
    Listing {
        items,
        failed_sources,
    }
}

pub(crate) async fn calendars_with(sources: Vec<SourceRef>, deps: &Deps) -> Listing<CalendarInfo> {
    listing(sources, deps, Arc::new(|source: &dyn CalendarSource| source.calendars())).await
}

pub(crate) async fn events_with(
    sources: Vec<SourceRef>,
    range: Range,
    deps: &Deps,
) -> Listing<CalendarEvent> {
    let found = listing(
        sources,
        deps,
        Arc::new(move |source: &dyn CalendarSource| source.events(range)),
    )
    .await;
    Listing {
        items: dedupe(found.items),
        failed_sources: found.failed_sources,
    }
}

pub(crate) async fn request_access_with(deps: &Deps) -> Result<AccessState, CalendarError> {
    let store = deps.store.clone();
    blocking(move || match store.access() {
        AccessState::NotDetermined => store.request_access(),
        known => known,
    })
    .await
}

pub(crate) async fn add_link_with(
    label: &str,
    link: &str,
    deps: &Deps,
) -> Result<IcsLink, CalendarError> {
    let url = checked_link(link)?;
    let host = host_of(&url);
    let id = new_link_id();
    let body = fetch_body(&url).await?;
    IcsSource::parse(&id, &host, &body)?;
    let key = key_of(&id)?;
    let vault = deps.vault.clone();
    let saved = url.to_string();
    blocking(move || vault.save(&key, &saved)).await??;
    remember_body(&id, &body, now_ms());
    let label = label.trim();
    Ok(IcsLink {
        label: match label.is_empty() {
            true => host.clone(),
            false => label.to_string(),
        },
        id,
        host,
    })
}

pub(crate) async fn remove_link_with(id: &str, deps: &Deps) -> Result<(), CalendarError> {
    let key = key_of(id)?;
    let vault = deps.vault.clone();
    blocking(move || vault.forget(&key)).await??;
    forget_body(id);
    Ok(())
}

#[tauri::command]
pub async fn calendar_access_state() -> Result<AccessState, CalendarError> {
    let store = native().store;
    blocking(move || store.access()).await
}

#[tauri::command]
pub async fn calendar_request_access() -> Result<AccessState, CalendarError> {
    request_access_with(&native()).await
}

#[tauri::command]
pub async fn calendar_list_calendars(
    sources: Vec<SourceRef>,
) -> Result<Listing<CalendarInfo>, CalendarError> {
    Ok(calendars_with(sources, &native()).await)
}

#[tauri::command]
pub async fn calendar_list_events(
    sources: Vec<SourceRef>,
    from: i64,
    to: i64,
) -> Result<Listing<CalendarEvent>, CalendarError> {
    let range = Range::checked(from, to)?;
    Ok(events_with(sources, range, &native()).await)
}

#[tauri::command]
pub async fn calendar_ics_add(label: String, url: String) -> Result<IcsLink, CalendarError> {
    add_link_with(&label, &url, &native()).await
}

#[tauri::command]
pub async fn calendar_ics_remove(id: String) -> Result<(), CalendarError> {
    remove_link_with(&id, &native()).await
}

#[cfg(test)]
mod tests;
