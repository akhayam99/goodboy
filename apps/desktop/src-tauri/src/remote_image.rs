use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::time::Duration;

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use reqwest::redirect::Policy;
use reqwest::Url;
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
    value.trim().to_ascii_lowercase().starts_with("image/")
}

fn sniff_image_mime(bytes: &[u8]) -> Option<&'static str> {
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

async fn ensure_public_host(host: &str) -> Result<(), String> {
    if host_literal_ip(host).is_some() {
        return Ok(());
    }
    let addresses = lookup_host((host, 443))
        .await
        .map_err(|_| format!("could not reach {host}"))?;
    let mut resolved = false;
    for address in addresses {
        resolved = true;
        if is_blocked_ip(address.ip()) {
            return Err(format!(
                "{host} points at a private address, so nothing was loaded"
            ));
        }
    }
    if !resolved {
        return Err(format!("could not reach {host}"));
    }
    Ok(())
}

#[tauri::command]
pub async fn fetch_remote_image(url: String) -> Result<String, String> {
    let parsed = validate_image_url(&url)?;
    let host = parsed
        .host_str()
        .ok_or_else(|| "that image address names no host".to_string())?
        .to_string();
    ensure_public_host(&host).await?;

    let client = reqwest::Client::builder()
        .redirect(Policy::none())
        .https_only(true)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| e.to_string())?;

    let mut response = client
        .get(parsed)
        .send()
        .await
        .map_err(|_| format!("could not load the image from {host}"))?;

    check_status(response.status().as_u16())?;

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    if !is_image_content_type(&content_type) {
        return Err(format!(
            "{host} answered with something that is not an image"
        ));
    }

    if let Some(length) = response.content_length() {
        check_size(length as usize)?;
    }

    let mut body: Vec<u8> = Vec::new();
    while let Some(chunk) = response
        .chunk()
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

#[cfg(test)]
mod tests {
    use super::{
        check_size, check_status, is_blocked_host, is_image_content_type, sniff_image_mime,
        validate_image_url, MAX_IMAGE_BYTES,
    };

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
}
