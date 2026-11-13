use std::time::Duration;

use tauri::ipc::Response;
use tauri::State;

use reqwest::Url;

use crate::remote_image::{
    check_status, host_label, resolve_tool_media, send_authed_media, Deadline, ImageResponse,
    LoadToolImageArgs, ToolAuth,
};
use crate::util::limits::MAX_VIDEO_BYTES;
use crate::util::MessageError;

const VIDEO_TIMEOUT: Duration = Duration::from_secs(180);
const OVER_THE_CAP: &str = "that video is larger than 50 MB, so nothing was loaded";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum VideoType {
    Mp4,
    Webm,
    Quicktime,
}

impl VideoType {
    fn code(self) -> u8 {
        match self {
            VideoType::Mp4 => 0,
            VideoType::Webm => 1,
            VideoType::Quicktime => 2,
        }
    }

    fn of_declared(value: &str) -> Option<VideoType> {
        let lowered = value.trim().to_ascii_lowercase();
        match lowered.split(';').next().unwrap_or("").trim() {
            "video/mp4" => Some(VideoType::Mp4),
            "video/webm" => Some(VideoType::Webm),
            "video/quicktime" => Some(VideoType::Quicktime),
            _ => None,
        }
    }

    fn of_bytes(bytes: &[u8]) -> Option<VideoType> {
        if bytes.starts_with(&[0x1a, 0x45, 0xdf, 0xa3]) {
            return Some(VideoType::Webm);
        }
        if bytes.len() >= 12 && &bytes[4..8] == b"ftyp" {
            if &bytes[8..12] == b"qt  " {
                return Some(VideoType::Quicktime);
            }
            return Some(VideoType::Mp4);
        }
        None
    }
}

fn check_size(len: usize) -> Result<(), String> {
    if len > MAX_VIDEO_BYTES {
        return Err(OVER_THE_CAP.to_string());
    }
    Ok(())
}

async fn read_video_response<R: ImageResponse + Send>(
    host: &str,
    response: &mut R,
) -> Result<Vec<u8>, String> {
    check_status(response.status_code())?;

    let content_type = response.declared_content_type().unwrap_or_default();
    if VideoType::of_declared(&content_type).is_none() {
        return Err(format!(
            "{host} answered with something that is not a video"
        ));
    }

    if let Some(length) = response.declared_length() {
        check_size(usize::try_from(length).unwrap_or(usize::MAX))?;
    }

    let mut body: Vec<u8> = vec![0];
    while let Some(chunk) = response
        .next_chunk()
        .await
        .map_err(|_| format!("{host} stopped sending the video"))?
    {
        check_size(body.len() - 1 + chunk.len())?;
        body.extend_from_slice(&chunk);
    }

    let kind = VideoType::of_bytes(&body[1..])
        .ok_or_else(|| format!("{host} answered with something that is not a video"))?;
    body[0] = kind.code();
    Ok(body)
}

#[tauri::command]
pub async fn fetch_remote_media(
    args: LoadToolImageArgs,
    linear_cache: State<'_, crate::linear::LinearTokenCache>,
    jira_cache: State<'_, crate::jira::JiraTokenCache>,
) -> Result<Response, MessageError> {
    let (provider, parsed, auth) = resolve_tool_media(args, &linear_cache, &jira_cache)?;
    let deadline = Deadline::after(VIDEO_TIMEOUT);
    let label = host_label(&parsed);
    let body = deadline
        .bound(&label, fetch_video(&provider, parsed, auth, deadline))
        .await?;
    Ok(Response::new(body))
}

async fn fetch_video(
    provider: &str,
    url: Url,
    auth: ToolAuth,
    deadline: Deadline,
) -> Result<Vec<u8>, String> {
    let (host, mut response) = send_authed_media(provider, url, auth, deadline).await?;
    read_video_response(&host, &mut response).await
}

#[cfg(test)]
mod tests {
    use super::{read_video_response, VideoType, MAX_VIDEO_BYTES, OVER_THE_CAP};
    use crate::remote_image::{is_allowed_redirect, validate_tool_image_url, ImageResponse};
    use reqwest::Url;
    use std::collections::VecDeque;

    const LIB_SRC: &str = include_str!("lib.rs");
    const SELF_SRC: &str = include_str!("remote_media.rs");
    const MP4_HEADER: [u8; 12] = [
        0, 0, 0, 0x18, b'f', b't', b'y', b'p', b'i', b's', b'o', b'm',
    ];
    const WEBM_HEADER: [u8; 4] = [0x1a, 0x45, 0xdf, 0xa3];

    struct FakeResponse {
        status: u16,
        content_type: Option<String>,
        length: Option<u64>,
        chunks: VecDeque<Vec<u8>>,
        pulls: usize,
    }

