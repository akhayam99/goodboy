use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;

use crate::integration_credentials::{self, IntegrationCredentialError};
use crate::integrations::http::{self, TransportFailure};
use crate::secrets;
use crate::util::percent_encode;

const PROVIDER: &str = "gitlab";

integration_credentials::token_cache!(GitlabTokenCache);

#[derive(Debug, Error)]
pub enum GitlabError {
    #[error("http error {status}: {body}")]
    Http { status: u16, body: String },
    #[error("request timed out: {0}")]
    Timeout(String),
    #[error("invalid response shape: {0}")]
    InvalidShape(String),
    #[error("no personal API key stored for workspace {0}")]
    NoToken(String),
    #[error("credential store error: {0}")]
    Credential(#[from] IntegrationCredentialError),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
}

crate::util::impl_error_serialize!(GitlabError);

impl GitlabError {
    fn kind(&self) -> &'static str {
        match self {
            GitlabError::Http { .. } => "http",
            GitlabError::Timeout(_) => "timeout",
            GitlabError::InvalidShape(_) => "shape",
            GitlabError::NoToken(_) => "no_token",
            GitlabError::Credential(_) => "credential",
            GitlabError::Secret(_) => "secret",
        }
    }
}

impl From<reqwest::Error> for GitlabError {
    fn from(e: reqwest::Error) -> Self {
        match TransportFailure::from(&e) {
            TransportFailure::Timeout(message) => GitlabError::Timeout(message),
            TransportFailure::Network(body) => GitlabError::Http { status: 0, body },
        }
    }
}

fn api_base(host: &str) -> Result<String, GitlabError> {
    let trimmed = host.trim().trim_end_matches('/');
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err(GitlabError::InvalidShape(format!("invalid host: {}", host)));
    }
    Ok(format!("{}/api/v4", trimmed))
}

async fn get_json<T: serde::de::DeserializeOwned>(
    host: &str,
    token: &str,
    path: &str,
) -> Result<T, GitlabError> {
    let url = format!("{}{}", api_base(host)?, path);
    let res = http::client()
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

const MAX_PAGES: u32 = 20;

async fn get_json_optional<T: serde::de::DeserializeOwned>(
    host: &str,
    token: &str,
    path: &str,
) -> Result<Option<T>, GitlabError> {
    let url = format!("{}{}", api_base(host)?, path);
    let res = http::client()
        .get(&url)
        .header("PRIVATE-TOKEN", token)
        .send()
        .await?;
    let status = res.status();
    let body = res.text().await?;
    if status == reqwest::StatusCode::NOT_FOUND || status == reqwest::StatusCode::FORBIDDEN {
        return Ok(None);
    }
    if !status.is_success() {
        return Err(GitlabError::Http {
            status: status.as_u16(),
            body,
        });
    }
    serde_json::from_str(&body)
        .map(Some)
        .map_err(|e| GitlabError::InvalidShape(e.to_string()))
}

async fn get_json_paged<T: serde::de::DeserializeOwned>(
    host: &str,
    token: &str,
    path: &str,
) -> Result<Vec<T>, GitlabError> {
    let base = api_base(host)?;
    let separator = if path.contains('?') { '&' } else { '?' };
    let mut collected: Vec<T> = Vec::new();
    let mut page: u32 = 1;
    loop {
        let url = format!("{base}{path}{separator}per_page=100&page={page}");
        let res = http::client()
            .get(&url)
            .header("PRIVATE-TOKEN", token)
            .send()
            .await?;
        let status = res.status();
        let next_page = res
            .headers()
            .get("x-next-page")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.trim().parse::<u32>().ok());
        let body = res.text().await?;
        if !status.is_success() {
            return Err(GitlabError::Http {
                status: status.as_u16(),
                body,
            });
        }
        let batch: Vec<T> =
            serde_json::from_str(&body).map_err(|e| GitlabError::InvalidShape(e.to_string()))?;
        collected.extend(batch);
        match next_page {
            Some(next) if next > page && page < MAX_PAGES => page = next,
            _ => break,
        }
    }
    Ok(collected)
}

async fn send_no_content(
    method: reqwest::Method,
    host: &str,
    token: &str,
    path: &str,
    body: &serde_json::Value,
) -> Result<(), GitlabError> {
    let url = format!("{}{}", api_base(host)?, path);
    let res = http::client()
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
    Ok(())
}

