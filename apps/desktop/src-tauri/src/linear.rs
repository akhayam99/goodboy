use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;

use crate::integration_credentials::{self, IntegrationCredentialError};
use crate::secrets;

const PROVIDER: &str = "linear";

/// In-memory cache of Linear personal API keys keyed by credential id.
/// macOS Keychain prompts the user on every `get_password` unless the ACL is
/// "Always Allow" + the app's code signature is stable. Caching avoids the
/// repeated prompt in dev builds and the per-fetch prompt in any build.
pub struct LinearTokenCache(integration_credentials::SecretCache);

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

#[derive(Debug, Error)]
pub enum LinearError {
    #[error("http error: {0}")]
    Http(String),
    #[error("graphql error: {0}")]
    GraphQl(String),
    #[error("invalid response shape: {0}")]
    InvalidShape(String),
    #[error("no personal API key stored for workspace {0}")]
    NoToken(String),
    #[error("credential store error: {0}")]
    Credential(#[from] IntegrationCredentialError),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
}

crate::util::impl_error_serialize!(LinearError);

impl LinearError {
    fn kind(&self) -> &'static str {
        match self {
            LinearError::Http(_) => "http",
            LinearError::GraphQl(_) => "graphql",
            LinearError::InvalidShape(_) => "shape",
            LinearError::NoToken(_) => "no_token",
            LinearError::Credential(_) => "credential",
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
    integration_credentials::read_for_binding(PROVIDER, workspace_id, None, &cache.0)?
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
pub struct LinearIssuePerson {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LinearIssueProject {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LinearIssueLabel {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LinearAttachment {
    pub id: String,
    pub title: Option<String>,
    pub url: String,
    #[serde(rename = "sourceType")]
    pub source_type: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LinearAttachmentNodes {
    pub nodes: Vec<LinearAttachment>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LinearIssueLabelNodes {
    pub nodes: Vec<LinearIssueLabel>,
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
    pub priority: Option<i64>,
    #[serde(rename = "priorityLabel")]
    pub priority_label: Option<String>,
    pub assignee: Option<LinearIssuePerson>,
    pub project: Option<LinearIssueProject>,
    pub labels: LinearIssueLabelNodes,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "branchName")]
    pub branch_name: String,
    pub attachments: LinearAttachmentNodes,
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
      priority
      priorityLabel
      assignee { name }
      project { name }
      labels { nodes { name color } }
      updatedAt
      branchName
      attachments(first: 10) {
        nodes { id title url sourceType metadata }
      }
    }
  }
}
"#;

const ISSUE_QUERY: &str = r#"
query Issue($issueId: String!) {
  issue(id: $issueId) {
    id
    identifier
    title
    description
    url
    state { name type }
    team { key }
    priority
    priorityLabel
    assignee { name }
    project { name }
    labels { nodes { name color } }
    updatedAt
    branchName
    attachments(first: 10) {
      nodes { id title url sourceType metadata }
    }
  }
}
"#;

#[derive(Debug, Serialize, Deserialize)]
pub struct LinearCommentUser {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LinearIssueComment {
    pub id: String,
    pub body: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    pub user: Option<LinearCommentUser>,
}

const ISSUE_COMMENTS_QUERY: &str = r#"
query IssueComments($issueId: String!) {
  issue(id: $issueId) {
    comments {
      nodes {
        id
        body
        createdAt
        user { name }
      }
    }
  }
}
"#;

const COMMENT_CREATE_MUTATION: &str = r#"
mutation CommentCreate($input: CommentCreateInput!) {
  commentCreate(input: $input) {
    success
    comment {
      id
      body
      createdAt
      user { name }
    }
  }
}
"#;

fn comment_create_variables(issue_id: &str, body: &str) -> serde_json::Value {
    serde_json::json!({
        "input": {
            "issueId": issue_id,
            "body": body
        }
    })
}

const ISSUE_UPDATE_MUTATION: &str = r#"
mutation IssueUpdate($issueId: String!, $input: IssueUpdateInput!) {
  issueUpdate(id: $issueId, input: $input) {
    success
    issue { description }
  }
}
"#;

/// Verifies the key a credential holds through the /viewer query and writes
/// nothing. A key already stored is verified without the webview ever seeing
/// it.
#[tauri::command]
pub async fn linear_validate_connection(
    credential_id: String,
    token: Option<String>,
    cache: State<'_, LinearTokenCache>,
) -> Result<LinearViewer, LinearError> {
    let token =
        integration_credentials::secret_to_verify(PROVIDER, &credential_id, token, &cache.0)?;
    let viewer: ViewerResponse = graphql(&token, VIEWER_QUERY, None).await?;
    Ok(viewer.viewer)
}

#[tauri::command]
pub async fn linear_connect(
    credential_id: String,
    token: Option<String>,
    cache: State<'_, LinearTokenCache>,
) -> Result<(), LinearError> {
    let token =
        integration_credentials::secret_to_verify(PROVIDER, &credential_id, token, &cache.0)?;
    integration_credentials::store_secret(&credential_id, &token, &cache.0)?;
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
    let resp: IssuesResponse = graphql(
        &token,
        ISSUES_QUERY,
        Some(serde_json::json!({ "filter": filter })),
    )
    .await?;
    Ok(resp.issues.nodes)
}

#[tauri::command]
pub async fn linear_fetch_issue(
    workspace_id: String,
    issue_id: String,
    cache: State<'_, LinearTokenCache>,
) -> Result<LinearIssue, LinearError> {
    let token = read_token(&workspace_id, &cache)?;
    let resp: IssueResponse = graphql(
        &token,
        ISSUE_QUERY,
        Some(serde_json::json!({ "issueId": issue_id })),
    )
    .await?;
    resp.issue
        .ok_or_else(|| LinearError::InvalidShape("missing issue".into()))
}

#[tauri::command]
pub async fn linear_fetch_issue_comments(
    workspace_id: String,
    issue_id: String,
    cache: State<'_, LinearTokenCache>,
) -> Result<Vec<LinearIssueComment>, LinearError> {
    let token = read_token(&workspace_id, &cache)?;
    let resp: IssueCommentsResponse = graphql(
        &token,
        ISSUE_COMMENTS_QUERY,
        Some(serde_json::json!({ "issueId": issue_id })),
    )
    .await?;
    let mut comments = resp
        .issue
        .ok_or_else(|| LinearError::InvalidShape("missing issue".into()))?
        .comments
        .nodes;
    comments.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    Ok(comments)
}

#[tauri::command]
pub async fn linear_create_comment(
    workspace_id: String,
    issue_id: String,
    body: String,
    cache: State<'_, LinearTokenCache>,
) -> Result<LinearIssueComment, LinearError> {
    let token = read_token(&workspace_id, &cache)?;
    let resp: CommentCreateResponse = graphql(
        &token,
        COMMENT_CREATE_MUTATION,
        Some(comment_create_variables(&issue_id, &body)),
    )
    .await?;
    if !resp.comment_create.success {
        return Err(LinearError::GraphQl(format!(
            "commentCreate rejected for {}",
            issue_id
        )));
    }
    resp.comment_create
        .comment
        .ok_or_else(|| LinearError::InvalidShape("missing comment".into()))
}

#[tauri::command]
pub async fn linear_update_issue(
    workspace_id: String,
    issue_id: String,
    description: String,
    cache: State<'_, LinearTokenCache>,
) -> Result<String, LinearError> {
    let token = read_token(&workspace_id, &cache)?;
    let resp: IssueUpdateResponse = graphql(
        &token,
        ISSUE_UPDATE_MUTATION,
        Some(serde_json::json!({
            "issueId": issue_id,
            "input": { "description": description }
        })),
    )
    .await?;
    if !resp.issue_update.success {
        return Err(LinearError::GraphQl(format!(
            "issueUpdate rejected for {}",
            issue_id
        )));
    }
    let issue = resp
        .issue_update
        .issue
        .ok_or_else(|| LinearError::InvalidShape("missing issue".into()))?;
    Ok(issue.description.unwrap_or_default())
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

#[derive(Deserialize)]
struct IssueResponse {
    issue: Option<LinearIssue>,
}

#[derive(Deserialize)]
struct IssueComments {
    comments: Nodes<LinearIssueComment>,
}

#[derive(Deserialize)]
struct IssueCommentsResponse {
    issue: Option<IssueComments>,
}

#[derive(Deserialize)]
struct IssueDescription {
    description: Option<String>,
}

#[derive(Deserialize)]
struct IssueUpdatePayload {
    success: bool,
    issue: Option<IssueDescription>,
}

#[derive(Deserialize)]
struct IssueUpdateResponse {
    #[serde(rename = "issueUpdate")]
    issue_update: IssueUpdatePayload,
}

#[derive(Deserialize)]
struct CommentCreatePayload {
    success: bool,
    comment: Option<LinearIssueComment>,
}

#[derive(Deserialize)]
struct CommentCreateResponse {
    #[serde(rename = "commentCreate")]
    comment_create: CommentCreatePayload,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn comment_create_variables_nest_the_issue_and_the_body_under_input() {
        let variables = comment_create_variables("issue-42", "ship it");

        assert_eq!(variables["input"]["issueId"], "issue-42");
        assert_eq!(variables["input"]["body"], "ship it");
        assert!(variables.get("issueId").is_none());
        assert!(variables.get("body").is_none());
    }

    #[test]
    fn comment_create_mutation_asks_linear_for_the_created_comment_back() {
        assert!(COMMENT_CREATE_MUTATION.contains("$input: CommentCreateInput!"));
        assert!(COMMENT_CREATE_MUTATION.contains("commentCreate(input: $input)"));
        assert!(COMMENT_CREATE_MUTATION.contains("createdAt"));
    }
}
