use std::future::Future;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::time::Duration;

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use reqwest::redirect::Policy;
use reqwest::{Client, Url};
use serde::Deserialize;
use tauri::State;
use tokio::net::lookup_host;

const MAX_URL_LEN: usize = 4096;
const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);
const BLOCKED_SUFFIXES: &[&str] = &[".localhost", ".local", ".internal", ".home.arpa"];

fn is_blocked_v4(ip: Ipv4Addr) -> bool {
    let octets = ip.octets();
    if octets[0] == 0 || octets[0] == 127 {
        return true;
    }
    if octets[0] == 100 && (64..128).contains(&octets[1]) {
        return true;
    }
    ip.is_private()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.is_unspecified()
        || ip.is_multicast()
}

fn is_blocked_v6(ip: Ipv6Addr) -> bool {
    if let Some(mapped) = ip.to_ipv4_mapped() {
        return is_blocked_v4(mapped);
    }
    let first = ip.segments()[0];
    let is_unique_local = first & 0xfe00 == 0xfc00;
    let is_link_local = first & 0xffc0 == 0xfe80;
    is_unique_local || is_link_local || ip.is_loopback() || ip.is_unspecified() || ip.is_multicast()
}

fn is_blocked_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_blocked_v4(v4),
        IpAddr::V6(v6) => is_blocked_v6(v6),
    }
}

fn host_literal_ip(host: &str) -> Option<IpAddr> {
    host.trim_start_matches('[')
        .trim_end_matches(']')
        .parse::<IpAddr>()
        .ok()
}

fn is_blocked_host(host: &str) -> bool {
    let lower = host.trim_end_matches('.').to_ascii_lowercase();
    if lower.is_empty() {
        return true;
    }
    if let Some(ip) = host_literal_ip(&lower) {
        return is_blocked_ip(ip);
    }
    if lower == "localhost" {
        return true;
    }
    BLOCKED_SUFFIXES
        .iter()
        .any(|suffix| lower.ends_with(suffix))
}

fn validate_image_url(url: &str) -> Result<Url, String> {
    if url.is_empty() || url.len() > MAX_URL_LEN {
        return Err("that image address is not a usable url".to_string());
    }
    if url.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("that image address is not a usable url".to_string());
    }
    let parsed =
        Url::parse(url).map_err(|_| "that image address is not a usable url".to_string())?;
    if parsed.scheme() != "https" {
        return Err("images load over https only".to_string());
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "that image address names no host".to_string())?;
    if is_blocked_host(host) {
        return Err(format!(
            "{host} is a private address, so nothing was loaded"
        ));
    }
    Ok(parsed)
}

fn check_status(status: u16) -> Result<(), String> {
    if (300..400).contains(&status) {
        return Err(
            "that host redirects the image somewhere else, so nothing was loaded".to_string(),
        );
    }
    if !(200..300).contains(&status) {
        return Err(format!("that host answered {status}"));
    }
    Ok(())
}

fn is_image_content_type(value: &str) -> bool {
    let lowered = value.trim().to_ascii_lowercase();
    let essence = lowered.split(';').next().unwrap_or("").trim();
    essence.starts_with("image/") && !essence.contains("svg")
}

pub(crate) fn sniff_image_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
        return Some("image/png");
    }
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        return Some("image/jpeg");
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some("image/gif");
    }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return Some("image/webp");
    }
    if bytes.len() >= 12 && &bytes[4..8] == b"ftyp" && matches!(&bytes[8..12], b"avif" | b"avis") {
        return Some("image/avif");
    }
    if bytes.starts_with(b"BM") {
        return Some("image/bmp");
    }
    None
}

fn check_size(len: usize) -> Result<(), String> {
    if len > MAX_IMAGE_BYTES {
        return Err("that image is larger than 10 MB, so nothing was loaded".to_string());
    }
    Ok(())
}

async fn resolve_public_addrs(host: &str) -> Result<Vec<SocketAddr>, String> {
    if host_literal_ip(host).is_some() {
        return Ok(Vec::new());
    }
    let addresses = lookup_host((host, 443))
        .await
        .map_err(|_| format!("could not reach {host}"))?;
    let mut vetted: Vec<SocketAddr> = Vec::new();
    for address in addresses {
        if is_blocked_ip(address.ip()) {
            return Err(format!(
                "{host} points at a private address, so nothing was loaded"
            ));
        }
        vetted.push(address);
    }
    if vetted.is_empty() {
        return Err(format!("could not reach {host}"));
    }
    Ok(vetted)
}

