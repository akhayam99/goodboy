use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Runtime, Url};

use crate::frame_protocol::FRAME_SCHEME;

pub(crate) const LABEL_PREFIX: &str = "browse-";

const WEB_SCHEMES: &[&str] = &["http", "https"];
const APP_SCHEMES: &[&str] = &["tauri", "ipc", "asset", FRAME_SCHEME];
const BLANK_PAGE: &str = "about:blank";

#[derive(Clone, Debug, Default)]
pub(crate) struct AppOrigins {
    dev_origin: Option<Url>,
}

impl AppOrigins {
    pub(crate) fn with_dev_origin(dev_origin: Option<Url>) -> Self {
        Self { dev_origin }
    }

    pub(crate) fn of_app<R: Runtime>(app: &AppHandle<R>) -> Self {
        let dev_origin = match tauri::is_dev() {
            true => app.config().build.dev_url.clone(),
            false => None,
        };
        Self::with_dev_origin(dev_origin)
    }

    fn is_dev_origin(&self, url: &Url) -> bool {
        let Some(dev) = &self.dev_origin else {
            return false;
        };
        host_of(url) == host_of(dev) && url.port_or_known_default() == dev.port_or_known_default()
    }

    fn is_app_origin(&self, url: &Url) -> bool {
        if APP_SCHEMES.contains(&url.scheme()) {
            return true;
        }
        let host = host_of(url);
        let is_protocol_host = APP_SCHEMES
            .iter()
            .any(|scheme| host == format!("{scheme}.localhost"));
        is_protocol_host || self.is_dev_origin(url)
    }
}

fn host_of(url: &Url) -> String {
    url.host_str()
        .unwrap_or_default()
        .trim_end_matches('.')
        .to_ascii_lowercase()
}

pub(crate) fn is_browser_label(label: &str) -> bool {
    label.starts_with(LABEL_PREFIX)
}

pub(crate) fn label_of(tab_id: &str) -> String {
    format!("{LABEL_PREFIX}{tab_id}")
}

pub(crate) fn is_web_address(url: &Url, origins: &AppOrigins) -> bool {
    WEB_SCHEMES.contains(&url.scheme()) && !origins.is_app_origin(url)
}

fn is_blank_page(url: &Url) -> bool {
    url.as_str() == BLANK_PAGE
}

pub(crate) fn may_open(url: &Url, origins: &AppOrigins) -> bool {
    is_web_address(url, origins) || is_blank_page(url)
}

fn may_navigate(url: &Url, origins: &AppOrigins, is_initial: bool) -> bool {
    if is_initial && is_blank_page(url) {
        return true;
    }
    is_web_address(url, origins)
}

pub(crate) struct NavigationGate {
    origins: AppOrigins,
    is_initial: AtomicBool,
}

impl NavigationGate {
    pub(crate) fn new(origins: AppOrigins) -> Self {
        Self {
            origins,
            is_initial: AtomicBool::new(true),
        }
    }

    pub(crate) fn allows(&self, target: &Url) -> bool {
        let was_initial = self.is_initial.swap(false, Ordering::SeqCst);
        may_navigate(target, &self.origins, was_initial)
    }
}

pub(crate) fn popup_target(url: &Url, origins: &AppOrigins) -> Option<Url> {
    if !is_web_address(url, origins) {
        return None;
    }
    Some(url.clone())
}

