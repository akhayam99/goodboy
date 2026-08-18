use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;
use thiserror::Error;

use crate::secrets;

pub struct BitbucketTokenCache(Mutex<HashMap<String, String>>);

impl BitbucketTokenCache {
    pub fn new() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(reqwest::Client::new)
}

fn credential_key(workspace_id: &str) -> String {
    format!("goodboy.workspace.{}.bitbucket", workspace_id)
}

const API_BASE: &str = "https://api.bitbucket.org/2.0";
const MAX_PAGES: u32 = 20;
const PAGE_LEN: u32 = 50;

const AUTH_HINT: &str = "bitbucket rejected the credentials. goodboy signs every call with http basic auth, your atlassian account email in the username slot and a secret in the password slot. that secret is either an atlassian api token or a legacy bitbucket app password. check which of the two you pasted, and that it grants the account, repository and pullrequest scopes";

#[derive(Debug, Error)]
pub enum BitbucketError {
    #[error("http error {status}: {body}")]
    Http { status: u16, body: String },
    #[error("authentication failed: {0}")]
    Auth(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("invalid response shape: {0}")]
    InvalidShape(String),
    #[error("no personal API key stored for workspace {0}")]
    NoToken(String),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
}

crate::util::impl_error_serialize!(BitbucketError);

impl BitbucketError {
    fn kind(&self) -> &'static str {
        match self {
            BitbucketError::Http { .. } => "http",
            BitbucketError::Auth(_) => "auth",
            BitbucketError::NotFound(_) => "not_found",
            BitbucketError::InvalidShape(_) => "shape",
            BitbucketError::NoToken(_) => "no_token",
            BitbucketError::Secret(_) => "secret",
        }
    }
}

impl From<reqwest::Error> for BitbucketError {
    fn from(e: reqwest::Error) -> Self {
        BitbucketError::Http {
            status: 0,
            body: e.to_string(),
        }
    }
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

fn error_message(body: &str) -> Option<String> {
    let parsed: Value = serde_json::from_str(body).ok()?;
    let error = parsed.get("error")?;
    let message = error
        .get("message")
        .and_then(|value| value.as_str())
        .map(str::to_string);
    let detail = error
        .get("detail")
        .and_then(|value| value.as_str())
        .map(str::to_string);
    match (message, detail) {
        (Some(message), Some(detail)) => Some(format!("{message}: {detail}")),
        (Some(message), None) => Some(message),
        (None, Some(detail)) => Some(detail),
        (None, None) => None,
    }
}

fn error_for_status(status: u16, body: String) -> BitbucketError {
    let detail = error_message(&body).unwrap_or_else(|| body.clone());
    match status {
        401 | 403 => BitbucketError::Auth(format!("{AUTH_HINT} ({detail})")),
        404 => BitbucketError::NotFound(detail),
        _ => BitbucketError::Http { status, body },
    }
}

struct Credentials<'a> {
    email: &'a str,
    token: &'a str,
}

fn repo_path(base: &str, workspace: &str, repo: &str) -> String {
    format!(
        "{}/repositories/{}/{}",
        base,
        percent_encode(workspace.trim().trim_matches('/')),
        percent_encode(repo.trim().trim_matches('/'))
    )
}

fn workspace_url(base: &str, workspace: &str) -> String {
    format!(
        "{}/workspaces/{}",
        base,
        percent_encode(workspace.trim().trim_matches('/'))
    )
}

fn current_user_url(base: &str) -> String {
    format!("{}/user", base)
}

fn pull_requests_path(base: &str, workspace: &str, repo: &str) -> String {
    format!("{}/pullrequests", repo_path(base, workspace, repo))
}

fn pull_request_path(base: &str, workspace: &str, repo: &str, id: u64) -> String {
    format!("{}/{}", pull_requests_path(base, workspace, repo), id)
}

fn pull_requests_url(base: &str, workspace: &str, repo: &str, state: Option<&str>) -> String {
    let selected = state
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("OPEN")
        .to_uppercase();
    format!(
        "{}?state={}&pagelen={}",
        pull_requests_path(base, workspace, repo),
        percent_encode(&selected),
        PAGE_LEN
    )
}

fn pull_requests_for_branch_url(base: &str, workspace: &str, repo: &str, branch: &str) -> String {
    let query = format!("source.branch.name=\"{}\"", branch.trim());
    format!(
        "{}?state=OPEN&pagelen={}&q={}",
        pull_requests_path(base, workspace, repo),
        PAGE_LEN,
        percent_encode(&query)
    )
}

fn pull_request_diff_url(base: &str, workspace: &str, repo: &str, id: u64) -> String {
    format!("{}/diff", pull_request_path(base, workspace, repo, id))
}

fn pull_request_comments_url(base: &str, workspace: &str, repo: &str, id: u64) -> String {
    format!(
        "{}/comments?pagelen={}",
        pull_request_path(base, workspace, repo, id),
        PAGE_LEN
    )
}

fn pull_request_statuses_url(base: &str, workspace: &str, repo: &str, id: u64) -> String {
    format!(
        "{}/statuses?pagelen={}",
        pull_request_path(base, workspace, repo, id),
        PAGE_LEN
    )
}

async fn get_json<T: serde::de::DeserializeOwned>(
    credentials: &Credentials<'_>,
    url: &str,
) -> Result<T, BitbucketError> {
    let res = http_client()
        .get(url)
        .basic_auth(credentials.email, Some(credentials.token))
        .header("Accept", "application/json")
        .send()
        .await?;
    let status = res.status();
    let body = res.text().await?;
    if !status.is_success() {
        return Err(error_for_status(status.as_u16(), body));
    }
    serde_json::from_str(&body).map_err(|e| BitbucketError::InvalidShape(e.to_string()))
}

fn reads_as_absent(status: u16) -> bool {
    status == 404
}

async fn get_json_optional<T: serde::de::DeserializeOwned>(
    credentials: &Credentials<'_>,
    url: &str,
) -> Result<Option<T>, BitbucketError> {
    let res = http_client()
        .get(url)
        .basic_auth(credentials.email, Some(credentials.token))
        .header("Accept", "application/json")
        .send()
        .await?;
    let status = res.status();
    let body = res.text().await?;
    if reads_as_absent(status.as_u16()) {
        return Ok(None);
    }
    if !status.is_success() {
        return Err(error_for_status(status.as_u16(), body));
    }
    serde_json::from_str(&body)
        .map(Some)
        .map_err(|e| BitbucketError::InvalidShape(e.to_string()))
}

async fn get_text(credentials: &Credentials<'_>, url: &str) -> Result<String, BitbucketError> {
    let res = http_client()
        .get(url)
        .basic_auth(credentials.email, Some(credentials.token))
        .header("Accept", "text/plain")
        .send()
        .await?;
    let status = res.status();
    let body = res.text().await?;
    if !status.is_success() {
        return Err(error_for_status(status.as_u16(), body));
    }
    Ok(body)
}

