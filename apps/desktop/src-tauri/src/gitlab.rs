use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use serde_json::Map;
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

impl Serialize for GitlabError {
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
