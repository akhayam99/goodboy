use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use serde_json::Map;
use tauri::State;
use thiserror::Error;

use crate::secrets;

/// In-memory cache of Jira API tokens keyed by workspace id.
/// Avoids repeated keychain prompts in dev builds and per-fetch prompts otherwise.
pub struct JiraTokenCache(Mutex<HashMap<String, String>>);

impl JiraTokenCache {
    pub fn new() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(reqwest::Client::new)
}

fn credential_key(workspace_id: &str) -> String {
    format!("goodboy.workspace.{}.jira", workspace_id)
}

fn basic_auth_header(email: &str, token: &str) -> String {
    let creds = format!("{email}:{token}");
    format!("Basic {}", base64::engine::general_purpose::STANDARD.encode(creds))
}

fn normalize_site_url(site_url: &str) -> String {
    site_url.trim_end_matches('/').to_string()
}

#[derive(Debug, Error)]
pub enum JiraError {
    #[error("http error: {0}")]
    Http(String),
    #[error("auth error: {0}")]
    Auth(String),
    #[error("invalid response shape: {0}")]
    InvalidShape(String),
    #[error("no token stored for workspace {0}")]
    NoToken(String),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
}

impl Serialize for JiraError {
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

impl JiraError {
    fn kind(&self) -> &'static str {
        match self {
            JiraError::Http(_) => "http",
            JiraError::Auth(_) => "auth",
            JiraError::InvalidShape(_) => "shape",
            JiraError::NoToken(_) => "no_token",
            JiraError::Secret(_) => "secret",
        }
    }
}

impl From<reqwest::Error> for JiraError {
    fn from(e: reqwest::Error) -> Self {
        JiraError::Http(e.to_string())
    }
}

fn read_token(workspace_id: &str, cache: &JiraTokenCache) -> Result<String, JiraError> {
    if let Some(tok) = cache.0.lock().unwrap().get(workspace_id) {
        return Ok(tok.clone());
    }
    let tok = secrets::read(&credential_key(workspace_id))?
        .ok_or_else(|| JiraError::NoToken(workspace_id.to_string()))?;
    cache
        .0
        .lock()
        .unwrap()
        .insert(workspace_id.to_string(), tok.clone());
    Ok(tok)
}

// ─── API response types ───────────────────────────────────────────────────────

/// Returned from GET /rest/api/3/myself. Field names match Jira's camelCase
/// so serde can deserialize directly and re-serialize identically to the
/// frontend TS types (accountId, displayName, emailAddress).
#[derive(Debug, Serialize, Deserialize)]
pub struct JiraSelf {
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "emailAddress")]
    pub email_address: String,
}

