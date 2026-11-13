use std::collections::HashMap;
use std::future::Future;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use reqwest::redirect::Policy;
use reqwest::Client;
use serde::Serialize;
use tauri::Url;

const MAX_ICON_BYTES: usize = 64 * 1024;
const MAX_PAGE_BYTES: usize = 128 * 1024;
const MAX_DECLARED_ICONS: usize = 3;
const MAX_REDIRECTS: usize = 3;
const FETCH_TIMEOUT: Duration = Duration::from_secs(3);
const ICON_MIMES: [&str; 7] = [
    "image/png",
    "image/x-icon",
    "image/vnd.microsoft.icon",
    "image/svg+xml",
    "image/jpeg",
    "image/gif",
    "image/webp",
];
const ICON_RELS: [&str; 2] = ["icon", "shortcut icon"];

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabFavicon {
    pub(crate) origin: String,
    pub(crate) src: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Remembered {
    Unknown,
    Missed,
    Icon(String),
}

#[derive(Default)]
pub(crate) struct BrowserFavicons {
    known: Mutex<HashMap<String, Option<String>>>,
}

impl BrowserFavicons {
    pub(crate) fn lookup(&self, key: &str) -> Remembered {
        match self.known.lock().expect("favicon cache").get(key) {
            None => Remembered::Unknown,
            Some(None) => Remembered::Missed,
            Some(Some(icon)) => Remembered::Icon(icon.clone()),
        }
    }

    pub(crate) fn remember(&self, key: &str, icon: Option<String>) {
        self.known
            .lock()
            .expect("favicon cache")
            .insert(key.to_string(), icon);
    }
}

pub(crate) fn host_key(page: &Url) -> Option<String> {
    if !matches!(page.scheme(), "http" | "https") || page.host_str().is_none() {
        return None;
    }
    Some(page.origin().ascii_serialization())
}

pub(crate) fn is_allowed_icon(page: &Url, icon: &Url) -> bool {
    matches!(icon.scheme(), "http" | "https")
        && icon.host_str().is_some()
        && icon.host_str() == page.host_str()
}

pub(crate) fn default_icon_url(page: &Url) -> Option<Url> {
    page.join("/favicon.ico")
        .ok()
        .filter(|icon| is_allowed_icon(page, icon))
}

pub(crate) fn declared_icon_urls(page: &Url, html: &str) -> Vec<Url> {
    let lower = html.to_ascii_lowercase();
    let mut found = Vec::new();
    let mut from = 0;
    while found.len() < MAX_DECLARED_ICONS {
        let Some(offset) = lower[from..].find("<link") else {
            break;
        };
        let start = from + offset;
        let end = lower[start..]
            .find('>')
            .map_or(lower.len(), |close| start + close);
        from = end;
        let tag = &html[start..end];
        let is_icon = attr_of(tag, "rel").is_some_and(|rel| {
            let rel = rel.trim().to_ascii_lowercase();
            ICON_RELS.contains(&rel.as_str())
        });
        if !is_icon {
            continue;
        }
        let Some(icon) = attr_of(tag, "href").and_then(|href| page.join(href.trim()).ok()) else {
            continue;
        };
        if is_allowed_icon(page, &icon) {
            found.push(icon);
        }
    }
    found
}

fn attr_of<'a>(tag: &'a str, name: &str) -> Option<&'a str> {
    let lower = tag.to_ascii_lowercase();
    let mut from = 0;
    while let Some(offset) = lower[from..].find(name) {
        let start = from + offset;
        let after = start + name.len();
        from = after;
        let is_attribute_start = start == 0 || lower.as_bytes()[start - 1].is_ascii_whitespace();
        let rest = tag[after..].trim_start();
        if !is_attribute_start || !rest.starts_with('=') {
            continue;
        }
        let value = rest[1..].trim_start();
        let quote = value.chars().next()?;
        if quote == '"' || quote == '\'' {
            let inner = &value[1..];
            return inner.find(quote).map(|close| &inner[..close]);
        }
        return value.split(|c: char| c.is_whitespace() || c == '>').next();
    }
    None
}

