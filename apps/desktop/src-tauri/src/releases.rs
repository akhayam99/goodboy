use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

const REPO_SLUG: &str = "akhayam99/goodboy";
const PER_PAGE: u32 = 50;
const CLIENT_USER_AGENT: &str = "goodboy-desktop";

fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(reqwest::Client::new)
}

fn releases_url() -> String {
    format!(
        "https://api.github.com/repos/{}/releases?per_page={}",
        REPO_SLUG, PER_PAGE
    )
}

#[derive(Deserialize)]
pub struct GithubRelease {
    tag_name: String,
    html_url: String,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    published_at: Option<String>,
    #[serde(default)]
    body: Option<String>,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseNote {
    pub version: String,
    pub published_at: String,
    pub body: String,
    pub html_url: String,
}

fn published_only(raw: Vec<GithubRelease>) -> Vec<ReleaseNote> {
    raw.into_iter()
        .filter(|release| !release.draft && !release.prerelease)
        .filter_map(|release| {
            let published_at = release.published_at?;
            Some(ReleaseNote {
                version: release.tag_name,
                published_at,
                body: release.body.unwrap_or_default(),
                html_url: release.html_url,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn releases_list() -> Result<Vec<ReleaseNote>, String> {
    let response = http_client()
        .get(releases_url())
        .header(reqwest::header::USER_AGENT, CLIENT_USER_AGENT)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("github responded {}", status.as_u16()));
    }

    let raw: Vec<GithubRelease> = response.json().await.map_err(|e| e.to_string())?;
    Ok(published_only(raw))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(raw: serde_json::Value) -> Vec<GithubRelease> {
        serde_json::from_value(raw).expect("fixture parses")
    }

    #[test]
    fn keeps_only_published_releases() {
        let raw = parse(serde_json::json!([
            {
                "tag_name": "v0.1.55",
                "html_url": "https://github.com/akhayam99/goodboy/releases/tag/v0.1.55",
                "draft": false,
                "prerelease": false,
                "published_at": "2026-07-01T10:00:00Z",
                "body": "## the round\n\n- one thing"
            },
            {
                "tag_name": "v0.2.0-rc.1",
                "html_url": "https://github.com/akhayam99/goodboy/releases/tag/v0.2.0-rc.1",
                "draft": false,
                "prerelease": true,
                "published_at": "2026-07-02T10:00:00Z",
                "body": "candidate"
            },
            {
                "tag_name": "v0.1.56",
                "html_url": "https://github.com/akhayam99/goodboy/releases/tag/v0.1.56",
                "draft": true,
                "prerelease": false,
                "published_at": null,
                "body": "unfinished"
            }
        ]));

        let notes = published_only(raw);

        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].version, "v0.1.55");
        assert_eq!(notes[0].published_at, "2026-07-01T10:00:00Z");
    }

    #[test]
    fn drops_a_published_flag_without_a_date_and_defaults_a_missing_body() {
        let raw = parse(serde_json::json!([
            {
                "tag_name": "v0.1.54",
                "html_url": "https://github.com/akhayam99/goodboy/releases/tag/v0.1.54",
                "published_at": "2026-06-01T10:00:00Z"
            },
            {
                "tag_name": "v0.1.53",
                "html_url": "https://github.com/akhayam99/goodboy/releases/tag/v0.1.53"
            }
        ]));

        let notes = published_only(raw);

        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].version, "v0.1.54");
        assert_eq!(notes[0].body, "");
    }

    #[test]
    fn builds_the_api_url_from_the_single_repo_slug() {
        assert_eq!(
            releases_url(),
            "https://api.github.com/repos/akhayam99/goodboy/releases?per_page=50"
        );
    }
}