async fn send_json<T: serde::de::DeserializeOwned>(
    method: reqwest::Method,
    host: &str,
    token: &str,
    path: &str,
    body: &serde_json::Value,
) -> Result<T, GitlabError> {
    let url = format!("{}{}", api_base(host)?, path);
    let res = http::client()
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

fn encode_project_path(project_path: &str) -> String {
    percent_encode(project_path.trim().trim_matches('/'))
}

fn read_token(
    workspace_id: &str,
    project_id: Option<&str>,
    cache: &GitlabTokenCache,
) -> Result<String, GitlabError> {
    integration_credentials::read_for_binding(PROVIDER, workspace_id, project_id, &cache.0)?
        .ok_or_else(|| GitlabError::NoToken(workspace_id.to_string()))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabUser {
    pub id: i64,
    pub username: String,
    pub name: String,
    #[serde(rename = "avatarUrl", alias = "avatar_url", default)]
    pub avatar_url: Option<String>,
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
pub async fn gitlab_validate_connection(
    credential_id: String,
    host: String,
    token: Option<String>,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabUser, GitlabError> {
    let token =
        integration_credentials::secret_to_verify(PROVIDER, &credential_id, token, &cache.0)?;
    get_json(&host, &token, "/user").await
}

#[tauri::command]
pub async fn gitlab_connect(
    credential_id: String,
    token: Option<String>,
    cache: State<'_, GitlabTokenCache>,
) -> Result<(), GitlabError> {
    let token =
        integration_credentials::secret_to_verify(PROVIDER, &credential_id, token, &cache.0)?;
    integration_credentials::store_secret(&credential_id, &token, &cache.0)?;
    Ok(())
}

#[tauri::command]
pub async fn gitlab_fetch_assigned_issues(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Vec<GitlabIssue>, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    get_json(
        &host,
        &token,
        "/issues?scope=assigned_to_me&state=opened&order_by=updated_at&per_page=50",
    )
    .await
}

#[tauri::command]
pub async fn gitlab_fetch_issue(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    issue_iid: i64,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabIssue, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    get_json(
        &host,
        &token,
        &format!(
            "/projects/{}/issues/{}",
            encode_project_path(&project_path),
            issue_iid
        ),
    )
    .await
}

fn issues_by_iids_path(project_path: &str, issue_iids: &[i64]) -> String {
    let mut path = format!("/projects/{}/issues", encode_project_path(project_path));
    for (index, iid) in issue_iids.iter().enumerate() {
        path.push(if index == 0 { '?' } else { '&' });
        path.push_str(&format!("iids[]={}", iid));
    }
    path
}

#[tauri::command]
pub async fn gitlab_fetch_issues(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    issue_iids: Vec<i64>,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Vec<GitlabIssue>, GitlabError> {
    if issue_iids.is_empty() {
        return Ok(Vec::new());
    }
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let path = issues_by_iids_path(&project_path, &issue_iids);
    get_json_paged(&host, &token, &path).await
}

#[tauri::command]
pub async fn gitlab_update_issue(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    issue_iid: i64,
    description: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<String, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    let body = serde_json::json!({ "description": description });
    let issue: GitlabIssue = send_json(
        reqwest::Method::PUT,
        &host,
        &token,
        &format!("/projects/{encoded}/issues/{issue_iid}"),
        &body,
    )
    .await?;
    Ok(issue.description.unwrap_or_default())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabMrAuthor {
    #[serde(default)]
    pub id: Option<i64>,
    pub username: String,
    pub name: String,
    #[serde(rename = "avatarUrl", alias = "avatar_url", default)]
    pub avatar_url: Option<String>,
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
    #[serde(default)]
    pub sha: Option<String>,
    #[serde(rename = "mergedAt", alias = "merged_at", default)]
    pub merged_at: Option<String>,
    #[serde(default)]
    pub author: Option<GitlabMrAuthor>,
    #[serde(default)]
    pub reviewers: Option<Vec<GitlabMrAuthor>>,
    #[serde(rename = "createdAt", alias = "created_at", default)]
    pub created_at: Option<String>,
    #[serde(
        rename = "detailedMergeStatus",
        alias = "detailed_merge_status",
        default
    )]
    pub detailed_merge_status: Option<String>,
    #[serde(rename = "headPipeline", alias = "head_pipeline", default)]
    pub head_pipeline: Option<GitlabHeadPipeline>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabHeadPipeline {
    pub id: i64,
    pub status: String,
    #[serde(rename = "webUrl", alias = "web_url", default)]
    pub web_url: Option<String>,
}

#[tauri::command]
pub async fn gitlab_fetch_assigned_mrs(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Vec<GitlabMergeRequest>, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    get_json(
        &host,
        &token,
        "/merge_requests?scope=assigned_to_me&state=opened&order_by=updated_at&per_page=50",
    )
    .await
}

pub async fn gitlab_fetch_project_mrs(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Vec<GitlabMergeRequest>, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    get_json(
        &host,
        &token,
        &format!("/projects/{encoded}/merge_requests?state=opened&per_page=100"),
    )
    .await
}

#[tauri::command]
pub async fn gitlab_mr_for_branch(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    source_branch: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Option<GitlabMergeRequest>, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    let branch = percent_encode(&source_branch);
    let path = format!(
        "/projects/{encoded}/merge_requests?source_branch={branch}&state=all&order_by=updated_at&per_page=1"
    );
    let mrs: Vec<GitlabMergeRequest> = get_json(&host, &token, &path).await?;
    Ok(mrs.into_iter().next())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn gitlab_create_mr(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    source_branch: String,
    target_branch: String,
    title: String,
    description: String,
    draft: bool,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabMergeRequest, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
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

#[derive(Debug, Deserialize)]
pub struct GitlabMrChange {
    pub old_path: String,
    pub new_path: String,
    #[serde(default)]
    pub diff: String,
    #[serde(default)]
    pub new_file: bool,
    #[serde(default)]
    pub deleted_file: bool,
}

#[derive(Debug, Deserialize)]
pub struct GitlabMrChanges {
    #[serde(default)]
    pub changes: Vec<GitlabMrChange>,
}

fn assemble_mr_diff(changes: &[GitlabMrChange]) -> String {
    let mut out = String::new();
    for change in changes {
        out.push_str(&format!(
            "diff --git a/{} b/{}\n",
            change.old_path, change.new_path
        ));
        if change.new_file {
            out.push_str("--- /dev/null\n");
        } else {
            out.push_str(&format!("--- a/{}\n", change.old_path));
        }
        if change.deleted_file {
            out.push_str("+++ /dev/null\n");
        } else {
            out.push_str(&format!("+++ b/{}\n", change.new_path));
        }
        out.push_str(&change.diff);
        if !change.diff.is_empty() && !change.diff.ends_with('\n') {
            out.push('\n');
        }
    }
    out
}

#[tauri::command]
pub async fn gitlab_mr_diff(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    cache: State<'_, GitlabTokenCache>,
) -> Result<String, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    let payload: GitlabMrChanges = get_json(
        &host,
        &token,
        &format!("/projects/{encoded}/merge_requests/{mr_iid}/changes"),
    )
    .await?;
    Ok(assemble_mr_diff(&payload.changes))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabDiffRefs {
    #[serde(rename = "baseSha", alias = "base_sha")]
    pub base_sha: String,
    #[serde(rename = "headSha", alias = "head_sha")]
    pub head_sha: String,
    #[serde(rename = "startSha", alias = "start_sha")]
    pub start_sha: String,
}

#[derive(Debug, Deserialize)]
pub struct GitlabMrRefsPayload {
    #[serde(default)]
    pub diff_refs: Option<GitlabDiffRefs>,
}

#[tauri::command]
pub async fn gitlab_mr_diff_refs(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabDiffRefs, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    let payload: GitlabMrRefsPayload = get_json(
        &host,
        &token,
        &format!("/projects/{encoded}/merge_requests/{mr_iid}"),
    )
    .await?;
    payload.diff_refs.ok_or_else(|| {
        GitlabError::InvalidShape(format!("merge request !{mr_iid} has no diff_refs"))
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitlabDiscussionPosition {
    pub base_sha: String,
    pub head_sha: String,
    pub start_sha: String,
    pub new_path: String,
    #[serde(default)]
    pub new_line: Option<i64>,
    #[serde(default)]
    pub old_path: Option<String>,
    #[serde(default)]
    pub old_line: Option<i64>,
}

fn discussion_payload(body: &str, position: &GitlabDiscussionPosition) -> serde_json::Value {
    let position_type = match (position.new_line, position.old_line) {
        (None, None) => "file",
        _ => "text",
    };
    let mut pos = serde_json::json!({
        "position_type": position_type,
        "base_sha": position.base_sha,
        "head_sha": position.head_sha,
        "start_sha": position.start_sha,
        "new_path": position.new_path,
    });
    if let Some(new_line) = position.new_line {
        pos["new_line"] = serde_json::json!(new_line);
    }
    if let Some(old_path) = &position.old_path {
        pos["old_path"] = serde_json::json!(old_path);
    }
    if let Some(old_line) = position.old_line {
        pos["old_line"] = serde_json::json!(old_line);
    }
    serde_json::json!({ "body": body, "position": pos })
}

#[derive(Debug, Deserialize)]
pub struct GitlabDiscussion {
    pub id: String,
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn gitlab_create_mr_discussion(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    body: String,
    position: GitlabDiscussionPosition,
    cache: State<'_, GitlabTokenCache>,
) -> Result<String, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    let payload = discussion_payload(&body, &position);
    let discussion: GitlabDiscussion = send_json(
        reqwest::Method::POST,
        &host,
        &token,
        &format!("/projects/{encoded}/merge_requests/{mr_iid}/discussions"),
        &payload,
    )
    .await?;
    Ok(discussion.id)
}

#[derive(Debug, Deserialize)]
pub struct GitlabNote {
    pub id: i64,
}

#[tauri::command]
pub async fn gitlab_create_mr_note(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    body: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<i64, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    let note: GitlabNote = send_json(
        reqwest::Method::POST,
        &host,
        &token,
        &format!("/projects/{encoded}/merge_requests/{mr_iid}/notes"),
        &serde_json::json!({ "body": body }),
    )
    .await?;
    Ok(note.id)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabNotePosition {
    #[serde(rename = "newPath", alias = "new_path", default)]
    pub new_path: Option<String>,
    #[serde(rename = "oldPath", alias = "old_path", default)]
    pub old_path: Option<String>,
    #[serde(rename = "newLine", alias = "new_line", default)]
    pub new_line: Option<i64>,
    #[serde(rename = "oldLine", alias = "old_line", default)]
    pub old_line: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabMrNote {
    pub id: i64,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub system: bool,
    #[serde(default)]
    pub author: Option<GitlabMrAuthor>,
    #[serde(rename = "createdAt", alias = "created_at", default)]
    pub created_at: String,
    #[serde(default)]
    pub resolvable: bool,
    #[serde(default)]
    pub resolved: Option<bool>,
    #[serde(default)]
    pub position: Option<GitlabNotePosition>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabMrDiscussion {
    pub id: String,
    #[serde(rename = "individualNote", alias = "individual_note", default)]
    pub individual_note: bool,
    #[serde(default)]
    pub notes: Vec<GitlabMrNote>,
}

#[tauri::command]
pub async fn gitlab_list_mr_discussions(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Vec<GitlabMrDiscussion>, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    get_json_paged(
        &host,
        &token,
        &format!("/projects/{encoded}/merge_requests/{mr_iid}/discussions"),
    )
    .await
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn gitlab_reply_to_mr_discussion(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    discussion_id: String,
    body: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<i64, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    let discussion = percent_encode(&discussion_id);
    let note: GitlabNote = send_json(
        reqwest::Method::POST,
        &host,
        &token,
        &format!("/projects/{encoded}/merge_requests/{mr_iid}/discussions/{discussion}/notes"),
        &serde_json::json!({ "body": body }),
    )
    .await?;
    Ok(note.id)
}

fn mr_discussion_resolve_path(
    project_path: &str,
    mr_iid: i64,
    discussion_id: &str,
    resolved: bool,
) -> String {
    let encoded = encode_project_path(project_path);
    let discussion = percent_encode(discussion_id);
    format!(
        "/projects/{encoded}/merge_requests/{mr_iid}/discussions/{discussion}?resolved={resolved}"
    )
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn gitlab_resolve_mr_discussion(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    discussion_id: String,
    resolved: bool,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabMrDiscussion, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    send_json(
        reqwest::Method::PUT,
        &host,
        &token,
        &mr_discussion_resolve_path(&project_path, mr_iid, &discussion_id, resolved),
        &serde_json::json!({ "resolved": resolved }),
    )
    .await
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabIssueNote {
    pub id: i64,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub system: bool,
    #[serde(default)]
    pub author: Option<GitlabMrAuthor>,
    #[serde(rename = "createdAt", alias = "created_at", default)]
    pub created_at: String,
}

#[tauri::command]
pub async fn gitlab_list_issue_notes(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    issue_iid: i64,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Vec<GitlabIssueNote>, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    get_json_paged(
        &host,
        &token,
        &format!("/projects/{encoded}/issues/{issue_iid}/notes?order_by=created_at&sort=asc"),
    )
    .await
}

#[tauri::command]
pub async fn gitlab_create_issue_note(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    issue_iid: i64,
    body: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<i64, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    let note: GitlabNote = send_json(
        reqwest::Method::POST,
        &host,
        &token,
        &format!("/projects/{encoded}/issues/{issue_iid}/notes"),
        &serde_json::json!({ "body": body }),
    )
    .await?;
    Ok(note.id)
}

fn issue_discussions_path(project_path: &str, issue_iid: i64) -> String {
    let encoded = encode_project_path(project_path);
    format!("/projects/{encoded}/issues/{issue_iid}/discussions")
}

fn issue_discussion_notes_path(project_path: &str, issue_iid: i64, discussion_id: &str) -> String {
    let discussion = percent_encode(discussion_id);
    format!(
        "{}/{discussion}/notes",
        issue_discussions_path(project_path, issue_iid)
    )
}

#[tauri::command]
pub async fn gitlab_list_issue_discussions(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    issue_iid: i64,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Vec<GitlabMrDiscussion>, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    get_json_paged(
        &host,
        &token,
        &issue_discussions_path(&project_path, issue_iid),
    )
    .await
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn gitlab_reply_to_issue_discussion(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    issue_iid: i64,
    discussion_id: String,
    body: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<i64, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let note: GitlabNote = send_json(
        reqwest::Method::POST,
        &host,
        &token,
        &issue_discussion_notes_path(&project_path, issue_iid, &discussion_id),
        &serde_json::json!({ "body": body }),
    )
    .await?;
    Ok(note.id)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabApproval {
    pub user: GitlabMrAuthor,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabMrApprovalState {
    #[serde(rename = "approvalsRequired", alias = "approvals_required", default)]
    pub approvals_required: i64,
    #[serde(rename = "approvalsLeft", alias = "approvals_left", default)]
    pub approvals_left: i64,
    #[serde(rename = "userHasApproved", alias = "user_has_approved", default)]
    pub user_has_approved: bool,
    #[serde(rename = "userCanApprove", alias = "user_can_approve", default)]
    pub user_can_approve: bool,
    #[serde(rename = "approvedBy", alias = "approved_by", default)]
    pub approved_by: Vec<GitlabApproval>,
}

async fn read_approval_state(
    host: &str,
    token: &str,
    encoded_project: &str,
    mr_iid: i64,
) -> Result<Option<GitlabMrApprovalState>, GitlabError> {
    get_json_optional(
        host,
        token,
        &format!("/projects/{encoded_project}/merge_requests/{mr_iid}/approvals"),
    )
    .await
}

#[tauri::command]
pub async fn gitlab_mr_approval_state(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Option<GitlabMrApprovalState>, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    read_approval_state(&host, &token, &encoded, mr_iid).await
}

#[tauri::command]
pub async fn gitlab_approve_mr(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Option<GitlabMrApprovalState>, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    send_no_content(
        reqwest::Method::POST,
        &host,
        &token,
        &format!("/projects/{encoded}/merge_requests/{mr_iid}/approve"),
        &serde_json::json!({}),
    )
    .await?;
    read_approval_state(&host, &token, &encoded, mr_iid).await
}

#[tauri::command]
pub async fn gitlab_unapprove_mr(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Option<GitlabMrApprovalState>, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    send_no_content(
        reqwest::Method::POST,
        &host,
        &token,
        &format!("/projects/{encoded}/merge_requests/{mr_iid}/unapprove"),
        &serde_json::json!({}),
    )
    .await?;
    read_approval_state(&host, &token, &encoded, mr_iid).await
}

fn mr_update_payload(
    state_event: Option<&str>,
    title: Option<&str>,
    description: Option<&str>,
    reviewer_ids: Option<&[i64]>,
) -> serde_json::Value {
    let mut payload = serde_json::Map::new();
    if let Some(event) = state_event {
        payload.insert("state_event".to_string(), serde_json::json!(event));
    }
    if let Some(value) = title {
        payload.insert("title".to_string(), serde_json::json!(value));
    }
    if let Some(value) = description {
        payload.insert("description".to_string(), serde_json::json!(value));
    }
    if let Some(ids) = reviewer_ids {
        payload.insert("reviewer_ids".to_string(), serde_json::json!(ids));
    }
    serde_json::Value::Object(payload)
}

fn mr_path(encoded_project: &str, mr_iid: i64) -> String {
    format!("/projects/{encoded_project}/merge_requests/{mr_iid}")
}

fn is_empty_payload(payload: &serde_json::Value) -> bool {
    payload.as_object().map(|map| map.is_empty()) == Some(true)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn gitlab_update_mr_state(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    state_event: Option<String>,
    title: Option<String>,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabMergeRequest, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    let payload = mr_update_payload(state_event.as_deref(), title.as_deref(), None, None);
    if is_empty_payload(&payload) {
        return Err(GitlabError::InvalidShape(
            "merge request update needs a state event or a title".to_string(),
        ));
    }
    send_json(
        reqwest::Method::PUT,
        &host,
        &token,
        &mr_path(&encoded, mr_iid),
        &payload,
    )
    .await
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn gitlab_update_mr(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    title: Option<String>,
    description: Option<String>,
    reviewer_ids: Option<Vec<i64>>,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabMergeRequest, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    let payload = mr_update_payload(
        None,
        title.as_deref(),
        description.as_deref(),
        reviewer_ids.as_deref(),
    );
    if is_empty_payload(&payload) {
        return Err(GitlabError::InvalidShape(
            "merge request update needs a title, a description or reviewers".to_string(),
        ));
    }
    send_json(
        reqwest::Method::PUT,
        &host,
        &token,
        &mr_path(&encoded, mr_iid),
        &payload,
    )
    .await
}

#[tauri::command]
pub async fn gitlab_get_mr(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabMergeRequest, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    get_json(&host, &token, &mr_path(&encoded, mr_iid)).await
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MergeStrategy {
    Merge,
    Squash,
    Rebase,
}

fn merge_strategy(method: Option<&str>) -> Result<MergeStrategy, GitlabError> {
    match method.map(str::trim).filter(|value| !value.is_empty()) {
        None | Some("merge") => Ok(MergeStrategy::Merge),
        Some("squash") => Ok(MergeStrategy::Squash),
        Some("rebase") => Ok(MergeStrategy::Rebase),
        Some(other) => Err(GitlabError::InvalidShape(format!(
            "unknown merge method: {other}"
        ))),
    }
}

fn merge_body(strategy: MergeStrategy) -> serde_json::Value {
    match strategy {
        MergeStrategy::Squash => serde_json::json!({ "squash": true }),
        MergeStrategy::Merge | MergeStrategy::Rebase => serde_json::json!({}),
    }
}

fn rebase_blocker(
    project_merge_method: &str,
    detailed_merge_status: Option<&str>,
) -> Option<&'static str> {
    if !matches!(project_merge_method, "ff" | "rebase_merge") {
        return Some("this project does not merge by fast-forward");
    }
    if detailed_merge_status == Some("need_rebase") {
        return Some("rebase the merge request first");
    }
    None
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn gitlab_merge_mr(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    method: Option<String>,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabMergeRequest, GitlabError> {
    let strategy = merge_strategy(method.as_deref())?;
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    if strategy == MergeStrategy::Rebase {
        let settings: GitlabMergeSettings =
            get_json(&host, &token, &project_settings_path(&encoded)).await?;
        let current: GitlabMergeRequest =
            get_json(&host, &token, &mr_path(&encoded, mr_iid)).await?;
        if let Some(reason) = rebase_blocker(
            &settings.merge_method,
            current.detailed_merge_status.as_deref(),
        ) {
            return Err(GitlabError::InvalidShape(reason.to_string()));
        }
    }
    send_json(
        reqwest::Method::PUT,
        &host,
        &token,
        &format!("{}/merge", mr_path(&encoded, mr_iid)),
        &merge_body(strategy),
    )
    .await
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabMergeSettings {
    #[serde(
        rename = "mergeMethod",
        alias = "merge_method",
        default = "default_merge_method"
    )]
    pub merge_method: String,
    #[serde(rename = "squashOption", alias = "squash_option", default)]
    pub squash_option: Option<String>,
    #[serde(
        rename = "onlyAllowMergeIfPipelineSucceeds",
        alias = "only_allow_merge_if_pipeline_succeeds",
        default
    )]
    pub only_allow_merge_if_pipeline_succeeds: bool,
}

fn default_merge_method() -> String {
    "merge".to_string()
}

fn project_settings_path(encoded_project: &str) -> String {
    format!("/projects/{encoded_project}")
}

#[tauri::command]
pub async fn gitlab_project_merge_methods(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabMergeSettings, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    get_json(&host, &token, &project_settings_path(&encoded)).await
}

fn project_users_path(encoded_project: &str, query: &str) -> String {
    format!(
        "/projects/{encoded_project}/users?search={}",
        percent_encode(query.trim())
    )
}

#[tauri::command]
pub async fn gitlab_search_project_users(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    query: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Vec<GitlabUser>, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    get_json(&host, &token, &project_users_path(&encoded, &query)).await
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabPipeline {
    pub id: i64,
    pub status: String,
    #[serde(rename = "webUrl", alias = "web_url", default)]
    pub web_url: Option<String>,
    #[serde(default)]
    pub sha: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabJob {
    pub id: i64,
    pub name: String,
    #[serde(default)]
    pub stage: Option<String>,
    pub status: String,
    #[serde(rename = "webUrl", alias = "web_url", default)]
    pub web_url: Option<String>,
    #[serde(rename = "allowFailure", alias = "allow_failure", default)]
    pub allow_failure: bool,
    #[serde(default)]
    pub duration: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct GitlabMrChecks {
    pub pipeline: Option<GitlabPipeline>,
    pub jobs: Vec<GitlabJob>,
}

fn mr_pipelines_path(encoded_project: &str, mr_iid: i64) -> String {
    format!("{}/pipelines", mr_path(encoded_project, mr_iid))
}

fn pipeline_jobs_path(encoded_project: &str, pipeline_id: i64) -> String {
    format!("/projects/{encoded_project}/pipelines/{pipeline_id}/jobs")
}

fn is_denied(error: &GitlabError) -> bool {
    matches!(error, GitlabError::Http { status, .. } if *status == 403 || *status == 404)
}

#[tauri::command]
pub async fn gitlab_mr_pipeline_jobs(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Option<GitlabMrChecks>, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    let Some(pipelines) = get_json_optional::<Vec<GitlabPipeline>>(
        &host,
        &token,
        &mr_pipelines_path(&encoded, mr_iid),
    )
    .await?
    else {
        return Ok(None);
    };
    let Some(pipeline) = pipelines.into_iter().next() else {
        return Ok(Some(GitlabMrChecks {
            pipeline: None,
            jobs: Vec::new(),
        }));
    };
    let jobs = match get_json_paged::<GitlabJob>(
        &host,
        &token,
        &pipeline_jobs_path(&encoded, pipeline.id),
    )
    .await
    {
        Ok(jobs) => jobs,
        Err(error) if is_denied(&error) => return Ok(None),
        Err(error) => return Err(error),
    };
    Ok(Some(GitlabMrChecks {
        pipeline: Some(pipeline),
        jobs,
    }))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabMrCommit {
    pub id: String,
    #[serde(rename = "shortId", alias = "short_id", default)]
    pub short_id: String,
    pub title: String,
    #[serde(rename = "authorName", alias = "author_name", default)]
    pub author_name: Option<String>,
    #[serde(rename = "committedDate", alias = "committed_date", default)]
    pub committed_date: Option<String>,
}

fn mr_commits_path(encoded_project: &str, mr_iid: i64) -> String {
    format!("{}/commits", mr_path(encoded_project, mr_iid))
}

#[tauri::command]
pub async fn gitlab_mr_commits(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Vec<GitlabMrCommit>, GitlabError> {
    let token = read_token(&workspace_id, project_id.as_deref(), &cache)?;
    let encoded = encode_project_path(&project_path);
    get_json_paged(&host, &token, &mr_commits_path(&encoded, mr_iid)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_base_appends_v4_for_gitlab_com() {
        assert_eq!(
            api_base("https://gitlab.com").unwrap(),
            "https://gitlab.com/api/v4"
        );
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
    fn issues_by_iids_path_repeats_the_iids_param_for_each_issue() {
        assert_eq!(
            issues_by_iids_path("payments/api", &[12, 44]),
            "/projects/payments%2Fapi/issues?iids[]=12&iids[]=44"
        );
    }

    #[test]
    fn issues_by_iids_path_handles_a_single_issue() {
        assert_eq!(
            issues_by_iids_path("payments/api", &[12]),
            "/projects/payments%2Fapi/issues?iids[]=12"
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
    fn mr_discussion_resolve_path_encodes_the_project_and_the_discussion_id() {
        assert_eq!(
            mr_discussion_resolve_path("group/sub/repo", 11, "6a9c1750b37d513a43987b574953fceb50b03ce7", true),
            "/projects/group%2Fsub%2Frepo/merge_requests/11/discussions/6a9c1750b37d513a43987b574953fceb50b03ce7?resolved=true"
        );
    }

    #[test]
    fn mr_discussion_resolve_path_escapes_a_discussion_id_that_is_not_url_safe() {
        let path = mr_discussion_resolve_path("acme/web", 4, "note/7 a+b", false);
        assert!(
            !path.contains("note/7 a+b"),
            "the raw discussion id leaked into the path: {path}"
        );
        assert_eq!(
            path,
            "/projects/acme%2Fweb/merge_requests/4/discussions/note%2F7%20a%2Bb?resolved=false"
        );
    }

    #[test]
    fn resolve_mr_discussion_is_registered_as_a_tauri_command() {
        let lib = include_str!("lib.rs");
        assert!(
            lib.contains("gitlab::gitlab_resolve_mr_discussion"),
            "gitlab_resolve_mr_discussion is missing from the generate_handler block"
        );
    }

    #[test]
    fn mr_discussion_deserializes_a_resolved_thread_payload() {
        let raw = r#"{
            "id": "6a9c1750b37d",
            "individual_note": false,
            "notes": [
                {
                    "id": 42,
                    "body": "one nit",
                    "system": false,
                    "created_at": "2026-08-01T10:00:00Z",
                    "resolvable": true,
                    "resolved": true
                }
            ]
        }"#;
        let discussion: GitlabMrDiscussion = serde_json::from_str(raw).unwrap();
        assert_eq!(discussion.id, "6a9c1750b37d");
        assert!(!discussion.individual_note);
        assert_eq!(discussion.notes[0].resolved, Some(true));
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
    fn merge_request_deserializes_author_and_reviewers() {
        let raw = r#"{
            "id": 9,
            "iid": 2,
            "project_id": 3,
            "title": "wip",
            "description": null,
            "state": "opened",
            "web_url": "https://gitlab.com/acme/web/-/merge_requests/2",
            "source_branch": "ak/feat-x",
            "target_branch": "main",
            "author": { "username": "alice", "name": "Alice", "avatar_url": "https://gitlab.com/a.png" },
            "reviewers": [{ "username": "bob", "name": "Bob" }]
        }"#;
        let mr: GitlabMergeRequest = serde_json::from_str(raw).unwrap();
        let author = mr.author.unwrap();
        assert_eq!(author.username, "alice");
        assert_eq!(
            author.avatar_url.as_deref(),
            Some("https://gitlab.com/a.png")
        );
        let reviewers = mr.reviewers.unwrap();
        assert_eq!(reviewers[0].username, "bob");
        assert!(reviewers[0].avatar_url.is_none());
        assert!(reviewers[0].id.is_none());
    }

    #[test]
    fn merge_request_reviewers_carry_their_user_id() {
        let raw = r#"{
            "id": 9, "iid": 2, "project_id": 3, "title": "t", "description": null,
            "state": "opened", "web_url": "https://gitlab.com/acme/web/-/merge_requests/2",
            "source_branch": "a", "target_branch": "main",
            "reviewers": [{ "id": 7, "username": "kenji-w", "name": "Kenji Watanabe" }]
        }"#;
        let mr: GitlabMergeRequest = serde_json::from_str(raw).unwrap();
        let reviewers = mr.reviewers.unwrap();
        assert_eq!(reviewers[0].id, Some(7));
        let value = serde_json::to_value(&reviewers[0]).unwrap();
        assert_eq!(value["id"], 7);
    }

    #[test]
    fn merge_request_defaults_missing_author_and_reviewers_to_none() {
        let raw = r#"{
            "id": 9,
            "iid": 2,
            "project_id": 3,
            "title": "wip",
            "description": null,
            "state": "opened",
            "web_url": "https://gitlab.com/acme/web/-/merge_requests/2",
            "source_branch": "ak/feat-x",
            "target_branch": "main"
        }"#;
        let mr: GitlabMergeRequest = serde_json::from_str(raw).unwrap();
        assert!(mr.author.is_none());
        assert!(mr.reviewers.is_none());
    }

    #[test]
    fn assemble_mr_diff_emits_git_headers_per_change() {
        let changes = vec![
            GitlabMrChange {
                old_path: "src/a.ts".into(),
                new_path: "src/a.ts".into(),
                diff: "@@ -1 +1 @@\n-old\n+new\n".into(),
                new_file: false,
                deleted_file: false,
            },
            GitlabMrChange {
                old_path: "src/b.ts".into(),
                new_path: "src/b.ts".into(),
                diff: "@@ -0,0 +1 @@\n+created".into(),
                new_file: true,
                deleted_file: false,
            },
            GitlabMrChange {
                old_path: "src/c.ts".into(),
                new_path: "src/c.ts".into(),
                diff: "@@ -1 +0,0 @@\n-gone\n".into(),
                new_file: false,
                deleted_file: true,
            },
        ];
        let out = assemble_mr_diff(&changes);
        assert!(out.contains("diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new\n"));
        assert!(out.contains("diff --git a/src/b.ts b/src/b.ts\n--- /dev/null\n+++ b/src/b.ts\n@@ -0,0 +1 @@\n+created\n"));
        assert!(out.contains("diff --git a/src/c.ts b/src/c.ts\n--- a/src/c.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-gone\n"));
    }

    #[test]
    fn assemble_mr_diff_returns_empty_for_no_changes() {
        assert_eq!(assemble_mr_diff(&[]), "");
    }

    #[test]
    fn diff_refs_deserialize_from_snake_case_mr_payload() {
        let raw = r#"{
            "id": 9,
            "iid": 2,
            "diff_refs": {
                "base_sha": "aaa",
                "head_sha": "bbb",
                "start_sha": "ccc"
            }
        }"#;
        let payload: GitlabMrRefsPayload = serde_json::from_str(raw).unwrap();
        let refs = payload.diff_refs.unwrap();
        assert_eq!(refs.base_sha, "aaa");
        assert_eq!(refs.head_sha, "bbb");
        assert_eq!(refs.start_sha, "ccc");
    }

    #[test]
    fn diff_refs_default_to_none_when_missing() {
        let payload: GitlabMrRefsPayload = serde_json::from_str(r#"{ "id": 9 }"#).unwrap();
        assert!(payload.diff_refs.is_none());
    }

    #[test]
    fn discussion_payload_anchors_text_position_on_the_new_line() {
        let position = GitlabDiscussionPosition {
            base_sha: "aaa".into(),
            head_sha: "bbb".into(),
            start_sha: "ccc".into(),
            new_path: "src/a.ts".into(),
            new_line: Some(12),
            old_path: None,
            old_line: None,
        };
        let payload = discussion_payload("tighten this", &position);
        assert_eq!(payload["body"], "tighten this");
        assert_eq!(payload["position"]["position_type"], "text");
        assert_eq!(payload["position"]["new_path"], "src/a.ts");
        assert_eq!(payload["position"]["new_line"], 12);
        assert!(payload["position"].get("old_path").is_none());
        assert!(payload["position"].get("old_line").is_none());
    }

    #[test]
    fn discussion_payload_uses_a_file_position_when_no_line_is_given() {
        let position = GitlabDiscussionPosition {
            base_sha: "aaa".into(),
            head_sha: "bbb".into(),
            start_sha: "ccc".into(),
            new_path: "src/a.ts".into(),
            new_line: None,
            old_path: Some("src/a.ts".into()),
            old_line: None,
        };
        let payload = discussion_payload("split this file", &position);
        assert_eq!(payload["position"]["position_type"], "file");
        assert_eq!(payload["position"]["new_path"], "src/a.ts");
        assert_eq!(payload["position"]["old_path"], "src/a.ts");
        assert!(payload["position"].get("new_line").is_none());
    }

    #[test]
    fn discussion_payload_carries_old_side_fields_when_present() {
        let position = GitlabDiscussionPosition {
            base_sha: "aaa".into(),
            head_sha: "bbb".into(),
            start_sha: "ccc".into(),
            new_path: "src/a.ts".into(),
            new_line: None,
            old_path: Some("src/a.ts".into()),
            old_line: Some(4),
        };
        let payload = discussion_payload("dead branch", &position);
        assert_eq!(payload["position"]["old_path"], "src/a.ts");
        assert_eq!(payload["position"]["old_line"], 4);
        assert!(payload["position"].get("new_line").is_none());
    }

    #[test]
    fn discussion_position_deserializes_camel_case_invoke_args() {
        let raw = r#"{
            "baseSha": "aaa",
            "headSha": "bbb",
            "startSha": "ccc",
            "newPath": "src/a.ts",
            "newLine": 12
        }"#;
        let position: GitlabDiscussionPosition = serde_json::from_str(raw).unwrap();
        assert_eq!(position.base_sha, "aaa");
        assert_eq!(position.new_line, Some(12));
        assert!(position.old_path.is_none());
    }

    #[test]
    fn discussion_deserializes_notes_with_system_flag_and_position() {
        let raw = r#"[{
            "id": "abc123",
            "individual_note": false,
            "notes": [
                {
                    "id": 1,
                    "body": "tighten this",
                    "system": false,
                    "created_at": "2026-07-22T10:00:00Z",
                    "resolvable": true,
                    "resolved": false,
                    "author": { "username": "alice", "name": "Alice" },
                    "position": { "new_path": "src/a.ts", "new_line": 12 }
                },
                {
                    "id": 2,
                    "body": "changed title from x to y",
                    "system": true,
                    "created_at": "2026-07-22T10:05:00Z"
                }
            ]
        }]"#;
        let discussions: Vec<GitlabMrDiscussion> = serde_json::from_str(raw).unwrap();
        let discussion = &discussions[0];
        assert_eq!(discussion.id, "abc123");
        assert!(!discussion.individual_note);
        assert_eq!(discussion.notes.len(), 2);
        assert_eq!(discussion.notes[0].resolved, Some(false));
        assert_eq!(
            discussion.notes[0]
                .position
                .as_ref()
                .and_then(|p| p.new_line),
            Some(12)
        );
        assert!(discussion.notes[1].system);
        assert!(discussion.notes[1].author.is_none());
    }

    #[test]
    fn discussion_serializes_notes_to_camel_case_for_the_frontend() {
        let discussion = GitlabMrDiscussion {
            id: "abc123".into(),
            individual_note: true,
            notes: vec![GitlabMrNote {
                id: 1,
                body: "ship it".into(),
                system: false,
                author: None,
                created_at: "2026-07-22T10:00:00Z".into(),
                resolvable: false,
                resolved: None,
                position: Some(GitlabNotePosition {
                    new_path: Some("src/a.ts".into()),
                    old_path: None,
                    new_line: Some(3),
                    old_line: None,
                }),
            }],
        };
        let value = serde_json::to_value(&discussion).unwrap();
        assert_eq!(value["individualNote"], true);
        assert_eq!(value["notes"][0]["createdAt"], "2026-07-22T10:00:00Z");
        assert_eq!(value["notes"][0]["position"]["newPath"], "src/a.ts");
        assert_eq!(value["notes"][0]["position"]["newLine"], 3);
    }

    #[test]
    fn approval_state_deserializes_snake_case_payload() {
        let raw = r#"{
            "approvals_required": 2,
            "approvals_left": 1,
            "user_has_approved": true,
            "user_can_approve": false,
            "approved_by": [{ "user": { "username": "bob", "name": "Bob" } }]
        }"#;
        let state: GitlabMrApprovalState = serde_json::from_str(raw).unwrap();
        assert_eq!(state.approvals_required, 2);
        assert_eq!(state.approvals_left, 1);
        assert!(state.user_has_approved);
        assert!(!state.user_can_approve);
        assert_eq!(state.approved_by[0].user.username, "bob");
    }

    #[test]
    fn approval_state_defaults_every_field_on_a_bare_payload() {
        let state: GitlabMrApprovalState = serde_json::from_str("{}").unwrap();
        assert_eq!(state.approvals_required, 0);
        assert!(!state.user_has_approved);
        assert!(state.approved_by.is_empty());
    }

    #[test]
    fn mr_update_payload_carries_only_the_supplied_fields() {
        let closing = mr_update_payload(Some("close"), None, None, None);
        assert_eq!(closing["state_event"], "close");
        assert!(closing.get("title").is_none());

        let retitle = mr_update_payload(None, Some("Draft: ship it"), None, None);
        assert_eq!(retitle["title"], "Draft: ship it");
        assert!(retitle.get("state_event").is_none());

        assert_eq!(
            mr_update_payload(None, None, None, None),
            serde_json::json!({})
        );
    }

    #[test]
    fn mr_update_payload_carries_a_description_and_reviewers_only_when_supplied() {
        let described = mr_update_payload(None, None, Some("Key the guard on the event id"), None);
        assert_eq!(described["description"], "Key the guard on the event id");
        assert!(described.get("title").is_none());
        assert!(described.get("reviewer_ids").is_none());

        let reviewed = mr_update_payload(None, None, None, Some(&[7, 9]));
        assert_eq!(reviewed["reviewer_ids"], serde_json::json!([7, 9]));
        assert!(reviewed.get("description").is_none());
    }

    #[test]
    fn mr_update_payload_with_an_empty_reviewer_list_clears_the_reviewers() {
        let cleared = mr_update_payload(None, None, None, Some(&[]));
        assert_eq!(cleared, serde_json::json!({ "reviewer_ids": [] }));
        assert!(!is_empty_payload(&cleared));
        assert!(is_empty_payload(&mr_update_payload(None, None, None, None)));
    }

    #[test]
    fn mr_update_payload_keeps_an_empty_description_so_it_can_be_cleared() {
        let cleared = mr_update_payload(None, None, Some(""), None);
        assert_eq!(cleared, serde_json::json!({ "description": "" }));
    }

    #[test]
    fn merge_strategy_defaults_to_a_plain_merge_and_rejects_unknown_methods() {
        assert_eq!(merge_strategy(None).unwrap(), MergeStrategy::Merge);
        assert_eq!(merge_strategy(Some("  ")).unwrap(), MergeStrategy::Merge);
        assert_eq!(merge_strategy(Some("merge")).unwrap(), MergeStrategy::Merge);
        assert_eq!(
            merge_strategy(Some("squash")).unwrap(),
            MergeStrategy::Squash
        );
        assert_eq!(
            merge_strategy(Some("rebase")).unwrap(),
            MergeStrategy::Rebase
        );
        let error = merge_strategy(Some("fast-forward")).unwrap_err();
        assert!(
            matches!(error, GitlabError::InvalidShape(message) if message.contains("fast-forward"))
        );
    }

    #[test]
    fn merge_body_sends_squash_only_for_the_squash_method() {
        assert_eq!(merge_body(MergeStrategy::Merge), serde_json::json!({}));
        assert_eq!(
            merge_body(MergeStrategy::Squash),
            serde_json::json!({ "squash": true })
        );
        assert_eq!(merge_body(MergeStrategy::Rebase), serde_json::json!({}));
    }

    #[test]
    fn rebase_needs_a_fast_forward_project_and_an_up_to_date_merge_request() {
        assert_eq!(
            rebase_blocker("merge", Some("mergeable")),
            Some("this project does not merge by fast-forward")
        );
        assert_eq!(
            rebase_blocker("ff", Some("need_rebase")),
            Some("rebase the merge request first")
        );
        assert_eq!(
            rebase_blocker("rebase_merge", Some("need_rebase")),
            Some("rebase the merge request first")
        );
        assert_eq!(rebase_blocker("ff", Some("mergeable")), None);
        assert_eq!(rebase_blocker("rebase_merge", None), None);
    }

    #[test]
    fn mr_paths_encode_the_project_and_name_the_resource() {
        let encoded = encode_project_path("harborline/payments-api");
        assert_eq!(
            mr_path(&encoded, 42),
            "/projects/harborline%2Fpayments-api/merge_requests/42"
        );
        assert_eq!(
            mr_pipelines_path(&encoded, 42),
            "/projects/harborline%2Fpayments-api/merge_requests/42/pipelines"
        );
        assert_eq!(
            mr_commits_path(&encoded, 42),
            "/projects/harborline%2Fpayments-api/merge_requests/42/commits"
        );
        assert_eq!(
            pipeline_jobs_path(&encoded, 9001),
            "/projects/harborline%2Fpayments-api/pipelines/9001/jobs"
        );
        assert_eq!(
            project_settings_path(&encoded),
            "/projects/harborline%2Fpayments-api"
        );
    }

    #[test]
    fn project_users_path_escapes_the_search_text() {
        let encoded = encode_project_path("harborline/payments-api");
        assert_eq!(
            project_users_path(&encoded, "  nadia p&q "),
            "/projects/harborline%2Fpayments-api/users?search=nadia%20p%26q"
        );
    }

    #[test]
    fn denied_means_forbidden_or_missing_and_nothing_else() {
        let http = |status: u16| GitlabError::Http {
            status,
            body: String::new(),
        };
        assert!(is_denied(&http(403)));
        assert!(is_denied(&http(404)));
        assert!(!is_denied(&http(401)));
        assert!(!is_denied(&http(500)));
        assert!(!is_denied(&GitlabError::InvalidShape("x".into())));
    }

    #[test]
    fn merge_request_deserializes_the_pipeline_and_merge_status_of_a_single_read() {
        let raw = r#"{
            "id": 501,
            "iid": 42,
            "project_id": 9,
            "title": "Stop retried webhooks posting a second credit",
            "description": "Key the guard on the event id.",
            "state": "opened",
            "web_url": "https://gitlab.com/harborline/payments-api/-/merge_requests/42",
            "source_branch": "hl/fix-duplicate-credit",
            "target_branch": "main",
            "draft": false,
            "has_conflicts": false,
            "merge_status": "can_be_merged",
            "detailed_merge_status": "need_rebase",
            "created_at": "2026-09-26T08:00:00Z",
            "updated_at": "2026-10-06T09:30:00Z",
            "sha": "6c20f48a9e1",
            "head_pipeline": {
                "id": 9001,
                "status": "failed",
                "web_url": "https://gitlab.com/harborline/payments-api/-/pipelines/9001"
            }
        }"#;
        let mr: GitlabMergeRequest = serde_json::from_str(raw).unwrap();
        assert_eq!(mr.created_at.as_deref(), Some("2026-09-26T08:00:00Z"));
        assert_eq!(mr.detailed_merge_status.as_deref(), Some("need_rebase"));
        let pipeline = mr.head_pipeline.unwrap();
        assert_eq!(pipeline.id, 9001);
        assert_eq!(pipeline.status, "failed");
    }

    #[test]
    fn merge_request_without_a_pipeline_reads_it_as_none() {
        let raw = r#"{
            "id": 501, "iid": 42, "project_id": 9, "title": "t", "description": null,
            "state": "opened", "web_url": "https://gitlab.com/a/b/-/merge_requests/42",
            "source_branch": "a", "target_branch": "main", "head_pipeline": null
        }"#;
        let mr: GitlabMergeRequest = serde_json::from_str(raw).unwrap();
        assert!(mr.head_pipeline.is_none());
        assert!(mr.created_at.is_none());
        assert!(mr.detailed_merge_status.is_none());
    }

    #[test]
    fn project_settings_deserialize_the_merge_rules_of_a_project() {
        let raw = r#"{
            "id": 9,
            "name": "payments-api",
            "merge_method": "rebase_merge",
            "squash_option": "never",
            "only_allow_merge_if_pipeline_succeeds": true
        }"#;
        let settings: GitlabMergeSettings = serde_json::from_str(raw).unwrap();
        assert_eq!(settings.merge_method, "rebase_merge");
        assert_eq!(settings.squash_option.as_deref(), Some("never"));
        assert!(settings.only_allow_merge_if_pipeline_succeeds);
        let value = serde_json::to_value(&settings).unwrap();
        assert_eq!(value["mergeMethod"], "rebase_merge");
        assert_eq!(value["squashOption"], "never");
        assert_eq!(value["onlyAllowMergeIfPipelineSucceeds"], true);
    }

    #[test]
    fn project_settings_default_to_a_merge_commit_project_without_squash_rules() {
        let settings: GitlabMergeSettings = serde_json::from_str("{}").unwrap();
        assert_eq!(settings.merge_method, "merge");
        assert!(settings.squash_option.is_none());
        assert!(!settings.only_allow_merge_if_pipeline_succeeds);
    }

    #[test]
    fn pipelines_and_jobs_deserialize_a_real_payload() {
        let pipelines = r#"[
            {
                "id": 9001,
                "iid": 311,
                "project_id": 9,
                "status": "failed",
                "source": "merge_request_event",
                "ref": "refs/merge-requests/42/head",
                "sha": "6c20f48a9e1",
                "web_url": "https://gitlab.com/harborline/payments-api/-/pipelines/9001",
                "created_at": "2026-10-06T09:00:00.000Z"
            }
        ]"#;
        let parsed: Vec<GitlabPipeline> = serde_json::from_str(pipelines).unwrap();
        assert_eq!(parsed[0].id, 9001);
        assert_eq!(parsed[0].status, "failed");
        assert_eq!(parsed[0].sha.as_deref(), Some("6c20f48a9e1"));

        let jobs = r#"[
            {
                "id": 77,
                "name": "unit",
                "stage": "test",
                "status": "success",
                "allow_failure": false,
                "duration": 83.5,
                "web_url": "https://gitlab.com/harborline/payments-api/-/jobs/77"
            },
            {
                "id": 78,
                "name": "deploy-preview",
                "stage": "deploy",
                "status": "manual",
                "allow_failure": true,
                "duration": null,
                "web_url": "https://gitlab.com/harborline/payments-api/-/jobs/78"
            }
        ]"#;
        let parsed: Vec<GitlabJob> = serde_json::from_str(jobs).unwrap();
        assert_eq!(parsed[0].duration, Some(83.5));
        assert!(!parsed[0].allow_failure);
        assert_eq!(parsed[1].status, "manual");
        assert!(parsed[1].allow_failure);
        assert!(parsed[1].duration.is_none());
        let value = serde_json::to_value(&parsed[1]).unwrap();
        assert_eq!(value["allowFailure"], true);
        assert_eq!(
            value["webUrl"],
            "https://gitlab.com/harborline/payments-api/-/jobs/78"
        );
    }

    #[test]
    fn mr_checks_serialize_the_pipeline_and_its_jobs() {
        let checks = GitlabMrChecks {
            pipeline: None,
            jobs: Vec::new(),
        };
        assert_eq!(
            serde_json::to_value(&checks).unwrap(),
            serde_json::json!({ "pipeline": null, "jobs": [] })
        );
    }

    #[test]
    fn project_users_deserialize_with_an_avatar() {
        let raw = r#"[
            {
                "id": 7,
                "username": "kenji-w",
                "name": "Kenji Watanabe",
                "state": "active",
                "avatar_url": "https://gitlab.com/uploads/-/system/user/avatar/7/avatar.png",
                "web_url": "https://gitlab.com/kenji-w"
            },
            { "id": 8, "username": "priya-n", "name": "Priya Nair" }
        ]"#;
        let users: Vec<GitlabUser> = serde_json::from_str(raw).unwrap();
        assert_eq!(users[0].username, "kenji-w");
        assert!(users[0].avatar_url.is_some());
        assert!(users[1].avatar_url.is_none());
        let value = serde_json::to_value(&users[0]).unwrap();
        assert_eq!(
            value["avatarUrl"],
            "https://gitlab.com/uploads/-/system/user/avatar/7/avatar.png"
        );
    }

    #[test]
    fn commits_deserialize_the_commit_list_of_a_merge_request() {
        let raw = r#"[
            {
                "id": "a41c9e2b7d3f0000000000000000000000000000",
                "short_id": "a41c9e2b",
                "title": "Drop the seenEvents read",
                "author_name": "Nadia Petrova",
                "author_email": "nadia@harborline.test",
                "created_at": "2026-10-03T12:00:00.000Z",
                "committed_date": "2026-10-03T12:00:00.000Z",
                "message": "Drop the seenEvents read\n"
            }
        ]"#;
        let commits: Vec<GitlabMrCommit> = serde_json::from_str(raw).unwrap();
        assert_eq!(commits[0].short_id, "a41c9e2b");
        assert_eq!(commits[0].author_name.as_deref(), Some("Nadia Petrova"));
        let value = serde_json::to_value(&commits[0]).unwrap();
        assert_eq!(value["committedDate"], "2026-10-03T12:00:00.000Z");
        assert_eq!(value["title"], "Drop the seenEvents read");
    }

    #[test]
    fn every_pull_request_command_is_registered_as_a_tauri_command() {
        let lib = include_str!("lib.rs");
        for command in [
            "gitlab::gitlab_update_mr,",
            "gitlab::gitlab_get_mr,",
            "gitlab::gitlab_merge_mr,",
            "gitlab::gitlab_project_merge_methods,",
            "gitlab::gitlab_search_project_users,",
            "gitlab::gitlab_mr_pipeline_jobs,",
            "gitlab::gitlab_mr_commits,",
        ] {
            assert!(
                lib.contains(command),
                "{command} is missing from the generate_handler block"
            );
        }
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
    fn issue_note_deserializes_snake_case_payload_with_system_flag() {
        let raw = r#"{
            "id": 5,
            "body": "changed the milestone",
            "system": true,
            "created_at": "2026-07-22T10:00:00Z",
            "author": { "username": "bob", "name": "Bob" }
        }"#;
        let note: GitlabIssueNote = serde_json::from_str(raw).unwrap();
        assert!(note.system);
        assert_eq!(note.author.unwrap().username, "bob");
        assert_eq!(note.created_at, "2026-07-22T10:00:00Z");
    }

    #[test]
    fn issue_discussion_paths_escape_the_project_and_the_discussion() {
        assert_eq!(
            issue_discussions_path("group/sub/repo", 7),
            "/projects/group%2Fsub%2Frepo/issues/7/discussions"
        );
        assert_eq!(
            issue_discussion_notes_path("acme/web", 7, "note/7 a+b"),
            "/projects/acme%2Fweb/issues/7/discussions/note%2F7%20a%2Bb/notes"
        );
    }

    #[test]
    fn issue_discussion_deserializes_notes_with_resolvable_flags() {
        let raw = r#"{
            "id": "6a9c1750b37d513a",
            "individual_note": false,
            "notes": [
                { "id": 1, "body": "why", "created_at": "2026-07-22T10:00:00Z", "resolvable": true, "resolved": false },
                { "id": 2, "body": "because", "created_at": "2026-07-22T11:00:00Z", "resolvable": true, "resolved": false }
            ]
        }"#;
        let discussion: GitlabMrDiscussion = serde_json::from_str(raw).unwrap();
        assert_eq!(discussion.id, "6a9c1750b37d513a");
        assert!(!discussion.individual_note);
        assert_eq!(discussion.notes.len(), 2);
        assert!(discussion.notes[0].resolvable);
        assert!(discussion.notes[1].position.is_none());
    }

    #[test]
    fn issue_note_defaults_missing_fields_on_a_bare_payload() {
        let note: GitlabIssueNote = serde_json::from_str(r#"{ "id": 1 }"#).unwrap();
        assert_eq!(note.body, "");
        assert!(!note.system);
        assert!(note.author.is_none());
    }

    #[test]
    fn issue_note_serializes_to_camel_case_for_the_frontend() {
        let note = GitlabIssueNote {
            id: 1,
            body: "looks good".into(),
            system: false,
            author: None,
            created_at: "2026-07-22T10:00:00Z".into(),
        };
        let value = serde_json::to_value(&note).unwrap();
        assert_eq!(value["createdAt"], "2026-07-22T10:00:00Z");
        assert_eq!(value["body"], "looks good");
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

    #[tokio::test]
    async fn a_silent_server_times_out_on_every_request_path() {
        use crate::integrations::http::test_support::{
            assert_error_shape, silent_server, within_bound,
        };
        let server = silent_server();
        let body = serde_json::json!({});
        let host = server.base.as_str();
        let (read, optional, paged, no_content, write) = within_bound(async {
            tokio::join!(
                get_json::<serde_json::Value>(host, "token", "/user"),
                get_json_optional::<serde_json::Value>(host, "token", "/user"),
                get_json_paged::<serde_json::Value>(host, "token", "/projects"),
                send_no_content(reqwest::Method::PUT, host, "token", "/user", &body),
                send_json::<serde_json::Value>(
                    reqwest::Method::POST,
                    host,
                    "token",
                    "/user",
                    &body
                ),
            )
        })
        .await;
        assert_error_shape(&read.unwrap_err(), "timeout");
        assert_error_shape(&optional.unwrap_err(), "timeout");
        assert_error_shape(&paged.unwrap_err(), "timeout");
        assert_error_shape(&no_content.unwrap_err(), "timeout");
        assert_error_shape(&write.unwrap_err(), "timeout");
    }

    #[tokio::test]
    async fn a_refused_connection_keeps_the_http_kind() {
        use crate::integrations::http::test_support::{
            assert_error_shape, closed_base, within_bound,
        };
        let base = closed_base();
        let error = within_bound(get_json::<serde_json::Value>(&base, "token", "/user"))
            .await
            .unwrap_err();
        assert_error_shape(&error, "http");
    }
}