pub(crate) fn mime_of(content_type: Option<&str>, icon: &Url) -> Option<String> {
    let declared = content_type
        .and_then(|value| value.split(';').next())
        .map(|value| value.trim().to_ascii_lowercase());
    match declared.as_deref() {
        Some(mime) if ICON_MIMES.contains(&mime) => Some(mime.to_string()),
        None | Some("application/octet-stream") if icon.path().ends_with(".ico") => {
            Some("image/x-icon".to_string())
        }
        _ => None,
    }
}

pub(crate) fn data_url(mime: &str, bytes: &[u8]) -> String {
    format!("data:{mime};base64,{}", STANDARD.encode(bytes))
}

pub(crate) async fn favicon_of<F, Fut>(
    cache: &BrowserFavicons,
    page: &Url,
    find: F,
) -> Option<String>
where
    F: FnOnce(Url) -> Fut,
    Fut: Future<Output = Option<String>>,
{
    let key = host_key(page)?;
    match cache.lookup(&key) {
        Remembered::Icon(icon) => return Some(icon),
        Remembered::Missed => return None,
        Remembered::Unknown => {}
    }
    let icon = find(page.clone()).await;
    cache.remember(&key, icon.clone());
    icon
}

fn client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(FETCH_TIMEOUT)
            .redirect(Policy::custom(|attempt| {
                let origin = attempt
                    .previous()
                    .first()
                    .and_then(|first| first.host_str().map(str::to_string));
                if attempt.previous().len() >= MAX_REDIRECTS
                    || attempt.url().host_str().map(str::to_string) != origin
                {
                    return attempt.stop();
                }
                attempt.follow()
            }))
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

async fn read_capped(mut response: reqwest::Response, cap: usize) -> Option<Vec<u8>> {
    if response
        .content_length()
        .is_some_and(|length| length as usize > cap)
    {
        return None;
    }
    let mut bytes = Vec::new();
    while let Ok(Some(chunk)) = response.chunk().await {
        bytes.extend_from_slice(&chunk);
        if bytes.len() > cap {
            return None;
        }
    }
    Some(bytes)
}

async fn fetch_icon(icon: &Url) -> Option<String> {
    let response = client().get(icon.clone()).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let mime = mime_of(content_type.as_deref(), icon)?;
    let bytes = read_capped(response, MAX_ICON_BYTES).await?;
    if bytes.is_empty() {
        return None;
    }
    Some(data_url(&mime, &bytes))
}

async fn fetch_page(page: &Url) -> Option<String> {
    let response = client().get(page.clone()).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    let bytes = read_capped(response, MAX_PAGE_BYTES).await?;
    Some(String::from_utf8_lossy(&bytes).into_owned())
}