pub(crate) fn parse_address(address: &str) -> Option<Url> {
    Url::parse(address.trim()).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(address: &str) -> Url {
        Url::parse(address).expect("test address parses")
    }

    fn dev() -> AppOrigins {
        AppOrigins::with_dev_origin(Some(url("http://localhost:1421")))
    }

    fn release() -> AppOrigins {
        AppOrigins::default()
    }

    const APP_ORIGINS: &[&str] = &[
        "tauri://localhost/",
        "tauri://localhost/index.html",
        "http://tauri.localhost/",
        "https://tauri.localhost/",
        "http://TAURI.localhost./",
        "http://ipc.localhost/plugin%3Aapp%7Cversion",
        "ipc://localhost/detect_editors",
        "asset://localhost/etc/hosts",
        "http://asset.localhost/etc/hosts",
        "gbframe://localhost/stage",
        "http://gbframe.localhost/stage",
        "http://localhost:1421/",
        "http://localhost:1421/spike-probe.html",
        "https://localhost:1421/",
        "http://localhost.:1421/",
    ];

    #[test]
    fn refuses_every_app_origin_in_a_dev_build() {
        let allowed: Vec<&str> = APP_ORIGINS
            .iter()
            .copied()
            .filter(|address| may_navigate(&url(address), &dev(), false))
            .collect();
        assert!(allowed.is_empty(), "allowed app origins: {allowed:?}");
    }

    #[test]
    fn refuses_every_app_origin_as_the_first_page_and_as_a_popup() {
        for address in APP_ORIGINS {
            assert!(!may_navigate(&url(address), &dev(), true), "{address}");
            assert!(!may_open(&url(address), &dev()), "{address}");
            assert_eq!(popup_target(&url(address), &dev()), None, "{address}");
        }
    }

    #[test]
    fn lets_a_release_build_preview_a_server_on_the_dev_port() {
        assert!(may_navigate(
            &url("http://localhost:1421/"),
            &release(),
            false
        ));
        assert!(!may_navigate(
            &url("http://tauri.localhost/"),
            &release(),
            false
        ));
        assert!(!may_navigate(&url("tauri://localhost/"), &release(), false));
    }

    #[test]
    fn allows_an_http_page_and_an_https_page() {
        for address in [
            "http://127.0.0.1:5173/",
            "http://localhost:5173/checkout",
            "https://example.com/",
            "https://acme.example/ledger-core?tab=1#top",
        ] {
            assert!(may_navigate(&url(address), &dev(), false), "{address}");
            assert!(may_open(&url(address), &dev()), "{address}");
            assert_eq!(popup_target(&url(address), &dev()), Some(url(address)));
        }
    }

    #[test]
    fn refuses_script_data_file_and_blob_addresses() {
        for address in [
            "javascript:alert(1)",
            "data:text/html,<script>parent</script>",
            "file:///etc/passwd",
            "blob:https://example.com/0f1e",
            "ftp://example.com/",
            "about:srcdoc",
            "chrome://settings",
        ] {
            assert!(!may_navigate(&url(address), &dev(), false), "{address}");
            assert!(!may_navigate(&url(address), &dev(), true), "{address}");
            assert!(!may_open(&url(address), &dev()), "{address}");
            assert_eq!(popup_target(&url(address), &dev()), None, "{address}");
        }
    }

    #[test]
    fn allows_about_blank_only_as_the_first_page() {
        let blank = url("about:blank");
        assert!(may_navigate(&blank, &dev(), true));
        assert!(!may_navigate(&blank, &dev(), false));
        assert!(may_open(&blank, &dev()));
        assert_eq!(popup_target(&blank, &dev()), None);
    }

    #[test]
    fn refuses_a_page_that_sends_itself_to_the_app_origin() {
        let page = url("https://example.com/");
        assert!(may_navigate(&page, &dev(), true));
        for target in ["http://localhost:1421/", "tauri://localhost/"] {
            assert!(!may_navigate(&url(target), &dev(), false), "{target}");
        }
    }

    fn walk(gate: &NavigationGate, steps: &[(&str, bool)]) {
        for (address, is_allowed) in steps {
            assert_eq!(gate.allows(&url(address)), *is_allowed, "{address}");
        }
    }

    #[test]
    fn refuses_a_redirect_to_the_app_after_a_web_page_loaded() {
        walk(
            &NavigationGate::new(dev()),
            &[
                ("https://example.com/login", true),
                ("http://localhost:1421/", false),
                ("tauri://localhost/", false),
                ("http://tauri.localhost/?next=1", false),
                ("https://example.com/login", true),
            ],
        );
    }

    #[test]
    fn refuses_a_blank_first_page_that_moves_itself_to_the_app() {
        walk(
            &NavigationGate::new(dev()),
            &[
                ("about:blank", true),
                ("tauri://localhost/index.html", false),
                ("about:blank", false),
                ("ipc://localhost/detect_editors", false),
            ],
        );
    }

    #[test]
    fn refuses_a_form_post_or_meta_refresh_that_targets_the_app() {
        walk(
            &NavigationGate::new(release()),
            &[
                ("http://127.0.0.1:5173/checkout", true),
                ("http://ipc.localhost/plugin%3Aapp%7Cversion", false),
                ("http://gbframe.localhost/stage", false),
                ("https://asset.localhost/etc/hosts", false),
                ("http://127.0.0.1:5173/checkout", true),
            ],
        );
    }

    #[test]
    fn refuses_script_data_blob_and_file_once_a_page_loaded() {
        walk(
            &NavigationGate::new(dev()),
            &[
                ("https://example.com/", true),
                ("javascript:location='tauri://localhost/'", false),
                ("data:text/html,<script>top</script>", false),
                ("blob:https://example.com/0f1e", false),
                ("file:///etc/hosts", false),
            ],
        );
    }

    #[test]
    fn spends_the_first_page_allowance_even_on_a_refused_first_page() {
        walk(
            &NavigationGate::new(dev()),
            &[("tauri://localhost/", false), ("about:blank", false)],
        );
    }

    #[test]
    fn refuses_every_scheme_the_app_registers() {
        let registered: Vec<&str> = include_str!("../lib.rs")
            .split("uri_scheme_protocol(")
            .skip(1)
            .filter_map(|rest| rest.split(',').next())
            .map(str::trim)
            .collect();
        assert_eq!(registered, vec!["frame_protocol::FRAME_SCHEME"]);
        assert!(APP_SCHEMES.contains(&FRAME_SCHEME));
        let elsewhere =
            crate::util::source_scan::production_hits(&["uri_scheme_protocol("], &["lib.rs"]);
        assert!(elsewhere.is_empty(), "{elsewhere:?}");
    }

    #[test]
    fn names_browser_webviews_with_a_prefix_no_window_uses() {
        assert_eq!(label_of("0f1e"), "browse-0f1e");
        assert!(is_browser_label("browse-0f1e"));
        assert!(!is_browser_label("main"));
        assert!(!is_browser_label("win-2"));
    }

    #[test]
    fn reads_an_address_with_spaces_around_it() {
        assert_eq!(
            parse_address("  https://example.com/  "),
            Some(url("https://example.com/"))
        );
        assert_eq!(parse_address("not an address"), None);
    }
}
