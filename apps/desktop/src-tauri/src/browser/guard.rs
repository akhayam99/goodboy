use std::net::IpAddr;

use tauri::{AppHandle, Runtime, Url};

use crate::frame_protocol::FRAME_SCHEME;

pub(crate) const LABEL_PREFIX: &str = "browse-";

const WEB_SCHEMES: &[&str] = &["http", "https"];
const APP_SCHEMES: &[&str] = &["tauri", "ipc", "asset", FRAME_SCHEME];
const ABOUT_SCHEME: &str = "about";
const BLANK_PAGE: &str = "blank";
const FRAME_PAGES: &[&str] = &[BLANK_PAGE, "srcdoc"];
const LOOPBACK_NAME: &str = "localhost";

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
        if url.port_or_known_default() != dev.port_or_known_default() {
            return false;
        }
        if is_loopback(dev) {
            return is_loopback(url);
        }
        host_of(url) == host_of(dev)
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

fn is_loopback(url: &Url) -> bool {
    let host = host_of(url);
    let bare = host.trim_start_matches('[').trim_end_matches(']');
    if let Ok(ip) = bare.parse::<IpAddr>() {
        return ip.is_loopback() || ip.is_unspecified();
    }
    host == LOOPBACK_NAME || host.ends_with(&format!(".{LOOPBACK_NAME}"))
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

fn is_about_page(url: &Url, pages: &[&str]) -> bool {
    url.scheme() == ABOUT_SCHEME && pages.contains(&url.path())
}

pub(crate) fn may_open(url: &Url, origins: &AppOrigins) -> bool {
    is_web_address(url, origins) || is_about_page(url, &[BLANK_PAGE])
}

pub(crate) fn may_navigate(url: &Url, origins: &AppOrigins) -> bool {
    is_web_address(url, origins) || is_about_page(url, FRAME_PAGES)
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
        "http://LOCALHOST:1421/",
        "http://127.0.0.1:1421/",
        "http://127.0.0.2:1421/",
        "http://0x7f.1:1421/",
        "http://0.0.0.0:1421/",
        "http://[::1]:1421/",
        "http://[::]:1421/",
        "http://x.localhost:1421/",
        "http://acme.LOCALHOST.:1421/",
    ];

    #[test]
    fn refuses_every_app_origin_in_a_dev_build() {
        let allowed: Vec<&str> = APP_ORIGINS
            .iter()
            .copied()
            .filter(|address| may_navigate(&url(address), &dev()))
            .collect();
        assert!(allowed.is_empty(), "allowed app origins: {allowed:?}");
    }

    #[test]
    fn refuses_every_app_origin_as_a_new_tab_and_as_a_popup() {
        for address in APP_ORIGINS {
            assert!(!may_open(&url(address), &dev()), "{address}");
            assert_eq!(popup_target(&url(address), &dev()), None, "{address}");
        }
    }

    #[test]
    fn treats_every_loopback_host_on_the_dev_port_as_the_dev_origin() {
        let loopback_dev = [
            "http://localhost:1421",
            "http://127.0.0.1:1421",
            "http://[::1]:1421",
        ];
        for dev_url in loopback_dev {
            let origins = AppOrigins::with_dev_origin(Some(url(dev_url)));
            for address in [
                "http://localhost:1421/",
                "http://127.0.0.1:1421/",
                "http://[::1]:1421/",
                "http://ledger-core.localhost:1421/",
            ] {
                assert!(
                    !may_navigate(&url(address), &origins),
                    "{dev_url} {address}"
                );
            }
            for address in [
                "http://127.0.0.1:5173/",
                "http://localhost:1422/",
                "http://notlocalhost:1421/",
                "http://localhost.example:1421/",
            ] {
                assert!(may_navigate(&url(address), &origins), "{dev_url} {address}");
            }
        }
    }

    #[test]
    fn compares_a_dev_host_that_is_not_loopback_by_name() {
        let origins = AppOrigins::with_dev_origin(Some(url("http://acme.example:1421")));
        assert!(!may_navigate(&url("http://ACME.example:1421/"), &origins));
        assert!(may_navigate(&url("http://127.0.0.1:1421/"), &origins));
        assert!(may_navigate(
            &url("http://northwind.example:1421/"),
            &origins
        ));
    }

    #[test]
    fn lets_a_release_build_preview_a_server_on_the_dev_port() {
        for address in [
            "http://localhost:1421/",
            "http://127.0.0.1:1421/",
            "http://[::1]:1421/",
        ] {
            assert!(may_navigate(&url(address), &release()), "{address}");
        }
        assert!(!may_navigate(&url("http://tauri.localhost/"), &release()));
        assert!(!may_navigate(&url("tauri://localhost/"), &release()));
    }

    #[test]
    fn allows_an_http_page_and_an_https_page() {
        for address in [
            "http://127.0.0.1:5173/",
            "http://localhost:5173/checkout",
            "https://example.com/",
            "https://acme.example/ledger-core?tab=1#top",
        ] {
            assert!(may_navigate(&url(address), &dev()), "{address}");
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
            "about:settings",
            "about:blankx",
            "chrome://settings",
        ] {
            assert!(!may_navigate(&url(address), &dev()), "{address}");
            assert!(!may_open(&url(address), &dev()), "{address}");
            assert_eq!(popup_target(&url(address), &dev()), None, "{address}");
        }
    }

    #[test]
    fn allows_a_blank_or_srcdoc_frame_at_any_time() {
        for address in ["about:blank", "about:blank#top", "about:srcdoc"] {
            assert!(may_navigate(&url(address), &dev()), "{address}");
            assert!(may_navigate(&url(address), &release()), "{address}");
            assert_eq!(popup_target(&url(address), &dev()), None, "{address}");
        }
        assert!(may_open(&url("about:blank"), &dev()));
        assert!(!may_open(&url("about:srcdoc"), &dev()));
    }

    fn walk(origins: &AppOrigins, steps: &[(&str, bool)]) {
        for (address, is_allowed) in steps {
            assert_eq!(
                may_navigate(&url(address), origins),
                *is_allowed,
                "{address}"
            );
        }
    }

    #[test]
    fn refuses_a_redirect_to_the_app_after_a_web_page_loaded() {
        walk(
            &dev(),
            &[
                ("https://example.com/login", true),
                ("http://localhost:1421/", false),
                ("http://127.0.0.1:1421/", false),
                ("tauri://localhost/", false),
                ("http://tauri.localhost/?next=1", false),
                ("https://example.com/login", true),
            ],
        );
    }

    #[test]
    fn refuses_a_blank_page_that_moves_itself_to_the_app() {
        walk(
            &dev(),
            &[
                ("about:blank", true),
                ("tauri://localhost/index.html", false),
                ("about:blank", true),
                ("ipc://localhost/detect_editors", false),
            ],
        );
    }

    #[test]
    fn refuses_a_form_post_or_meta_refresh_that_targets_the_app() {
        walk(
            &release(),
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
            &dev(),
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