fn image_redirect_policy() -> Policy {
    Policy::none()
}

fn build_image_client(host: &str, addresses: &[SocketAddr]) -> Result<Client, String> {
    let mut builder = Client::builder()
        .redirect(image_redirect_policy())
        .https_only(true)
        .timeout(REQUEST_TIMEOUT);
    if !addresses.is_empty() {
        builder = builder.resolve_to_addrs(host, addresses);
    }
    builder.build().map_err(|e| e.to_string())
}

trait ImageResponse {
    fn status_code(&self) -> u16;
    fn declared_content_type(&self) -> Option<String>;
    fn declared_length(&self) -> Option<u64>;
    fn next_chunk(&mut self) -> impl Future<Output = Result<Option<Vec<u8>>, String>> + Send;
}

impl ImageResponse for reqwest::Response {
    fn status_code(&self) -> u16 {
        self.status().as_u16()
    }

    fn declared_content_type(&self) -> Option<String> {
        self.headers()
            .get(reqwest::header::CONTENT_TYPE)?
            .to_str()
            .ok()
            .map(str::to_string)
    }

    fn declared_length(&self) -> Option<u64> {
        self.content_length()
    }

    async fn next_chunk(&mut self) -> Result<Option<Vec<u8>>, String> {
        self.chunk()
            .await
            .map(|chunk| chunk.map(|bytes| bytes.to_vec()))
            .map_err(|e| e.to_string())
    }
}

async fn read_image_response<R: ImageResponse + Send>(
    host: &str,
    response: &mut R,
) -> Result<String, String> {
    check_status(response.status_code())?;

    let content_type = response.declared_content_type().unwrap_or_default();
    if !is_image_content_type(&content_type) {
        return Err(format!(
            "{host} answered with something that is not an image"
        ));
    }

    if let Some(length) = response.declared_length() {
        check_size(length as usize)?;
    }

    let mut body: Vec<u8> = Vec::new();
    while let Some(chunk) = response
        .next_chunk()
        .await
        .map_err(|_| format!("could not load the image from {host}"))?
    {
        check_size(body.len() + chunk.len())?;
        body.extend_from_slice(&chunk);
    }

    let mime = sniff_image_mime(&body)
        .ok_or_else(|| format!("{host} answered with something that is not an image"))?;

    Ok(format!("data:{};base64,{}", mime, STANDARD.encode(&body)))
}

#[tauri::command]
pub async fn fetch_remote_image(url: String) -> Result<String, String> {
    let parsed = validate_image_url(&url)?;
    let host = parsed
        .host_str()
        .ok_or_else(|| "that image address names no host".to_string())?
        .to_string();
    let addresses = resolve_public_addrs(&host).await?;
    let client = build_image_client(&host, &addresses)?;

    let mut response = client
        .get(parsed)
        .send()
        .await
        .map_err(|_| format!("could not load the image from {host}"))?;

    read_image_response(&host, &mut response).await
}

const GITHUB_REDIRECT_HOST: &str = "private-user-images.githubusercontent.com";

fn tool_host_is_trusted(provider: &str, url: &Url, jira_site_host: Option<&str>) -> bool {
    let host = url.host_str().unwrap_or("");
    let path = url.path();
    match provider {
        "linear" => host == "uploads.linear.app",
        "jira" => {
            jira_site_host == Some(host) && path.starts_with("/rest/api/3/attachment/content/")
        }
        "github" => host == "github.com" && path.starts_with("/user-attachments/assets/"),
        _ => false,
    }
}

fn validate_tool_image_url(
    provider: &str,
    url: &str,
    jira_site_host: Option<&str>,
) -> Result<Url, String> {
    let parsed = validate_image_url(url)?;
    if !tool_host_is_trusted(provider, &parsed, jira_site_host) {
        let host = parsed.host_str().unwrap_or(url);
        return Err(format!("{host} is not a host {provider} images load from"));
    }
    Ok(parsed)
}

fn is_allowed_redirect(provider: &str, url: &Url) -> bool {
    provider == "github" && url.scheme() == "https" && url.host_str() == Some(GITHUB_REDIRECT_HOST)
}

