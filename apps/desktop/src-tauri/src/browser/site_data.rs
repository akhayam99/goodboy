#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

use std::net::IpAddr;

use serde::Serialize;
use tauri::{Runtime, Url, Webview};

use super::guard::{self, AppOrigins};
use super::profile::Isolation;
use super::reason::{self, NOT_WEB_ADDRESS, SITE_MOVED};
use super::registry::BrowserRegistry;
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
    pub(crate) extra_hosts: Vec<String>,
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

pub(crate) fn is_record_of_any(record: &str, hosts: &[String]) -> bool {
    hosts.iter().any(|host| is_site_record(record, host))
}

pub(crate) fn trail_of(
    registry: &BrowserRegistry,
    tab_id: &str,
    isolation: Isolation,
) -> Vec<String> {
    if !cfg!(target_os = "macos") || isolation != Isolation::PerWorkspace {
        return Vec::new();
    }
    registry.trail_of(tab_id)
}

pub(crate) fn check_trail(
    trail: &[String],
    host: &str,
    extra_hosts: &[String],
) -> Result<Vec<String>, MessageError> {
    let site = host_key(host);
    let known: Vec<String> = trail.iter().map(|known| host_key(known)).collect();
    let mut checked: Vec<String> = Vec::new();
    for extra in extra_hosts.iter().map(|extra| host_key(extra)) {
        if extra.is_empty() || !known.contains(&extra) {
            return Err(reason::refused(SITE_MOVED));
        }
        if extra != site && !checked.contains(&extra) {
            checked.push(extra);
        }
    }
    Ok(checked)
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
    removed_within(receiver, SITE_DATA_WAIT).await
}

#[cfg(target_os = "macos")]
async fn removed_within(
    receiver: std::sync::mpsc::Receiver<Option<usize>>,
    wait: std::time::Duration,
) -> Result<usize, MessageError> {
    use super::reason::SITE_DATA_UNAVAILABLE;
    let removed = tauri::async_runtime::spawn_blocking(move || receiver.recv_timeout(wait))
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
    extra_hosts: Vec<String>,
) -> Result<SiteCleared, MessageError> {
    let key = host_key(host);
    let mut sites = vec![key.clone()];
    sites.extend(extra_hosts.iter().cloned());
    remove_where(tab, move |record| is_record_of_any(record, &sites)).await?;
    Ok(SiteCleared {
        host: key,
        extra_hosts,
        scope: SiteScope::Site,
    })
}

#[cfg(not(target_os = "macos"))]
pub(crate) async fn clear_site<R: Runtime>(
    tab: &Webview<R>,
    host: &str,
    extra_hosts: Vec<String>,
) -> Result<SiteCleared, MessageError> {
    tab.clear_all_browsing_data()
        .map_err(|error| MessageError::Failed(error.to_string()))?;
    Ok(SiteCleared {
        host: host_key(host),
        extra_hosts,
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
    #[cfg(target_os = "macos")]
    mod native;

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

    fn hosts(names: &[&str]) -> Vec<String> {
        names.iter().map(|name| name.to_string()).collect()
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn a_removal_that_never_answers_fails_after_the_wait() {
        use super::super::reason::SITE_DATA_UNAVAILABLE;
        let wait = std::time::Duration::from_millis(20);
        let (sender, receiver) = std::sync::mpsc::sync_channel(1);
        let silent = tauri::async_runtime::block_on(removed_within(receiver, wait));
        assert_eq!(
            silent.map_err(|error| error.to_string()),
            Err(SITE_DATA_UNAVAILABLE.to_string())
        );
        drop(sender);
        let (sender, receiver) = std::sync::mpsc::sync_channel(1);
        sender.try_send(None).expect("room");
        let refused = tauri::async_runtime::block_on(removed_within(receiver, wait));
        assert!(refused.is_err());
        let (sender, receiver) = std::sync::mpsc::sync_channel(1);
        sender.try_send(Some(2)).expect("room");
        let removed = tauri::async_runtime::block_on(removed_within(receiver, wait));
        assert_eq!(removed.map_err(|error| error.to_string()), Ok(2));
        assert_eq!(SITE_DATA_WAIT, std::time::Duration::from_secs(10));
    }

    #[test]
    fn a_list_matches_a_record_of_any_of_its_sites() {
        let sites = hosts(&["app.harborline.dev", "login.cascadia-id.com"]);
        assert!(is_record_of_any("harborline.dev", &sites));
        assert!(is_record_of_any("cascadia-id.com", &sites));
        assert!(!is_record_of_any("northwind.test", &sites));
        assert!(!is_record_of_any("localhost", &hosts(&["127.0.0.1"])));
        assert!(!is_record_of_any("harborline.dev", &[]));
    }

    #[test]
    fn has_a_trail_only_where_a_workspace_has_its_own_store() {
        let registry = BrowserRegistry::default();
        registry.insert(crate::browser::registry::NewTab {
            id: "a",
            session_id: "harborline",
            window_label: "main",
            profile: crate::browser::profile::ProfileId::of_workspace("harborline")
                .expect("workspace id"),
            url: "about:blank",
            rect: tauri::Rect {
                position: tauri::LogicalPosition::new(0.0, 0.0).into(),
                size: tauri::LogicalSize::new(1.0, 1.0).into(),
            },
            is_shown: true,
            opener_id: None,
            now_ms: 0,
        });
        registry.remember_host("a", "login.cascadia-id.com");
        assert!(trail_of(&registry, "a", Isolation::Shared).is_empty());
        assert_eq!(
            trail_of(&registry, "a", Isolation::PerWorkspace).is_empty(),
            !cfg!(target_os = "macos")
        );
    }

    #[test]
    fn takes_only_extra_hosts_the_tab_went_through() {
        let trail = hosts(&["app.harborline.dev", "login.cascadia-id.com"]);
        let checked = check_trail(
            &trail,
            "app.harborline.dev",
            &hosts(&[
                "Login.Cascadia-ID.com.",
                "login.cascadia-id.com",
                "app.harborline.dev",
            ]),
        )
        .map_err(|error| error.to_string());
        assert_eq!(checked, Ok(hosts(&["login.cascadia-id.com"])));
        let none =
            check_trail(&trail, "app.harborline.dev", &[]).map_err(|error| error.to_string());
        assert_eq!(none, Ok(vec![]));
    }

    #[test]
    fn refuses_an_extra_host_the_tab_never_loaded() {
        let trail = hosts(&["app.harborline.dev", "login.cascadia-id.com"]);
        for extra in ["northwind.test", "cascadia-id.com", " "] {
            assert_eq!(
                check_trail(&trail, "app.harborline.dev", &hosts(&[extra]))
                    .map_err(|error| error.to_string()),
                Err(SITE_MOVED.to_string()),
                "{extra}"
            );
        }
        assert!(check_trail(&[], "localhost", &hosts(&["localhost"])).is_err());
    }

    #[test]
    fn wire_shape_site_cleared() {
        assert_wire_value(
            &SiteCleared {
                host: "app.harborline.dev".into(),
                extra_hosts: hosts(&["login.cascadia-id.com"]),
                scope: SiteScope::Site,
            },
            json!({
                "host": "app.harborline.dev",
                "extraHosts": ["login.cascadia-id.com"],
                "scope": "site",
            }),
        );
        assert_wire_value(&SiteScope::Workspace, json!("workspace"));
    }
}
