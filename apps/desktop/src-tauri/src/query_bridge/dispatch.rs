use std::collections::BTreeMap;

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

use super::args::{optional_text, required_text};
use super::mount::MountRow;
use super::protocol::{spec_for, Access, BridgeError, QueryRequest, MOUNT_UNAVAILABLE};
use crate::db::Db;

pub(super) type Args = BTreeMap<String, Value>;

fn text(args: &Args, key: &str) -> Result<String, String> {
    required_text(args, key).map_err(|error| error.message)
}

fn encode<T: Serialize>(value: T) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|error| error.to_string())
}

fn number(args: &Args, key: &str) -> Result<i64, String> {
    args.get(key)
        .and_then(Value::as_i64)
        .ok_or_else(|| format!("missing numeric argument: {}", key))
}

fn optional_number(args: &Args, key: &str) -> Option<i64> {
    args.get(key).and_then(Value::as_i64)
}

fn unsigned(args: &Args, key: &str) -> Result<u64, String> {
    let value = number(args, key)?;
    u64::try_from(value).map_err(|_| format!("{} must not be negative", key))
}

fn flag(args: &Args, key: &str) -> bool {
    args.get(key).and_then(Value::as_bool).unwrap_or(false)
}

pub(super) struct Scope<'a> {
    pub(super) workspace: &'a str,
    pub(super) session: &'a str,
    pub(super) project: Option<String>,
    pub(super) mount: Option<String>,
    pub(super) args: &'a Args,
    pub(super) resolved: Option<MountRow>,
}

impl Scope<'_> {
    pub(super) fn project_id(&self) -> Option<&str> {
        self.project.as_deref()
    }

    pub(super) fn mount_id(&self) -> Option<&str> {
        self.mount.as_deref()
    }

    pub(super) fn require_mount(&self) -> Result<MountRow, BridgeError> {
        self.resolved.clone().ok_or_else(|| {
            BridgeError::coded(
                MOUNT_UNAVAILABLE,
                "this command needs a mount of this session",
            )
        })
    }
}

fn is_mount_dependent(provider: &str, verb: &str) -> bool {
    provider == "github" || (provider == "gitlab" && verb == "mr-create")
}

fn creates_request(provider: &str, verb: &str) -> bool {
    matches!(
        (provider, verb),
        ("github", "pr-create") | ("gitlab", "mr-create")
    )
}

