use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;

use crate::integration_credentials::{self, BoundValue, IntegrationCredentialError};
use crate::integrations::failure::{self, HostFailure, HostFailureKind};
use crate::integrations::http::{
    self, require_secure_scheme, send_retrying, Paged, SchemeRefusal, TransportFailure,
};
use crate::integrations::request_state::RequestState;
use crate::secrets;
use crate::util::percent_encode;

const PROVIDER: &str = "gitlab";

integration_credentials::token_cache!(GitlabTokenCache);

#[derive(Debug, Error)]
pub enum GitlabError {
    #[error("http error {status}: {body}")]
    Http { status: u16, body: String },
    #[error("http error 429: {body}")]
    RateLimited {
        retry_after_seconds: Option<u64>,
        body: String,
    },
    #[error("request timed out: {0}")]
    Timeout(String),
    #[error("invalid request: {0}")]
    InvalidInput(String),
    #[error("{0}")]
    InsecureHost(String),
    #[error("invalid response shape: {0}")]
    InvalidShape(String),
    #[error("no personal API key stored for workspace {0}")]
    NoToken(String),
    #[error("the branch changed after it was reviewed: {0}")]
    StaleHead(String),
    #[error("credential store error: {0}")]
    Credential(#[from] IntegrationCredentialError),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
}

crate::util::impl_error_serialize!(GitlabError, failure);

impl GitlabError {
    fn kind(&self) -> &'static str {
        match self {
            GitlabError::Http { .. } => "http",
            GitlabError::RateLimited { .. } => "rate_limited",
            GitlabError::Timeout(_) => "timeout",
            GitlabError::InvalidInput(_) => "invalid_input",
            GitlabError::InsecureHost(_) => "insecure_host",
            GitlabError::InvalidShape(_) => "shape",
            GitlabError::NoToken(_) => "no_token",
            GitlabError::StaleHead(_) => "stale_head",
            GitlabError::Credential(_) => "credential",
            GitlabError::Secret(_) => "secret",
        }
    }

    fn failure(&self) -> Option<HostFailure> {
        match self {
            GitlabError::Http { status, body } => {
                Some(failure::failure_of_status(*status, None, body))
            }
            GitlabError::RateLimited {
                retry_after_seconds,
                body,
            } => Some(failure::failure_of_status(429, *retry_after_seconds, body)),
            GitlabError::Timeout(message) => {
                Some(HostFailure::of_kind(HostFailureKind::Timeout, message))
            }
            GitlabError::InsecureHost(message) => {
                Some(HostFailure::of_kind(HostFailureKind::Failed, message))
            }
            GitlabError::NoToken(_) => Some(HostFailure::of_kind(
                HostFailureKind::BadCredentials,
                &self.to_string(),
            )),
            GitlabError::StaleHead(_)
            | GitlabError::InvalidInput(_)
            | GitlabError::InvalidShape(_)
            | GitlabError::Credential(_)
            | GitlabError::Secret(_) => None,
        }
    }
}

