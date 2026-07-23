use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;

use crate::secrets;

pub struct GitlabTokenCache(Mutex<HashMap<String, String>>);

impl GitlabTokenCache {
    pub fn new() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(reqwest::Client::new)
}

fn credential_key(workspace_id: &str) -> String {
    format!("goodboy.workspace.{}.gitlab", workspace_id)
}

#[derive(Debug, Error)]
pub enum GitlabError {
    #[error("http error {status}: {body}")]
    Http { status: u16, body: String },
    #[error("invalid response shape: {0}")]
    InvalidShape(String),
    #[error("no token stored for workspace {0}")]
    NoToken(String),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
}

crate::util::impl_error_serialize!(GitlabError);

impl GitlabError {
    fn kind(&self) -> &'static str {
        match self {
            GitlabError::Http { .. } => "http",
            GitlabError::InvalidShape(_) => "shape",
            GitlabError::NoToken(_) => "no_token",
            GitlabError::Secret(_) => "secret",
        }
    }
}

impl From<reqwest::Error> for GitlabError {
    fn from(e: reqwest::Error) -> Self {
        GitlabError::Http {
            status: 0,
            body: e.to_string(),
        }
    }
}

fn api_base(host: &str) -> Result<String, GitlabError> {
    let trimmed = host.trim().trim_end_matches('/');
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err(GitlabError::InvalidShape(format!(
            "invalid host: {}",
            host
        )));
    }
    Ok(format!("{}/api/v4", trimmed))
}

async fn get_json<T: serde::de::DeserializeOwned>(
    host: &str,
    token: &str,
    path: &str,
) -> Result<T, GitlabError> {
    let url = format!("{}{}", api_base(host)?, path);
    let res = http_client()
        .get(&url)
        .header("PRIVATE-TOKEN", token)
        .send()
        .await?;
    let status = res.status();
    let body = res.text().await?;
    if !status.is_success() {
        return Err(GitlabError::Http {
            status: status.as_u16(),
            body,
        });
    }
    serde_json::from_str(&body).map_err(|e| GitlabError::InvalidShape(e.to_string()))
}

async fn send_json<T: serde::de::DeserializeOwned>(
    method: reqwest::Method,
    host: &str,
    token: &str,
    path: &str,
    body: &serde_json::Value,
) -> Result<T, GitlabError> {
    let url = format!("{}{}", api_base(host)?, path);
    let res = http_client()
        .request(method, &url)
        .header("PRIVATE-TOKEN", token)
        .json(body)
        .send()
        .await?;
    let status = res.status();
    let text = res.text().await?;
    if !status.is_success() {
        return Err(GitlabError::Http {
            status: status.as_u16(),
            body: text,
        });
    }
    serde_json::from_str(&text).map_err(|e| GitlabError::InvalidShape(e.to_string()))
}

fn percent_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

fn encode_project_path(project_path: &str) -> String {
    percent_encode(project_path.trim().trim_matches('/'))
}

