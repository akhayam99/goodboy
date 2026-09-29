use serde::{Deserialize, Serialize};
use tauri::State;
use thiserror::Error;

use crate::integration_credentials::{self, IntegrationCredentialError};
use crate::integrations::http::{self, TransportFailure};
use crate::secrets;

const PROVIDER: &str = "sentry";

const BASE_URL: &str = "https://sentry.io/api/0";
const PAGE_LIMIT: &str = "25";
const DEFAULT_QUERY: &str = "is:unresolved";

#[derive(Clone, Serialize, Deserialize)]
pub struct SentryConfig {
    pub token: String,
    pub org: String,
    pub project: String,
}

#[derive(Deserialize)]
pub struct SentryScope {
    pub org: String,
    pub project: String,
}

integration_credentials::token_cache!(SentryTokenCache);

#[derive(Debug, Error)]
pub enum SentryError {
    #[error("http error: {0}")]
    Http(String),
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

impl SentryError {
    fn kind(&self) -> &'static str {
        match self {
            SentryError::Http(_) => "http",
            SentryError::Timeout(_) => "timeout",
            SentryError::InvalidShape(_) => "shape",
            SentryError::NoToken(_) => "no_token",
            SentryError::Credential(_) => "credential",
            SentryError::Secret(_) => "secret",
        }
    }
}

crate::util::impl_error_serialize!(SentryError);

impl From<reqwest::Error> for SentryError {
    fn from(e: reqwest::Error) -> Self {
        match TransportFailure::from(&e) {
            TransportFailure::Timeout(message) => SentryError::Timeout(message),
            TransportFailure::Network(message) => SentryError::Http(message),
        }
    }
}

impl From<serde_json::Error> for SentryError {
    fn from(e: serde_json::Error) -> Self {
        SentryError::InvalidShape(e.to_string())
    }
}