fn http_failure(status: u16, retry_after_seconds: Option<u64>, body: String) -> GitlabError {
    match status {
        429 => GitlabError::RateLimited {
            retry_after_seconds,
            body,
        },
        _ => GitlabError::Http { status, body },
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
    require_secure_scheme(trimmed).map_err(|refusal| match refusal {
        SchemeRefusal::Insecure(message) => GitlabError::InsecureHost(message),
        SchemeRefusal::Invalid(message) => GitlabError::InvalidInput(message),
    })?;
    Ok(format!("{}/api/v4", trimmed))
}

async fn get_json<T: serde::de::DeserializeOwned>(
    host: &str,
    token: &str,
    path: &str,
) -> Result<T, GitlabError> {
    let url = format!("{}{}", api_base(host)?, path);
    let res = send_retrying(|| http::client().get(&url).header("PRIVATE-TOKEN", token)).await?;
    let status = res.status();
    let retry_after = failure::retry_after_of(res.headers());
    let body = res.text().await?;
    if !status.is_success() {
        return Err(http_failure(status.as_u16(), retry_after, body));
    }
    serde_json::from_str(&body).map_err(|e| GitlabError::InvalidShape(e.to_string()))
}

use crate::util::limits::MAX_PAGES;

async fn get_json_optional<T: serde::de::DeserializeOwned>(
    host: &str,
    token: &str,
    path: &str,
) -> Result<Option<T>, GitlabError> {
    let url = format!("{}{}", api_base(host)?, path);
    let res = send_retrying(|| http::client().get(&url).header("PRIVATE-TOKEN", token)).await?;
    let status = res.status();
    let retry_after = failure::retry_after_of(res.headers());
    let body = res.text().await?;
    if status == reqwest::StatusCode::NOT_FOUND || status == reqwest::StatusCode::FORBIDDEN {
        return Ok(None);
    }
    if !status.is_success() {
        return Err(http_failure(status.as_u16(), retry_after, body));
    }
    serde_json::from_str(&body)
        .map(Some)
        .map_err(|e| GitlabError::InvalidShape(e.to_string()))
}

#[derive(Debug, PartialEq, Eq)]
enum PageStep {
    Done,
    Next(u32),
    Truncated,
}

fn page_step(page: u32, next_page: Option<u32>) -> PageStep {
    match next_page {
        Some(next) if next > page && page < MAX_PAGES => PageStep::Next(next),
        Some(next) if next > page => PageStep::Truncated,
        _ => PageStep::Done,
    }
}

async fn get_json_paged<T: serde::de::DeserializeOwned>(
    host: &str,
    token: &str,
    path: &str,
) -> Result<Vec<T>, GitlabError> {
    Ok(get_json_paged_marked(host, token, path)
        .await?
        .into_items(path))
}

async fn get_json_paged_marked<T: serde::de::DeserializeOwned>(
    host: &str,
    token: &str,
    path: &str,
) -> Result<Paged<T>, GitlabError> {
    let base = api_base(host)?;
    let separator = if path.contains('?') { '&' } else { '?' };
    let mut collected: Vec<T> = Vec::new();
    let mut page: u32 = 1;
    let mut is_truncated = false;
    loop {
        let url = format!("{base}{path}{separator}per_page=100&page={page}");
        let res = send_retrying(|| http::client().get(&url).header("PRIVATE-TOKEN", token)).await?;
        let status = res.status();
        let next_page = res
            .headers()
            .get("x-next-page")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.trim().parse::<u32>().ok());
        let retry_after = failure::retry_after_of(res.headers());
        let body = res.text().await?;
        if !status.is_success() {
            return Err(http_failure(status.as_u16(), retry_after, body));
        }
        let batch: Vec<T> =
            serde_json::from_str(&body).map_err(|e| GitlabError::InvalidShape(e.to_string()))?;
        collected.extend(batch);
        match page_step(page, next_page) {
            PageStep::Next(next) => page = next,
            PageStep::Truncated => {
                is_truncated = true;
                break;
            }
            PageStep::Done => break,
        }
    }
    Ok(Paged {
        items: collected,
        is_truncated,
    })
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
    let retry_after = failure::retry_after_of(res.headers());
    let text = res.text().await?;
    if !status.is_success() {
        return Err(http_failure(status.as_u16(), retry_after, text));
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
    let retry_after = failure::retry_after_of(res.headers());
    let text = res.text().await?;
    if !status.is_success() {
        return Err(http_failure(status.as_u16(), retry_after, text));
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
    integration_credentials::read_for_binding(PROVIDER, workspace_id, project_id, cache.0)?
        .ok_or_else(|| GitlabError::NoToken(workspace_id.to_string()))
}

fn read_bound_token(
    workspace_id: &str,
    project_id: Option<&str>,
    host: &str,
    cache: &GitlabTokenCache,
) -> Result<String, GitlabError> {
    integration_credentials::require_bound(
        PROVIDER,
        workspace_id,
        project_id,
        &[BoundValue {
            key: "host",
            supplied: host,
        }],
    )?;
    read_token(workspace_id, project_id, cache)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitlabUser {
    pub id: i64,
    pub username: String,
    pub name: String,
    #[serde(alias = "avatar_url", default)]
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
#[serde(rename_all = "camelCase")]
pub struct GitlabIssue {
    pub id: i64,
    pub iid: i64,
    #[serde(alias = "project_id")]
    pub project_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    #[serde(alias = "web_url")]
    pub web_url: String,
    pub references: GitlabReferences,
    #[serde(alias = "updated_at")]
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
        integration_credentials::secret_to_verify(PROVIDER, &credential_id, token, cache.0)?;
    get_json(&host, &token, "/user").await
}

#[tauri::command]
pub async fn gitlab_connect(
    credential_id: String,
    token: Option<String>,
    cache: State<'_, GitlabTokenCache>,
) -> Result<(), GitlabError> {
    let token =
        integration_credentials::secret_to_verify(PROVIDER, &credential_id, token, cache.0)?;
    integration_credentials::store_secret(&credential_id, &token, cache.0)?;
    Ok(())
}

#[tauri::command]
pub async fn gitlab_fetch_assigned_issues(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Vec<GitlabIssue>, GitlabError> {
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
#[serde(rename_all = "camelCase")]
pub struct GitlabMrAuthor {
    #[serde(default)]
    pub id: Option<i64>,
    pub username: String,
    pub name: String,
    #[serde(alias = "avatar_url", default)]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitlabMergeRequestFields {
    pub id: i64,
    pub iid: i64,
    #[serde(alias = "project_id")]
    pub project_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    #[serde(alias = "web_url")]
    pub web_url: String,
    #[serde(alias = "source_branch")]
    pub source_branch: String,
    #[serde(alias = "target_branch")]
    pub target_branch: String,
    #[serde(default)]
    pub draft: bool,
    #[serde(
        rename = "isMergeWhenPipelineSucceeds",
        alias = "merge_when_pipeline_succeeds",
        default
    )]
    pub merge_when_pipeline_succeeds: bool,
    #[serde(alias = "has_conflicts", default)]
    pub has_conflicts: bool,
    #[serde(alias = "merge_status", default)]
    pub merge_status: Option<String>,
    #[serde(alias = "updated_at", default)]
    pub updated_at: String,
    #[serde(default)]
    pub sha: Option<String>,
    #[serde(alias = "merged_at", default)]
    pub merged_at: Option<String>,
    #[serde(default)]
    pub author: Option<GitlabMrAuthor>,
    #[serde(default)]
    pub reviewers: Option<Vec<GitlabMrAuthor>>,
    #[serde(alias = "created_at", default)]
    pub created_at: Option<String>,
    #[serde(alias = "detailed_merge_status", default)]
    pub detailed_merge_status: Option<String>,
    #[serde(alias = "head_pipeline", default)]
    pub head_pipeline: Option<GitlabHeadPipeline>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitlabMergeRequest {
    #[serde(flatten)]
    fields: GitlabMergeRequestFields,
    pub request_state: RequestState,
}

impl std::ops::Deref for GitlabMergeRequest {
    type Target = GitlabMergeRequestFields;

    fn deref(&self) -> &Self::Target {
        &self.fields
    }
}

impl<'de> Deserialize<'de> for GitlabMergeRequest {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let fields = GitlabMergeRequestFields::deserialize(deserializer)?;
        let request_state = request_state_of(&fields.state, fields.draft);
        Ok(GitlabMergeRequest {
            fields,
            request_state,
        })
    }
}

fn request_state_of(host_state: &str, is_draft: bool) -> RequestState {
    match host_state {
        "opened" if is_draft => RequestState::Draft,
        "opened" | "locked" => RequestState::Open,
        "merged" => RequestState::Merged,
        "closed" => RequestState::Closed,
        _ => RequestState::Unknown,
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitlabHeadPipeline {
    pub id: i64,
    pub status: String,
    #[serde(alias = "web_url", default)]
    pub web_url: Option<String>,
}

const ASSIGNED_MRS_PATH: &str =
    "/merge_requests?scope=assigned_to_me&state=opened&order_by=updated_at";

#[tauri::command]
pub async fn gitlab_fetch_assigned_mrs(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Vec<GitlabMergeRequest>, GitlabError> {
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
    get_json_paged(&host, &token, ASSIGNED_MRS_PATH).await
}

pub async fn gitlab_fetch_project_mrs(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    cache: State<'_, GitlabTokenCache>,
) -> Result<Vec<GitlabMergeRequest>, GitlabError> {
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
    let encoded = encode_project_path(&project_path);
    let branch = percent_encode(&source_branch);
    let path =
        format!("/projects/{encoded}/merge_requests?source_branch={branch}&{MR_FOR_BRANCH_QUERY}");
    let mrs: Vec<GitlabMergeRequest> = get_json(&host, &token, &path).await?;
    Ok(pick_request_for_branch(mrs))
}

const MR_FOR_BRANCH_QUERY: &str = "state=all&order_by=updated_at&per_page=20";

fn is_open(mr: &GitlabMergeRequest) -> bool {
    matches!(mr.request_state, RequestState::Open | RequestState::Draft)
}

fn pick_request_for_branch(mrs: Vec<GitlabMergeRequest>) -> Option<GitlabMergeRequest> {
    mrs.into_iter()
        .max_by_key(|mr| (is_open(mr), mr.updated_at.clone()))
}

const DRAFT_PREFIXES: [&str; 3] = ["draft:", "[draft]", "(draft)"];

fn draft_title(title: &str, is_draft: bool) -> String {
    if !is_draft {
        return title.to_string();
    }
    let trimmed = title.trim();
    let lowered = trimmed.to_lowercase();
    let rest = DRAFT_PREFIXES
        .iter()
        .find(|prefix| lowered.starts_with(**prefix))
        .map_or(trimmed, |prefix| trimmed[prefix.len()..].trim_start());
    format!("Draft: {rest}")
}

fn create_mr_body(
    source_branch: &str,
    target_branch: &str,
    title: &str,
    description: &str,
    should_remove_source_branch: Option<bool>,
) -> serde_json::Value {
    let mut body = serde_json::json!({
        "source_branch": source_branch,
        "target_branch": target_branch,
        "title": title,
        "description": description,
    });
    if let (Some(flag), Some(fields)) = (should_remove_source_branch, body.as_object_mut()) {
        fields.insert(
            "remove_source_branch".to_string(),
            serde_json::Value::Bool(flag),
        );
    }
    body
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
    should_remove_source_branch: Option<bool>,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabMergeRequest, GitlabError> {
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
    let encoded = encode_project_path(&project_path);
    let body = create_mr_body(
        &source_branch,
        &target_branch,
        &draft_title(&title, draft),
        &description,
        should_remove_source_branch,
    );
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
    #[serde(default)]
    pub renamed_file: bool,
}

#[derive(Debug, Deserialize)]
pub struct GitlabMrChanges {
    #[serde(default)]
    pub changes: Vec<GitlabMrChange>,
}

fn is_rename(change: &GitlabMrChange) -> bool {
    !change.new_file
        && !change.deleted_file
        && (change.renamed_file || change.old_path != change.new_path)
}

fn assemble_mr_diff(changes: &[GitlabMrChange]) -> String {
    let mut out = String::new();
    for change in changes {
        out.push_str(&format!(
            "diff --git a/{} b/{}\n",
            change.old_path, change.new_path
        ));
        if is_rename(change) {
            if change.diff.is_empty() {
                out.push_str("similarity index 100%\n");
            }
            out.push_str(&format!("rename from {}\n", change.old_path));
            out.push_str(&format!("rename to {}\n", change.new_path));
            if change.diff.is_empty() {
                continue;
            }
        }
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
#[serde(rename_all = "camelCase")]
pub struct GitlabDiffRefs {
    #[serde(alias = "base_sha")]
    pub base_sha: String,
    #[serde(alias = "head_sha")]
    pub head_sha: String,
    #[serde(alias = "start_sha")]
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
#[serde(rename_all = "camelCase")]
pub struct GitlabNotePosition {
    #[serde(alias = "new_path", default)]
    pub new_path: Option<String>,
    #[serde(alias = "old_path", default)]
    pub old_path: Option<String>,
    #[serde(alias = "new_line", default)]
    pub new_line: Option<i64>,
    #[serde(alias = "old_line", default)]
    pub old_line: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitlabMrNote {
    pub id: i64,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub system: bool,
    #[serde(default)]
    pub author: Option<GitlabMrAuthor>,
    #[serde(alias = "created_at", default)]
    pub created_at: String,
    #[serde(default)]
    pub resolvable: bool,
    #[serde(default)]
    pub resolved: Option<bool>,
    #[serde(default)]
    pub position: Option<GitlabNotePosition>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitlabMrDiscussion {
    pub id: String,
    #[serde(alias = "individual_note", default)]
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
#[serde(rename_all = "camelCase")]
pub struct GitlabIssueNote {
    pub id: i64,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub system: bool,
    #[serde(default)]
    pub author: Option<GitlabMrAuthor>,
    #[serde(alias = "created_at", default)]
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
#[serde(rename_all = "camelCase")]
pub struct GitlabMrApprovalState {
    #[serde(alias = "approvals_required", default)]
    pub approvals_required: i64,
    #[serde(alias = "approvals_left", default)]
    pub approvals_left: i64,
    #[serde(alias = "user_has_approved", default)]
    pub user_has_approved: bool,
    #[serde(alias = "user_can_approve", default)]
    pub user_can_approve: bool,
    #[serde(alias = "approved_by", default)]
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
    let encoded = encode_project_path(&project_path);
    let payload = mr_update_payload(state_event.as_deref(), title.as_deref(), None, None);
    if is_empty_payload(&payload) {
        return Err(GitlabError::InvalidInput(
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
    let encoded = encode_project_path(&project_path);
    let payload = mr_update_payload(
        None,
        title.as_deref(),
        description.as_deref(),
        reviewer_ids.as_deref(),
    );
    if is_empty_payload(&payload) {
        return Err(GitlabError::InvalidInput(
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
        Some(other) => Err(GitlabError::InvalidInput(format!(
            "unknown merge method: {other}"
        ))),
    }
}

fn pinned_head(expected_head_sha: Option<&str>) -> Option<&str> {
    expected_head_sha
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn merge_body(strategy: MergeStrategy, expected_head_sha: Option<&str>) -> serde_json::Value {
    let mut body = match strategy {
        MergeStrategy::Squash => serde_json::json!({ "squash": true }),
        MergeStrategy::Merge | MergeStrategy::Rebase => serde_json::json!({ "squash": false }),
    };
    if let (Some(sha), Some(fields)) = (pinned_head(expected_head_sha), body.as_object_mut()) {
        fields.insert(
            "sha".to_string(),
            serde_json::Value::String(sha.to_string()),
        );
    }
    body
}

fn merge_failure(error: GitlabError, expected_head_sha: Option<&str>) -> GitlabError {
    match error {
        GitlabError::Http { status: 409, body } if pinned_head(expected_head_sha).is_some() => {
            GitlabError::StaleHead(body)
        }
        other => other,
    }
}

fn rebase_blocker(
    project_merge_method: &str,
    detailed_merge_status: Option<&str>,
) -> Option<&'static str> {
    if project_merge_method != "ff" {
        return Some("this project does not merge by fast-forward");
    }
    if detailed_merge_status == Some("need_rebase") {
        return Some("rebase the merge request first");
    }
    None
}

#[tauri::command]
pub async fn gitlab_cancel_auto_merge(
    workspace_id: String,
    project_id: Option<String>,
    host: String,
    project_path: String,
    mr_iid: i64,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabMergeRequest, GitlabError> {
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
    let encoded = encode_project_path(&project_path);
    send_json(
        reqwest::Method::POST,
        &host,
        &token,
        &format!("/projects/{encoded}/merge_requests/{mr_iid}/cancel_merge_when_pipeline_succeeds"),
        &serde_json::json!({}),
    )
    .await
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
    expected_head_sha: Option<String>,
    cache: State<'_, GitlabTokenCache>,
) -> Result<GitlabMergeRequest, GitlabError> {
    let strategy = merge_strategy(method.as_deref())?;
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
            return Err(GitlabError::InvalidInput(reason.to_string()));
        }
    }
    send_json(
        reqwest::Method::PUT,
        &host,
        &token,
        &format!("{}/merge", mr_path(&encoded, mr_iid)),
        &merge_body(strategy, expected_head_sha.as_deref()),
    )
    .await
    .map_err(|error| merge_failure(error, expected_head_sha.as_deref()))
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitlabMergeSettings {
    #[serde(alias = "merge_method", default = "default_merge_method")]
    pub merge_method: String,
    #[serde(alias = "squash_option", default)]
    pub squash_option: Option<String>,
    #[serde(alias = "only_allow_merge_if_pipeline_succeeds", default)]
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
    let encoded = encode_project_path(&project_path);
    get_json(&host, &token, &project_users_path(&encoded, &query)).await
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitlabPipeline {
    pub id: i64,
    pub status: String,
    #[serde(alias = "web_url", default)]
    pub web_url: Option<String>,
    #[serde(default)]
    pub sha: Option<String>,
    #[serde(alias = "project_id", default)]
    pub project_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitlabJob {
    pub id: i64,
    pub name: String,
    #[serde(default)]
    pub stage: Option<String>,
    pub status: String,
    #[serde(alias = "web_url", default)]
    pub web_url: Option<String>,
    #[serde(alias = "allow_failure", default)]
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

fn pipeline_owner(pipeline: &GitlabPipeline, encoded_project: &str) -> String {
    pipeline
        .project_id
        .map_or_else(|| encoded_project.to_string(), |id| id.to_string())
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
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
        &pipeline_jobs_path(&pipeline_owner(&pipeline, &encoded), pipeline.id),
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
#[serde(rename_all = "camelCase")]
pub struct GitlabMrCommit {
    pub id: String,
    #[serde(alias = "short_id", default)]
    pub short_id: String,
    pub title: String,
    #[serde(alias = "author_name", default)]
    pub author_name: Option<String>,
    #[serde(alias = "committed_date", default)]
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
    let token = read_bound_token(&workspace_id, project_id.as_deref(), &host, &cache)?;
    let encoded = encode_project_path(&project_path);
    get_json_paged(&host, &token, &mr_commits_path(&encoded, mr_iid)).await
}

#[cfg(test)]
mod wire_shape;

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
    fn api_base_allows_plain_http_only_on_localhost() {
        assert_eq!(
            api_base("http://localhost:8080").unwrap(),
            "http://localhost:8080/api/v4"
        );
        assert_eq!(
            api_base("http://127.0.0.1:8080/").unwrap(),
            "http://127.0.0.1:8080/api/v4"
        );
        for refused in [
            "http://gitlab.internal:8080",
            "http://192.168.1.20",
            "http://gitlab.example.com",
        ] {
            let error = api_base(refused).unwrap_err();
            assert!(
                matches!(&error, GitlabError::InsecureHost(message) if message.contains("https")),
                "{refused}"
            );
        }
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
        assert!(matches!(err, GitlabError::InvalidInput(_)));
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
    fn merge_request_reads_merge_when_pipeline_succeeds() {
        let snake = r#"{
            "id": 9, "iid": 2, "project_id": 3, "title": "t", "description": null,
            "state": "opened", "web_url": "https://gitlab.com/acme/web/-/merge_requests/2",
            "source_branch": "a", "target_branch": "main",
            "merge_when_pipeline_succeeds": true
        }"#;
        let mr: GitlabMergeRequest = serde_json::from_str(snake).unwrap();
        assert!(mr.merge_when_pipeline_succeeds);
        let plain = snake.replace("\"merge_when_pipeline_succeeds\": true", "\"draft\": false");
        let mr: GitlabMergeRequest = serde_json::from_str(&plain).unwrap();
        assert!(!mr.merge_when_pipeline_succeeds);
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
        let author = mr.author.as_ref().unwrap();
        assert_eq!(author.username, "alice");
        assert_eq!(
            author.avatar_url.as_deref(),
            Some("https://gitlab.com/a.png")
        );
        let reviewers = mr.reviewers.as_ref().unwrap();
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
        let reviewers = mr.reviewers.as_ref().unwrap();
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
                renamed_file: false,
            },
            GitlabMrChange {
                old_path: "src/b.ts".into(),
                new_path: "src/b.ts".into(),
                diff: "@@ -0,0 +1 @@\n+created".into(),
                new_file: true,
                deleted_file: false,
                renamed_file: false,
            },
            GitlabMrChange {
                old_path: "src/c.ts".into(),
                new_path: "src/c.ts".into(),
                diff: "@@ -1 +0,0 @@\n-gone\n".into(),
                new_file: false,
                deleted_file: true,
                renamed_file: false,
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
            matches!(error, GitlabError::InvalidInput(message) if message.contains("fast-forward"))
        );
    }

    #[test]
    fn merge_body_asks_for_squash_only_for_the_squash_method() {
        assert_eq!(
            merge_body(MergeStrategy::Merge, None),
            serde_json::json!({ "squash": false })
        );
        assert_eq!(
            merge_body(MergeStrategy::Squash, None),
            serde_json::json!({ "squash": true })
        );
        assert_eq!(
            merge_body(MergeStrategy::Rebase, None),
            serde_json::json!({ "squash": false })
        );
    }

    #[test]
    fn merge_body_pins_the_head_the_user_reviewed() {
        assert_eq!(
            merge_body(MergeStrategy::Squash, Some("6c20f48a9e1")),
            serde_json::json!({ "squash": true, "sha": "6c20f48a9e1" })
        );
        assert_eq!(
            merge_body(MergeStrategy::Merge, Some("  6c20f48a9e1 ")),
            serde_json::json!({ "squash": false, "sha": "6c20f48a9e1" })
        );
        assert_eq!(
            merge_body(MergeStrategy::Merge, Some("  ")),
            serde_json::json!({ "squash": false })
        );
    }

    #[test]
    fn a_moved_head_reads_as_stale_head_only_when_the_merge_was_pinned() {
        let conflict = || GitlabError::Http {
            status: 409,
            body: "SHA does not match HEAD of source branch".to_string(),
        };
        assert!(matches!(
            merge_failure(conflict(), Some("6c20f48a9e1")),
            GitlabError::StaleHead(body) if body.contains("does not match HEAD")
        ));
        assert!(matches!(
            merge_failure(conflict(), None),
            GitlabError::Http { status: 409, .. }
        ));
        assert!(matches!(
            merge_failure(
                GitlabError::Http {
                    status: 405,
                    body: "branch cannot be merged".to_string()
                },
                Some("6c20f48a9e1")
            ),
            GitlabError::Http { status: 405, .. }
        ));
    }

    #[test]
    fn a_stale_head_reaches_the_frontend_under_its_own_kind() {
        let value = serde_json::to_value(GitlabError::StaleHead("moved".to_string())).unwrap();
        assert_eq!(value["kind"], "stale_head");
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
            Some("this project does not merge by fast-forward")
        );
        assert_eq!(rebase_blocker("ff", Some("mergeable")), None);
        assert_eq!(
            rebase_blocker("rebase_merge", None),
            Some("this project does not merge by fast-forward")
        );
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
    fn the_jobs_of_a_fork_pipeline_are_asked_of_the_project_that_owns_it() {
        let encoded = encode_project_path("harborline/payments-api");
        let fork: GitlabPipeline = serde_json::from_str(
            r#"{"id":9001,"status":"success","project_id":77,"sha":"a41c9e2b7d3f"}"#,
        )
        .unwrap();
        let same: GitlabPipeline =
            serde_json::from_str(r#"{"id":9002,"status":"success"}"#).unwrap();

        assert_eq!(
            pipeline_jobs_path(&pipeline_owner(&fork, &encoded), fork.id),
            "/projects/77/pipelines/9001/jobs"
        );
        assert_eq!(
            pipeline_jobs_path(&pipeline_owner(&same, &encoded), same.id),
            "/projects/harborline%2Fpayments-api/pipelines/9002/jobs"
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
        let pipeline = mr.head_pipeline.as_ref().unwrap();
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
        assert_eq!(GitlabError::StaleHead("x".into()).kind(), "stale_head");
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

    #[test]
    fn every_http_status_reads_as_one_failure_kind_on_the_wire() {
        for (status, kind) in [
            (0u16, "network"),
            (401, "bad_credentials"),
            (403, "denied"),
            (404, "not_found"),
            (409, "failed"),
            (422, "failed"),
            (500, "failed"),
            (502, "failed"),
        ] {
            let wire = serde_json::to_value(http_failure(status, None, "body".into())).unwrap();
            assert_eq!(wire["failureKind"], kind, "status {status}");
            assert_eq!(wire["status"], status, "status {status}");
            assert_eq!(wire["detail"], "body");
        }
        let limited = serde_json::to_value(http_failure(429, Some(9), "slow".into())).unwrap();
        assert_eq!(limited["kind"], "rate_limited");
        assert_eq!(limited["failureKind"], "rate_limited");
        assert_eq!(limited["retryAfterSeconds"], 9);
    }

    #[test]
    fn local_failures_carry_a_failure_kind_and_input_errors_carry_none() {
        let timeout = serde_json::to_value(GitlabError::Timeout("deadline".into())).unwrap();
        assert_eq!(timeout["failureKind"], "timeout");
        let no_token = serde_json::to_value(GitlabError::NoToken("ws".into())).unwrap();
        assert_eq!(no_token["failureKind"], "bad_credentials");
        let input = serde_json::to_value(GitlabError::InvalidInput("x".into())).unwrap();
        assert_eq!(input["kind"], "invalid_input");
        assert!(input.get("failureKind").is_none());
        let insecure = api_base("http://gitlab.internal:8080").unwrap_err();
        let wire = serde_json::to_value(insecure).unwrap();
        assert_eq!(wire["kind"], "insecure_host");
        assert_eq!(wire["failureKind"], "failed");
        assert!(wire["detail"].as_str().unwrap().contains("use https"));
    }

    #[tokio::test]
    async fn a_rate_limited_read_is_retried_and_keeps_the_retry_hint() {
        use crate::integrations::http::test_support::{
            http_response, serve_sequence, within_bound,
        };
        use crate::integrations::http::MAX_ATTEMPTS;
        let answer = http_response(
            "429 Too Many Requests",
            &[("Retry-After", "0")],
            "slow down",
        );
        let (base, server) = serve_sequence(vec![answer; MAX_ATTEMPTS as usize]).await;
        let error = within_bound(get_json::<serde_json::Value>(&base, "token", "/user"))
            .await
            .unwrap_err();
        assert!(matches!(
            error,
            GitlabError::RateLimited { retry_after_seconds: Some(0), ref body } if body == "slow down"
        ));
        assert_eq!(server.await.unwrap().len(), MAX_ATTEMPTS as usize);
    }

    #[test]
    fn every_host_state_maps_to_one_request_state() {
        for (host_state, is_draft, expected) in [
            ("opened", false, RequestState::Open),
            ("opened", true, RequestState::Draft),
            ("locked", false, RequestState::Open),
            ("merged", false, RequestState::Merged),
            ("merged", true, RequestState::Merged),
            ("closed", false, RequestState::Closed),
            ("closed", true, RequestState::Closed),
        ] {
            assert_eq!(
                request_state_of(host_state, is_draft),
                expected,
                "{host_state} draft={is_draft}"
            );
        }
    }

    #[test]
    fn a_state_the_adapter_does_not_know_stays_visible_as_unknown() {
        assert_eq!(request_state_of("", false), RequestState::Unknown);
        assert_eq!(request_state_of("all", false), RequestState::Unknown);
        assert_eq!(request_state_of("Opened", false), RequestState::Unknown);
    }

    #[test]
    fn a_merge_request_serializes_its_request_state_beside_the_raw_host_state() {
        let raw = r#"{
            "id": 1, "iid": 4, "project_id": 3, "title": "Ledger change",
            "description": null, "state": "opened", "web_url": "https://gitlab.com/acme/web/-/merge_requests/4",
            "source_branch": "ak/ledger", "target_branch": "main", "draft": true,
            "updated_at": "2026-09-01T00:00:00Z"
        }"#;
        let mr: GitlabMergeRequest = serde_json::from_str(raw).unwrap();
        assert_eq!(mr.request_state, RequestState::Draft);
        assert_eq!(mr.iid, 4);
        let wire = serde_json::to_value(&mr).unwrap();
        assert_eq!(wire["requestState"], "draft");
        assert_eq!(wire["state"], "opened");
        assert_eq!(wire["iid"], 4);
        assert_eq!(
            wire["webUrl"],
            "https://gitlab.com/acme/web/-/merge_requests/4"
        );
    }

    #[test]
    fn a_merge_request_in_a_state_nobody_mapped_reaches_the_app_as_unknown() {
        let raw = r#"{
            "id": 1, "iid": 4, "project_id": 3, "title": "t", "description": null,
            "state": "archived", "web_url": "u", "source_branch": "a", "target_branch": "b"
        }"#;
        let mr: GitlabMergeRequest = serde_json::from_str(raw).unwrap();
        assert_eq!(mr.request_state, RequestState::Unknown);
        let wire = serde_json::to_value(&mr).unwrap();
        assert_eq!(wire["requestState"], "unknown");
        assert_eq!(wire["state"], "archived");
    }

    #[test]
    fn the_page_cap_marks_a_list_that_has_more_as_truncated() {
        assert_eq!(page_step(1, Some(2)), PageStep::Next(2));
        assert_eq!(
            page_step(MAX_PAGES - 1, Some(MAX_PAGES)),
            PageStep::Next(MAX_PAGES)
        );
        assert_eq!(
            page_step(MAX_PAGES, Some(MAX_PAGES + 1)),
            PageStep::Truncated
        );
        assert_eq!(page_step(MAX_PAGES, None), PageStep::Done);
        assert_eq!(page_step(3, None), PageStep::Done);
        assert_eq!(page_step(3, Some(3)), PageStep::Done);
        assert_eq!(page_step(3, Some(2)), PageStep::Done);
    }

    #[tokio::test]
    async fn a_list_cut_at_the_cap_reaches_the_caller_marked_truncated() {
        use crate::integrations::http::test_support::{
            http_response, serve_sequence, within_bound,
        };
        let pages: Vec<String> = (1..=MAX_PAGES)
            .map(|page| {
                http_response(
                    "200 OK",
                    &[("x-next-page", &(page + 1).to_string())],
                    &format!("[{page}]"),
                )
            })
            .collect();
        let (base, server) = serve_sequence(pages).await;
        let paged = within_bound(get_json_paged_marked::<u32>(&base, "token", "/things")).await;
        let paged = paged.unwrap();
        assert!(paged.is_truncated);
        assert_eq!(paged.items.len() as u32, MAX_PAGES);
        assert_eq!(server.await.unwrap().len() as u32, MAX_PAGES);
    }

    #[tokio::test]
    async fn a_list_that_ends_before_the_cap_is_complete() {
        use crate::integrations::http::test_support::{
            http_response, serve_sequence, within_bound,
        };
        let (base, _server) = serve_sequence(vec![
            http_response("200 OK", &[("x-next-page", "2")], "[1]"),
            http_response("200 OK", &[("x-next-page", "")], "[2]"),
        ])
        .await;
        let paged = within_bound(get_json_paged_marked::<u32>(&base, "token", "/things"))
            .await
            .unwrap();
        assert!(!paged.is_truncated);
        assert_eq!(paged.items, vec![1, 2]);
    }
    #[test]
    fn the_assigned_request_list_is_paged_not_cut_at_fifty() {
        assert!(!ASSIGNED_MRS_PATH.contains("per_page"));
        assert!(ASSIGNED_MRS_PATH.contains('?'));
    }

    #[test]
    fn a_draft_request_gets_one_draft_prefix_even_when_the_title_has_one() {
        assert_eq!(draft_title("Ledger change", true), "Draft: Ledger change");
        assert_eq!(
            draft_title("Draft: Ledger change", true),
            "Draft: Ledger change"
        );
        assert_eq!(
            draft_title("draft: Ledger change", true),
            "Draft: Ledger change"
        );
        assert_eq!(
            draft_title("[Draft] Ledger change", true),
            "Draft: Ledger change"
        );
        assert_eq!(
            draft_title("(Draft) Ledger change", true),
            "Draft: Ledger change"
        );
        assert_eq!(
            draft_title("  Draft:   Ledger change ", true),
            "Draft: Ledger change"
        );
        assert_eq!(
            draft_title("Draft: Draft: twice", true),
            "Draft: Draft: twice"
        );
    }

    #[test]
    fn a_ready_request_keeps_the_title_it_was_given() {
        assert_eq!(draft_title("Ledger change", false), "Ledger change");
        assert_eq!(
            draft_title("Draft: kept as typed", false),
            "Draft: kept as typed"
        );
    }

    #[test]
    fn the_create_body_leaves_the_branch_cleanup_to_the_project_unless_told() {
        let body = create_mr_body("ak/ledger", "main", "Ledger change", "why", None);
        assert!(body.get("remove_source_branch").is_none());
        let removing = create_mr_body("ak/ledger", "main", "Ledger change", "why", Some(true));
        assert_eq!(removing["remove_source_branch"], true);
        let keeping = create_mr_body("ak/ledger", "main", "Ledger change", "why", Some(false));
        assert_eq!(keeping["remove_source_branch"], false);
        assert_eq!(keeping["source_branch"], "ak/ledger");
        assert_eq!(keeping["target_branch"], "main");
    }

    fn found(iid: i64, state: &str, updated_at: &str) -> GitlabMergeRequest {
        let raw = format!(
            r#"{{"id": {iid}, "iid": {iid}, "project_id": 3, "title": "t", "description": null,
                "state": "{state}", "web_url": "u", "source_branch": "ak/x", "target_branch": "main",
                "updated_at": "{updated_at}"}}"#
        );
        serde_json::from_str(&raw).unwrap()
    }

    #[test]
    fn the_request_for_a_branch_prefers_an_open_one_then_the_newest() {
        let merged_new = found(3, "merged", "2026-09-03T00:00:00Z");
        let open_old = found(2, "opened", "2026-09-01T00:00:00Z");
        let closed_mid = found(1, "closed", "2026-09-02T00:00:00Z");
        let picked = pick_request_for_branch(vec![merged_new, open_old, closed_mid]).unwrap();
        assert_eq!(picked.iid, 2);
    }

    #[test]
    fn with_no_open_request_the_newest_of_any_state_wins() {
        let merged_new = found(3, "merged", "2026-09-03T00:00:00Z");
        let closed_old = found(1, "closed", "2026-09-01T00:00:00Z");
        let picked = pick_request_for_branch(vec![closed_old, merged_new]).unwrap();
        assert_eq!(picked.iid, 3);
        assert!(pick_request_for_branch(Vec::new()).is_none());
    }

    #[test]
    fn two_open_requests_resolve_to_the_most_recently_updated() {
        let older = found(1, "opened", "2026-09-01T00:00:00Z");
        let newer = found(2, "opened", "2026-09-02T00:00:00Z");
        assert_eq!(pick_request_for_branch(vec![older, newer]).unwrap().iid, 2);
    }

    #[test]
    fn the_branch_lookup_asks_for_every_state() {
        assert!(MR_FOR_BRANCH_QUERY.contains("state=all"));
        assert!(MR_FOR_BRANCH_QUERY.contains("order_by=updated_at"));
        assert!(
            !MR_FOR_BRANCH_QUERY.contains("per_page=1&")
                && !MR_FOR_BRANCH_QUERY.ends_with("per_page=1")
        );
    }

    fn change(old_path: &str, new_path: &str, diff: &str) -> GitlabMrChange {
        GitlabMrChange {
            old_path: old_path.to_string(),
            new_path: new_path.to_string(),
            diff: diff.to_string(),
            new_file: false,
            deleted_file: false,
            renamed_file: old_path != new_path,
        }
    }

    #[test]
    fn a_pure_rename_names_both_paths_and_says_nothing_changed() {
        let out = assemble_mr_diff(&[change("src/old.ts", "src/new.ts", "")]);
        assert_eq!(
            out,
            "diff --git a/src/old.ts b/src/new.ts\nsimilarity index 100%\nrename from src/old.ts\nrename to src/new.ts\n"
        );
    }

    #[test]
    fn a_rename_with_edits_keeps_its_hunks_after_the_rename_headers() {
        let diff = "@@ -1 +1 @@\n-a\n+b\n";
        let out = assemble_mr_diff(&[change("src/old.ts", "src/new.ts", diff)]);
        assert_eq!(
            out,
            "diff --git a/src/old.ts b/src/new.ts\nrename from src/old.ts\nrename to src/new.ts\n--- a/src/old.ts\n+++ b/src/new.ts\n@@ -1 +1 @@\n-a\n+b\n"
        );
    }

    #[test]
    fn a_plain_edit_a_new_file_and_a_deleted_file_keep_their_headers() {
        let edit = assemble_mr_diff(&[change("a.ts", "a.ts", "@@ -1 +1 @@\n-a\n+b\n")]);
        assert_eq!(
            edit,
            "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-a\n+b\n"
        );
        let mut added = change("n.ts", "n.ts", "@@ -0,0 +1 @@\n+x\n");
        added.new_file = true;
        assert!(assemble_mr_diff(&[added]).contains("--- /dev/null\n+++ b/n.ts\n"));
        let mut removed = change("d.ts", "d.ts", "@@ -1 +0,0 @@\n-x\n");
        removed.deleted_file = true;
        assert!(assemble_mr_diff(&[removed]).contains("--- a/d.ts\n+++ /dev/null\n"));
    }

    #[test]
    fn the_changes_payload_reads_the_rename_flag_and_survives_its_absence() {
        let with_flag: GitlabMrChange = serde_json::from_str(
            r#"{"old_path":"a","new_path":"b","diff":"","renamed_file":true}"#,
        )
        .unwrap();
        assert!(with_flag.renamed_file);
        let without: GitlabMrChange =
            serde_json::from_str(r#"{"old_path":"a","new_path":"a","diff":""}"#).unwrap();
        assert!(!without.renamed_file);
    }
}