fn config_field(provider: &str, scope: &Scope<'_>, key: &str) -> Result<String, String> {
    let raw = crate::integration_credentials::config_for_binding(
        provider,
        scope.workspace,
        scope.project_id(),
    )
    .map_err(|error| error.to_string())?
    .ok_or_else(|| format!("{} is not connected in this workspace", provider))?;
    let parsed: Value = serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    parsed
        .get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| format!("the {} connection stores no {}", provider, key))
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SlackChannelSetting {
    id: String,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SlackAgentPolicy {
    read_followed: Option<String>,
    read_others: Option<String>,
    reply: Option<String>,
    react: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
struct SlackSignature {
    agents: Option<bool>,
    text: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SlackBridgeSettings {
    followed_channels: Vec<SlackChannelSetting>,
    has_selected_channels: Option<bool>,
    agent_policy: SlackAgentPolicy,
    signature: SlackSignature,
}

fn slack_settings(scope: &Scope<'_>) -> Result<SlackBridgeSettings, String> {
    let raw = crate::integration_credentials::config_for_binding(
        "slack",
        scope.workspace,
        scope.project_id(),
    )
    .map_err(|error| error.to_string())?
    .ok_or_else(|| "slack is not connected in this workspace".to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

fn slack_channel_allowed(settings: &SlackBridgeSettings, channel: &str) -> bool {
    if settings.has_selected_channels != Some(true) {
        return true;
    }
    let is_followed = settings
        .followed_channels
        .iter()
        .any(|candidate| candidate.id == channel);
    if is_followed {
        return settings.agent_policy.read_followed.as_deref() == Some("allow");
    }
    settings.agent_policy.read_others.as_deref() == Some("allow")
}

fn ensure_slack_channel(settings: &SlackBridgeSettings, channel: &str) -> Result<(), String> {
    if slack_channel_allowed(settings, channel) {
        return Ok(());
    }
    Err(format!(
        "this channel has not been shared with Goodboy: {}",
        channel
    ))
}

fn slack_signature(settings: &SlackBridgeSettings) -> Option<String> {
    if settings.signature.agents != Some(true) {
        return None;
    }
    settings
        .signature
        .text
        .clone()
        .filter(|value| !value.trim().is_empty())
}

fn filter_slack_channels(
    settings: &SlackBridgeSettings,
    channels: Vec<crate::slack::SlackChannel>,
) -> Vec<crate::slack::SlackChannel> {
    if settings.has_selected_channels != Some(true) {
        return channels.into_iter().take(12).collect();
    }
    channels
        .into_iter()
        .filter(|channel| slack_channel_allowed(settings, &channel.id))
        .collect()
}

struct IntegrationDraftParams<'a> {
    workspace_id: &'a str,
    session_id: &'a str,
    verb: &'a str,
    target: Value,
    body: &'a str,
}

fn save_integration_draft(
    app: &AppHandle,
    params: IntegrationDraftParams<'_>,
) -> Result<Value, String> {
    let state = app.state::<Db>();
    let conn = state
        .0
        .lock()
        .map_err(|_| "db mutex poisoned".to_string())?;
    insert_integration_draft(&conn, params)
}

fn insert_integration_draft(
    conn: &rusqlite::Connection,
    params: IntegrationDraftParams<'_>,
) -> Result<Value, String> {
    let id = crate::util::uuid_v4();
    let now = crate::util::now_ms();
    conn.execute(
        "INSERT INTO integration_drafts
         (id, workspace_id, session_id, provider, verb, target_json, body, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'slack', ?4, ?5, ?6, 'pending', ?7, ?7)",
        rusqlite::params![
            id,
            params.workspace_id,
            params.session_id,
            params.verb,
            params.target.to_string(),
            params.body,
            now
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(serde_json::json!({
        "status": "queued",
        "draftId": id,
        "message": "Saved as a draft for approval. Do not send it again."
    }))
}

fn ensure_connected(app: &AppHandle, workspace_id: &str, provider: &str) -> Result<(), String> {
    let state = app.state::<Db>();
    let conn = state
        .0
        .lock()
        .map_err(|_| "db mutex poisoned".to_string())?;
    conn.query_row(
        "SELECT 1 FROM integration_bindings
         WHERE workspace_id = ?1 AND provider = ?2
         LIMIT 1",
        rusqlite::params![workspace_id, provider],
        |_| Ok(()),
    )
    .optional()
    .map_err(|error| error.to_string())?
    .ok_or_else(|| format!("{} is not connected in this workspace", provider))
}

fn named_project_id(app: &AppHandle, workspace_id: &str, name: &str) -> Result<String, String> {
    let state = app.state::<Db>();
    let conn = state
        .0
        .lock()
        .map_err(|_| "db mutex poisoned".to_string())?;
    conn.query_row(
        "SELECT id FROM projects
         WHERE workspace_id = ?1 AND disconnected_at IS NULL AND lower(name) = lower(?2)
         ORDER BY created_at ASC, id ASC
         LIMIT 1",
        rusqlite::params![workspace_id, name],
        |row| row.get(0),
    )
    .optional()
    .map_err(|error| error.to_string())?
    .ok_or_else(|| format!("unknown project: {}", name))
}

pub async fn dispatch(app: &AppHandle, request: &QueryRequest) -> Result<Value, BridgeError> {
    if request.workspace_id.is_empty() {
        return Err("no workspace: pass --workspace <id>".into());
    }
    let spec = spec_for(&request.provider, &request.verb)
        .ok_or_else(|| format!("unknown command: {} {}", request.provider, request.verb))?;
    if request.provider == "project" {
        return super::project::materialize(app, request).await;
    }
    let project = match request.project.trim() {
        "" => None,
        name => Some(named_project_id(app, &request.workspace_id, name)?),
    };
    let mut scope = Scope {
        workspace: &request.workspace_id,
        session: &request.session_id,
        project,
        mount: match request.mount.trim() {
            "" => None,
            id => Some(id.to_string()),
        },
        args: &request.args,
        resolved: None,
    };
    if request.provider == "mount" {
        return super::mount::dispatch(app, &scope, &request.verb).await;
    }
    if request.provider == "series" {
        return super::series::dispatch(app, &scope, &request.verb).await;
    }
    if request.provider != "github" {
        ensure_connected(app, &request.workspace_id, &request.provider)?;
    }
    if is_mount_dependent(&request.provider, &request.verb) {
        scope.resolved = Some(super::mount::resolve_scope_mount(app, &scope)?);
    }
    if creates_request(&request.provider, &request.verb) {
        return super::mount::create_request(app, &scope, &request.provider).await;
    }
    let args = &request.args;
    match spec.access {
        Access::Read => run_read(app, &request.provider, &request.verb, &scope, args)
            .await
            .map_err(BridgeError::from),
        Access::Write => run_write(app, &request.provider, &request.verb, &scope, args)
            .await
            .map_err(BridgeError::from),
    }
}

async fn run_read(
    app: &AppHandle,
    provider: &str,
    verb: &str,
    scope: &Scope<'_>,
    args: &Args,
) -> Result<Value, String> {
    match (provider, verb) {
        ("linear", "issue") => encode(
            crate::linear::linear_fetch_issue(
                scope.workspace.to_string(),
                scope.project.clone(),
                text(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("linear", "issues-assigned") => encode(
            crate::linear::linear_fetch_assigned_issues(
                scope.workspace.to_string(),
                scope.project.clone(),
                optional_text(args, "team"),
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("linear", "comments") => encode(
            crate::linear::linear_fetch_issue_comments(
                scope.workspace.to_string(),
                scope.project.clone(),
                text(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("sentry", "issues") => encode(
            crate::sentry::sentry_fetch_issues(
                scope.workspace.to_string(),
                scope.project.clone(),
                optional_text(args, "query"),
                optional_text(args, "cursor"),
                optional_text(args, "sentry_project"),
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("sentry", "issue") => encode(
            crate::sentry::sentry_fetch_issue(
                scope.workspace.to_string(),
                scope.project.clone(),
                text(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("sentry", "issue-detail") => encode(
            crate::sentry::sentry_fetch_issue_detail(
                scope.workspace.to_string(),
                scope.project.clone(),
                text(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("github", "prs") => super::github::prs(app, scope, optional_text(args, "state")).await,
        ("github", "pr") => super::github::pr(app, scope, optional_number(args, "number")).await,
        ("github", "pr-for-branch") => {
            super::github::pr_for_branch(app, scope, text(args, "branch")?).await
        }
        ("github", "pr-diff") => {
            super::github::pr_diff(app, scope, optional_number(args, "number")).await
        }
        ("github", "pr-checks") => {
            super::github::pr_checks(app, scope, optional_number(args, "number")).await
        }
        ("github", "pr-comments") => {
            super::github::pr_comments(app, scope, optional_number(args, "number")).await
        }
        ("github", "issues-assigned") => super::github::issues_assigned(app, scope).await,
        ("github", "issue") => super::github::issue(app, scope, number(args, "number")?).await,
        ("github", "issue-comments") => {
            super::github::issue_comments(app, scope, number(args, "number")?).await
        }
        ("gitlab", "issues-assigned") => encode(
            crate::gitlab::gitlab_fetch_assigned_issues(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "issue") => encode(
            crate::gitlab::gitlab_fetch_issue(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "issue-notes") => encode(
            crate::gitlab::gitlab_list_issue_notes(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "issue-discussions") => encode(
            crate::gitlab::gitlab_list_issue_discussions(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "mrs-assigned") => encode(
            crate::gitlab::gitlab_fetch_assigned_mrs(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "mrs") => encode(
            crate::gitlab::gitlab_fetch_project_mrs(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "mr-for-branch") => encode(
            crate::gitlab::gitlab_mr_for_branch(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                text(args, "branch")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "mr-diff") => encode(
            crate::gitlab::gitlab_mr_diff(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "mr-discussions") => encode(
            crate::gitlab::gitlab_list_mr_discussions(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "mr-approval-state") => encode(
            crate::gitlab::gitlab_mr_approval_state(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("jira", "issues") => encode(
            crate::jira::jira_list_issues(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("jira", scope, "siteUrl")?,
                config_field("jira", scope, "email")?,
                match optional_text(args, "project") {
                    Some(project) => project,
                    None => config_field("jira", scope, "projectKey")?,
                },
                !flag(args, "all"),
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("jira", "issue") => encode(
            crate::jira::jira_get_issue(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("jira", scope, "siteUrl")?,
                config_field("jira", scope, "email")?,
                text(args, "key")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("jira", "comments") => encode(
            crate::jira::jira_list_comments(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("jira", scope, "siteUrl")?,
                config_field("jira", scope, "email")?,
                text(args, "key")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("jira", "transitions") => encode(
            crate::jira::jira_list_transitions(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("jira", scope, "siteUrl")?,
                config_field("jira", scope, "email")?,
                text(args, "key")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "prs") => encode(
            crate::bitbucket::bitbucket_list_pull_requests(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                optional_text(args, "state"),
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "pr") => encode(
            crate::bitbucket::bitbucket_get_pull_request(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                unsigned(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "pr-diff") => encode(
            crate::bitbucket::bitbucket_pull_request_diff(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                unsigned(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "pr-comments") => encode(
            crate::bitbucket::bitbucket_list_pull_request_comments(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                unsigned(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "pr-statuses") => encode(
            crate::bitbucket::bitbucket_list_pull_request_statuses(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                unsigned(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "pr-for-branch") => encode(
            crate::bitbucket::bitbucket_pull_request_for_branch(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                text(args, "branch")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("slack", "channels") => {
            let settings = slack_settings(scope)?;
            let channels = crate::slack::slack_list_channels(
                scope.workspace.to_string(),
                scope.project.clone(),
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?;
            encode(filter_slack_channels(&settings, channels))
        }
        ("slack", "thread-heads") => {
            let channel = text(args, "channel")?;
            ensure_slack_channel(&slack_settings(scope)?, &channel)?;
            encode(
                crate::slack::slack_list_thread_heads(
                    scope.workspace.to_string(),
                    scope.project.clone(),
                    channel,
                    app.state(),
                )
                .await
                .map_err(|error| error.to_string())?,
            )
        }
        ("slack", "thread") => {
            let channel = text(args, "channel")?;
            ensure_slack_channel(&slack_settings(scope)?, &channel)?;
            encode(
                crate::slack::slack_get_thread(
                    scope.workspace.to_string(),
                    scope.project.clone(),
                    channel,
                    text(args, "ts")?,
                    app.state(),
                )
                .await
                .map_err(|error| error.to_string())?,
            )
        }
        ("slack", "permalink") => {
            let channel = text(args, "channel")?;
            ensure_slack_channel(&slack_settings(scope)?, &channel)?;
            encode(
                crate::slack::slack_get_permalink(
                    scope.workspace.to_string(),
                    scope.project.clone(),
                    channel,
                    text(args, "ts")?,
                    app.state(),
                )
                .await
                .map_err(|error| error.to_string())?,
            )
        }
        ("slack", "users") => encode(
            crate::slack::slack_list_users(
                scope.workspace.to_string(),
                scope.project.clone(),
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        _ => Err(format!("unhandled read command: {} {}", provider, verb)),
    }
}

async fn run_write(
    app: &AppHandle,
    provider: &str,
    verb: &str,
    scope: &Scope<'_>,
    args: &Args,
) -> Result<Value, String> {
    match (provider, verb) {
        ("linear", "comment-create") => encode(
            crate::linear::linear_create_comment(
                scope.workspace.to_string(),
                scope.project.clone(),
                text(args, "id")?,
                text(args, "body")?,
                optional_text(args, "parent"),
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("linear", "issue-update") => encode(
            crate::linear::linear_update_issue(
                scope.workspace.to_string(),
                scope.project.clone(),
                text(args, "id")?,
                text(args, "description")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("github", "pr-comment-create") => {
            super::github::pr_comment_create(
                app,
                scope,
                text(args, "body")?,
                optional_number(args, "number"),
            )
            .await
        }
        ("github", "pr-thread-reply") => {
            super::github::pr_thread_reply(app, scope, text(args, "thread")?, text(args, "body")?)
                .await
        }
        ("github", "pr-thread-resolve") => {
            super::github::pr_thread_resolve(app, scope, text(args, "thread")?).await
        }
        ("github", "pr-ready") => {
            super::github::pr_ready(app, scope, optional_number(args, "number")).await
        }
        ("github", "pr-merge") => {
            super::github::pr_merge(
                app,
                scope,
                optional_number(args, "number"),
                optional_text(args, "method"),
            )
            .await
        }
        ("github", "issue-comment-create") => {
            super::github::issue_comment_create(
                app,
                scope,
                number(args, "number")?,
                text(args, "body")?,
            )
            .await
        }
        ("github", "push") => {
            super::github::push(
                app,
                scope,
                optional_text(args, "branch"),
                flag(args, "force-with-lease"),
            )
            .await
        }
        ("gitlab", "issue-update") => encode(
            crate::gitlab::gitlab_update_issue(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                text(args, "description")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "issue-note-create") => encode(
            crate::gitlab::gitlab_create_issue_note(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                text(args, "body")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "issue-discussion-reply") => encode(
            crate::gitlab::gitlab_reply_to_issue_discussion(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                text(args, "discussion")?,
                text(args, "body")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "mr-note-create") => encode(
            crate::gitlab::gitlab_create_mr_note(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                text(args, "body")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "mr-discussion-reply") => encode(
            crate::gitlab::gitlab_reply_to_mr_discussion(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                text(args, "discussion")?,
                text(args, "body")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "mr-discussion-resolve") => encode(
            crate::gitlab::gitlab_resolve_mr_discussion(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                text(args, "discussion")?,
                !flag(args, "unresolve"),
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "mr-approve") => encode(
            crate::gitlab::gitlab_approve_mr(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "mr-unapprove") => encode(
            crate::gitlab::gitlab_unapprove_mr(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "mr-merge") => encode(
            crate::gitlab::gitlab_merge_mr(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                optional_text(args, "method"),
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("jira", "comment-create") => encode(
            crate::jira::jira_create_comment(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("jira", scope, "siteUrl")?,
                config_field("jira", scope, "email")?,
                text(args, "key")?,
                text(args, "body")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("jira", "issue-update") => encode(
            crate::jira::jira_update_issue(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("jira", scope, "siteUrl")?,
                config_field("jira", scope, "email")?,
                text(args, "key")?,
                text(args, "description")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("jira", "transition") => encode(
            crate::jira::jira_transition_issue(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("jira", scope, "siteUrl")?,
                config_field("jira", scope, "email")?,
                text(args, "key")?,
                text(args, "transition")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "pr-comment-create") => encode(
            crate::bitbucket::bitbucket_create_pull_request_comment(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                unsigned(args, "id")?,
                text(args, "body")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "pr-comment-reply") => encode(
            crate::bitbucket::bitbucket_reply_to_pull_request_comment(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                unsigned(args, "id")?,
                unsigned(args, "parent")?,
                text(args, "body")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "pr-approve") => encode(
            crate::bitbucket::bitbucket_approve_pull_request(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                unsigned(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "pr-unapprove") => encode(
            crate::bitbucket::bitbucket_unapprove_pull_request(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                unsigned(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "pr-request-changes") => encode(
            crate::bitbucket::bitbucket_request_changes(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                unsigned(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "pr-unrequest-changes") => encode(
            crate::bitbucket::bitbucket_unrequest_changes(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                unsigned(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "pr-merge") => encode(
            crate::bitbucket::bitbucket_merge_pull_request(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                unsigned(args, "id")?,
                None,
                optional_text(args, "message"),
                optional_text(args, "strategy"),
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "pr-decline") => encode(
            crate::bitbucket::bitbucket_decline_pull_request(
                scope.workspace.to_string(),
                scope.project.clone(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                unsigned(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("slack", "reply") => {
            let settings = slack_settings(scope)?;
            let channel = text(args, "channel")?;
            let thread_ts = text(args, "ts")?;
            let body = text(args, "text")?;
            ensure_slack_channel(&settings, &channel)?;
            match settings.agent_policy.reply.as_deref().unwrap_or("ask") {
                "ask" => save_integration_draft(
                    app,
                    IntegrationDraftParams {
                        workspace_id: scope.workspace,
                        session_id: scope.session,
                        verb: "reply",
                        target: serde_json::json!({
                            "channelId": channel,
                            "threadTs": thread_ts
                        }),
                        body: &body,
                    },
                ),
                "never" => Err("Slack replies are disabled for agents".to_string()),
                "allow" => encode(
                    crate::slack::slack_post_reply(
                        scope.workspace.to_string(),
                        scope.project.clone(),
                        channel,
                        thread_ts,
                        body,
                        slack_signature(&settings),
                        app.state(),
                    )
                    .await
                    .map_err(|error| error.to_string())?,
                ),
                value => Err(format!("unknown Slack reply policy: {}", value)),
            }
        }
        ("slack", "reaction-add") => {
            let settings = slack_settings(scope)?;
            let channel = text(args, "channel")?;
            let message_ts = text(args, "ts")?;
            let name = text(args, "name")?;
            ensure_slack_channel(&settings, &channel)?;
            match settings.agent_policy.react.as_deref().unwrap_or("allow") {
                "ask" => save_integration_draft(
                    app,
                    IntegrationDraftParams {
                        workspace_id: scope.workspace,
                        session_id: scope.session,
                        verb: "reaction-add",
                        target: serde_json::json!({
                            "channelId": channel,
                            "messageTs": message_ts
                        }),
                        body: &name,
                    },
                ),
                "never" => Err("Slack reactions are disabled for agents".to_string()),
                "allow" => encode(
                    crate::slack::slack_add_reaction(
                        scope.workspace.to_string(),
                        scope.project.clone(),
                        channel,
                        message_ts,
                        name,
                        app.state(),
                    )
                    .await
                    .map_err(|error| error.to_string())?,
                ),
                value => Err(format!("unknown Slack reaction policy: {}", value)),
            }
        }
        _ => Err(format!("unhandled write command: {} {}", provider, verb)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::query_bridge::protocol::CATALOG;

    fn args(pairs: &[(&str, Value)]) -> Args {
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_string(), value.clone()))
            .collect()
    }

    #[test]
    fn a_required_text_argument_reports_its_own_name_when_absent() {
        let error = text(&args(&[]), "id").expect_err("missing id");

        assert!(error.contains("id"));
    }

    #[test]
    fn a_numeric_argument_refuses_a_string_that_looks_like_a_number() {
        assert!(number(&args(&[("iid", Value::from("42"))]), "iid").is_err());
        assert_eq!(number(&args(&[("iid", Value::from(42))]), "iid"), Ok(42));
    }

    #[test]
    fn an_unsigned_argument_refuses_a_negative_id() {
        assert!(unsigned(&args(&[("id", Value::from(-1))]), "id").is_err());
        assert_eq!(unsigned(&args(&[("id", Value::from(7))]), "id"), Ok(7));
    }

    #[test]
    fn a_host_command_that_writes_to_one_mount_resolves_it_before_the_provider_runs() {
        assert!(is_mount_dependent("github", "push"));
        assert!(is_mount_dependent("gitlab", "mr-create"));
        assert!(!is_mount_dependent("gitlab", "mrs"));
        assert!(!is_mount_dependent("slack", "reply"));
    }

    #[test]
    fn creating_a_review_request_leaves_the_generic_provider_arms_alone() {
        assert!(creates_request("github", "pr-create"));
        assert!(creates_request("gitlab", "mr-create"));
        assert!(!creates_request("github", "pr-merge"));
    }

    #[test]
    fn an_absent_flag_reads_as_false() {
        assert!(!flag(&args(&[]), "all"));
        assert!(flag(&args(&[("all", Value::from(true))]), "all"));
    }

    #[test]
    fn slack_channel_access_follows_the_saved_policy() {
        let settings: SlackBridgeSettings = serde_json::from_value(serde_json::json!({
            "followedChannels": [{"id": "C1"}],
            "hasSelectedChannels": true,
            "agentPolicy": {
                "readFollowed": "allow",
                "readOthers": "off",
                "reply": "ask",
                "react": "allow"
            },
            "signature": {"agents": true, "text": "Written with Goodboy"}
        }))
        .expect("settings");

        assert!(slack_channel_allowed(&settings, "C1"));
        assert!(!slack_channel_allowed(&settings, "C2"));
        assert_eq!(
            slack_signature(&settings).as_deref(),
            Some("Written with Goodboy")
        );
    }

    #[test]
    fn an_approval_draft_is_inserted_without_posting() {
        let conn = rusqlite::Connection::open_in_memory().expect("database");
        conn.execute_batch(
            "CREATE TABLE integration_drafts (
               id TEXT PRIMARY KEY,
               workspace_id TEXT NOT NULL,
               session_id TEXT NOT NULL,
               provider TEXT NOT NULL,
               verb TEXT NOT NULL,
               target_json TEXT NOT NULL,
               body TEXT NOT NULL,
               status TEXT NOT NULL,
               created_at INTEGER NOT NULL,
               updated_at INTEGER NOT NULL
             );",
        )
        .expect("schema");

        let outcome = insert_integration_draft(
            &conn,
            IntegrationDraftParams {
                workspace_id: "workspace",
                session_id: "session",
                verb: "reply",
                target: serde_json::json!({"channelId": "C1", "threadTs": "1.0"}),
                body: "Ready",
            },
        )
        .expect("draft");
        let row: (String, String, String) = conn
            .query_row(
                "SELECT provider, verb, status FROM integration_drafts",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("row");

        assert_eq!(outcome["status"], "queued");
        assert_eq!(row, ("slack".into(), "reply".into(), "pending".into()));
    }

    #[test]
    fn every_catalogued_verb_is_routed_by_the_arm_matching_its_access() {
        for spec in CATALOG {
            let routed = match spec.access {
                Access::Read => READ_VERBS.contains(&(spec.provider, spec.verb)),
                Access::Write => WRITE_VERBS.contains(&(spec.provider, spec.verb)),
            };
            assert!(
                routed,
                "{} {} is catalogued but never dispatched",
                spec.provider, spec.verb
            );
        }
    }

    #[test]
    fn no_dispatched_verb_is_missing_from_the_catalog() {
        for (provider, verb) in READ_VERBS.iter().chain(WRITE_VERBS.iter()) {
            assert!(
                spec_for(provider, verb).is_some(),
                "{} {} is dispatched but not catalogued",
                provider,
                verb
            );
        }
    }

    #[test]
    fn a_write_verb_never_hides_inside_the_read_arm() {
        for (provider, verb) in WRITE_VERBS {
            assert!(
                !READ_VERBS.contains(&(provider, verb)),
                "{} {} is reachable from the read arm",
                provider,
                verb
            );
        }
    }

    const READ_VERBS: &[(&str, &str)] = &[
        ("mount", "list"),
        ("series", "list"),
        ("mount", "inspect"),
        ("mount", "operation"),
        ("linear", "issue"),
        ("linear", "issues-assigned"),
        ("linear", "comments"),
        ("sentry", "issues"),
        ("sentry", "issue"),
        ("sentry", "issue-detail"),
        ("github", "prs"),
        ("github", "pr"),
        ("github", "pr-for-branch"),
        ("github", "pr-diff"),
        ("github", "pr-checks"),
        ("github", "pr-comments"),
        ("github", "issues-assigned"),
        ("github", "issue"),
        ("github", "issue-comments"),
        ("gitlab", "issues-assigned"),
        ("gitlab", "issue"),
        ("gitlab", "issue-notes"),
        ("gitlab", "issue-discussions"),
        ("gitlab", "mrs-assigned"),
        ("gitlab", "mrs"),
        ("gitlab", "mr-for-branch"),
        ("gitlab", "mr-diff"),
        ("gitlab", "mr-discussions"),
        ("gitlab", "mr-approval-state"),
        ("jira", "issues"),
        ("jira", "issue"),
        ("jira", "comments"),
        ("jira", "transitions"),
        ("bitbucket", "prs"),
        ("bitbucket", "pr"),
        ("bitbucket", "pr-diff"),
        ("bitbucket", "pr-comments"),
        ("bitbucket", "pr-statuses"),
        ("bitbucket", "pr-for-branch"),
        ("slack", "channels"),
        ("slack", "thread-heads"),
        ("slack", "thread"),
        ("slack", "permalink"),
        ("slack", "users"),
    ];

    const WRITE_VERBS: &[(&str, &str)] = &[
        ("project", "materialize"),
        ("mount", "fork"),
        ("mount", "switch"),
        ("mount", "attach"),
        ("mount", "unmount"),
        ("mount", "activate"),
        ("mount", "resolve"),
        ("series", "create"),
        ("series", "set-member"),
        ("linear", "comment-create"),
        ("linear", "issue-update"),
        ("github", "pr-comment-create"),
        ("github", "pr-thread-reply"),
        ("github", "pr-thread-resolve"),
        ("github", "pr-ready"),
        ("github", "pr-merge"),
        ("github", "issue-comment-create"),
        ("github", "push"),
        ("github", "pr-create"),
        ("gitlab", "issue-update"),
        ("gitlab", "issue-note-create"),
        ("gitlab", "issue-discussion-reply"),
        ("gitlab", "mr-note-create"),
        ("gitlab", "mr-discussion-reply"),
        ("gitlab", "mr-discussion-resolve"),
        ("gitlab", "mr-approve"),
        ("gitlab", "mr-unapprove"),
        ("gitlab", "mr-merge"),
        ("gitlab", "mr-create"),
        ("jira", "comment-create"),
        ("jira", "issue-update"),
        ("jira", "transition"),
        ("bitbucket", "pr-comment-create"),
        ("bitbucket", "pr-comment-reply"),
        ("bitbucket", "pr-approve"),
        ("bitbucket", "pr-unapprove"),
        ("bitbucket", "pr-request-changes"),
        ("bitbucket", "pr-unrequest-changes"),
        ("bitbucket", "pr-merge"),
        ("bitbucket", "pr-decline"),
        ("slack", "reply"),
        ("slack", "reaction-add"),
    ];
}