#[derive(Serialize, Deserialize)]
pub struct SentryOrganization {
    pub slug: String,
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct SentryProject {
    pub slug: String,
    pub name: String,
    pub organization: SentryOrganization,
}

#[derive(Serialize, Deserialize)]
pub struct SentryIssueMetadata {
    #[serde(rename = "type", default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SentryIssueProject {
    pub slug: String,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct SentryIssue {
    pub id: String,
    #[serde(default)]
    pub project: Option<SentryIssueProject>,
    #[serde(rename = "shortId", default)]
    pub short_id: Option<String>,
    pub title: String,
    #[serde(default)]
    pub culprit: Option<String>,
    #[serde(default)]
    pub level: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub count: Option<String>,
    #[serde(rename = "userCount", default)]
    pub user_count: Option<i64>,
    #[serde(rename = "firstSeen", default)]
    pub first_seen: Option<String>,
    #[serde(rename = "lastSeen", default)]
    pub last_seen: Option<String>,
    #[serde(default)]
    pub permalink: Option<String>,
    #[serde(default)]
    pub metadata: Option<SentryIssueMetadata>,
}

#[derive(Serialize)]
pub struct SentryIssuesPage {
    pub issues: Vec<SentryIssue>,
    pub next_cursor: Option<String>,
}

#[derive(Serialize)]
pub struct SentryStackFrame {
    pub filename: Option<String>,
    pub function: Option<String>,
    pub line_no: Option<i64>,
    pub in_app: bool,
}

#[derive(Serialize)]
pub struct SentryTag {
    pub key: String,
    pub value: String,
}

#[derive(Serialize)]
pub struct SentryBreadcrumb {
    pub category: Option<String>,
    pub message: Option<String>,
    pub level: Option<String>,
    pub timestamp: Option<String>,
}

#[derive(Serialize)]
pub struct SentryIssueDetail {
    pub title: Option<String>,
    pub culprit: Option<String>,
    pub frames: Vec<SentryStackFrame>,
    pub tags: Vec<SentryTag>,
    pub breadcrumbs: Vec<SentryBreadcrumb>,
}

/// A pre-m114 entry held the whole connection as one blob. The credential now
/// holds the token alone, so an older blob is read for its token and nothing
/// else.
fn token_from_secret(raw: &str) -> String {
    serde_json::from_str::<SentryConfig>(raw)
        .map(|held| held.token)
        .unwrap_or_else(|_| raw.to_string())
}

fn read_config(
    workspace_id: &str,
    project_id: Option<&str>,
    cache: &SentryTokenCache,
) -> Result<SentryConfig, SentryError> {
    let raw =
        integration_credentials::read_for_binding(PROVIDER, workspace_id, project_id, &cache.0)?
            .ok_or_else(|| SentryError::NoToken(workspace_id.to_string()))?;
    let scope = integration_credentials::config_for_binding(PROVIDER, workspace_id, project_id)?
        .ok_or_else(|| SentryError::NoToken(workspace_id.to_string()))?;
    let scope: SentryScope = serde_json::from_str(&scope)?;
    Ok(SentryConfig {
        token: token_from_secret(&raw),
        org: scope.org,
        project: scope.project,
    })
}

const MAX_ATTEMPTS: u32 = 3;
const BASE_BACKOFF_MS: u64 = 400;
const MAX_RETRY_WAIT_MS: u64 = 5_000;

fn is_transient_status(status: reqwest::StatusCode) -> bool {
    matches!(status.as_u16(), 429 | 502 | 503 | 504)
}

const MONTHS: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let y = if month <= 2 { year - 1 } else { year };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (month + 9) % 12;
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn parse_http_date_ms(value: &str) -> Option<i64> {
    let parts: Vec<&str> = value.split_whitespace().collect();
    if parts.len() != 6 || parts[5] != "GMT" {
        return None;
    }
    let day: i64 = parts[1].parse().ok()?;
    let month = MONTHS.iter().position(|m| *m == parts[2])? as i64 + 1;
    let year: i64 = parts[3].parse().ok()?;
    let clock: Vec<i64> = parts[4]
        .split(':')
        .map(|p| p.parse().ok())
        .collect::<Option<_>>()?;
    if clock.len() != 3 {
        return None;
    }
    let days = days_from_civil(year, month, day);
    Some(((days * 86_400) + clock[0] * 3_600 + clock[1] * 60 + clock[2]) * 1_000)
}

fn retry_after_ms(value: &str, now_ms: i64) -> Option<u64> {
    let value = value.trim();
    if let Ok(seconds) = value.parse::<f64>() {
        return (seconds.is_finite() && seconds >= 0.0).then(|| (seconds * 1000.0).ceil() as u64);
    }
    parse_http_date_ms(value).map(|at| at.saturating_sub(now_ms).max(0) as u64)
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn retry_wait(attempt: u32, retry_after: Option<&str>) -> std::time::Duration {
    let backoff = BASE_BACKOFF_MS.saturating_mul(1u64 << attempt.min(8));
    let wait = retry_after
        .and_then(|value| retry_after_ms(value, now_ms()))
        .unwrap_or(backoff);
    std::time::Duration::from_millis(wait.min(MAX_RETRY_WAIT_MS))
}

async fn send_retrying<F>(build: F) -> Result<reqwest::Response, SentryError>
where
    F: Fn() -> reqwest::RequestBuilder,
{
    let mut attempt = 0;
    loop {
        let is_last = attempt + 1 >= MAX_ATTEMPTS;
        let wait = match build().send().await {
            Ok(res) if !is_last && is_transient_status(res.status()) => retry_wait(
                attempt,
                res.headers()
                    .get(reqwest::header::RETRY_AFTER)
                    .and_then(|v| v.to_str().ok()),
            ),
            Ok(res) => return Ok(res),
            Err(e) if !is_last && (e.is_connect() || e.is_timeout()) => retry_wait(attempt, None),
            Err(e) => return Err(e.into()),
        };
        tokio::time::sleep(wait).await;
        attempt += 1;
    }
}

fn parse_next_cursor(link: &str) -> Option<String> {
    for segment in link.split(',') {
        if !segment.contains("rel=\"next\"") || !segment.contains("results=\"true\"") {
            continue;
        }
        let start = segment.find("cursor=\"")? + "cursor=\"".len();
        let rest = &segment[start..];
        let end = rest.find('"')?;
        return Some(rest[..end].to_string());
    }
    None
}

fn parse_frame(frame: &serde_json::Value) -> SentryStackFrame {
    SentryStackFrame {
        filename: frame
            .get("filename")
            .and_then(|v| v.as_str())
            .map(String::from),
        function: frame
            .get("function")
            .and_then(|v| v.as_str())
            .map(String::from),
        line_no: frame.get("lineNo").and_then(|v| v.as_i64()),
        in_app: frame
            .get("inApp")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
    }
}

fn extract_frames(event: &serde_json::Value) -> Vec<SentryStackFrame> {
    let entries = match event.get("entries").and_then(|v| v.as_array()) {
        Some(entries) => entries,
        None => return Vec::new(),
    };
    for entry in entries {
        let kind = entry.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let data = entry.get("data");
        let frames = match kind {
            "exception" => data
                .and_then(|d| d.get("values"))
                .and_then(|v| v.as_array())
                .and_then(|values| values.last())
                .and_then(|value| value.get("stacktrace"))
                .and_then(|st| st.get("frames")),
            "stacktrace" => data.and_then(|d| d.get("frames")),
            _ => None,
        };
        if let Some(frames) = frames.and_then(|f| f.as_array()) {
            return frames.iter().map(parse_frame).collect();
        }
    }
    Vec::new()
}

fn extract_tags(event: &serde_json::Value) -> Vec<SentryTag> {
    event
        .get("tags")
        .and_then(|value| value.as_array())
        .map(|tags| {
            tags.iter()
                .filter_map(|tag| {
                    let key = tag.get("key").and_then(|value| value.as_str())?;
                    let value = tag.get("value").and_then(|value| value.as_str())?;
                    Some(SentryTag {
                        key: key.to_string(),
                        value: value.to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn extract_breadcrumbs(event: &serde_json::Value) -> Vec<SentryBreadcrumb> {
    event
        .get("entries")
        .and_then(|value| value.as_array())
        .and_then(|entries| {
            entries.iter().find(|entry| {
                entry.get("type").and_then(|value| value.as_str()) == Some("breadcrumbs")
            })
        })
        .and_then(|entry| entry.get("data"))
        .and_then(|data| data.get("values"))
        .and_then(|values| values.as_array())
        .map(|breadcrumbs| {
            breadcrumbs
                .iter()
                .map(|breadcrumb| SentryBreadcrumb {
                    category: breadcrumb
                        .get("category")
                        .and_then(|value| value.as_str())
                        .map(String::from),
                    message: breadcrumb
                        .get("message")
                        .and_then(|value| value.as_str())
                        .map(String::from),
                    level: breadcrumb
                        .get("level")
                        .and_then(|value| value.as_str())
                        .map(String::from),
                    timestamp: breadcrumb
                        .get("timestamp")
                        .and_then(|value| value.as_str())
                        .map(String::from),
                })
                .collect()
        })
        .unwrap_or_default()
}

#[tauri::command]
pub async fn sentry_validate_connection(
    credential_id: String,
    token: Option<String>,
    org: String,
    project: String,
    cache: State<'_, SentryTokenCache>,
) -> Result<SentryProject, SentryError> {
    let secret =
        integration_credentials::secret_to_verify(PROVIDER, &credential_id, token, &cache.0)
            .map(|raw| token_from_secret(&raw))?;
    let url = format!("{}/projects/{}/{}/", BASE_URL, org, project);
    let res = http::client().get(&url).bearer_auth(&secret).send().await?;
    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(SentryError::Http(format!("status {}: {}", status, body)));
    }
    Ok(res.json().await?)
}

const MAX_LIST_PAGES: u32 = 10;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SentryOrganizationSummary {
    pub slug: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SentryProjectSummary {
    pub id: String,
    pub slug: String,
    pub name: String,
    #[serde(default)]
    pub platform: Option<String>,
}

fn verified_secret(
    credential_id: &str,
    token: Option<String>,
    cache: &SentryTokenCache,
) -> Result<String, SentryError> {
    integration_credentials::secret_to_verify(PROVIDER, credential_id, token, &cache.0)
        .map(|raw| token_from_secret(&raw))
        .map_err(SentryError::from)
}

async fn get_all_pages<T: serde::de::DeserializeOwned>(
    url: &str,
    secret: &str,
) -> Result<Vec<T>, SentryError> {
    let mut items: Vec<T> = Vec::new();
    let mut cursor: Option<String> = None;
    for _ in 0..MAX_LIST_PAGES {
        let res = send_retrying(|| {
            let request = http::client().get(url).bearer_auth(secret);
            match cursor.as_deref() {
                Some(value) => request.query(&[("cursor", value)]),
                None => request,
            }
        })
        .await?;
        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            return Err(SentryError::Http(format!("status {}: {}", status, body)));
        }
        let next = res
            .headers()
            .get(reqwest::header::LINK)
            .and_then(|v| v.to_str().ok())
            .and_then(parse_next_cursor);
        let body = res.text().await?;
        let page: Vec<T> = serde_json::from_str(&body)?;
        items.extend(page);
        match next {
            Some(value) if Some(&value) != cursor.as_ref() => cursor = Some(value),
            _ => break,
        }
    }
    Ok(items)
}

fn organizations_url() -> String {
    format!("{}/organizations/?member=1", BASE_URL)
}

fn organization_projects_url(org: &str) -> String {
    format!("{}/organizations/{}/projects/", BASE_URL, org)
}

#[tauri::command]
pub async fn sentry_list_organizations(
    credential_id: String,
    token: Option<String>,
    cache: State<'_, SentryTokenCache>,
) -> Result<Vec<SentryOrganizationSummary>, SentryError> {
    let secret = verified_secret(&credential_id, token, &cache)?;
    get_all_pages(&organizations_url(), &secret).await
}

#[tauri::command]
pub async fn sentry_list_projects(
    credential_id: String,
    token: Option<String>,
    org: String,
    cache: State<'_, SentryTokenCache>,
) -> Result<Vec<SentryProjectSummary>, SentryError> {
    let secret = verified_secret(&credential_id, token, &cache)?;
    get_all_pages(&organization_projects_url(org.trim()), &secret).await
}

fn issues_url(cfg: &SentryConfig, sentry_project: Option<&str>) -> String {
    let project = sentry_project
        .map(str::trim)
        .filter(|slug| !slug.is_empty())
        .unwrap_or(&cfg.project);
    format!("{}/projects/{}/{}/issues/", BASE_URL, cfg.org, project)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SentryCodeMapping {
    #[serde(rename = "projectSlug", default)]
    pub project_slug: Option<String>,
    #[serde(rename = "repoName", default)]
    pub repo_name: Option<String>,
    #[serde(rename = "stackRoot", default)]
    pub stack_root: Option<String>,
    #[serde(rename = "sourceRoot", default)]
    pub source_root: Option<String>,
}

fn code_mappings_url(org: &str) -> String {
    format!("{}/organizations/{}/code-mappings/", BASE_URL, org)
}

#[tauri::command]
pub async fn sentry_list_code_mappings(
    workspace_id: String,
    cache: State<'_, SentryTokenCache>,
) -> Result<Vec<SentryCodeMapping>, SentryError> {
    let cfg = read_config(&workspace_id, None, &cache)?;
    get_all_pages(&code_mappings_url(&cfg.org), &cfg.token).await
}

#[tauri::command]
pub async fn sentry_connect(
    credential_id: String,
    token: Option<String>,
    cache: State<'_, SentryTokenCache>,
) -> Result<(), SentryError> {
    let secret =
        integration_credentials::secret_to_verify(PROVIDER, &credential_id, token, &cache.0)
            .map(|raw| token_from_secret(&raw))?;
    integration_credentials::store_secret(&credential_id, &secret, &cache.0)?;
    Ok(())
}

#[tauri::command]
pub async fn sentry_fetch_issues(
    workspace_id: String,
    project_id: Option<String>,
    query: Option<String>,
    cursor: Option<String>,
    sentry_project: Option<String>,
    cache: State<'_, SentryTokenCache>,
) -> Result<SentryIssuesPage, SentryError> {
    let cfg = read_config(&workspace_id, project_id.as_deref(), &cache)?;
    let url = issues_url(&cfg, sentry_project.as_deref());
    let mut params: Vec<(&str, String)> = vec![
        ("limit", PAGE_LIMIT.to_string()),
        ("query", query.unwrap_or_else(|| DEFAULT_QUERY.to_string())),
    ];
    if let Some(cursor) = cursor {
        params.push(("cursor", cursor));
    }
    let res = send_retrying(|| {
        http::client()
            .get(&url)
            .bearer_auth(&cfg.token)
            .query(&params)
    })
    .await?;
    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(SentryError::Http(format!("status {}: {}", status, body)));
    }
    let next_cursor = res
        .headers()
        .get(reqwest::header::LINK)
        .and_then(|v| v.to_str().ok())
        .and_then(parse_next_cursor);
    let issues: Vec<SentryIssue> = res.json().await?;
    Ok(SentryIssuesPage {
        issues,
        next_cursor,
    })
}

#[derive(Deserialize)]
struct SentryShortIdResolution {
    group: SentryIssue,
}

fn short_id_url(org: &str, short_id: &str) -> String {
    format!(
        "{}/organizations/{}/shortids/{}/",
        BASE_URL,
        org,
        short_id.trim().to_uppercase()
    )
}

#[tauri::command]
pub async fn sentry_resolve_short_id(
    workspace_id: String,
    project_id: Option<String>,
    short_id: String,
    cache: State<'_, SentryTokenCache>,
) -> Result<SentryIssue, SentryError> {
    let cfg = read_config(&workspace_id, project_id.as_deref(), &cache)?;
    let url = short_id_url(&cfg.org, &short_id);
    let res = send_retrying(|| http::client().get(&url).bearer_auth(&cfg.token)).await?;
    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(SentryError::Http(format!("status {}: {}", status, body)));
    }
    let body = res.text().await?;
    let resolved: SentryShortIdResolution = serde_json::from_str(&body)?;
    Ok(resolved.group)
}

#[tauri::command]
pub async fn sentry_fetch_issue(
    workspace_id: String,
    project_id: Option<String>,
    issue_id: String,
    cache: State<'_, SentryTokenCache>,
) -> Result<SentryIssue, SentryError> {
    let cfg = read_config(&workspace_id, project_id.as_deref(), &cache)?;
    let url = format!("{}/issues/{}/", BASE_URL, issue_id);
    let res = send_retrying(|| http::client().get(&url).bearer_auth(&cfg.token)).await?;
    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(SentryError::Http(format!("status {}: {}", status, body)));
    }
    let body = res.text().await?;
    let issue: SentryIssue = serde_json::from_str(&body)?;
    Ok(issue)
}

#[tauri::command]
pub async fn sentry_fetch_issue_detail(
    workspace_id: String,
    project_id: Option<String>,
    issue_id: String,
    cache: State<'_, SentryTokenCache>,
) -> Result<SentryIssueDetail, SentryError> {
    let cfg = read_config(&workspace_id, project_id.as_deref(), &cache)?;
    let url = format!("{}/issues/{}/events/latest/", BASE_URL, issue_id);
    let res = send_retrying(|| http::client().get(&url).bearer_auth(&cfg.token)).await?;
    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(SentryError::Http(format!("status {}: {}", status, body)));
    }
    let event: serde_json::Value = res.json().await?;
    let title = event
        .get("title")
        .and_then(|v| v.as_str())
        .map(String::from);
    let culprit = event
        .get("culprit")
        .and_then(|v| v.as_str())
        .map(String::from);
    Ok(SentryIssueDetail {
        title,
        culprit,
        frames: extract_frames(&event),
        tags: extract_tags(&event),
        breadcrumbs: extract_breadcrumbs(&event),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const CODE_MAPPINGS_FIXTURE: &str = r#"[{"id":"12","projectId":"4501","projectSlug":"payments-api","repoId":"77","repoName":"northwind/ledger-core","integrationId":"5","provider":{"key":"github","slug":"github","name":"GitHub"},"stackRoot":"services/payments","sourceRoot":"services/payments","defaultBranch":"main"},{"id":"13","projectSlug":"storefront-web","repoName":"northwind/storefront-web","stackRoot":"","sourceRoot":""}]"#;
    const ISSUE_WITH_PROJECT: &str = r#"{"id":"91","shortId":"PAYMENTS-API-3","title":"KeyError: amount","project":{"id":"4501","name":"payments-api","slug":"payments-api","platform":"python"}}"#;

    fn config(project: &str) -> SentryConfig {
        SentryConfig {
            token: "t".to_string(),
            org: "northwind".to_string(),
            project: project.to_string(),
        }
    }

    #[test]
    fn short_id_resolution_reads_the_group_across_the_organization() {
        assert_eq!(
            short_id_url("northwind", " notify-3f "),
            "https://sentry.io/api/0/organizations/northwind/shortids/NOTIFY-3F/"
        );
        let body = format!(
            r#"{{"organizationSlug":"northwind","projectSlug":"payments-api","groupId":"91","shortId":"PAYMENTS-API-3","group":{ISSUE_WITH_PROJECT}}}"#
        );
        let resolved: SentryShortIdResolution = serde_json::from_str(&body).expect("parses");
        assert_eq!(resolved.group.id, "91");
        assert_eq!(resolved.group.short_id.as_deref(), Some("PAYMENTS-API-3"));
    }

    #[test]
    fn code_mappings_fixture_reads_project_repo_and_roots() {
        let mappings: Vec<SentryCodeMapping> =
            serde_json::from_str(CODE_MAPPINGS_FIXTURE).expect("parses");
        assert_eq!(mappings[0].project_slug.as_deref(), Some("payments-api"));
        assert_eq!(
            mappings[0].repo_name.as_deref(),
            Some("northwind/ledger-core")
        );
        assert_eq!(mappings[0].stack_root.as_deref(), Some("services/payments"));
        assert_eq!(mappings[1].project_slug.as_deref(), Some("storefront-web"));
        assert_eq!(
            code_mappings_url("northwind"),
            "https://sentry.io/api/0/organizations/northwind/code-mappings/"
        );
    }

    #[test]
    fn issue_carries_its_sentry_project() {
        let issue: SentryIssue = serde_json::from_str(ISSUE_WITH_PROJECT).expect("parses");
        assert_eq!(
            issue.project,
            Some(SentryIssueProject {
                slug: "payments-api".to_string(),
                name: Some("payments-api".to_string()),
            })
        );
    }

    #[test]
    fn issues_url_uses_a_linked_project_over_the_default() {
        let cfg = config("storefront-web");
        assert_eq!(
            issues_url(&cfg, None),
            "https://sentry.io/api/0/projects/northwind/storefront-web/issues/"
        );
        assert_eq!(
            issues_url(&cfg, Some("payments-api")),
            "https://sentry.io/api/0/projects/northwind/payments-api/issues/"
        );
        assert_eq!(
            issues_url(&cfg, Some("  ")),
            "https://sentry.io/api/0/projects/northwind/storefront-web/issues/"
        );
    }

    const ORGANIZATIONS_FIXTURE: &str = r#"[{"id":"1","slug":"northwind","name":"Northwind","dateCreated":"2024-01-01T00:00:00Z","isEarlyAdopter":false,"require2FA":false,"avatar":{"avatarType":"letter_avatar","avatarUuid":null},"features":[],"status":{"id":"active","name":"active"}},{"id":"2","slug":"harborline","name":"Harborline"}]"#;
    const PROJECTS_FIXTURE: &str = r#"[{"id":"4501","slug":"payments-api","name":"payments-api","platform":"python","dateCreated":"2024-01-01T00:00:00Z","isBookmarked":false,"isMember":true,"features":[],"firstEvent":null,"hasAccess":true,"team":{"id":"9","slug":"core","name":"Core"},"teams":[]},{"id":"4502","slug":"storefront-web","name":"storefront-web","platform":null}]"#;

    #[test]
    fn organizations_fixture_reads_slug_and_name() {
        let orgs: Vec<SentryOrganizationSummary> =
            serde_json::from_str(ORGANIZATIONS_FIXTURE).expect("parses");
        assert_eq!(
            orgs,
            vec![
                SentryOrganizationSummary {
                    slug: "northwind".to_string(),
                    name: "Northwind".to_string()
                },
                SentryOrganizationSummary {
                    slug: "harborline".to_string(),
                    name: "Harborline".to_string()
                },
            ]
        );
    }

    #[test]
    fn projects_fixture_reads_id_slug_name_and_platform() {
        let projects: Vec<SentryProjectSummary> =
            serde_json::from_str(PROJECTS_FIXTURE).expect("parses");
        assert_eq!(projects.len(), 2);
        assert_eq!(projects[0].id, "4501");
        assert_eq!(projects[0].slug, "payments-api");
        assert_eq!(projects[0].platform.as_deref(), Some("python"));
        assert_eq!(projects[1].platform, None);
    }

    #[test]
    fn list_urls_point_at_the_member_orgs_and_the_org_projects() {
        assert_eq!(
            organizations_url(),
            "https://sentry.io/api/0/organizations/?member=1"
        );
        assert_eq!(
            organization_projects_url("northwind"),
            "https://sentry.io/api/0/organizations/northwind/projects/"
        );
    }

    #[test]
    fn a_rate_limit_or_a_gateway_error_is_transient_and_a_client_error_is_not() {
        for code in [429u16, 502, 503, 504] {
            assert!(is_transient_status(
                reqwest::StatusCode::from_u16(code).unwrap()
            ));
        }
        for code in [200u16, 400, 401, 403, 404, 500] {
            assert!(!is_transient_status(
                reqwest::StatusCode::from_u16(code).unwrap()
            ));
        }
    }

    #[test]
    fn the_retry_wait_honors_retry_after_and_stays_capped() {
        assert_eq!(retry_wait(0, Some("2")), std::time::Duration::from_secs(2));
        assert_eq!(
            retry_wait(0, Some("0.25")),
            std::time::Duration::from_millis(250)
        );
        assert_eq!(
            retry_wait(0, Some("600")),
            std::time::Duration::from_millis(MAX_RETRY_WAIT_MS)
        );
        assert_eq!(
            retry_wait(0, Some("soon")),
            std::time::Duration::from_millis(BASE_BACKOFF_MS)
        );
        assert_eq!(
            retry_wait(1, None),
            std::time::Duration::from_millis(BASE_BACKOFF_MS * 2)
        );
        assert_eq!(
            retry_wait(30, None),
            std::time::Duration::from_millis(MAX_RETRY_WAIT_MS)
        );
    }

    #[test]
    fn the_retry_wait_reads_an_http_date() {
        let at = parse_http_date_ms("Wed, 21 Oct 2026 07:28:00 GMT").unwrap();
        assert_eq!(at, 1_792_567_680_000);
        assert_eq!(
            retry_after_ms("Wed, 21 Oct 2026 07:28:00 GMT", at - 3_000),
            Some(3_000)
        );
        assert_eq!(
            retry_after_ms("Wed, 21 Oct 2026 07:28:00 GMT", at + 10_000),
            Some(0)
        );
        assert_eq!(retry_after_ms("Wed, 21 Oct 2026 07:28:00 CET", at), None);
        assert_eq!(parse_http_date_ms("Thu, 01 Jan 1970 00:00:00 GMT"), Some(0));
    }

    async fn serve(responses: Vec<&'static str>) -> (String, tokio::task::JoinHandle<usize>) {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/issues/", listener.local_addr().unwrap());
        let handle = tokio::spawn(async move {
            let mut served = 0;
            for response in responses {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut buf = [0u8; 4096];
                let _ = socket.read(&mut buf).await.unwrap();
                socket.write_all(response.as_bytes()).await.unwrap();
                socket.shutdown().await.unwrap();
                served += 1;
            }
            served
        });
        (url, handle)
    }

    const RATE_LIMITED: &str = "HTTP/1.1 429 Too Many Requests\r\nRetry-After: 0\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    const OK_EMPTY: &str =
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n[]";

    #[tokio::test]
    async fn a_rate_limited_first_call_is_retried_and_recovers() {
        let (url, server) = serve(vec![RATE_LIMITED, OK_EMPTY]).await;
        let client = reqwest::Client::new();
        let res = send_retrying(|| client.get(&url)).await.unwrap();
        assert_eq!(res.status(), reqwest::StatusCode::OK);
        assert_eq!(server.await.unwrap(), 2);
    }

    #[tokio::test]
    async fn a_rate_limit_that_never_clears_surfaces_after_the_last_attempt() {
        let (url, server) = serve(vec![RATE_LIMITED; MAX_ATTEMPTS as usize]).await;
        let client = reqwest::Client::new();
        let res = send_retrying(|| client.get(&url)).await.unwrap();
        assert_eq!(res.status(), reqwest::StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(server.await.unwrap(), MAX_ATTEMPTS as usize);
    }

    #[test]
    fn next_cursor_extracts_when_results_true() {
        let link = "<https://sentry.io/api/0/x/?cursor=0:0:1>; rel=\"previous\"; results=\"false\"; cursor=\"0:0:1\", <https://sentry.io/api/0/x/?cursor=0:100:0>; rel=\"next\"; results=\"true\"; cursor=\"0:100:0\"";
        assert_eq!(parse_next_cursor(link), Some("0:100:0".to_string()));
    }

    #[test]
    fn next_cursor_none_when_results_false() {
        let link = "<https://sentry.io/api/0/x/?cursor=0:100:0>; rel=\"next\"; results=\"false\"; cursor=\"0:100:0\"";
        assert_eq!(parse_next_cursor(link), None);
    }

    #[test]
    fn next_cursor_none_when_no_next_rel() {
        let link = "<https://sentry.io/api/0/x/?cursor=0:0:1>; rel=\"previous\"; results=\"true\"; cursor=\"0:0:1\"";
        assert_eq!(parse_next_cursor(link), None);
    }

    #[test]
    fn extract_frames_from_exception_entry() {
        let event = serde_json::json!({
            "entries": [
                { "type": "breadcrumbs", "data": {} },
                {
                    "type": "exception",
                    "data": {
                        "values": [
                            { "stacktrace": { "frames": [ { "filename": "a.ts", "function": "old", "lineNo": 1, "inApp": false } ] } },
                            { "stacktrace": { "frames": [ { "filename": "b.ts", "function": "boom", "lineNo": 42, "inApp": true } ] } }
                        ]
                    }
                }
            ]
        });
        let frames = extract_frames(&event);
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].filename.as_deref(), Some("b.ts"));
        assert_eq!(frames[0].line_no, Some(42));
        assert!(frames[0].in_app);
    }

    #[test]
    fn extract_frames_empty_without_entries() {
        let event = serde_json::json!({ "title": "x" });
        assert!(extract_frames(&event).is_empty());
    }

    #[test]
    fn issue_deserializes_counts_and_seen_timestamps() {
        let payload = serde_json::json!({
            "id": "42",
            "shortId": "GOODBOY-42",
            "title": "TypeError: request failed",
            "culprit": "api/items",
            "level": "error",
            "status": "unresolved",
            "count": "128",
            "userCount": 9,
            "firstSeen": "2026-07-01T09:00:00Z",
            "lastSeen": "2026-07-23T10:00:00Z",
            "permalink": "https://sentry.io/issues/42"
        });
        let issue: SentryIssue = serde_json::from_value(payload).unwrap();
        assert_eq!(issue.count.as_deref(), Some("128"));
        assert_eq!(issue.user_count, Some(9));
        assert_eq!(issue.first_seen.as_deref(), Some("2026-07-01T09:00:00Z"));
        assert_eq!(issue.last_seen.as_deref(), Some("2026-07-23T10:00:00Z"));
    }

    #[test]
    fn issue_deserializes_when_optional_fields_are_absent() {
        let payload = serde_json::json!({ "id": "42", "title": "Boom" });
        let issue: SentryIssue = serde_json::from_value(payload).unwrap();
        assert_eq!(issue.id, "42");
        assert!(issue.count.is_none());
        assert!(issue.metadata.is_none());
    }

    #[test]
    fn extracts_tags_and_breadcrumbs() {
        let event = serde_json::json!({
            "tags": [
                { "key": "release", "value": "web@1.2.3" },
                { "key": "environment", "value": "production" }
            ],
            "entries": [{
                "type": "breadcrumbs",
                "data": {
                    "values": [{
                        "category": "http",
                        "message": "GET /api/items",
                        "level": "info",
                        "timestamp": "2026-07-23T10:00:00Z"
                    }]
                }
            }]
        });
        let tags = extract_tags(&event);
        let breadcrumbs = extract_breadcrumbs(&event);
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].key, "release");
        assert_eq!(breadcrumbs.len(), 1);
        assert_eq!(breadcrumbs[0].message.as_deref(), Some("GET /api/items"));
    }
}