pub(crate) async fn find_icon(page: Url) -> Option<String> {
    if let Some(default) = default_icon_url(&page) {
        if let Some(icon) = fetch_icon(&default).await {
            return Some(icon);
        }
    }
    let html = fetch_page(&page).await?;
    for declared in declared_icon_urls(&page, &html) {
        if let Some(icon) = fetch_icon(&declared).await {
            return Some(icon);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicUsize, Ordering};

    use super::*;

    fn url(address: &str) -> Url {
        Url::parse(address).expect("test address parses")
    }

    #[tokio::test]
    async fn caches_an_icon_per_host() {
        let cache = BrowserFavicons::default();
        let fetched = AtomicUsize::new(0);
        let find = |_: Url| async {
            fetched.fetch_add(1, Ordering::SeqCst);
            Some("data:image/png;base64,AAAA".to_string())
        };
        let first = favicon_of(&cache, &url("https://northwind.example/a"), find).await;
        let second = favicon_of(&cache, &url("https://northwind.example/b"), find).await;
        assert_eq!(first, second);
        assert_eq!(first.as_deref(), Some("data:image/png;base64,AAAA"));
        assert_eq!(fetched.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn caches_a_miss_so_a_host_without_an_icon_is_not_fetched_again() {
        let cache = BrowserFavicons::default();
        let fetched = AtomicUsize::new(0);
        let find = |_: Url| async {
            fetched.fetch_add(1, Ordering::SeqCst);
            None
        };
        let page = url("http://localhost:5173/checkout");
        assert_eq!(favicon_of(&cache, &page, find).await, None);
        assert_eq!(favicon_of(&cache, &page, find).await, None);
        assert_eq!(fetched.load(Ordering::SeqCst), 1);
        assert_eq!(cache.lookup("http://localhost:5173"), Remembered::Missed);
    }

    #[tokio::test]
    async fn keeps_hosts_apart_by_origin() {
        let cache = BrowserFavicons::default();
        let fetched = AtomicUsize::new(0);
        let find = |_: Url| async {
            fetched.fetch_add(1, Ordering::SeqCst);
            None
        };
        favicon_of(&cache, &url("http://localhost:5173/"), find).await;
        favicon_of(&cache, &url("http://localhost:8080/"), find).await;
        assert_eq!(fetched.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn never_fetches_for_an_address_that_is_not_http() {
        let cache = BrowserFavicons::default();
        let fetched = AtomicUsize::new(0);
        let find = |_: Url| async {
            fetched.fetch_add(1, Ordering::SeqCst);
            None
        };
        for address in ["file:///etc/hosts", "about:blank", "data:text/html,hi"] {
            assert_eq!(favicon_of(&cache, &url(address), find).await, None);
        }
        assert_eq!(fetched.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn refuses_an_icon_that_is_not_http_or_not_on_the_page_host() {
        let page = url("https://northwind.example/app");
        assert!(is_allowed_icon(
            &page,
            &url("https://northwind.example/i.png")
        ));
        assert!(is_allowed_icon(
            &page,
            &url("http://northwind.example:81/i.png")
        ));
        assert!(!is_allowed_icon(&page, &url("data:image/png;base64,AAAA")));
        assert!(!is_allowed_icon(&page, &url("file:///tmp/i.png")));
        assert!(!is_allowed_icon(&page, &url("javascript:alert(1)")));
        assert!(!is_allowed_icon(&page, &url("http://127.0.0.1/i.png")));
        assert!(!is_allowed_icon(&page, &url("https://acme.example/i.png")));
    }

    #[test]
    fn reads_declared_icons_and_drops_the_refused_ones() {
        let page = url("https://northwind.example/app/index.html");
        let html = concat!(
            "<html><head>",
            "<link rel=\"stylesheet\" href=\"/a.css\">",
            "<LINK REL=\"Shortcut Icon\" HREF='/static/fav.png'>",
            "<link rel=\"icon\" href=\"data:image/png;base64,AAAA\">",
            "<link rel=icon href=rel/small.svg>",
            "<link rel=\"icon\" href=\"https://acme.example/i.png\">",
            "<link data-rel=\"icon\" href=\"/nope.png\">",
            "</head></html>",
        );
        let found: Vec<String> = declared_icon_urls(&page, html)
            .iter()
            .map(|icon| icon.to_string())
            .collect();
        assert_eq!(
            found,
            vec![
                "https://northwind.example/static/fav.png".to_string(),
                "https://northwind.example/app/rel/small.svg".to_string(),
            ]
        );
    }

    #[test]
    fn reads_no_icon_from_a_page_that_declares_none() {
        let page = url("http://localhost:5173/");
        assert!(
            declared_icon_urls(&page, "<html><link rel=\"stylesheet\" href=\"/a.css\"").is_empty()
        );
        assert!(declared_icon_urls(&page, "").is_empty());
    }

    #[test]
    fn accepts_only_image_content_types() {
        let ico = url("https://northwind.example/favicon.ico");
        assert_eq!(
            mime_of(Some("image/png; charset=binary"), &ico).as_deref(),
            Some("image/png")
        );
        assert_eq!(mime_of(None, &ico).as_deref(), Some("image/x-icon"));
        assert_eq!(
            mime_of(Some("application/octet-stream"), &ico).as_deref(),
            Some("image/x-icon")
        );
        assert_eq!(mime_of(Some("text/html"), &ico), None);
        assert_eq!(mime_of(None, &url("https://northwind.example/i.png")), None);
    }

    #[test]
    fn wire_shape_tab_favicon() {
        crate::util::wire_shape::assert_wire_value(
            &TabFavicon {
                origin: "http://localhost:5173".to_string(),
                src: None,
            },
            serde_json::json!({ "origin": "http://localhost:5173", "src": null }),
        );
    }

    #[test]
    fn builds_a_data_url() {
        assert_eq!(
            data_url("image/png", &[1, 2, 3]),
            "data:image/png;base64,AQID"
        );
    }
}
