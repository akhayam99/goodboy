use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use serde_json::Map;
use tauri::State;
use thiserror::Error;

use crate::secrets;

const BASE_URL: &str = "https://sentry.io/api/0";
const PAGE_LIMIT: &str = "25";
const DEFAULT_QUERY: &str = "is:unresolved";

#[derive(Clone, Serialize, Deserialize)]
pub struct SentryConfig {
    pub token: String,
    pub org: String,
    pub project: String,
}

pub struct SentryTokenCache(Mutex<HashMap<String, SentryConfig>>);

impl SentryTokenCache {
    pub fn new() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(reqwest::Client::new)
}

fn credential_key(workspace_id: &str) -> String {
    format!("goodboy.workspace.{}.sentry", workspace_id)
}

#[derive(Debug, Error)]
pub enum SentryError {
    #[error("http error: {0}")]
    Http(String),
    #[error("invalid response shape: {0}")]
    InvalidShape(String),
    #[error("no token stored for workspace {0}")]
    NoToken(String),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
}

impl SentryError {
    fn kind(&self) -> &'static str {
        match self {
            SentryError::Http(_) => "http",
            SentryError::InvalidShape(_) => "shape",
            SentryError::NoToken(_) => "no_token",
            SentryError::Secret(_) => "secret",
        }
    }
}

impl Serialize for SentryError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = Map::new();
        map.insert(
            "kind".to_string(),
            serde_json::Value::String(self.kind().to_string()),
        );
        map.insert(
            "message".to_string(),
            serde_json::Value::String(self.to_string()),
        );
        serde_json::Value::Object(map).serialize(serializer)
    }
}

impl From<reqwest::Error> for SentryError {
    fn from(e: reqwest::Error) -> Self {
        SentryError::Http(e.to_string())
    }
}

impl From<serde_json::Error> for SentryError {
    fn from(e: serde_json::Error) -> Self {
        SentryError::InvalidShape(e.to_string())
    }
}

#[derive(Serialize, Deserialize)]
pub struct SentryOrganization {
    pub slug: String,
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct SentryProject {
    pub slug: String,
    pub name: String,
    pub organization: SentryOrganization,
}

#[derive(Serialize, Deserialize)]
pub struct SentryIssueMetadata {
    #[serde(rename = "type", default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub value: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct SentryIssue {
    pub id: String,
    #[serde(rename = "shortId", default)]
    pub short_id: Option<String>,
    pub title: String,
    #[serde(default)]
    pub culprit: Option<String>,
    #[serde(default)]
    pub level: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub count: Option<String>,
    #[serde(rename = "userCount", default)]
    pub user_count: Option<i64>,
    #[serde(rename = "firstSeen", default)]
    pub first_seen: Option<String>,
    #[serde(rename = "lastSeen", default)]
    pub last_seen: Option<String>,
    #[serde(default)]
    pub permalink: Option<String>,
    #[serde(default)]
    pub metadata: Option<SentryIssueMetadata>,
}

#[derive(Serialize)]
pub struct SentryIssuesPage {
    pub issues: Vec<SentryIssue>,
    pub next_cursor: Option<String>,
}

#[derive(Serialize)]
pub struct SentryStackFrame {
    pub filename: Option<String>,
    pub function: Option<String>,
    pub line_no: Option<i64>,
    pub in_app: bool,
}

#[derive(Serialize)]
pub struct SentryIssueDetail {
    pub title: Option<String>,
    pub culprit: Option<String>,
    pub frames: Vec<SentryStackFrame>,
}

fn read_config(workspace_id: &str, cache: &SentryTokenCache) -> Result<SentryConfig, SentryError> {
    if let Some(cfg) = cache.0.lock().unwrap().get(workspace_id) {
        return Ok(cfg.clone());
    }
    let raw = secrets::read(&credential_key(workspace_id))?
        .ok_or_else(|| SentryError::NoToken(workspace_id.to_string()))?;
    let cfg: SentryConfig = serde_json::from_str(&raw)?;
    cache
        .0
        .lock()
        .unwrap()
        .insert(workspace_id.to_string(), cfg.clone());
    Ok(cfg)
}

fn parse_next_cursor(link: &str) -> Option<String> {
    for segment in link.split(',') {
        if !segment.contains("rel=\"next\"") || !segment.contains("results=\"true\"") {
            continue;
        }
        let start = segment.find("cursor=\"")? + "cursor=\"".len();
        let rest = &segment[start..];
        let end = rest.find('"')?;
        return Some(rest[..end].to_string());
    }
    None
}

fn parse_frame(frame: &serde_json::Value) -> SentryStackFrame {
    SentryStackFrame {
        filename: frame
            .get("filename")
            .and_then(|v| v.as_str())
            .map(String::from),
        function: frame
            .get("function")
            .and_then(|v| v.as_str())
            .map(String::from),
        line_no: frame.get("lineNo").and_then(|v| v.as_i64()),
        in_app: frame
            .get("inApp")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
    }
}

fn extract_frames(event: &serde_json::Value) -> Vec<SentryStackFrame> {
    let entries = match event.get("entries").and_then(|v| v.as_array()) {
        Some(entries) => entries,
        None => return Vec::new(),
    };
    for entry in entries {
        let kind = entry.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let data = entry.get("data");
        let frames = match kind {
            "exception" => data
                .and_then(|d| d.get("values"))
                .and_then(|v| v.as_array())
                .and_then(|values| values.last())
                .and_then(|value| value.get("stacktrace"))
                .and_then(|st| st.get("frames")),
            "stacktrace" => data.and_then(|d| d.get("frames")),
            _ => None,
        };
        if let Some(frames) = frames.and_then(|f| f.as_array()) {
            return frames.iter().map(parse_frame).collect();
        }
    }
    Vec::new()
}

#[tauri::command]
pub async fn sentry_connect(
    workspace_id: String,
    token: String,
    org: String,
    project: String,
    cache: State<'_, SentryTokenCache>,
) -> Result<SentryProject, SentryError> {
    let url = format!("{}/projects/{}/{}/", BASE_URL, org, project);
    let res = http_client().get(&url).bearer_auth(&token).send().await?;
    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(SentryError::Http(format!("status {}: {}", status, body)));
    }
    let project_resp: SentryProject = res.json().await?;
    let cfg = SentryConfig {
        token,
        org,
        project,
    };
    secrets::set(&credential_key(&workspace_id), &serde_json::to_string(&cfg)?)?;
    cache.0.lock().unwrap().insert(workspace_id, cfg);
    Ok(project_resp)
}