async fn send_json<T: serde::de::DeserializeOwned>(
    credentials: &Credentials<'_>,
    method: reqwest::Method,
    url: &str,
    body: Option<&Value>,
) -> Result<T, BitbucketError> {
    let mut request = http_client()
        .request(method, url)
        .basic_auth(credentials.email, Some(credentials.token))
        .header("Accept", "application/json");
    if let Some(payload) = body {
        request = request.json(payload);
    }
    let res = request.send().await?;
    let status = res.status();
    let text = res.text().await?;
    if !status.is_success() {
        return Err(error_for_status(status.as_u16(), text));
    }
    serde_json::from_str(&text).map_err(|e| BitbucketError::InvalidShape(e.to_string()))
}

async fn send_no_content(
    credentials: &Credentials<'_>,
    method: reqwest::Method,
    url: &str,
    body: Option<&Value>,
) -> Result<(), BitbucketError> {
    let mut request = http_client()
        .request(method, url)
        .basic_auth(credentials.email, Some(credentials.token))
        .header("Accept", "application/json");
    if let Some(payload) = body {
        request = request.json(payload);
    }
    let res = request.send().await?;
    let status = res.status();
    let text = res.text().await?;
    if !status.is_success() {
        return Err(error_for_status(status.as_u16(), text));
    }
    Ok(())
}

fn read_token(workspace_id: &str, cache: &BitbucketTokenCache) -> Result<String, BitbucketError> {
    if let Some(token) = cache.0.lock().unwrap().get(workspace_id) {
        return Ok(token.clone());
    }
    let token = secrets::read(&credential_key(workspace_id))?
        .ok_or_else(|| BitbucketError::NoToken(workspace_id.to_string()))?;
    cache
        .0
        .lock()
        .unwrap()
        .insert(workspace_id.to_string(), token.clone());
    Ok(token)
}