enum ToolAuth {
    Raw(String),
    Bearer(String),
    Basic { email: String, token: String },
}

fn apply_tool_auth(builder: reqwest::RequestBuilder, auth: &ToolAuth) -> reqwest::RequestBuilder {
    match auth {
        ToolAuth::Raw(token) => builder.header("Authorization", token),
        ToolAuth::Bearer(token) => builder.bearer_auth(token),
        ToolAuth::Basic { email, token } => builder.basic_auth(email, Some(token)),
    }
}

async fn fetch_authed_image(provider: &str, url: Url, auth: ToolAuth) -> Result<String, String> {
    let host = url
        .host_str()
        .ok_or_else(|| "that image address names no host".to_string())?
        .to_string();
    let addresses = resolve_public_addrs(&host).await?;
    let client = build_image_client(&host, &addresses)?;
    let response = apply_tool_auth(client.get(url), &auth)
        .send()
        .await
        .map_err(|_| format!("could not load the image from {host}"))?;

    if !(300..400).contains(&response.status().as_u16()) {
        let mut response = response;
        return read_image_response(&host, &mut response).await;
    }

    let location = response
        .headers()
        .get(reqwest::header::LOCATION)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
        .ok_or_else(|| format!("{host} redirected without a location"))?;
    let redirect_url =
        Url::parse(&location).map_err(|_| format!("{host} redirected to an unusable address"))?;
    if !is_allowed_redirect(provider, &redirect_url) {
        return Err(format!(
            "{host} redirected somewhere this loader does not trust"
        ));
    }
    let redirect_host = redirect_url
        .host_str()
        .ok_or_else(|| "the redirect names no host".to_string())?
        .to_string();
    let redirect_addresses = resolve_public_addrs(&redirect_host).await?;
    let redirect_client = build_image_client(&redirect_host, &redirect_addresses)?;
    let mut redirected = redirect_client
        .get(redirect_url)
        .send()
        .await
        .map_err(|_| format!("could not load the image from {redirect_host}"))?;

    read_image_response(&redirect_host, &mut redirected).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadToolImageArgs {
    workspace_id: String,
    project_id: Option<String>,
    provider: String,
    email: Option<String>,
    site_url: Option<String>,
    url: String,
}

#[tauri::command]
pub async fn load_tool_image(
    args: LoadToolImageArgs,
    linear_cache: State<'_, crate::linear::LinearTokenCache>,
    jira_cache: State<'_, crate::jira::JiraTokenCache>,
) -> Result<String, String> {
    let LoadToolImageArgs {
        workspace_id,
        project_id,
        provider,
        email,
        site_url,
        url,
    } = args;
    let jira_site_host = site_url
        .as_deref()
        .and_then(|site| Url::parse(site).ok())
        .and_then(|url| url.host_str().map(str::to_string));
    let parsed = validate_tool_image_url(&provider, &url, jira_site_host.as_deref())?;
    let auth = match provider.as_str() {
        "linear" => {
            let token =
                crate::linear::read_token(&workspace_id, project_id.as_deref(), &linear_cache)
                    .map_err(|e| e.to_string())?;
            ToolAuth::Raw(token)
        }
        "jira" => {
            let token = crate::jira::read_token(&workspace_id, project_id.as_deref(), &jira_cache)
                .map_err(|e| e.to_string())?;
            let email = email.ok_or_else(|| "jira images need the connected email".to_string())?;
            ToolAuth::Basic { email, token }
        }
        "github" => {
            let token = crate::github::read_token(Some(&workspace_id), project_id.as_deref())
                .ok_or_else(|| "no github token stored for this workspace".to_string())?;
            ToolAuth::Bearer(token)
        }
        other => return Err(format!("{other} does not host its own images")),
    };
    fetch_authed_image(&provider, parsed, auth).await
}

#[cfg(test)]
mod tests {
    use super::{
        build_image_client, check_size, check_status, image_redirect_policy, is_allowed_redirect,
        is_blocked_host, is_image_content_type, read_image_response, resolve_public_addrs,
        sniff_image_mime, tool_host_is_trusted, validate_image_url, validate_tool_image_url,
        ImageResponse, Url, MAX_IMAGE_BYTES,
    };
    use std::collections::VecDeque;
    use std::time::Duration;

    const LIB_SRC: &str = include_str!("lib.rs");
    const SELF_SRC: &str = include_str!("remote_image.rs");
    const PNG_HEADER: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];

    struct FakeResponse {
        status: u16,
        content_type: Option<String>,
        length: Option<u64>,
        chunks: VecDeque<Vec<u8>>,
        pulls: usize,
    }

    impl FakeResponse {
        fn image(chunks: Vec<Vec<u8>>) -> Self {
            Self {
                status: 200,
                content_type: Some("image/png".to_string()),
                length: None,
                chunks: chunks.into(),
                pulls: 0,
            }
        }
    }

    impl ImageResponse for FakeResponse {
        fn status_code(&self) -> u16 {
            self.status
        }

        fn declared_content_type(&self) -> Option<String> {
            self.content_type.clone()
        }

        fn declared_length(&self) -> Option<u64> {
            self.length
        }

        async fn next_chunk(&mut self) -> Result<Option<Vec<u8>>, String> {
            self.pulls += 1;
            Ok(self.chunks.pop_front())
        }
    }

    fn command_body() -> &'static str {
        let start = SELF_SRC
            .find("pub async fn fetch_remote_image")
            .expect("command");
        let rest = &SELF_SRC[start..];
        let end = rest.find("\n}\n").expect("command end");
        &rest[..end]
    }

    #[tokio::test]
    async fn pins_the_connection_to_the_address_it_resolved() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let accepted = tokio::spawn(async move { listener.accept().await.is_ok() });

        let client = build_image_client("pinned.invalid", &[address]).unwrap();
        let _ = client.get("https://pinned.invalid/a.png").send().await;

        let reached = tokio::time::timeout(Duration::from_secs(5), accepted).await;
        assert!(
            matches!(reached, Ok(Ok(true))),
            "the request did not reach the checked address"
        );
    }

    #[tokio::test]
    async fn refuses_a_host_whose_dns_answer_is_private() {
        assert!(resolve_public_addrs("localhost").await.is_err());
    }

    #[tokio::test]
    async fn leaves_a_literal_address_to_the_client() {
        assert_eq!(resolve_public_addrs("93.184.216.34").await.unwrap(), vec![]);
    }

    #[test]
    fn refuses_to_follow_redirects() {
        let policy = format!("{:?}", image_redirect_policy());
        assert!(policy.contains("None"), "{policy}");
        assert!(!policy.contains("Limit"), "{policy}");
        assert!(!policy.contains("Custom"), "{policy}");
    }

    #[tokio::test]
    async fn refuses_a_response_that_is_not_a_success() {
        for status in [301u16, 302, 307, 404, 500] {
            let mut response = FakeResponse {
                status,
                ..FakeResponse::image(vec![PNG_HEADER.to_vec()])
            };
            assert!(
                read_image_response("h.example.com", &mut response)
                    .await
                    .is_err(),
                "accepted {status}"
            );
            assert_eq!(response.pulls, 0);
        }
    }

    #[tokio::test]
    async fn refuses_a_response_that_does_not_declare_an_image() {
        for content_type in [
            Some("text/html".to_string()),
            Some("image/svg+xml".to_string()),
            Some("image/svg+xml; charset=utf-8".to_string()),
            None,
        ] {
            let mut response = FakeResponse {
                content_type,
                ..FakeResponse::image(vec![PNG_HEADER.to_vec()])
            };
            assert!(read_image_response("h.example.com", &mut response)
                .await
                .is_err());
            assert_eq!(response.pulls, 0);
        }
    }

    #[tokio::test]
    async fn refuses_a_declared_length_over_the_cap() {
        let mut response = FakeResponse {
            length: Some(MAX_IMAGE_BYTES as u64 + 1),
            ..FakeResponse::image(vec![PNG_HEADER.to_vec()])
        };

        assert!(read_image_response("h.example.com", &mut response)
            .await
            .is_err());
        assert_eq!(response.pulls, 0);
    }

    #[tokio::test]
    async fn stops_reading_a_body_that_grows_past_the_cap() {
        let chunk = vec![0u8; 1024 * 1024];
        let mut response = FakeResponse::image(vec![chunk; 12]);

        assert!(read_image_response("h.example.com", &mut response)
            .await
            .is_err());
        assert!(response.pulls < 12, "read {} chunks", response.pulls);
    }

    #[tokio::test]
    async fn names_the_mime_from_the_bytes_and_not_the_header() {
        let mut response = FakeResponse::image(vec![vec![0xff, 0xd8, 0xff, 0xe0], vec![0x00]]);

        let uri = read_image_response("h.example.com", &mut response)
            .await
            .unwrap();

        assert!(uri.starts_with("data:image/jpeg;base64,"), "{uri}");
    }

    #[tokio::test]
    async fn refuses_markup_the_header_calls_an_image() {
        let mut response = FakeResponse::image(vec![b"<svg xmlns=\"x\">".to_vec()]);

        assert!(read_image_response("h.example.com", &mut response)
            .await
            .is_err());
    }

    #[test]
    fn the_command_vets_dns_and_pins_before_it_connects() {
        let body = command_body();
        assert!(
            body.contains("resolve_public_addrs(&host).await?"),
            "{body}"
        );
        assert!(
            body.contains("build_image_client(&host, &addresses)?"),
            "{body}"
        );
        assert!(
            body.contains("read_image_response(&host, &mut response)"),
            "{body}"
        );
    }

    #[test]
    fn the_command_stays_registered_with_the_webview() {
        assert!(LIB_SRC.contains("remote_image::fetch_remote_image"));
    }

    #[test]
    fn accepts_a_github_user_attachment_url() {
        let parsed =
            validate_image_url("https://github.com/user-attachments/assets/9f2c.png").unwrap();
        assert_eq!(parsed.host_str(), Some("github.com"));
    }

    #[test]
    fn refuses_every_scheme_but_https() {
        for url in [
            "http://example.com/a.png",
            "file:///etc/passwd",
            "data:image/png;base64,AAAA",
            "javascript:alert(1)",
        ] {
            assert!(validate_image_url(url).is_err(), "accepted {url}");
        }
    }

    #[test]
    fn refuses_loopback_private_and_link_local_hosts() {
        for host in [
            "https://localhost/a.png",
            "https://127.0.0.1/a.png",
            "https://10.0.0.5/a.png",
            "https://192.168.1.4/a.png",
            "https://172.16.3.9/a.png",
            "https://169.254.169.254/latest/meta-data",
            "https://100.100.0.1/a.png",
            "https://[::1]/a.png",
            "https://[fd00::1]/a.png",
            "https://[fe80::1]/a.png",
            "https://[::ffff:127.0.0.1]/a.png",
            "https://printer.local/a.png",
            "https://api.internal/a.png",
        ] {
            assert!(validate_image_url(host).is_err(), "accepted {host}");
        }
    }

    #[test]
    fn treats_a_trailing_dot_host_as_the_same_host() {
        assert!(is_blocked_host("localhost."));
        assert!(is_blocked_host("127.0.0.1."));
    }

    #[test]
    fn refuses_a_redirect_and_any_non_success_status() {
        assert!(check_status(301).is_err());
        assert!(check_status(302).is_err());
        assert!(check_status(307).is_err());
        assert!(check_status(404).is_err());
        assert!(check_status(200).is_ok());
    }

    #[test]
    fn refuses_a_body_over_ten_megabytes() {
        assert!(check_size(MAX_IMAGE_BYTES).is_ok());
        assert!(check_size(MAX_IMAGE_BYTES + 1).is_err());
    }

    #[test]
    fn accepts_only_an_image_content_type() {
        assert!(is_image_content_type("image/png"));
        assert!(is_image_content_type("Image/JPEG; charset=binary"));
        assert!(!is_image_content_type("text/html"));
        assert!(!is_image_content_type(""));
        assert!(!is_image_content_type("image/svg+xml"));
        assert!(!is_image_content_type("Image/SVG+XML; charset=utf-8"));
    }

    #[test]
    fn sniffs_the_mime_from_the_bytes_and_rejects_markup() {
        assert_eq!(
            sniff_image_mime(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
            Some("image/png")
        );
        assert_eq!(
            sniff_image_mime(&[0xff, 0xd8, 0xff, 0xe0]),
            Some("image/jpeg")
        );
        assert_eq!(sniff_image_mime(b"GIF89a...."), Some("image/gif"));
        assert_eq!(
            sniff_image_mime(b"RIFF\0\0\0\0WEBPVP8 "),
            Some("image/webp")
        );
        assert_eq!(
            sniff_image_mime(b"<svg xmlns=\"http://www.w3.org/2000/svg\">"),
            None
        );
        assert_eq!(sniff_image_mime(b"<!doctype html>"), None);
    }

    #[test]
    fn trusts_only_each_providers_own_upload_host() {
        let linear = Url::parse("https://uploads.linear.app/9f2c.png").unwrap();
        assert!(tool_host_is_trusted("linear", &linear, None));

        let jira =
            Url::parse("https://acme.atlassian.net/rest/api/3/attachment/content/1").unwrap();
        assert!(tool_host_is_trusted(
            "jira",
            &jira,
            Some("acme.atlassian.net")
        ));

        let github = Url::parse("https://github.com/user-attachments/assets/9f2c").unwrap();
        assert!(tool_host_is_trusted("github", &github, None));
    }

    #[test]
    fn refuses_a_jira_attachment_from_a_tenant_other_than_the_one_connected() {
        let foreign_tenant =
            Url::parse("https://evil.atlassian.net/rest/api/3/attachment/content/1").unwrap();
        assert!(!tool_host_is_trusted(
            "jira",
            &foreign_tenant,
            Some("acme.atlassian.net")
        ));
    }

    #[test]
    fn refuses_a_jira_attachment_when_no_site_is_connected() {
        let jira =
            Url::parse("https://acme.atlassian.net/rest/api/3/attachment/content/1").unwrap();
        assert!(!tool_host_is_trusted("jira", &jira, None));
    }

    #[test]
    fn refuses_a_host_not_in_the_providers_own_table() {
        let foreign = Url::parse("https://cdn.acme.dev/9f2c.png").unwrap();
        assert!(!tool_host_is_trusted("linear", &foreign, None));
        assert!(!tool_host_is_trusted(
            "jira",
            &foreign,
            Some("acme.atlassian.net")
        ));
        assert!(!tool_host_is_trusted("github", &foreign, None));

        let wrong_jira_path = Url::parse("https://acme.atlassian.net/rest/api/3/issue/1").unwrap();
        assert!(!tool_host_is_trusted(
            "jira",
            &wrong_jira_path,
            Some("acme.atlassian.net")
        ));

        let wrong_github_path = Url::parse("https://github.com/acme/repo").unwrap();
        assert!(!tool_host_is_trusted("github", &wrong_github_path, None));

        assert!(!tool_host_is_trusted("bitbucket", &linear_upload(), None));
    }

    fn linear_upload() -> Url {
        Url::parse("https://uploads.linear.app/9f2c.png").unwrap()
    }

    #[test]
    fn validate_tool_image_url_refuses_a_mismatched_host() {
        assert!(validate_tool_image_url("linear", "https://cdn.acme.dev/a.png", None).is_err());
        assert!(
            validate_tool_image_url("linear", "https://uploads.linear.app/a.png", None).is_ok()
        );
    }

    #[test]
    fn only_github_gets_one_redirect_and_only_to_its_own_asset_host() {
        let target = Url::parse("https://private-user-images.githubusercontent.com/a.png").unwrap();
        assert!(is_allowed_redirect("github", &target));
        assert!(!is_allowed_redirect("linear", &target));
        assert!(!is_allowed_redirect("jira", &target));

        let elsewhere = Url::parse("https://attacker.example.com/a.png").unwrap();
        assert!(!is_allowed_redirect("github", &elsewhere));
    }

    #[test]
    fn the_redirect_hop_never_carries_the_first_hops_auth_header() {
        let start = SELF_SRC
            .find("async fn fetch_authed_image")
            .expect("fetch_authed_image");
        let rest = &SELF_SRC[start..];
        let end = rest.find("\n}\n").expect("function end");
        let body = &rest[..end];

        assert_eq!(
            body.matches("apply_tool_auth(").count(),
            1,
            "the auth header must be attached exactly once, to the first request"
        );
        assert!(
            body.contains("redirect_client\n        .get(redirect_url)")
                || body.contains("redirect_client.get(redirect_url)"),
            "the redirect request must go out through a plain, unauthenticated client"
        );
    }
}