#[tauri::command]
pub async fn sentry_disconnect(
    workspace_id: String,
    cache: State<'_, SentryTokenCache>,
) -> Result<(), SentryError> {
    secrets::clear(&credential_key(&workspace_id))?;
    cache.0.lock().unwrap().remove(&workspace_id);
    Ok(())
}

#[tauri::command]
pub async fn sentry_fetch_issues(
    workspace_id: String,
    query: Option<String>,
    cursor: Option<String>,
    cache: State<'_, SentryTokenCache>,
) -> Result<SentryIssuesPage, SentryError> {
    let cfg = read_config(&workspace_id, &cache)?;
    let url = format!("{}/projects/{}/{}/issues/", BASE_URL, cfg.org, cfg.project);
    let mut params: Vec<(&str, String)> = vec![
        ("limit", PAGE_LIMIT.to_string()),
        ("query", query.unwrap_or_else(|| DEFAULT_QUERY.to_string())),
    ];
    if let Some(cursor) = cursor {
        params.push(("cursor", cursor));
    }
    let res = http_client()
        .get(&url)
        .bearer_auth(&cfg.token)
        .query(&params)
        .send()
        .await?;
    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(SentryError::Http(format!("status {}: {}", status, body)));
    }
    let next_cursor = res
        .headers()
        .get(reqwest::header::LINK)
        .and_then(|v| v.to_str().ok())
        .and_then(parse_next_cursor);
    let issues: Vec<SentryIssue> = res.json().await?;
    Ok(SentryIssuesPage {
        issues,
        next_cursor,
    })
}

#[tauri::command]
pub async fn sentry_fetch_issue_detail(
    workspace_id: String,
    issue_id: String,
    cache: State<'_, SentryTokenCache>,
) -> Result<SentryIssueDetail, SentryError> {
    let cfg = read_config(&workspace_id, &cache)?;
    let url = format!("{}/issues/{}/events/latest/", BASE_URL, issue_id);
    let res = http_client().get(&url).bearer_auth(&cfg.token).send().await?;
    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(SentryError::Http(format!("status {}: {}", status, body)));
    }
    let event: serde_json::Value = res.json().await?;
    let title = event
        .get("title")
        .and_then(|v| v.as_str())
        .map(String::from);
    let culprit = event
        .get("culprit")
        .and_then(|v| v.as_str())
        .map(String::from);
    Ok(SentryIssueDetail {
        title,
        culprit,
        frames: extract_frames(&event),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn next_cursor_extracts_when_results_true() {
        let link = "<https://sentry.io/api/0/x/?cursor=0:0:1>; rel=\"previous\"; results=\"false\"; cursor=\"0:0:1\", <https://sentry.io/api/0/x/?cursor=0:100:0>; rel=\"next\"; results=\"true\"; cursor=\"0:100:0\"";
        assert_eq!(parse_next_cursor(link), Some("0:100:0".to_string()));
    }

    #[test]
    fn next_cursor_none_when_results_false() {
        let link = "<https://sentry.io/api/0/x/?cursor=0:100:0>; rel=\"next\"; results=\"false\"; cursor=\"0:100:0\"";
        assert_eq!(parse_next_cursor(link), None);
    }

    #[test]
    fn next_cursor_none_when_no_next_rel() {
        let link = "<https://sentry.io/api/0/x/?cursor=0:0:1>; rel=\"previous\"; results=\"true\"; cursor=\"0:0:1\"";
        assert_eq!(parse_next_cursor(link), None);
    }

    #[test]
    fn extract_frames_from_exception_entry() {
        let event = serde_json::json!({
            "entries": [
                { "type": "breadcrumbs", "data": {} },
                {
                    "type": "exception",
                    "data": {
                        "values": [
                            { "stacktrace": { "frames": [ { "filename": "a.ts", "function": "old", "lineNo": 1, "inApp": false } ] } },
                            { "stacktrace": { "frames": [ { "filename": "b.ts", "function": "boom", "lineNo": 42, "inApp": true } ] } }
                        ]
                    }
                }
            ]
        });
        let frames = extract_frames(&event);
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].filename.as_deref(), Some("b.ts"));
        assert_eq!(frames[0].line_no, Some(42));
        assert!(frames[0].in_app);
    }

    #[test]
    fn extract_frames_empty_without_entries() {
        let event = serde_json::json!({ "title": "x" });
        assert!(extract_frames(&event).is_empty());
    }
}