#[derive(Debug, Deserialize)]
struct BitbucketHref {
    #[serde(default)]
    href: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct BitbucketLinks {
    #[serde(default)]
    avatar: Option<BitbucketHref>,
    #[serde(default)]
    html: Option<BitbucketHref>,
}

fn href_of(link: Option<&BitbucketHref>) -> Option<String> {
    link.and_then(|value| value.href.clone())
        .filter(|value| !value.is_empty())
}

#[derive(Debug, Deserialize)]
struct BitbucketUserRaw {
    #[serde(default)]
    uuid: Option<String>,
    #[serde(default)]
    account_id: Option<String>,
    #[serde(default)]
    nickname: Option<String>,
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    links: Option<BitbucketLinks>,
}

#[derive(Debug, Serialize)]
pub struct BitbucketUser {
    pub uuid: String,
    #[serde(rename = "accountId")]
    pub account_id: Option<String>,
    pub nickname: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
}

fn map_user(raw: BitbucketUserRaw) -> BitbucketUser {
    let links = raw.links.unwrap_or_default();
    let display_name = raw.display_name.unwrap_or_default();
    let nickname = raw.nickname.unwrap_or_else(|| display_name.clone());
    BitbucketUser {
        uuid: raw.uuid.unwrap_or_default(),
        account_id: raw.account_id,
        nickname,
        display_name,
        avatar_url: href_of(links.avatar.as_ref()),
    }
}

#[derive(Debug, Deserialize)]
struct BitbucketWorkspaceRaw {
    #[serde(default)]
    uuid: Option<String>,
    #[serde(default)]
    slug: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    links: Option<BitbucketLinks>,
}

#[derive(Debug, Serialize)]
pub struct BitbucketWorkspace {
    pub uuid: String,
    pub slug: String,
    pub name: String,
    #[serde(rename = "webUrl")]
    pub web_url: Option<String>,
}

fn map_workspace(raw: BitbucketWorkspaceRaw) -> BitbucketWorkspace {
    let links = raw.links.unwrap_or_default();
    let slug = raw.slug.unwrap_or_default();
    let name = raw.name.unwrap_or_else(|| slug.clone());
    BitbucketWorkspace {
        uuid: raw.uuid.unwrap_or_default(),
        slug,
        name,
        web_url: href_of(links.html.as_ref()),
    }
}

#[derive(Debug, Serialize)]
pub struct BitbucketConnection {
    pub user: BitbucketUser,
    pub workspace: BitbucketWorkspace,
}

#[derive(Debug, Deserialize)]
struct BitbucketNamed {
    #[serde(default)]
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct BitbucketCommitRef {
    #[serde(default)]
    hash: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct BitbucketEndpointRaw {
    #[serde(default)]
    branch: Option<BitbucketNamed>,
    #[serde(default)]
    commit: Option<BitbucketCommitRef>,
}

#[derive(Debug, Deserialize)]
struct BitbucketParticipantRaw {
    #[serde(default)]
    user: Option<BitbucketUserRaw>,
    #[serde(default)]
    role: Option<String>,
    #[serde(default)]
    approved: bool,
    #[serde(default)]
    state: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BitbucketParticipant {
    pub user: Option<BitbucketUser>,
    pub role: String,
    pub approved: bool,
    pub state: Option<String>,
}

fn map_participant(raw: BitbucketParticipantRaw) -> BitbucketParticipant {
    BitbucketParticipant {
        user: raw.user.map(map_user),
        role: raw.role.unwrap_or_default(),
        approved: raw.approved,
        state: raw.state,
    }
}

#[derive(Debug, Deserialize)]
struct BitbucketPullRequestRaw {
    id: u64,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    state: Option<String>,
    #[serde(default)]
    created_on: Option<String>,
    #[serde(default)]
    updated_on: Option<String>,
    #[serde(default)]
    source: Option<BitbucketEndpointRaw>,
    #[serde(default)]
    destination: Option<BitbucketEndpointRaw>,
    #[serde(default)]
    author: Option<BitbucketUserRaw>,
    #[serde(default)]
    reviewers: Vec<BitbucketUserRaw>,
    #[serde(default)]
    participants: Vec<BitbucketParticipantRaw>,
    #[serde(default)]
    close_source_branch: bool,
    #[serde(default)]
    merge_commit: Option<BitbucketCommitRef>,
    #[serde(default)]
    comment_count: u64,
    #[serde(default)]
    task_count: u64,
    #[serde(default)]
    links: Option<BitbucketLinks>,
}

#[derive(Debug, Serialize)]
pub struct BitbucketPullRequest {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub state: String,
    #[serde(rename = "createdOn")]
    pub created_on: String,
    #[serde(rename = "updatedOn")]
    pub updated_on: String,
    #[serde(rename = "sourceBranch")]
    pub source_branch: String,
    #[serde(rename = "sourceCommit")]
    pub source_commit: Option<String>,
    #[serde(rename = "destinationBranch")]
    pub destination_branch: String,
    #[serde(rename = "destinationCommit")]
    pub destination_commit: Option<String>,
    pub author: Option<BitbucketUser>,
    pub reviewers: Vec<BitbucketUser>,
    pub participants: Vec<BitbucketParticipant>,
    #[serde(rename = "closeSourceBranch")]
    pub close_source_branch: bool,
    #[serde(rename = "mergeCommit")]
    pub merge_commit: Option<String>,
    #[serde(rename = "commentCount")]
    pub comment_count: u64,
    #[serde(rename = "taskCount")]
    pub task_count: u64,
    #[serde(rename = "webUrl")]
    pub web_url: Option<String>,
}

fn branch_name(endpoint: Option<&BitbucketEndpointRaw>) -> String {
    endpoint
        .and_then(|value| value.branch.as_ref())
        .and_then(|branch| branch.name.clone())
        .unwrap_or_default()
}

fn commit_hash(endpoint: Option<&BitbucketEndpointRaw>) -> Option<String> {
    endpoint
        .and_then(|value| value.commit.as_ref())
        .and_then(|commit| commit.hash.clone())
}

fn map_pull_request(raw: BitbucketPullRequestRaw) -> BitbucketPullRequest {
    let links = raw.links.unwrap_or_default();
    BitbucketPullRequest {
        id: raw.id,
        title: raw.title.unwrap_or_default(),
        description: raw.description.unwrap_or_default(),
        state: raw.state.unwrap_or_default(),
        created_on: raw.created_on.unwrap_or_default(),
        updated_on: raw.updated_on.unwrap_or_default(),
        source_branch: branch_name(raw.source.as_ref()),
        source_commit: commit_hash(raw.source.as_ref()),
        destination_branch: branch_name(raw.destination.as_ref()),
        destination_commit: commit_hash(raw.destination.as_ref()),
        author: raw.author.map(map_user),
        reviewers: raw.reviewers.into_iter().map(map_user).collect(),
        participants: raw.participants.into_iter().map(map_participant).collect(),
        close_source_branch: raw.close_source_branch,
        merge_commit: raw.merge_commit.and_then(|commit| commit.hash),
        comment_count: raw.comment_count,
        task_count: raw.task_count,
        web_url: href_of(links.html.as_ref()),
    }
}

#[derive(Debug, Deserialize)]
struct BitbucketContentRaw {
    #[serde(default)]
    raw: Option<String>,
}

#[derive(Debug, Deserialize)]
struct BitbucketParentRaw {
    #[serde(default)]
    id: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct BitbucketInlineRaw {
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    from: Option<u64>,
    #[serde(default)]
    to: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct BitbucketInline {
    pub path: String,
    pub from: Option<u64>,
    pub to: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct BitbucketCommentRaw {
    id: u64,
    #[serde(default)]
    content: Option<BitbucketContentRaw>,
    #[serde(default)]
    user: Option<BitbucketUserRaw>,
    #[serde(default)]
    created_on: Option<String>,
    #[serde(default)]
    updated_on: Option<String>,
    #[serde(default)]
    deleted: bool,
    #[serde(default)]
    parent: Option<BitbucketParentRaw>,
    #[serde(default)]
    inline: Option<BitbucketInlineRaw>,
    #[serde(default)]
    links: Option<BitbucketLinks>,
}

#[derive(Debug, Serialize)]
pub struct BitbucketComment {
    pub id: u64,
    pub body: String,
    pub user: Option<BitbucketUser>,
    #[serde(rename = "createdOn")]
    pub created_on: String,
    #[serde(rename = "updatedOn")]
    pub updated_on: String,
    pub deleted: bool,
    #[serde(rename = "parentId")]
    pub parent_id: Option<u64>,
    pub inline: Option<BitbucketInline>,
    #[serde(rename = "webUrl")]
    pub web_url: Option<String>,
}

fn map_comment(raw: BitbucketCommentRaw) -> BitbucketComment {
    let links = raw.links.unwrap_or_default();
    BitbucketComment {
        id: raw.id,
        body: raw
            .content
            .and_then(|content| content.raw)
            .unwrap_or_default(),
        user: raw.user.map(map_user),
        created_on: raw.created_on.unwrap_or_default(),
        updated_on: raw.updated_on.unwrap_or_default(),
        deleted: raw.deleted,
        parent_id: raw.parent.and_then(|parent| parent.id),
        inline: raw.inline.map(|inline| BitbucketInline {
            path: inline.path.unwrap_or_default(),
            from: inline.from,
            to: inline.to,
        }),
        web_url: href_of(links.html.as_ref()),
    }
}

#[derive(Debug, Deserialize)]
struct BitbucketStatusRaw {
    #[serde(default)]
    key: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    state: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    refname: Option<String>,
    #[serde(default)]
    created_on: Option<String>,
    #[serde(default)]
    updated_on: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BitbucketStatus {
    pub key: String,
    pub name: String,
    pub state: String,
    pub url: Option<String>,
    pub description: Option<String>,
    pub refname: Option<String>,
    #[serde(rename = "createdOn")]
    pub created_on: String,
    #[serde(rename = "updatedOn")]
    pub updated_on: String,
}

fn map_status(raw: BitbucketStatusRaw) -> BitbucketStatus {
    let key = raw.key.unwrap_or_default();
    BitbucketStatus {
        name: raw.name.unwrap_or_else(|| key.clone()),
        key,
        state: raw.state.unwrap_or_default(),
        url: raw.url,
        description: raw.description,
        refname: raw.refname,
        created_on: raw.created_on.unwrap_or_default(),
        updated_on: raw.updated_on.unwrap_or_default(),
    }
}

#[derive(Debug, Deserialize)]
struct BitbucketPage<T> {
    #[serde(default = "Vec::new")]
    values: Vec<T>,
    #[serde(default)]
    next: Option<String>,
}

struct Pager {
    seen: HashSet<String>,
    pages: u32,
}

impl Pager {
    fn new() -> Self {
        Self {
            seen: HashSet::new(),
            pages: 0,
        }
    }

    fn absorb<T>(
        &mut self,
        page: BitbucketPage<T>,
        sink: &mut Vec<T>,
    ) -> Result<Option<String>, BitbucketError> {
        sink.extend(page.values);
        self.pages += 1;
        if self.pages >= MAX_PAGES {
            return Ok(None);
        }
        let Some(next) = page.next.filter(|value| !value.trim().is_empty()) else {
            return Ok(None);
        };
        if !self.seen.insert(next.clone()) {
            return Err(BitbucketError::InvalidShape(format!(
                "bitbucket pagination looped on {next}"
            )));
        }
        Ok(Some(next))
    }
}

async fn get_json_paged<T: serde::de::DeserializeOwned>(
    credentials: &Credentials<'_>,
    first_url: &str,
) -> Result<Vec<T>, BitbucketError> {
    let mut pager = Pager::new();
    let mut collected: Vec<T> = Vec::new();
    let mut url = first_url.to_string();
    loop {
        let page: BitbucketPage<T> = get_json(credentials, &url).await?;
        let Some(next) = pager.absorb(page, &mut collected)? else {
            break;
        };
        url = next;
    }
    Ok(collected)
}

fn first_matching_branch(
    values: Vec<BitbucketPullRequestRaw>,
    branch: &str,
) -> Option<BitbucketPullRequestRaw> {
    let wanted = branch.trim();
    values
        .into_iter()
        .find(|raw| branch_name(raw.source.as_ref()) == wanted)
}

struct BitbucketWrite {
    method: reqwest::Method,
    url: String,
    body: Option<Value>,
}

fn approve_url(base: &str, workspace: &str, repo: &str, id: u64) -> String {
    format!("{}/approve", pull_request_path(base, workspace, repo, id))
}

fn request_changes_url(base: &str, workspace: &str, repo: &str, id: u64) -> String {
    format!(
        "{}/request-changes",
        pull_request_path(base, workspace, repo, id)
    )
}

fn approve_write(base: &str, workspace: &str, repo: &str, id: u64) -> BitbucketWrite {
    BitbucketWrite {
        method: reqwest::Method::POST,
        url: approve_url(base, workspace, repo, id),
        body: Some(Value::Object(serde_json::Map::new())),
    }
}

fn unapprove_write(base: &str, workspace: &str, repo: &str, id: u64) -> BitbucketWrite {
    BitbucketWrite {
        method: reqwest::Method::DELETE,
        url: approve_url(base, workspace, repo, id),
        body: None,
    }
}

fn request_changes_write(base: &str, workspace: &str, repo: &str, id: u64) -> BitbucketWrite {
    BitbucketWrite {
        method: reqwest::Method::POST,
        url: request_changes_url(base, workspace, repo, id),
        body: Some(Value::Object(serde_json::Map::new())),
    }
}

fn unrequest_changes_write(base: &str, workspace: &str, repo: &str, id: u64) -> BitbucketWrite {
    BitbucketWrite {
        method: reqwest::Method::DELETE,
        url: request_changes_url(base, workspace, repo, id),
        body: None,
    }
}

fn decline_write(base: &str, workspace: &str, repo: &str, id: u64) -> BitbucketWrite {
    BitbucketWrite {
        method: reqwest::Method::POST,
        url: format!("{}/decline", pull_request_path(base, workspace, repo, id)),
        body: Some(Value::Object(serde_json::Map::new())),
    }
}

fn merge_write(
    base: &str,
    workspace: &str,
    repo: &str,
    id: u64,
    close_source_branch: Option<bool>,
    message: Option<&str>,
) -> BitbucketWrite {
    let mut body = serde_json::Map::new();
    if let Some(flag) = close_source_branch {
        body.insert("close_source_branch".to_string(), Value::Bool(flag));
    }
    if let Some(text) = message.map(str::trim).filter(|text| !text.is_empty()) {
        body.insert("message".to_string(), Value::String(text.to_string()));
    }
    BitbucketWrite {
        method: reqwest::Method::POST,
        url: format!("{}/merge", pull_request_path(base, workspace, repo, id)),
        body: Some(Value::Object(body)),
    }
}

fn comment_write(base: &str, workspace: &str, repo: &str, id: u64, text: &str) -> BitbucketWrite {
    BitbucketWrite {
        method: reqwest::Method::POST,
        url: format!("{}/comments", pull_request_path(base, workspace, repo, id)),
        body: Some(serde_json::json!({ "content": { "raw": text } })),
    }
}

fn reply_write(
    base: &str,
    workspace: &str,
    repo: &str,
    id: u64,
    parent_id: u64,
    text: &str,
) -> BitbucketWrite {
    BitbucketWrite {
        method: reqwest::Method::POST,
        url: format!("{}/comments", pull_request_path(base, workspace, repo, id)),
        body: Some(serde_json::json!({
            "content": { "raw": text },
            "parent": { "id": parent_id }
        })),
    }
}

#[tauri::command]
pub async fn bitbucket_validate_connection(
    workspace_slug: String,
    email: String,
    api_token: String,
) -> Result<BitbucketConnection, BitbucketError> {
    let credentials = Credentials {
        email: &email,
        token: &api_token,
    };
    let user_raw: BitbucketUserRaw = get_json(&credentials, &current_user_url(API_BASE)).await?;
    let workspace_raw: Option<BitbucketWorkspaceRaw> =
        get_json_optional(&credentials, &workspace_url(API_BASE, &workspace_slug)).await?;
    let Some(workspace_raw) = workspace_raw else {
        return Err(BitbucketError::NotFound(format!(
            "the credentials are valid but no bitbucket workspace answers to the slug {}. the slug is the segment right after bitbucket.org in your repository url, not your display name",
            workspace_slug.trim()
        )));
    };
    Ok(BitbucketConnection {
        user: map_user(user_raw),
        workspace: map_workspace(workspace_raw),
    })
}

#[tauri::command]
pub async fn bitbucket_connect(
    workspace_id: String,
    api_token: String,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<(), BitbucketError> {
    secrets::set(&credential_key(&workspace_id), &api_token)?;
    cache.0.lock().unwrap().insert(workspace_id, api_token);
    Ok(())
}

#[tauri::command]
pub async fn bitbucket_disconnect(
    workspace_id: String,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<(), BitbucketError> {
    secrets::clear(&credential_key(&workspace_id))?;
    cache.0.lock().unwrap().remove(&workspace_id);
    Ok(())
}

#[tauri::command]
pub async fn bitbucket_list_pull_requests(
    workspace_id: String,
    workspace_slug: String,
    repo_slug: String,
    email: String,
    state: Option<String>,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<Vec<BitbucketPullRequest>, BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let credentials = Credentials {
        email: &email,
        token: &token,
    };
    let url = pull_requests_url(API_BASE, &workspace_slug, &repo_slug, state.as_deref());
    let raw: Vec<BitbucketPullRequestRaw> = get_json_paged(&credentials, &url).await?;
    Ok(raw.into_iter().map(map_pull_request).collect())
}

#[tauri::command]
pub async fn bitbucket_get_pull_request(
    workspace_id: String,
    workspace_slug: String,
    repo_slug: String,
    email: String,
    pull_request_id: u64,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<BitbucketPullRequest, BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let credentials = Credentials {
        email: &email,
        token: &token,
    };
    let url = pull_request_path(API_BASE, &workspace_slug, &repo_slug, pull_request_id);
    let raw: BitbucketPullRequestRaw = get_json(&credentials, &url).await?;
    Ok(map_pull_request(raw))
}

#[tauri::command]
pub async fn bitbucket_pull_request_diff(
    workspace_id: String,
    workspace_slug: String,
    repo_slug: String,
    email: String,
    pull_request_id: u64,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<String, BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let credentials = Credentials {
        email: &email,
        token: &token,
    };
    let url = pull_request_diff_url(API_BASE, &workspace_slug, &repo_slug, pull_request_id);
    get_text(&credentials, &url).await
}

#[tauri::command]
pub async fn bitbucket_list_pull_request_comments(
    workspace_id: String,
    workspace_slug: String,
    repo_slug: String,
    email: String,
    pull_request_id: u64,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<Vec<BitbucketComment>, BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let credentials = Credentials {
        email: &email,
        token: &token,
    };
    let url = pull_request_comments_url(API_BASE, &workspace_slug, &repo_slug, pull_request_id);
    let raw: Vec<BitbucketCommentRaw> = get_json_paged(&credentials, &url).await?;
    Ok(raw.into_iter().map(map_comment).collect())
}

#[tauri::command]
pub async fn bitbucket_list_pull_request_statuses(
    workspace_id: String,
    workspace_slug: String,
    repo_slug: String,
    email: String,
    pull_request_id: u64,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<Vec<BitbucketStatus>, BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let credentials = Credentials {
        email: &email,
        token: &token,
    };
    let url = pull_request_statuses_url(API_BASE, &workspace_slug, &repo_slug, pull_request_id);
    let raw: Vec<BitbucketStatusRaw> = get_json_paged(&credentials, &url).await?;
    Ok(raw.into_iter().map(map_status).collect())
}

#[tauri::command]
pub async fn bitbucket_pull_request_for_branch(
    workspace_id: String,
    workspace_slug: String,
    repo_slug: String,
    email: String,
    source_branch: String,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<Option<BitbucketPullRequest>, BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let credentials = Credentials {
        email: &email,
        token: &token,
    };
    let url = pull_requests_for_branch_url(API_BASE, &workspace_slug, &repo_slug, &source_branch);
    let raw: Vec<BitbucketPullRequestRaw> = get_json_paged(&credentials, &url).await?;
    Ok(first_matching_branch(raw, &source_branch).map(map_pull_request))
}

#[tauri::command]
pub async fn bitbucket_approve_pull_request(
    workspace_id: String,
    workspace_slug: String,
    repo_slug: String,
    email: String,
    pull_request_id: u64,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<BitbucketParticipant, BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let credentials = Credentials {
        email: &email,
        token: &token,
    };
    let write = approve_write(API_BASE, &workspace_slug, &repo_slug, pull_request_id);
    let raw: BitbucketParticipantRaw =
        send_json(&credentials, write.method, &write.url, write.body.as_ref()).await?;
    Ok(map_participant(raw))
}

#[tauri::command]
pub async fn bitbucket_unapprove_pull_request(
    workspace_id: String,
    workspace_slug: String,
    repo_slug: String,
    email: String,
    pull_request_id: u64,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<(), BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let credentials = Credentials {
        email: &email,
        token: &token,
    };
    let write = unapprove_write(API_BASE, &workspace_slug, &repo_slug, pull_request_id);
    send_no_content(&credentials, write.method, &write.url, write.body.as_ref()).await
}

#[tauri::command]
pub async fn bitbucket_request_changes(
    workspace_id: String,
    workspace_slug: String,
    repo_slug: String,
    email: String,
    pull_request_id: u64,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<BitbucketParticipant, BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let credentials = Credentials {
        email: &email,
        token: &token,
    };
    let write = request_changes_write(API_BASE, &workspace_slug, &repo_slug, pull_request_id);
    let raw: BitbucketParticipantRaw =
        send_json(&credentials, write.method, &write.url, write.body.as_ref()).await?;
    Ok(map_participant(raw))
}

#[tauri::command]
pub async fn bitbucket_unrequest_changes(
    workspace_id: String,
    workspace_slug: String,
    repo_slug: String,
    email: String,
    pull_request_id: u64,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<(), BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let credentials = Credentials {
        email: &email,
        token: &token,
    };
    let write = unrequest_changes_write(API_BASE, &workspace_slug, &repo_slug, pull_request_id);
    send_no_content(&credentials, write.method, &write.url, write.body.as_ref()).await
}

#[tauri::command]
pub async fn bitbucket_merge_pull_request(
    workspace_id: String,
    workspace_slug: String,
    repo_slug: String,
    email: String,
    pull_request_id: u64,
    close_source_branch: Option<bool>,
    message: Option<String>,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<BitbucketPullRequest, BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let credentials = Credentials {
        email: &email,
        token: &token,
    };
    let write = merge_write(
        API_BASE,
        &workspace_slug,
        &repo_slug,
        pull_request_id,
        close_source_branch,
        message.as_deref(),
    );
    let raw: BitbucketPullRequestRaw =
        send_json(&credentials, write.method, &write.url, write.body.as_ref()).await?;
    Ok(map_pull_request(raw))
}

#[tauri::command]
pub async fn bitbucket_decline_pull_request(
    workspace_id: String,
    workspace_slug: String,
    repo_slug: String,
    email: String,
    pull_request_id: u64,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<BitbucketPullRequest, BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let credentials = Credentials {
        email: &email,
        token: &token,
    };
    let write = decline_write(API_BASE, &workspace_slug, &repo_slug, pull_request_id);
    let raw: BitbucketPullRequestRaw =
        send_json(&credentials, write.method, &write.url, write.body.as_ref()).await?;
    Ok(map_pull_request(raw))
}

#[tauri::command]
pub async fn bitbucket_create_pull_request_comment(
    workspace_id: String,
    workspace_slug: String,
    repo_slug: String,
    email: String,
    pull_request_id: u64,
    body: String,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<BitbucketComment, BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let credentials = Credentials {
        email: &email,
        token: &token,
    };
    let write = comment_write(
        API_BASE,
        &workspace_slug,
        &repo_slug,
        pull_request_id,
        &body,
    );
    let raw: BitbucketCommentRaw =
        send_json(&credentials, write.method, &write.url, write.body.as_ref()).await?;
    Ok(map_comment(raw))
}

#[tauri::command]
pub async fn bitbucket_reply_to_pull_request_comment(
    workspace_id: String,
    workspace_slug: String,
    repo_slug: String,
    email: String,
    pull_request_id: u64,
    parent_comment_id: u64,
    body: String,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<BitbucketComment, BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let credentials = Credentials {
        email: &email,
        token: &token,
    };
    let write = reply_write(
        API_BASE,
        &workspace_slug,
        &repo_slug,
        pull_request_id,
        parent_comment_id,
        &body,
    );
    let raw: BitbucketCommentRaw =
        send_json(&credentials, write.method, &write.url, write.body.as_ref()).await?;
    Ok(map_comment(raw))
}

#[cfg(test)]
mod tests {
    use super::*;

    const BASE: &str = "https://api.bitbucket.org/2.0";

    fn pr_page(next: Option<&str>, ids: &[u64]) -> BitbucketPage<BitbucketPullRequestRaw> {
        let values: Vec<Value> = ids
            .iter()
            .map(|id| serde_json::json!({ "id": id }))
            .collect();
        let mut envelope = serde_json::json!({
            "values": values,
            "page": 1,
            "pagelen": 50,
            "size": 120
        });
        if let Some(url) = next {
            envelope["next"] = Value::String(url.to_string());
        }
        serde_json::from_value(envelope).unwrap()
    }

    #[test]
    fn credential_key_is_namespaced_per_workspace() {
        assert_eq!(credential_key("ws-1"), "goodboy.workspace.ws-1.bitbucket");
    }

    #[test]
    fn error_kind_maps_each_variant() {
        assert_eq!(
            BitbucketError::Http {
                status: 500,
                body: "x".into()
            }
            .kind(),
            "http"
        );
        assert_eq!(BitbucketError::Auth("x".into()).kind(), "auth");
        assert_eq!(BitbucketError::NotFound("x".into()).kind(), "not_found");
        assert_eq!(BitbucketError::InvalidShape("x".into()).kind(), "shape");
        assert_eq!(BitbucketError::NoToken("ws".into()).kind(), "no_token");
    }

    #[test]
    fn error_for_status_names_both_credential_schemes_on_a_401() {
        let err = error_for_status(
            401,
            r#"{"type":"error","error":{"message":"Access token expired."}}"#.into(),
        );
        let BitbucketError::Auth(detail) = err else {
            panic!("expected an auth error");
        };
        assert!(detail.contains("api token"));
        assert!(detail.contains("app password"));
        assert!(detail.contains("Access token expired."));
    }

    #[test]
    fn error_for_status_maps_403_to_auth_and_404_to_not_found() {
        assert!(matches!(
            error_for_status(403, "{}".into()),
            BitbucketError::Auth(_)
        ));
        let err = error_for_status(
            404,
            r#"{"type":"error","error":{"message":"Repository not found"}}"#.into(),
        );
        assert!(matches!(err, BitbucketError::NotFound(ref m) if m == "Repository not found"));
    }

    #[test]
    fn error_for_status_keeps_a_400_as_http_with_the_raw_body() {
        let err = error_for_status(400, r#"{"error":{"message":"bad"}}"#.into());
        assert!(matches!(err, BitbucketError::Http { status: 400, .. }));
    }

    #[test]
    fn error_message_joins_the_message_and_the_detail() {
        let body =
            r#"{"type":"error","error":{"message":"Merge failed","detail":"branch is behind"}}"#;
        assert_eq!(
            error_message(body),
            Some("Merge failed: branch is behind".to_string())
        );
    }

    #[test]
    fn error_message_is_none_for_a_non_json_body() {
        assert!(error_message("<html>bad gateway</html>").is_none());
    }

    #[test]
    fn repo_path_percent_encodes_both_slugs() {
        assert_eq!(
            repo_path(BASE, "goodboy", "desktop-app"),
            "https://api.bitbucket.org/2.0/repositories/goodboy/desktop-app"
        );
        assert!(repo_path(BASE, "my team", "a/b").ends_with("/repositories/my%20team/a%2Fb"));
    }

    #[test]
    fn workspace_and_user_urls_target_the_two_validation_probes() {
        assert_eq!(
            workspace_url(BASE, "goodboy"),
            "https://api.bitbucket.org/2.0/workspaces/goodboy"
        );
        assert_eq!(current_user_url(BASE), "https://api.bitbucket.org/2.0/user");
    }

    #[test]
    fn pull_request_path_appends_the_numeric_id() {
        assert_eq!(
            pull_request_path(BASE, "goodboy", "desktop", 42),
            "https://api.bitbucket.org/2.0/repositories/goodboy/desktop/pullrequests/42"
        );
    }

    #[test]
    fn pull_requests_url_defaults_to_open_and_honours_an_explicit_state() {
        assert_eq!(
            pull_requests_url(BASE, "goodboy", "desktop", None),
            "https://api.bitbucket.org/2.0/repositories/goodboy/desktop/pullrequests?state=OPEN&pagelen=50"
        );
        assert!(
            pull_requests_url(BASE, "goodboy", "desktop", Some("merged"))
                .contains("?state=MERGED&")
        );
        assert!(pull_requests_url(BASE, "goodboy", "desktop", Some("  ")).contains("?state=OPEN&"));
    }

    #[test]
    fn pull_requests_for_branch_url_quotes_and_encodes_the_branch_query() {
        let url = pull_requests_for_branch_url(BASE, "goodboy", "desktop", " ak/feat-x ");
        assert!(url.starts_with(
            "https://api.bitbucket.org/2.0/repositories/goodboy/desktop/pullrequests?state=OPEN&pagelen=50&q="
        ));
        assert!(url.ends_with("q=source.branch.name%3D%22ak%2Ffeat-x%22"));
    }

    #[test]
    fn diff_comments_and_statuses_urls_hang_off_the_pull_request() {
        assert_eq!(
            pull_request_diff_url(BASE, "goodboy", "desktop", 7),
            "https://api.bitbucket.org/2.0/repositories/goodboy/desktop/pullrequests/7/diff"
        );
        assert!(pull_request_comments_url(BASE, "goodboy", "desktop", 7)
            .starts_with("https://api.bitbucket.org/2.0/repositories/goodboy/desktop/pullrequests/7/comments?"));
        assert!(pull_request_statuses_url(BASE, "goodboy", "desktop", 7)
            .starts_with("https://api.bitbucket.org/2.0/repositories/goodboy/desktop/pullrequests/7/statuses?"));
    }

    fn body_of(write: &BitbucketWrite) -> &Value {
        write.body.as_ref().expect("the write carries a body")
    }

    #[test]
    fn approve_write_posts_to_the_approve_sub_resource_with_an_empty_body() {
        let write = approve_write(BASE, "goodboy", "desktop", 12);
        assert_eq!(write.method, reqwest::Method::POST);
        assert_eq!(
            write.url,
            "https://api.bitbucket.org/2.0/repositories/goodboy/desktop/pullrequests/12/approve"
        );
        assert_eq!(*body_of(&write), serde_json::json!({}));
    }

    #[test]
    fn unapprove_write_deletes_the_same_approve_sub_resource_without_a_body() {
        let write = unapprove_write(BASE, "goodboy", "desktop", 12);
        assert_eq!(write.method, reqwest::Method::DELETE);
        assert_eq!(write.url, approve_write(BASE, "goodboy", "desktop", 12).url);
        assert!(write.body.is_none());
    }

    #[test]
    fn request_changes_write_uses_the_hyphenated_sub_resource() {
        let write = request_changes_write(BASE, "goodboy", "desktop", 12);
        assert_eq!(write.method, reqwest::Method::POST);
        assert_eq!(
            write.url,
            "https://api.bitbucket.org/2.0/repositories/goodboy/desktop/pullrequests/12/request-changes"
        );
        assert_eq!(*body_of(&write), serde_json::json!({}));
    }

    #[test]
    fn unrequest_changes_write_deletes_the_same_sub_resource_without_a_body() {
        let write = unrequest_changes_write(BASE, "goodboy", "desktop", 12);
        assert_eq!(write.method, reqwest::Method::DELETE);
        assert_eq!(
            write.url,
            request_changes_write(BASE, "goodboy", "desktop", 12).url
        );
        assert!(write.body.is_none());
    }

    #[test]
    fn decline_write_targets_the_decline_sub_resource() {
        let write = decline_write(BASE, "goodboy", "desktop", 3);
        assert_eq!(write.method, reqwest::Method::POST);
        assert_eq!(
            write.url,
            "https://api.bitbucket.org/2.0/repositories/goodboy/desktop/pullrequests/3/decline"
        );
    }

    #[test]
    fn merge_write_never_pins_a_merge_strategy() {
        let bare = merge_write(BASE, "goodboy", "desktop", 5, None, None);
        assert_eq!(bare.method, reqwest::Method::POST);
        assert_eq!(
            bare.url,
            "https://api.bitbucket.org/2.0/repositories/goodboy/desktop/pullrequests/5/merge"
        );
        assert_eq!(*body_of(&bare), serde_json::json!({}));
        let full = merge_write(BASE, "goodboy", "desktop", 5, Some(true), Some("ship it"));
        assert!(body_of(&full).get("merge_strategy").is_none());
    }

    #[test]
    fn merge_write_carries_only_the_options_it_was_given() {
        let with_flag = merge_write(BASE, "goodboy", "desktop", 5, Some(false), None);
        assert_eq!(
            body_of(&with_flag)["close_source_branch"],
            Value::Bool(false)
        );
        assert!(body_of(&with_flag).get("message").is_none());
        let with_message = merge_write(BASE, "goodboy", "desktop", 5, None, Some(" ship it "));
        assert_eq!(body_of(&with_message)["message"], "ship it");
        assert!(body_of(&with_message).get("close_source_branch").is_none());
        let blank_message = merge_write(BASE, "goodboy", "desktop", 5, None, Some("   "));
        assert!(body_of(&blank_message).get("message").is_none());
    }

    #[test]
    fn comment_write_nests_the_text_under_content_raw() {
        let write = comment_write(BASE, "goodboy", "desktop", 9, "looks good");
        assert_eq!(write.method, reqwest::Method::POST);
        assert_eq!(
            write.url,
            "https://api.bitbucket.org/2.0/repositories/goodboy/desktop/pullrequests/9/comments"
        );
        assert_eq!(body_of(&write)["content"]["raw"], "looks good");
        assert!(body_of(&write).get("parent").is_none());
        assert!(body_of(&write).get("body").is_none());
    }

    #[test]
    fn reply_write_adds_the_parent_id_beside_the_content() {
        let write = reply_write(BASE, "goodboy", "desktop", 9, 4242, "agreed");
        assert_eq!(write.method, reqwest::Method::POST);
        assert_eq!(
            write.url,
            "https://api.bitbucket.org/2.0/repositories/goodboy/desktop/pullrequests/9/comments"
        );
        assert_eq!(body_of(&write)["content"]["raw"], "agreed");
        assert_eq!(body_of(&write)["parent"]["id"], 4242);
    }

    #[test]
    fn only_a_404_reads_as_an_absent_resource() {
        assert!(reads_as_absent(404));
        assert!(!reads_as_absent(403));
        assert!(!reads_as_absent(401));
        assert!(!reads_as_absent(200));
        assert!(!reads_as_absent(500));
    }

    #[test]
    fn user_parses_and_falls_back_to_the_display_name_for_the_nickname() {
        let raw: BitbucketUserRaw = serde_json::from_str(
            r#"{ "uuid": "{abc}", "account_id": "acc-1", "display_name": "Amin K",
                 "links": { "avatar": { "href": "https://avatar/x.png" } } }"#,
        )
        .unwrap();
        let user = map_user(raw);
        assert_eq!(user.uuid, "{abc}");
        assert_eq!(user.account_id.as_deref(), Some("acc-1"));
        assert_eq!(user.nickname, "Amin K");
        assert_eq!(user.avatar_url.as_deref(), Some("https://avatar/x.png"));
    }

    #[test]
    fn workspace_parses_and_falls_back_to_the_slug_for_the_name() {
        let raw: BitbucketWorkspaceRaw =
            serde_json::from_str(r#"{ "uuid": "{ws}", "slug": "goodboy" }"#).unwrap();
        let workspace = map_workspace(raw);
        assert_eq!(workspace.slug, "goodboy");
        assert_eq!(workspace.name, "goodboy");
        assert!(workspace.web_url.is_none());
    }

    #[test]
    fn pull_request_parses_the_full_documented_shape() {
        let raw: BitbucketPullRequestRaw = serde_json::from_str(
            r#"{
                "id": 42,
                "title": "Ship bitbucket",
                "description": "the backend",
                "state": "OPEN",
                "created_on": "2026-08-01T09:00:00+00:00",
                "updated_on": "2026-08-02T09:00:00+00:00",
                "close_source_branch": true,
                "comment_count": 3,
                "task_count": 1,
                "source": { "branch": { "name": "ak/feat-bb" }, "commit": { "hash": "aaa111" } },
                "destination": { "branch": { "name": "main" }, "commit": { "hash": "bbb222" } },
                "author": { "uuid": "{u1}", "display_name": "Amin", "nickname": "amin" },
                "reviewers": [{ "uuid": "{u2}", "display_name": "Rev" }],
                "participants": [
                  { "role": "REVIEWER", "approved": true, "state": "approved",
                    "user": { "uuid": "{u2}", "display_name": "Rev" } }
                ],
                "links": { "html": { "href": "https://bitbucket.org/goodboy/desktop/pull-requests/42" } }
            }"#,
        )
        .unwrap();
        let pr = map_pull_request(raw);
        assert_eq!(pr.id, 42);
        assert_eq!(pr.source_branch, "ak/feat-bb");
        assert_eq!(pr.destination_branch, "main");
        assert_eq!(pr.source_commit.as_deref(), Some("aaa111"));
        assert_eq!(pr.comment_count, 3);
        assert!(pr.close_source_branch);
        assert_eq!(pr.participants.len(), 1);
        assert!(pr.participants[0].approved);
        assert_eq!(
            pr.web_url.as_deref(),
            Some("https://bitbucket.org/goodboy/desktop/pull-requests/42")
        );
    }

    #[test]
    fn pull_request_parses_when_every_optional_branch_is_absent() {
        let raw: BitbucketPullRequestRaw = serde_json::from_str(r#"{ "id": 1 }"#).unwrap();
        let pr = map_pull_request(raw);
        assert_eq!(pr.id, 1);
        assert_eq!(pr.source_branch, "");
        assert!(pr.author.is_none());
        assert!(pr.merge_commit.is_none());
        assert!(pr.web_url.is_none());
        assert!(pr.reviewers.is_empty());
    }

    #[test]
    fn a_merged_pull_request_carries_its_merge_commit_hash() {
        let raw: BitbucketPullRequestRaw = serde_json::from_str(
            r#"{ "id": 8, "state": "MERGED", "merge_commit": { "hash": "ccc333" } }"#,
        )
        .unwrap();
        let pr = map_pull_request(raw);
        assert_eq!(pr.state, "MERGED");
        assert_eq!(pr.merge_commit.as_deref(), Some("ccc333"));
    }

    #[test]
    fn comment_parses_an_inline_reply() {
        let raw: BitbucketCommentRaw = serde_json::from_str(
            r#"{
                "id": 91,
                "content": { "raw": "rename this", "markup": "markdown", "html": "<p>rename this</p>" },
                "user": { "uuid": "{u1}", "display_name": "Amin" },
                "created_on": "2026-08-01T09:00:00+00:00",
                "updated_on": "2026-08-01T09:30:00+00:00",
                "deleted": false,
                "parent": { "id": 90 },
                "inline": { "path": "src/lib.rs", "from": null, "to": 12 },
                "links": { "html": { "href": "https://bitbucket.org/c/91" } }
            }"#,
        )
        .unwrap();
        let comment = map_comment(raw);
        assert_eq!(comment.body, "rename this");
        assert_eq!(comment.parent_id, Some(90));
        let inline = comment.inline.unwrap();
        assert_eq!(inline.path, "src/lib.rs");
        assert_eq!(inline.to, Some(12));
        assert!(inline.from.is_none());
    }

    #[test]
    fn comment_parses_a_top_level_note_without_inline_or_parent() {
        let raw: BitbucketCommentRaw =
            serde_json::from_str(r#"{ "id": 5, "content": { "raw": "lgtm" } }"#).unwrap();
        let comment = map_comment(raw);
        assert_eq!(comment.id, 5);
        assert_eq!(comment.body, "lgtm");
        assert!(comment.parent_id.is_none());
        assert!(comment.inline.is_none());
        assert!(!comment.deleted);
    }

    #[test]
    fn statuses_parse_and_fall_back_to_the_key_for_the_name() {
        let raw: BitbucketPage<BitbucketStatusRaw> = serde_json::from_str(
            r#"{ "values": [
                  { "key": "PIPELINE", "name": "Pipeline #12", "state": "SUCCESSFUL",
                    "url": "https://bitbucket.org/p/12", "refname": "ak/feat-bb",
                    "created_on": "2026-08-01T09:00:00+00:00", "updated_on": "2026-08-01T09:10:00+00:00" },
                  { "key": "codecov", "state": "FAILED" }
                ], "page": 1, "pagelen": 50, "size": 2 }"#,
        )
        .unwrap();
        let statuses: Vec<BitbucketStatus> = raw.values.into_iter().map(map_status).collect();
        assert_eq!(statuses.len(), 2);
        assert_eq!(statuses[0].name, "Pipeline #12");
        assert_eq!(statuses[0].state, "SUCCESSFUL");
        assert_eq!(statuses[1].name, "codecov");
        assert!(statuses[1].url.is_none());
    }

    #[test]
    fn participant_parses_the_changes_requested_state() {
        let raw: BitbucketParticipantRaw = serde_json::from_str(
            r#"{ "role": "REVIEWER", "approved": false, "state": "changes_requested",
                 "user": { "uuid": "{u3}", "display_name": "Rev" } }"#,
        )
        .unwrap();
        let participant = map_participant(raw);
        assert_eq!(participant.role, "REVIEWER");
        assert!(!participant.approved);
        assert_eq!(participant.state.as_deref(), Some("changes_requested"));
    }

    #[test]
    fn the_page_envelope_ignores_the_counters_it_does_not_model() {
        let page = pr_page(Some("https://api.bitbucket.org/2.0/x?page=2"), &[1, 2]);
        assert_eq!(page.values.len(), 2);
        assert_eq!(
            page.next.as_deref(),
            Some("https://api.bitbucket.org/2.0/x?page=2")
        );
    }

    #[test]
    fn the_page_envelope_tolerates_a_missing_values_array() {
        let page: BitbucketPage<BitbucketPullRequestRaw> =
            serde_json::from_str(r#"{ "page": 1, "pagelen": 50, "size": 0 }"#).unwrap();
        assert!(page.values.is_empty());
        assert!(page.next.is_none());
    }

    #[test]
    fn the_pager_follows_the_absolute_next_url_and_stops_when_it_is_gone() {
        let mut pager = Pager::new();
        let mut sink: Vec<BitbucketPullRequestRaw> = Vec::new();
        let next = pager
            .absorb(
                pr_page(Some("https://api.bitbucket.org/2.0/x?page=2"), &[1]),
                &mut sink,
            )
            .unwrap();
        assert_eq!(
            next.as_deref(),
            Some("https://api.bitbucket.org/2.0/x?page=2")
        );
        let done = pager.absorb(pr_page(None, &[2, 3]), &mut sink).unwrap();
        assert!(done.is_none());
        assert_eq!(sink.len(), 3);
    }

    #[test]
    fn the_pager_bails_when_the_next_url_repeats() {
        let mut pager = Pager::new();
        let mut sink: Vec<BitbucketPullRequestRaw> = Vec::new();
        let looping = "https://api.bitbucket.org/2.0/x?page=2";
        pager
            .absorb(pr_page(Some(looping), &[1]), &mut sink)
            .unwrap();
        let err = pager
            .absorb(pr_page(Some(looping), &[1]), &mut sink)
            .unwrap_err();
        assert!(matches!(err, BitbucketError::InvalidShape(ref m) if m.contains("looped")));
    }

    #[test]
    fn the_pager_stops_at_the_page_cap_even_while_next_keeps_coming() {
        let mut pager = Pager::new();
        let mut sink: Vec<BitbucketPullRequestRaw> = Vec::new();
        for page in 0..MAX_PAGES {
            let next = format!("https://api.bitbucket.org/2.0/x?page={}", page + 2);
            let outcome = pager
                .absorb(pr_page(Some(&next), &[page as u64]), &mut sink)
                .unwrap();
            if page + 1 == MAX_PAGES {
                assert!(outcome.is_none());
            }
        }
        assert_eq!(sink.len() as u32, MAX_PAGES);
    }

    #[test]
    fn the_pager_treats_a_blank_next_url_as_the_end() {
        let mut pager = Pager::new();
        let mut sink: Vec<BitbucketPullRequestRaw> = Vec::new();
        let next = pager.absorb(pr_page(Some("   "), &[1]), &mut sink).unwrap();
        assert!(next.is_none());
    }

    #[test]
    fn the_branch_lookup_rejects_a_server_side_query_that_returned_the_wrong_branch() {
        let values: Vec<BitbucketPullRequestRaw> = serde_json::from_str(
            r#"[
                { "id": 1, "source": { "branch": { "name": "ak/other" } } },
                { "id": 2, "source": { "branch": { "name": "ak/feat-bb" } } }
            ]"#,
        )
        .unwrap();
        let found = first_matching_branch(values, " ak/feat-bb ").unwrap();
        assert_eq!(found.id, 2);
    }

    #[test]
    fn the_branch_lookup_is_none_when_no_open_pull_request_matches() {
        let values: Vec<BitbucketPullRequestRaw> =
            serde_json::from_str(r#"[{ "id": 1, "source": { "branch": { "name": "main" } } }]"#)
                .unwrap();
        assert!(first_matching_branch(values, "ak/feat-bb").is_none());
    }
}
