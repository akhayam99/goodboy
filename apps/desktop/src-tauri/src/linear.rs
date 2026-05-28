use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use serde_json::Map;
use tauri::State;
use thiserror::Error;

use crate::secrets;

/// In-memory cache of Linear PATs keyed by workspace id.
/// macOS Keychain prompts the user on every `get_password` unless the ACL is
/// "Always Allow" + the app's code signature is stable. Caching avoids the
/// repeated prompt in dev builds and the per-fetch prompt in any build.
pub struct LinearTokenCache(Mutex<HashMap<String, String>>);

impl LinearTokenCache {
    pub fn new() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

const API_URL: &str = "https://api.linear.app/graphql";

// Single client so reqwest can reuse the TLS connection pool across calls.
// `new()` is cheap but constructing a Client every call defeats keep-alive.
fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(reqwest::Client::new)
}

fn credential_key(workspace_id: &str) -> String {
    format!("goodboy.workspace.{}.linear", workspace_id)
}

#[derive(Debug, Error)]
pub enum LinearError {
    #[error("http error: {0}")]
    Http(String),
    #[error("graphql error: {0}")]
    GraphQl(String),
    #[error("invalid response shape: {0}")]
    InvalidShape(String),
    #[error("no token stored for workspace {0}")]
    NoToken(String),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
}

impl Serialize for LinearError {
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

impl LinearError {
    fn kind(&self) -> &'static str {
        match self {
            LinearError::Http(_) => "http",
            LinearError::GraphQl(_) => "graphql",
            LinearError::InvalidShape(_) => "shape",
            LinearError::NoToken(_) => "no_token",
            LinearError::Secret(_) => "secret",
        }
    }
}

impl From<reqwest::Error> for LinearError {
    fn from(e: reqwest::Error) -> Self {
        LinearError::Http(e.to_string())
    }
}

#[derive(Serialize)]
struct GraphQlRequest<'a> {
    query: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    variables: Option<serde_json::Value>,
}

async fn graphql<T: serde::de::DeserializeOwned>(
    token: &str,
    query: &str,
    variables: Option<serde_json::Value>,
) -> Result<T, LinearError> {
    let res = http_client()
        .post(API_URL)
        .header("Authorization", token)
        .header("Content-Type", "application/json")
        .json(&GraphQlRequest { query, variables })
        .send()
        .await?;
    let status = res.status();
    let body: serde_json::Value = res.json().await?;
    if !status.is_success() {
        return Err(LinearError::Http(format!("status {}: {}", status, body)));
    }
    if let Some(errors) = body.get("errors") {
        return Err(LinearError::GraphQl(errors.to_string()));
    }
    let data = body
        .get("data")
        .cloned()
        .ok_or_else(|| LinearError::InvalidShape("missing data".into()))?;
    serde_json::from_value(data).map_err(|e| LinearError::InvalidShape(e.to_string()))
}

fn read_token(workspace_id: &str, cache: &LinearTokenCache) -> Result<String, LinearError> {
    if let Some(tok) = cache.0.lock().unwrap().get(workspace_id) {
        return Ok(tok.clone());
    }
    let tok = secrets::read(&credential_key(workspace_id))?
        .ok_or_else(|| LinearError::NoToken(workspace_id.to_string()))?;
    cache
        .0
        .lock()
        .unwrap()
        .insert(workspace_id.to_string(), tok.clone());
    Ok(tok)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LinearOrganization {
    #[serde(rename = "urlKey")]
    pub url_key: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LinearViewer {
    pub id: String,
    pub name: String,
    pub email: String,
    pub organization: LinearOrganization,
}

const VIEWER_QUERY: &str = r#"
query Viewer {
  viewer {
    id
    name
    email
    organization { urlKey name }
  }
}
"#;

#[derive(Debug, Serialize, Deserialize)]
pub struct LinearIssueState {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LinearIssueTeam {
    pub key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LinearIssue {
    pub id: String,
    pub identifier: String,
    pub title: String,
    pub description: Option<String>,
    pub url: String,
    pub state: LinearIssueState,
    pub team: LinearIssueTeam,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

const ISSUES_QUERY: &str = r#"
query AssignedIssues($filter: IssueFilter!) {
  issues(first: 50, filter: $filter, orderBy: updatedAt) {
    nodes {
      id
      identifier
      title
      description
      url
      state { name type }
      team { key }
      updatedAt
    }
  }
}
"#;

/// Verify token via /viewer query and save to keyring on success.
#[tauri::command]
pub async fn linear_connect(
    workspace_id: String,
    token: String,
    cache: State<'_, LinearTokenCache>,
) -> Result<LinearViewer, LinearError> {
    let viewer: ViewerResponse = graphql(&token, VIEWER_QUERY, None).await?;
    secrets::set(&credential_key(&workspace_id), &token)?;
    cache.0.lock().unwrap().insert(workspace_id, token);
    Ok(viewer.viewer)
}

#[tauri::command]
pub async fn linear_disconnect(
    workspace_id: String,
    cache: State<'_, LinearTokenCache>,
) -> Result<(), LinearError> {
    secrets::clear(&credential_key(&workspace_id))?;
    cache.0.lock().unwrap().remove(&workspace_id);
    Ok(())
}

#[tauri::command]
pub async fn linear_fetch_assigned_issues(
    workspace_id: String,
    team_id: Option<String>,
    cache: State<'_, LinearTokenCache>,
) -> Result<Vec<LinearIssue>, LinearError> {
    let token = read_token(&workspace_id, &cache)?;
    let mut filter = serde_json::json!({
        "assignee": { "isMe": { "eq": true } },
        "state": { "type": { "nin": ["completed", "canceled"] } }
    });
    if let Some(team_id) = team_id {
        filter["team"] = serde_json::json!({ "id": { "eq": team_id } });
    }
    let resp: IssuesResponse =
        graphql(&token, ISSUES_QUERY, Some(serde_json::json!({ "filter": filter }))).await?;
    Ok(resp.issues.nodes)
}

#[derive(Deserialize)]
struct ViewerResponse {
    viewer: LinearViewer,
}

#[derive(Deserialize)]
struct Nodes<T> {
    nodes: Vec<T>,
}

#[derive(Deserialize)]
struct IssuesResponse {
    issues: Nodes<LinearIssue>,
}