    impl FakeResponse {
        fn video(chunks: Vec<Vec<u8>>) -> Self {
            Self {
                status: 200,
                content_type: Some("video/mp4".to_string()),
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

    fn function_body(name: &str) -> &'static str {
        let start = SELF_SRC.find(name).expect("function");
        let rest = &SELF_SRC[start..];
        let end = rest.find("\n}\n").expect("function end");
        &rest[..end]
    }

    #[tokio::test]
    async fn refuses_a_declared_length_over_the_cap_before_reading_the_body() {
        let mut response = FakeResponse {
            length: Some(MAX_VIDEO_BYTES as u64 + 1),
            ..FakeResponse::video(vec![MP4_HEADER.to_vec()])
        };
        let error = read_video_response("h.example.com", &mut response)
            .await
            .unwrap_err();
        assert_eq!(error, OVER_THE_CAP);
        assert_eq!(response.pulls, 0);
    }

    #[tokio::test]
    async fn stops_reading_a_body_that_grows_past_the_cap() {
        let mut response = FakeResponse::video(vec![
            MP4_HEADER.to_vec(),
            vec![0; MAX_VIDEO_BYTES],
            vec![0; 16],
        ]);
        let error = read_video_response("h.example.com", &mut response)
            .await
            .unwrap_err();
        assert_eq!(error, OVER_THE_CAP);
        assert_eq!(response.pulls, 2);
    }

    #[tokio::test]
    async fn refuses_a_type_that_is_not_one_of_the_three_video_types() {
        for declared in [
            "image/png",
            "text/html",
            "video/x-flv",
            "application/octet-stream",
            "",
        ] {
            let mut response = FakeResponse {
                content_type: Some(declared.to_string()),
                ..FakeResponse::video(vec![MP4_HEADER.to_vec()])
            };
            assert!(
                read_video_response("h.example.com", &mut response)
                    .await
                    .is_err(),
                "accepted {declared}"
            );
            assert_eq!(response.pulls, 0);
        }
    }

    #[tokio::test]
    async fn refuses_markup_the_header_calls_a_video() {
        let mut response = FakeResponse::video(vec![b"<html>nope</html>".to_vec()]);
        assert!(read_video_response("h.example.com", &mut response)
            .await
            .is_err());
    }

    #[tokio::test]
    async fn refuses_a_response_that_is_not_a_success() {
        for status in [301u16, 302, 404, 500] {
            let mut response = FakeResponse {
                status,
                ..FakeResponse::video(vec![MP4_HEADER.to_vec()])
            };
            assert!(read_video_response("h.example.com", &mut response)
                .await
                .is_err());
            assert_eq!(response.pulls, 0);
        }
    }

    #[tokio::test]
    async fn names_the_type_from_the_bytes_in_the_first_byte() {
        let mut mp4 = FakeResponse::video(vec![MP4_HEADER.to_vec()]);
        let body = read_video_response("h.example.com", &mut mp4)
            .await
            .unwrap();
        assert_eq!(body[0], VideoType::Mp4.code());
        assert_eq!(&body[1..], &MP4_HEADER);

        let mut webm = FakeResponse {
            content_type: Some("video/webm; codecs=vp9".to_string()),
            ..FakeResponse::video(vec![WEBM_HEADER.to_vec()])
        };
        let body = read_video_response("h.example.com", &mut webm)
            .await
            .unwrap();
        assert_eq!(body[0], VideoType::Webm.code());

        let mut quicktime_header = MP4_HEADER.to_vec();
        quicktime_header[8..12].copy_from_slice(b"qt  ");
        let mut quicktime = FakeResponse {
            content_type: Some("video/quicktime".to_string()),
            ..FakeResponse::video(vec![quicktime_header])
        };
        let body = read_video_response("h.example.com", &mut quicktime)
            .await
            .unwrap();
        assert_eq!(body[0], VideoType::Quicktime.code());
    }

    #[test]
    fn the_cap_is_fifty_megabytes() {
        assert_eq!(MAX_VIDEO_BYTES, 50 * 1024 * 1024);
    }

    #[test]
    fn the_command_stays_registered_with_the_webview() {
        assert!(LIB_SRC.contains("remote_media::fetch_remote_media"));
    }

    #[test]
    fn the_command_goes_through_the_vetted_hop_that_drops_the_token_on_a_redirect() {
        let body = function_body("pub async fn fetch_remote_media");
        assert!(body.contains("resolve_tool_media("), "{body}");
        assert!(body.contains("Deadline::after(VIDEO_TIMEOUT)"), "{body}");
        assert!(
            body.contains(".bound(&label, fetch_video(&provider, parsed, auth, deadline))"),
            "{body}"
        );
        let fetch = function_body("async fn fetch_video");
        assert!(
            fetch.contains("send_authed_media(provider, url, auth, deadline)"),
            "{fetch}"
        );
        for source in [body, fetch] {
            assert!(!source.contains("apply_tool_auth("), "{source}");
            assert!(!source.contains("Client::builder"), "{source}");
            assert!(!source.contains(".redirect("), "{source}");
        }
    }

    #[test]
    fn refuses_a_private_address_and_a_host_that_is_not_the_providers_own() {
        for url in [
            "https://127.0.0.1/user-attachments/assets/9f2c",
            "https://10.0.0.8/user-attachments/assets/9f2c",
            "https://localhost/user-attachments/assets/9f2c",
            "https://example.com/user-attachments/assets/9f2c",
        ] {
            assert!(
                validate_tool_image_url("github", url, None).is_err(),
                "{url}"
            );
        }
        assert!(validate_tool_image_url(
            "github",
            "https://github.com/user-attachments/assets/9f2c",
            None
        )
        .is_ok());
    }

    #[test]
    fn follows_a_redirect_only_to_the_one_host_github_serves_files_from() {
        let own = Url::parse("https://private-user-images.githubusercontent.com/1/a.mp4").unwrap();
        let other = Url::parse("https://attacker.example.com/a.mp4").unwrap();
        assert!(is_allowed_redirect("github", &own));
        assert!(!is_allowed_redirect("github", &other));
        assert!(!is_allowed_redirect("linear", &own));
        assert!(!is_allowed_redirect("jira", &own));
    }
}
