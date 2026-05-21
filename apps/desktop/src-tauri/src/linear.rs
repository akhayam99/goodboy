use serde::{Deserialize, Serialize};
use serde_json::Map;
use thiserror::Error;

use crate::secrets;

const API_URL: &str = "https://api.linear.app/graphql";

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
    let client = reqwest::Client::new();
    let res = client
        .post(API_URL)
        .header("Authorization", token)
        .header("Content-Type", "application/json")
        .json(&GraphQlRequest { query, variables })
        .send()
        .await?;
    let status = res.status();
    let body: serde_json::Value = res.json().await?;
    if !status.is_success() {
        return Err(LinearError::Http(format!(
            "status {}: {}",
            status,
            body.to_string()
        )));
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

fn read_token(workspace_id: &str) -> Result<String, LinearError> {
    secrets::read(&credential_key(workspace_id))?
        .ok_or_else(|| LinearError::NoToken(workspace_id.to_string()))
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
pub struct LinearTeam {
    pub id: String,
    pub key: String,
    pub name: String,
}

const TEAMS_QUERY: &str = r#"
query Teams {
  teams(first: 100) {
    nodes { id key name }
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

const ISSUE_QUERY: &str = r#"
query Issue($id: String!) {
  issue(id: $id) {
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
"#;

/// Verify token via /viewer query and save to keyring on success.
#[tauri::command]
pub async fn linear_connect(
    workspace_id: String,
    token: String,
) -> Result<LinearViewer, LinearError> {
    let viewer: ViewerResponse = graphql(&token, VIEWER_QUERY, None).await?;
    secrets::set(&credential_key(&workspace_id), &token)?;
    Ok(viewer.viewer)
}

#[tauri::command]
pub async fn linear_disconnect(workspace_id: String) -> Result<(), LinearError> {
    secrets::clear(&credential_key(&workspace_id))?;
    Ok(())
}

#[tauri::command]
pub async fn linear_has_token(workspace_id: String) -> Result<bool, LinearError> {
    Ok(secrets::read(&credential_key(&workspace_id))?.is_some())
}

#[tauri::command]
pub async fn linear_fetch_viewer(workspace_id: String) -> Result<LinearViewer, LinearError> {
    let token = read_token(&workspace_id)?;
    let resp: ViewerResponse = graphql(&token, VIEWER_QUERY, None).await?;
    Ok(resp.viewer)
}

#[tauri::command]
pub async fn linear_fetch_teams(workspace_id: String) -> Result<Vec<LinearTeam>, LinearError> {
    let token = read_token(&workspace_id)?;
    let resp: TeamsResponse = graphql(&token, TEAMS_QUERY, None).await?;
    Ok(resp.teams.nodes)
}

#[tauri::command]
pub async fn linear_fetch_assigned_issues(
    workspace_id: String,
    team_id: Option<String>,
) -> Result<Vec<LinearIssue>, LinearError> {
    let token = read_token(&workspace_id)?;
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

#[tauri::command]
pub async fn linear_fetch_issue(
    workspace_id: String,
    issue_id: String,
) -> Result<LinearIssue, LinearError> {
    let token = read_token(&workspace_id)?;
    let resp: IssueResponse =
        graphql(&token, ISSUE_QUERY, Some(serde_json::json!({ "id": issue_id }))).await?;
    Ok(resp.issue)
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
struct TeamsResponse {
    teams: Nodes<LinearTeam>,
}

#[derive(Deserialize)]
struct IssuesResponse {
    issues: Nodes<LinearIssue>,
}

#[derive(Deserialize)]
struct IssueResponse {
    issue: LinearIssue,
}