#[derive(Debug, Serialize)]
pub struct JiraIssue {
    pub id: String,
    pub key: String,
    pub title: String,
    pub description: Option<String>,
    pub url: String,
    pub status: JiraIssueStatus,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct JiraIssueStatus {
    pub name: String,
    #[serde(rename = "statusCategoryKey")]
    pub status_category_key: String,
}

// Raw shapes for Jira REST deserialization
#[derive(Deserialize)]
struct SearchResult {
    issues: Vec<RawJiraIssue>,
}

#[derive(Deserialize)]
struct RawJiraIssue {
    id: String,
    key: String,
    fields: RawJiraFields,
}

#[derive(Deserialize)]
struct RawJiraFields {
    summary: String,
    status: RawJiraStatus,
    description: Option<serde_json::Value>,
    updated: String,
}

#[derive(Deserialize)]
struct RawJiraStatus {
    name: String,
    #[serde(rename = "statusCategory")]
    status_category: RawJiraStatusCategory,
}

#[derive(Deserialize)]
struct RawJiraStatusCategory {
    key: String,
}

// ─── ADF → plain text ────────────────────────────────────────────────────────

/// Flatten Atlassian Document Format JSON to plain text.
/// Block-level nodes (paragraph, heading, etc.) become double-newline-separated
/// paragraphs. Inline text nodes are concatenated directly. Defensive: returns
/// "" on any unexpected shape, never panics.
fn adf_to_text(value: &serde_json::Value) -> String {
    let mut blocks: Vec<String> = Vec::new();
    collect_adf_blocks(value, &mut blocks);
    blocks.join("\n\n").trim().to_string()
}

fn collect_adf_blocks(node: &serde_json::Value, blocks: &mut Vec<String>) {
    let Some(obj) = node.as_object() else { return };
    let t = obj.get("type").and_then(|v| v.as_str()).unwrap_or("");

    match t {
        "doc" | "bulletList" | "orderedList" | "blockquote" => {
            if let Some(arr) = obj.get("content").and_then(|v| v.as_array()) {
                for child in arr {
                    collect_adf_blocks(child, blocks);
                }
            }
        }
        "paragraph" | "heading" | "listItem" | "codeBlock" => {
            let mut inline = String::new();
            if let Some(arr) = obj.get("content").and_then(|v| v.as_array()) {
                for child in arr {
                    collect_adf_inline(child, &mut inline);
                }
            }
            let s = inline.trim().to_string();
            if !s.is_empty() {
                blocks.push(s);
            }
        }
        _ => {
            // Unknown container: recurse into content if present
            if let Some(arr) = obj.get("content").and_then(|v| v.as_array()) {
                for child in arr {
                    collect_adf_blocks(child, blocks);
                }
            }
        }
    }
}

fn collect_adf_inline(node: &serde_json::Value, out: &mut String) {
    let Some(obj) = node.as_object() else { return };
    let t = obj.get("type").and_then(|v| v.as_str()).unwrap_or("");

    match t {
        "text" => {
            if let Some(s) = obj.get("text").and_then(|v| v.as_str()) {
                out.push_str(s);
            }
        }
        "hardBreak" => {
            out.push('\n');
        }
        _ => {
            if let Some(arr) = obj.get("content").and_then(|v| v.as_array()) {
                for child in arr {
                    collect_adf_inline(child, out);
                }
            }
        }
    }
}

// ─── commands ────────────────────────────────────────────────────────────────

/// Verify API token via /myself and save to keychain on success.
#[tauri::command]
pub async fn jira_connect(
    workspace_id: String,
    site_url: String,
    email: String,
    token: String,
    cache: State<'_, JiraTokenCache>,
) -> Result<JiraSelf, JiraError> {
    let site = normalize_site_url(&site_url);
    let url = format!("{}/rest/api/3/myself", site);
    let res = http_client()
        .get(&url)
        .header("Authorization", basic_auth_header(&email, &token))
        .header("Accept", "application/json")
        .send()
        .await?;

    let status = res.status();
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Err(JiraError::Auth(format!("authentication failed ({})", status)));
    }
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(JiraError::Http(format!("status {}: {}", status, body)));
    }

    let myself: JiraSelf = res
        .json()
        .await
        .map_err(|e| JiraError::InvalidShape(e.to_string()))?;

    secrets::set(&credential_key(&workspace_id), &token)?;
    cache.0.lock().unwrap().insert(workspace_id, token);
    Ok(myself)
}

#[tauri::command]
pub async fn jira_disconnect(
    workspace_id: String,
    cache: State<'_, JiraTokenCache>,
) -> Result<(), JiraError> {
    secrets::clear(&credential_key(&workspace_id))?;
    cache.0.lock().unwrap().remove(&workspace_id);
    Ok(())
}

#[tauri::command]
pub async fn jira_fetch_assigned_issues(
    workspace_id: String,
    site_url: String,
    email: String,
    cache: State<'_, JiraTokenCache>,
) -> Result<Vec<JiraIssue>, JiraError> {
    let token = read_token(&workspace_id, &cache)?;
    let site = normalize_site_url(&site_url);
    let url = format!("{}/rest/api/3/search", site);

    let res = http_client()
        .get(&url)
        .header("Authorization", basic_auth_header(&email, &token))
        .header("Accept", "application/json")
        .query(&[
            (
                "jql",
                "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC",
            ),
            ("maxResults", "50"),
            ("fields", "summary,status,description,updated"),
        ])
        .send()
        .await?;

    let status = res.status();
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Err(JiraError::Auth(format!("authentication failed ({})", status)));
    }
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(JiraError::Http(format!("status {}: {}", status, body)));
    }

    let result: SearchResult = res
        .json()
        .await
        .map_err(|e| JiraError::InvalidShape(e.to_string()))?;

    let issues = result
        .issues
        .into_iter()
        .map(|raw| {
            let description = raw
                .fields
                .description
                .as_ref()
                .map(adf_to_text)
                .filter(|s| !s.is_empty());
            JiraIssue {
                id: raw.id,
                url: format!("{}/browse/{}", site, raw.key),
                key: raw.key,
                title: raw.fields.summary,
                description,
                status: JiraIssueStatus {
                    name: raw.fields.status.name,
                    status_category_key: raw.fields.status.status_category.key,
                },
                updated_at: raw.fields.updated,
            }
        })
        .collect();

    Ok(issues)
}
