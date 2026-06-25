use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use serde_json::Map;
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

#[derive(Debug, Error)]
pub enum BitbucketError {
    #[error("http error {status}: {body}")]
    Http { status: u16, body: String },
    #[error("invalid response shape: {0}")]
    InvalidShape(String),
    #[error("no token stored for workspace {0}")]
    NoToken(String),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
}

impl Serialize for BitbucketError {
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

impl BitbucketError {
    fn kind(&self) -> &'static str {
        match self {
            BitbucketError::Http { .. } => "http",
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

fn api_base(host: &str) -> Result<String, BitbucketError> {
    let trimmed = host.trim().trim_end_matches('/');
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err(BitbucketError::InvalidShape(format!("invalid host: {}", host)));
    }
    let with_api = trimmed.replace("://bitbucket.org", "://api.bitbucket.org");
    Ok(format!("{}/2.0", with_api))
}

async fn get_json<T: serde::de::DeserializeOwned>(
    host: &str,
    token: &str,
    path: &str,
) -> Result<T, BitbucketError> {
    let url = format!("{}{}", api_base(host)?, path);
    let res = http_client()
        .get(&url)
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await?;
    let status = res.status();
    let body = res.text().await?;
    if !status.is_success() {
        return Err(BitbucketError::Http {
            status: status.as_u16(),
            body,
        });
    }
    serde_json::from_str(&body).map_err(|e| BitbucketError::InvalidShape(e.to_string()))
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

fn encode_repo_path(workspace_slug: &str, repo_slug: &str) -> String {
    format!(
        "{}/{}",
        percent_encode(workspace_slug.trim().trim_matches('/')),
        percent_encode(repo_slug.trim().trim_matches('/'))
    )
}

fn read_token(workspace_id: &str, cache: &BitbucketTokenCache) -> Result<String, BitbucketError> {
    if let Some(tok) = cache.0.lock().unwrap().get(workspace_id) {
        return Ok(tok.clone());
    }
    let tok = secrets::read(&credential_key(workspace_id))?
        .ok_or_else(|| BitbucketError::NoToken(workspace_id.to_string()))?;
    cache
        .0
        .lock()
        .unwrap()
        .insert(workspace_id.to_string(), tok.clone());
    Ok(tok)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BitbucketUser {
    #[serde(rename = "accountId", alias = "account_id")]
    pub account_id: String,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(rename = "displayName", alias = "display_name")]
    pub display_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BitbucketBranch {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BitbucketRef {
    pub branch: BitbucketBranch,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BitbucketLinkHref {
    pub href: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BitbucketLinks {
    pub html: BitbucketLinkHref,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BitbucketSummary {
    #[serde(default)]
    pub raw: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BitbucketPullRequest {
    pub id: i64,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub state: String,
    pub links: BitbucketLinks,
    pub source: BitbucketRef,
    pub destination: BitbucketRef,
    #[serde(default)]
    pub summary: Option<BitbucketSummary>,
    #[serde(rename = "updatedOn", alias = "updated_on", default)]
    pub updated_on: Option<String>,
}

#[derive(Debug, Deserialize)]
struct BitbucketPaginated<T> {
    #[serde(default = "Vec::new")]
    values: Vec<T>,
}

#[tauri::command]
pub async fn bitbucket_connect(
    workspace_id: String,
    host: String,
    token: String,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<BitbucketUser, BitbucketError> {
    let user: BitbucketUser = get_json(&host, &token, "/user").await?;
    secrets::set(&credential_key(&workspace_id), &token)?;
    cache.0.lock().unwrap().insert(workspace_id, token);
    Ok(user)
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
pub async fn bitbucket_pr_for_branch(
    workspace_id: String,
    host: String,
    workspace_slug: String,
    repo_slug: String,
    source_branch: String,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<Option<BitbucketPullRequest>, BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let repo = encode_repo_path(&workspace_slug, &repo_slug);
    let query = percent_encode(&format!("source.branch.name=\"{}\"", source_branch));
    let path = format!("/repositories/{repo}/pullrequests?q={query}&sort=-updated_on&pagelen=1");
    let page: BitbucketPaginated<BitbucketPullRequest> = get_json(&host, &token, &path).await?;
    Ok(page.values.into_iter().next())
}

#[tauri::command]
pub async fn bitbucket_pr_detail(
    workspace_id: String,
    host: String,
    workspace_slug: String,
    repo_slug: String,
    pr_id: i64,
    cache: State<'_, BitbucketTokenCache>,
) -> Result<BitbucketPullRequest, BitbucketError> {
    let token = read_token(&workspace_id, &cache)?;
    let repo = encode_repo_path(&workspace_slug, &repo_slug);
    get_json(&host, &token, &format!("/repositories/{repo}/pullrequests/{pr_id}")).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_base_maps_cloud_web_host_to_api_host() {
        assert_eq!(
            api_base("https://bitbucket.org").unwrap(),
            "https://api.bitbucket.org/2.0"
        );
    }

    #[test]
    fn api_base_maps_http_cloud_host() {
        assert_eq!(
            api_base("http://bitbucket.org").unwrap(),
            "http://api.bitbucket.org/2.0"
        );
    }

    #[test]
    fn api_base_trims_trailing_slash_and_whitespace() {
        assert_eq!(
            api_base("  https://bitbucket.org/  ").unwrap(),
            "https://api.bitbucket.org/2.0"
        );
    }

    #[test]
    fn api_base_preserves_self_hosted_host() {
        assert_eq!(
            api_base("https://bitbucket.example.com").unwrap(),
            "https://bitbucket.example.com/2.0"
        );
    }

    #[test]
    fn api_base_rejects_a_host_without_scheme() {
        let err = api_base("bitbucket.org").unwrap_err();
        assert!(matches!(err, BitbucketError::InvalidShape(_)));
    }

    #[test]
    fn api_base_rejects_empty_host() {
        let err = api_base("").unwrap_err();
        assert!(matches!(err, BitbucketError::InvalidShape(_)));
    }

    #[test]
    fn encode_repo_path_percent_encodes_each_segment() {
        assert_eq!(encode_repo_path("acme", "web-app"), "acme/web-app");
        assert_eq!(encode_repo_path("/acme/", "/my repo/"), "acme/my%20repo");
    }

    #[test]
    fn encode_repo_path_trims_slash_padding_from_slugs() {
        assert_eq!(encode_repo_path("//acme//", "//repo//"), "acme/repo");
    }

    #[test]
    fn percent_encode_escapes_branch_slashes_and_reserved() {
        assert_eq!(percent_encode("ak/feat-x"), "ak%2Ffeat-x");
        assert_eq!(percent_encode("a b"), "a%20b");
        assert_eq!(percent_encode("keep-._~"), "keep-._~");
    }

    #[test]
    fn percent_encode_handles_empty_string() {
        assert_eq!(percent_encode(""), "");
    }

    #[test]
    fn percent_encode_encodes_plus_sign() {
        assert_eq!(percent_encode("a+b"), "a%2Bb");
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
        assert_eq!(BitbucketError::InvalidShape("x".into()).kind(), "shape");
        assert_eq!(BitbucketError::NoToken("ws".into()).kind(), "no_token");
    }

    #[test]
    fn error_serializes_kind_and_message_fields() {
        let err = BitbucketError::Http { status: 404, body: "not found".into() };
        let val = serde_json::to_value(&err).unwrap();
        assert_eq!(val["kind"], "http");
        assert_eq!(val["message"], "http error 404: not found");
    }

    #[test]
    fn error_serializes_no_token_variant_includes_workspace_id() {
        let err = BitbucketError::NoToken("ws-x".into());
        let val = serde_json::to_value(&err).unwrap();
        assert_eq!(val["kind"], "no_token");
        assert!(val["message"].as_str().unwrap().contains("ws-x"));
    }

    #[test]
    fn error_serializes_invalid_shape_variant() {
        let err = BitbucketError::InvalidShape("bad json".into());
        let val = serde_json::to_value(&err).unwrap();
        assert_eq!(val["kind"], "shape");
    }

    #[test]
    fn user_deserializes_snake_case_payload() {
        let raw = r#"{
            "account_id": "abc-123",
            "username": "amin",
            "display_name": "Amin K"
        }"#;
        let user: BitbucketUser = serde_json::from_str(raw).unwrap();
        assert_eq!(user.account_id, "abc-123");
        assert_eq!(user.username.as_deref(), Some("amin"));
        assert_eq!(user.display_name, "Amin K");
    }

    #[test]
    fn user_deserializes_without_optional_username() {
        let raw = r#"{"account_id": "xyz", "display_name": "No Username"}"#;
        let user: BitbucketUser = serde_json::from_str(raw).unwrap();
        assert_eq!(user.account_id, "xyz");
        assert!(user.username.is_none());
        assert_eq!(user.display_name, "No Username");
    }

    #[test]
    fn pull_request_deserializes_cloud_payload() {
        let raw = r#"{
            "id": 7,
            "title": "Add feature",
            "description": "short",
            "state": "OPEN",
            "links": { "html": { "href": "https://bitbucket.org/acme/web/pull-requests/7" } },
            "source": { "branch": { "name": "ak/feat-x" } },
            "destination": { "branch": { "name": "main" } },
            "summary": { "raw": "full body" },
            "updated_on": "2026-05-21T10:00:00Z"
        }"#;
        let pr: BitbucketPullRequest = serde_json::from_str(raw).unwrap();
        assert_eq!(pr.id, 7);
        assert_eq!(pr.state, "OPEN");
        assert_eq!(pr.source.branch.name, "ak/feat-x");
        assert_eq!(pr.destination.branch.name, "main");
        assert_eq!(pr.links.html.href, "https://bitbucket.org/acme/web/pull-requests/7");
        assert_eq!(pr.summary.unwrap().raw.as_deref(), Some("full body"));
        assert_eq!(pr.updated_on.as_deref(), Some("2026-05-21T10:00:00Z"));
    }

    #[test]
    fn pull_request_missing_optional_fields_deserializes() {
        let raw = r#"{
            "id": 1,
            "title": "Minimal PR",
            "state": "OPEN",
            "links": { "html": { "href": "https://bitbucket.org/a/b/pull-requests/1" } },
            "source": { "branch": { "name": "feat/foo" } },
            "destination": { "branch": { "name": "main" } }
        }"#;
        let pr: BitbucketPullRequest = serde_json::from_str(raw).unwrap();
        assert_eq!(pr.id, 1);
        assert!(pr.description.is_none());
        assert!(pr.summary.is_none());
        assert!(pr.updated_on.is_none());
    }

    #[test]
    fn pull_request_summary_with_null_raw_is_some_none() {
        let raw = r#"{
            "id": 2,
            "title": "Null summary raw",
            "state": "MERGED",
            "links": { "html": { "href": "https://bitbucket.org/a/b/pull-requests/2" } },
            "source": { "branch": { "name": "main" } },
            "destination": { "branch": { "name": "release" } },
            "summary": { "raw": null }
        }"#;
        let pr: BitbucketPullRequest = serde_json::from_str(raw).unwrap();
        assert!(pr.summary.is_some());
        assert!(pr.summary.unwrap().raw.is_none());
    }

    #[test]
    fn paginated_defaults_to_empty_values() {
        let page: BitbucketPaginated<BitbucketPullRequest> =
            serde_json::from_str("{}").unwrap();
        assert!(page.values.is_empty());
    }

    #[test]
    fn paginated_parses_pr_values_array() {
        let raw = r#"{
            "values": [{
                "id": 3,
                "title": "Some PR",
                "state": "OPEN",
                "links": { "html": { "href": "https://bitbucket.org/a/b/pull-requests/3" } },
                "source": { "branch": { "name": "feature" } },
                "destination": { "branch": { "name": "main" } }
            }]
        }"#;
        let page: BitbucketPaginated<BitbucketPullRequest> = serde_json::from_str(raw).unwrap();
        assert_eq!(page.values.len(), 1);
        assert_eq!(page.values[0].id, 3);
        assert_eq!(page.values[0].title, "Some PR");
    }

    #[test]
    fn read_token_returns_from_in_memory_cache() {
        let cache = BitbucketTokenCache::new();
        cache
            .0
            .lock()
            .unwrap()
            .insert("ws-cached".to_string(), "tok-in-cache".to_string());
        let result = read_token("ws-cached", &cache);
        assert_eq!(result.unwrap(), "tok-in-cache");
    }

    #[test]
    fn pr_for_branch_query_encodes_slash_and_double_quotes() {
        let branch = "ak/feat-x";
        let query = percent_encode(&format!("source.branch.name=\"{}\"", branch));
        assert!(
            query.contains("ak%2Ffeat-x"),
            "slash in branch name must be encoded, got: {query}"
        );
        assert!(
            query.contains("%22"),
            "double-quotes around branch name must be encoded, got: {query}"
        );
    }
}