fn read_token(workspace_id: &str, cache: &GitlabTokenCache) -> Result<String, GitlabError> {
    if let Some(tok) = cache.0.lock().unwrap().get(workspace_id) {
        return Ok(tok.clone());
    }
    let tok = secrets::read(&credential_key(workspace_id))?
        .ok_or_else(|| GitlabError::NoToken(workspace_id.to_string()))?;
    cache
        .0
        .lock()
        .unwrap()
        .insert(workspace_id.to_string(), tok.clone());
    Ok(tok)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabUser {
    pub id: i64,
    pub username: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabReferences {
    pub full: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabMilestone {
    pub title: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabIssue {
    pub id: i64,
    pub iid: i64,
    #[serde(rename = "projectId", alias = "project_id")]
    pub project_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    #[serde(rename = "webUrl", alias = "web_url")]
    pub web_url: String,
    pub references: GitlabReferences,
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: String,
    pub milestone: Option<GitlabMilestone>,
    pub labels: Vec<String>,
}

#[tauri::command]
pub async fn gitlab_connect(
    workspace_id: String,
    host: String,
    token: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabUser, GitlabError> {
    let user: GitlabUser = get_json(&host, &token, "/user").await?;
    secrets::set(&credential_key(&workspace_id), &token)?;
    cache.0.lock().unwrap().insert(workspace_id, token);
    Ok(user)
}

#[tauri::command]
pub async fn gitlab_disconnect(
    workspace_id: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<(), GitlabError> {
    secrets::clear(&credential_key(&workspace_id))?;
    cache.0.lock().unwrap().remove(&workspace_id);
    Ok(())
}

#[tauri::command]
pub async fn gitlab_fetch_assigned_issues(
    workspace_id: String,
    host: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Vec<GitlabIssue>, GitlabError> {
    let token = read_token(&workspace_id, &cache)?;
    get_json(
        &host,
        &token,
        "/issues?scope=assigned_to_me&state=opened&order_by=updated_at&per_page=50",
    )
    .await
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabMergeRequest {
    pub id: i64,
    pub iid: i64,
    #[serde(rename = "projectId", alias = "project_id")]
    pub project_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    #[serde(rename = "webUrl", alias = "web_url")]
    pub web_url: String,
    #[serde(rename = "sourceBranch", alias = "source_branch")]
    pub source_branch: String,
    #[serde(rename = "targetBranch", alias = "target_branch")]
    pub target_branch: String,
    #[serde(default)]
    pub draft: bool,
    #[serde(rename = "hasConflicts", alias = "has_conflicts", default)]
    pub has_conflicts: bool,
    #[serde(rename = "mergeStatus", alias = "merge_status", default)]
    pub merge_status: Option<String>,
    #[serde(rename = "updatedAt", alias = "updated_at", default)]
    pub updated_at: String,
}

#[tauri::command]
pub async fn gitlab_fetch_assigned_mrs(
    workspace_id: String,
    host: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Vec<GitlabMergeRequest>, GitlabError> {
    let token = read_token(&workspace_id, &cache)?;
    get_json(
        &host,
        &token,
        "/merge_requests?scope=assigned_to_me&state=opened&order_by=updated_at&per_page=50",
    )
    .await
}

#[tauri::command]
pub async fn gitlab_mr_for_branch(
    workspace_id: String,
    host: String,
    project_path: String,
    source_branch: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Option<GitlabMergeRequest>, GitlabError> {
    let token = read_token(&workspace_id, &cache)?;
    let encoded = encode_project_path(&project_path);
    let branch = percent_encode(&source_branch);
    let path = format!(
        "/projects/{encoded}/merge_requests?source_branch={branch}&state=all&order_by=updated_at&per_page=1"
    );
    let mrs: Vec<GitlabMergeRequest> = get_json(&host, &token, &path).await?;
    Ok(mrs.into_iter().next())
}

#[tauri::command]
pub async fn gitlab_create_mr(
    workspace_id: String,
    host: String,
    project_path: String,
    source_branch: String,
    target_branch: String,
    title: String,
    description: String,
    draft: bool,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabMergeRequest, GitlabError> {
    let token = read_token(&workspace_id, &cache)?;
    let encoded = encode_project_path(&project_path);
    let mr_title = if draft {
        format!("Draft: {title}")
    } else {
        title
    };
    let body = serde_json::json!({
        "source_branch": source_branch,
        "target_branch": target_branch,
        "title": mr_title,
        "description": description,
        "remove_source_branch": true,
    });
    send_json(
        reqwest::Method::POST,
        &host,
        &token,
        &format!("/projects/{encoded}/merge_requests"),
        &body,
    )
    .await
}

#[tauri::command]
pub async fn gitlab_merge_mr(
    workspace_id: String,
    host: String,
    project_path: String,
    mr_iid: i64,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabMergeRequest, GitlabError> {
    let token = read_token(&workspace_id, &cache)?;
    let encoded = encode_project_path(&project_path);
    send_json(
        reqwest::Method::PUT,
        &host,
        &token,
        &format!("/projects/{encoded}/merge_requests/{mr_iid}/merge"),
        &serde_json::json!({}),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_base_appends_v4_for_gitlab_com() {
        assert_eq!(api_base("https://gitlab.com").unwrap(), "https://gitlab.com/api/v4");
    }

    #[test]
    fn api_base_trims_trailing_slash_and_whitespace() {
        assert_eq!(
            api_base("  https://gitlab.example.com/  ").unwrap(),
            "https://gitlab.example.com/api/v4"
        );
    }

    #[test]
    fn api_base_supports_self_hosted_http_host() {
        assert_eq!(
            api_base("http://gitlab.internal:8080").unwrap(),
            "http://gitlab.internal:8080/api/v4"
        );
    }

    #[test]
    fn api_base_rejects_a_host_without_scheme() {
        let err = api_base("gitlab.com").unwrap_err();
        assert!(matches!(err, GitlabError::InvalidShape(_)));
    }

    #[test]
    fn encode_project_path_percent_encodes_namespace_slashes() {
        assert_eq!(encode_project_path("group/sub/repo"), "group%2Fsub%2Frepo");
        assert_eq!(encode_project_path("/acme/web/"), "acme%2Fweb");
    }

    #[test]
    fn percent_encode_escapes_branch_slashes_and_reserved() {
        assert_eq!(percent_encode("ak/feat-x"), "ak%2Ffeat-x");
        assert_eq!(percent_encode("a b"), "a%20b");
        assert_eq!(percent_encode("keep-._~"), "keep-._~");
    }

    #[test]
    fn merge_request_deserializes_snake_case_payload() {
        let raw = r#"{
            "id": 9,
            "iid": 2,
            "project_id": 3,
            "title": "Draft: wip",
            "description": null,
            "state": "opened",
            "web_url": "https://gitlab.com/acme/web/-/merge_requests/2",
            "source_branch": "ak/feat-x",
            "target_branch": "main",
            "draft": true,
            "has_conflicts": false,
            "merge_status": "can_be_merged",
            "updated_at": "2026-07-22T10:00:00Z"
        }"#;
        let mr: GitlabMergeRequest = serde_json::from_str(raw).unwrap();
        assert_eq!(mr.iid, 2);
        assert_eq!(mr.source_branch, "ak/feat-x");
        assert!(mr.draft);
        assert_eq!(mr.merge_status.as_deref(), Some("can_be_merged"));
        assert_eq!(mr.updated_at, "2026-07-22T10:00:00Z");
    }

    #[test]
    fn credential_key_is_namespaced_per_workspace() {
        assert_eq!(credential_key("ws-1"), "goodboy.workspace.ws-1.gitlab");
    }

    #[test]
    fn error_kind_maps_each_variant() {
        assert_eq!(
            GitlabError::Http {
                status: 500,
                body: "x".into()
            }
            .kind(),
            "http"
        );
        assert_eq!(GitlabError::InvalidShape("x".into()).kind(), "shape");
        assert_eq!(GitlabError::NoToken("ws".into()).kind(), "no_token");
    }

    #[test]
    fn gitlab_issue_deserializes_snake_case_payload() {
        let raw = r#"{
            "id": 101,
            "iid": 7,
            "project_id": 3,
            "title": "Fix",
            "description": null,
            "state": "opened",
            "web_url": "https://gitlab.com/acme/web/-/issues/7",
            "references": { "full": "acme/web#7" },
            "updated_at": "2026-05-21T10:00:00Z",
            "milestone": null,
            "labels": []
        }"#;
        let issue: GitlabIssue = serde_json::from_str(raw).unwrap();
        assert_eq!(issue.project_id, 3);
        assert_eq!(issue.web_url, "https://gitlab.com/acme/web/-/issues/7");
        assert_eq!(issue.updated_at, "2026-05-21T10:00:00Z");
        assert_eq!(issue.references.full, "acme/web#7");
        assert!(issue.description.is_none());
    }

    #[test]
    fn gitlab_issue_deserializes_camel_case_payload() {
        let raw = r#"{
            "id": 1,
            "iid": 1,
            "projectId": 9,
            "title": "t",
            "description": "d",
            "state": "opened",
            "webUrl": "https://gitlab.com/x/-/issues/1",
            "references": { "full": "x#1" },
            "updatedAt": "2026-01-01T00:00:00Z",
            "milestone": { "title": "v1" },
            "labels": ["bug"]
        }"#;
        let issue: GitlabIssue = serde_json::from_str(raw).unwrap();
        assert_eq!(issue.project_id, 9);
        assert_eq!(issue.milestone.unwrap().title, "v1");
        assert_eq!(issue.labels, vec!["bug".to_string()]);
    }
}
