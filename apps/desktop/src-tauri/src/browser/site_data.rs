#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

use std::net::IpAddr;

use serde::Serialize;
use tauri::{Runtime, Url, Webview};

use super::guard::{self, AppOrigins};
use super::reason::{self, NOT_WEB_ADDRESS, SITE_MOVED};
use crate::util::MessageError;

#[cfg(target_os = "macos")]
const SITE_DATA_WAIT: std::time::Duration = std::time::Duration::from_secs(10);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SiteScope {
    Site,
    #[cfg_attr(target_os = "macos", allow(dead_code))]
    Workspace,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SiteCleared {
    pub(crate) host: String,
    pub(crate) scope: SiteScope,
}

pub(crate) fn host_key(host: &str) -> String {
    host.trim()
        .trim_end_matches('.')
        .trim_start_matches('[')
        .trim_end_matches(']')
        .to_ascii_lowercase()
}

fn is_exact_host(host: &str) -> bool {
    host == "localhost" || host.ends_with(".localhost") || host.parse::<IpAddr>().is_ok()
}

pub(crate) fn is_site_record(record: &str, host: &str) -> bool {
    let record = host_key(record);
    let host = host_key(host);
    if record.is_empty() || host.is_empty() {
        return false;
    }
    if record == host {
        return true;
    }
    if is_exact_host(&host) {
        return false;
    }
    record.contains('.') && host.ends_with(&format!(".{record}"))
}

pub(crate) fn check_site(live: &Url, host: &str, origins: &AppOrigins) -> Result<(), MessageError> {
    if !guard::is_web_address(live, origins) {
        return Err(reason::refused(NOT_WEB_ADDRESS));
    }
    if host_key(&guard::host_of(live)) != host_key(host) || host_key(host).is_empty() {
        return Err(reason::refused(SITE_MOVED));
    }
    Ok(())
}

#[cfg(target_os = "macos")]
async fn remove_where<R, Keep>(tab: &Webview<R>, keep: Keep) -> Result<usize, MessageError>
where
    R: Runtime,
    Keep: Fn(&str) -> bool + Send + 'static,
{
    use super::reason::SITE_DATA_UNAVAILABLE;
    if std::any::TypeId::of::<R>() != std::any::TypeId::of::<tauri::Wry>() {
        return Err(reason::failed(SITE_DATA_UNAVAILABLE));
    }
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    tab.with_webview(move |platform| {
        crate::platform::web_site_data::remove_records(platform, keep, sender)
    })
    .map_err(|_| reason::failed(SITE_DATA_UNAVAILABLE))?;
    let removed =
        tauri::async_runtime::spawn_blocking(move || receiver.recv_timeout(SITE_DATA_WAIT))
            .await
            .map_err(|_| reason::failed(SITE_DATA_UNAVAILABLE))?;
    removed
        .ok()
        .flatten()
        .ok_or_else(|| reason::failed(SITE_DATA_UNAVAILABLE))
}

#[cfg(target_os = "macos")]
pub(crate) async fn clear_site<R: Runtime>(
    tab: &Webview<R>,
    host: &str,
) -> Result<SiteCleared, MessageError> {
    let key = host_key(host);
    let site = key.clone();
    remove_where(tab, move |record| is_site_record(record, &site)).await?;
    Ok(SiteCleared {
        host: key,
        scope: SiteScope::Site,
    })
}

#[cfg(not(target_os = "macos"))]
pub(crate) async fn clear_site<R: Runtime>(
    tab: &Webview<R>,
    host: &str,
) -> Result<SiteCleared, MessageError> {
    tab.clear_all_browsing_data()
        .map_err(|error| MessageError::Failed(error.to_string()))?;
    Ok(SiteCleared {
        host: host_key(host),
        scope: SiteScope::Workspace,
    })
}

#[cfg(target_os = "macos")]
pub(crate) async fn clear_store<R: Runtime>(tab: &Webview<R>) -> Result<(), MessageError> {
    remove_where(tab, |_| true).await.map(|_| ())
}

#[cfg(not(target_os = "macos"))]
pub(crate) async fn clear_store<R: Runtime>(tab: &Webview<R>) -> Result<(), MessageError> {
    tab.clear_all_browsing_data()
        .map_err(|error| MessageError::Failed(error.to_string()))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::util::wire_shape::assert_wire_value;

    #[test]
    fn a_loopback_host_matches_only_itself() {
        assert!(is_site_record("localhost", "localhost"));
        assert!(is_site_record("127.0.0.1", "127.0.0.1"));
        assert!(is_site_record("::1", "[::1]"));
        assert!(!is_site_record("localhost", "app.localhost"));
        assert!(!is_site_record("127.0.0.1", "localhost"));
        assert!(!is_site_record("0.0.1", "127.0.0.1"));
        assert!(!is_site_record("acme.test", "localhost"));
    }

    #[test]
    fn a_web_host_matches_its_registrable_domain() {
        assert!(is_site_record("acme.test", "acme.test"));
        assert!(is_site_record("acme.test", "app.acme.test"));
        assert!(is_site_record("Acme.Test", "www.acme.test."));
        assert!(is_site_record("acme.co.uk", "shop.acme.co.uk"));
    }

    #[test]
    fn a_web_host_leaves_every_other_site_alone() {
        assert!(!is_site_record("northwind.test", "acme.test"));
        assert!(!is_site_record("cme.test", "acme.test"));
        assert!(!is_site_record("app.acme.test", "acme.test"));
        assert!(!is_site_record("test", "acme.test"));
        assert!(!is_site_record("", "acme.test"));
        assert!(!is_site_record("acme.test", ""));
    }

    fn site_check(address: &str, host: &str) -> Result<(), String> {
        let live = guard::parse_address(address).expect("an address");
        check_site(&live, host, &AppOrigins::with_dev_origin(None)).map_err(|e| e.to_string())
    }

    #[test]
    fn clears_the_site_the_menu_named() {
        assert!(site_check("http://localhost:5005/login", "localhost").is_ok());
        assert!(site_check("https://App.Acme.test./", "app.acme.test").is_ok());
    }

    #[test]
    fn refuses_a_page_that_moved_or_is_not_a_web_page() {
        assert_eq!(
            site_check("https://northwind.test/", "acme.test"),
            Err(SITE_MOVED.to_string())
        );
        assert_eq!(
            site_check("https://acme.test/", " "),
            Err(SITE_MOVED.to_string())
        );
        for address in ["about:blank", "file:///work/harborline/plan.html"] {
            assert_eq!(
                site_check(address, ""),
                Err(NOT_WEB_ADDRESS.to_string()),
                "{address}"
            );
        }
    }

    #[test]
    fn wire_shape_site_cleared() {
        assert_wire_value(
            &SiteCleared {
                host: "localhost".into(),
                scope: SiteScope::Site,
            },
            json!({ "host": "localhost", "scope": "site" }),
        );
        assert_wire_value(&SiteScope::Workspace, json!("workspace"));
    }
}
