use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;

use crate::integration_credentials::{self, http_client, IntegrationCredentialError};
use crate::secrets;

const PROVIDER: &str = "linear";

integration_credentials::token_cache!(LinearTokenCache);

const API_URL: &str = "https://api.linear.app/graphql";

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

pub(crate) fn read_token(
    workspace_id: &str,
    project_id: Option<&str>,
    cache: &LinearTokenCache,
) -> Result<String, LinearError> {
    integration_credentials::read_for_binding(PROVIDER, workspace_id, project_id, &cache.0)?
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
    #[serde(rename = "avatarUrl", default)]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LinearCommentParent {
    pub id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LinearIssueComment {
    pub id: String,
    pub body: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    pub user: Option<LinearCommentUser>,
    #[serde(default)]
    pub parent: Option<LinearCommentParent>,
}

const COMMENT_PAGE_SIZE: u32 = 100;
const COMMENT_PAGE_LIMIT: usize = 20;

const ISSUE_COMMENTS_QUERY: &str = r#"
query IssueComments($issueId: String!, $first: Int!, $after: String) {
  issue(id: $issueId) {
    comments(first: $first, after: $after) {
      nodes {
        id
        body
        createdAt
        parent { id }
        user { name avatarUrl }
      }
      pageInfo { hasNextPage endCursor }
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
      parent { id }
      user { name avatarUrl }
    }
  }
}
"#;

fn issue_comments_variables(issue_id: &str, after: Option<&str>) -> serde_json::Value {
    serde_json::json!({
        "issueId": issue_id,
        "first": COMMENT_PAGE_SIZE,
        "after": after
    })
}

fn next_comment_cursor(page_info: &LinearPageInfo) -> Option<String> {
    if !page_info.has_next_page {
        return None;
    }
    page_info
        .end_cursor
        .clone()
        .filter(|cursor| !cursor.is_empty())
}

fn comment_create_variables(
    issue_id: &str,
    body: &str,
    parent_id: Option<&str>,
) -> serde_json::Value {
    let mut input = serde_json::json!({
        "issueId": issue_id,
        "body": body
    });
    if let Some(parent) = parent_id {
        input["parentId"] = serde_json::json!(parent);
    }
    serde_json::json!({ "input": input })
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
    project_id: Option<String>,
    team_id: Option<String>,
    cache: State<'_, LinearTokenCache>,
) -> Result<Vec<LinearIssue>, LinearError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
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
    project_id: Option<String>,
    issue_id: String,
    cache: State<'_, LinearTokenCache>,
) -> Result<LinearIssue, LinearError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
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
    project_id: Option<String>,
    issue_id: String,
    cache: State<'_, LinearTokenCache>,
) -> Result<Vec<LinearIssueComment>, LinearError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let mut comments: Vec<LinearIssueComment> = Vec::new();
    let mut cursor: Option<String> = None;
    for _ in 0..COMMENT_PAGE_LIMIT {
        let resp: IssueCommentsResponse = graphql(
            &token,
            ISSUE_COMMENTS_QUERY,
            Some(issue_comments_variables(&issue_id, cursor.as_deref())),
        )
        .await?;
        let page = resp
            .issue
            .ok_or_else(|| LinearError::InvalidShape("missing issue".into()))?
            .comments;
        comments.extend(page.nodes);
        cursor = next_comment_cursor(&page.page_info);
        if cursor.is_none() {
            break;
        }
    }
    comments.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    Ok(comments)
}

#[tauri::command]
pub async fn linear_create_comment(
    workspace_id: String,
    project_id: Option<String>,
    issue_id: String,
    body: String,
    parent_id: Option<String>,
    cache: State<'_, LinearTokenCache>,
) -> Result<LinearIssueComment, LinearError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let resp: CommentCreateResponse = graphql(
        &token,
        COMMENT_CREATE_MUTATION,
        Some(comment_create_variables(
            &issue_id,
            &body,
            parent_id.as_deref(),
        )),
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
    project_id: Option<String>,
    issue_id: String,
    description: String,
    cache: State<'_, LinearTokenCache>,
) -> Result<String, LinearError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
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
struct LinearPageInfo {
    #[serde(rename = "hasNextPage", default)]
    has_next_page: bool,
    #[serde(rename = "endCursor", default)]
    end_cursor: Option<String>,
}

#[derive(Deserialize)]
struct CommentPage {
    nodes: Vec<LinearIssueComment>,
    #[serde(rename = "pageInfo")]
    page_info: LinearPageInfo,
}

#[derive(Deserialize)]
struct IssueComments {
    comments: CommentPage,
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
        let variables = comment_create_variables("issue-42", "ship it", None);

        assert_eq!(variables["input"]["issueId"], "issue-42");
        assert_eq!(variables["input"]["body"], "ship it");
        assert!(variables.get("issueId").is_none());
        assert!(variables.get("body").is_none());
    }

    #[test]
    fn comment_create_variables_leave_out_the_parent_for_a_new_thread() {
        let variables = comment_create_variables("issue-42", "ship it", None);

        assert!(variables["input"].get("parentId").is_none());
    }

    #[test]
    fn comment_create_variables_nest_the_parent_for_a_reply() {
        let variables = comment_create_variables("issue-42", "ship it", Some("comment-7"));

        assert_eq!(variables["input"]["parentId"], "comment-7");
        assert_eq!(variables["input"]["body"], "ship it");
    }

    #[test]
    fn comment_page_cursor_stops_on_the_last_page() {
        let more = LinearPageInfo {
            has_next_page: true,
            end_cursor: Some("cursor-2".into()),
        };
        let last = LinearPageInfo {
            has_next_page: false,
            end_cursor: Some("cursor-3".into()),
        };

        assert_eq!(next_comment_cursor(&more), Some("cursor-2".to_string()));
        assert_eq!(next_comment_cursor(&last), None);
    }

    #[test]
    fn comment_parses_its_parent_and_the_author_avatar() {
        let raw = r#"{
            "id": "c2",
            "body": "agreed",
            "createdAt": "2026-09-20T10:00:00Z",
            "parent": { "id": "c1" },
            "user": { "name": "Robin Vale", "avatarUrl": "https://linear.example/robin.png" }
        }"#;
        let comment: LinearIssueComment = serde_json::from_str(raw).unwrap();

        assert_eq!(
            comment.parent.map(|parent| parent.id),
            Some("c1".to_string())
        );
        assert_eq!(
            comment.user.and_then(|user| user.avatar_url),
            Some("https://linear.example/robin.png".to_string())
        );
    }

    #[test]
    fn issue_comments_query_pages_and_asks_for_the_parent() {
        assert!(ISSUE_COMMENTS_QUERY.contains("comments(first: $first, after: $after)"));
        assert!(ISSUE_COMMENTS_QUERY.contains("parent { id }"));
        assert!(ISSUE_COMMENTS_QUERY.contains("pageInfo { hasNextPage endCursor }"));
    }

    #[test]
    fn comment_create_mutation_asks_linear_for_the_created_comment_back() {
        assert!(COMMENT_CREATE_MUTATION.contains("$input: CommentCreateInput!"));
        assert!(COMMENT_CREATE_MUTATION.contains("commentCreate(input: $input)"));
        assert!(COMMENT_CREATE_MUTATION.contains("createdAt"));
    }
}
