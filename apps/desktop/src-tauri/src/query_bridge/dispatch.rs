use std::collections::BTreeMap;

use rusqlite::OptionalExtension;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Manager};

use super::protocol::{spec_for, Access, QueryRequest};
use crate::db::Db;

type Args = BTreeMap<String, Value>;

fn encode<T: Serialize>(value: T) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|error| error.to_string())
}

fn text(args: &Args, key: &str) -> Result<String, String> {
    args.get(key)
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| format!("missing argument: {}", key))
}

fn optional_text(args: &Args, key: &str) -> Option<String> {
    args.get(key).and_then(Value::as_str).map(str::to_string)
}

fn number(args: &Args, key: &str) -> Result<i64, String> {
    args.get(key)
        .and_then(Value::as_i64)
        .ok_or_else(|| format!("missing numeric argument: {}", key))
}

fn unsigned(args: &Args, key: &str) -> Result<u64, String> {
    let value = number(args, key)?;
    u64::try_from(value).map_err(|_| format!("{} must not be negative", key))
}

fn flag(args: &Args, key: &str) -> bool {
    args.get(key).and_then(Value::as_bool).unwrap_or(false)
}

struct Scope<'a> {
    workspace: &'a str,
    project: Option<String>,
}

impl Scope<'_> {
    fn project_id(&self) -> Option<&str> {
        self.project.as_deref()
    }
}

fn config_field(provider: &str, scope: &Scope<'_>, key: &str) -> Result<String, String> {
    let raw =
        crate::integration_credentials::config_for_binding(provider, scope.workspace, scope.project_id())
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

pub async fn dispatch(app: &AppHandle, request: &QueryRequest) -> Result<Value, String> {
    if request.workspace_id.is_empty() {
        return Err("no workspace: pass --workspace <id>".to_string());
    }
    let spec = spec_for(&request.provider, &request.verb)
        .ok_or_else(|| format!("unknown command: {} {}", request.provider, request.verb))?;
    if request.provider == "project" {
        return super::project::materialize(app, request).await;
    }
    ensure_connected(app, &request.workspace_id, &request.provider)?;
    let project = match request.project.trim() {
        "" => None,
        name => Some(named_project_id(app, &request.workspace_id, name)?),
    };
    let scope = Scope {
        workspace: &request.workspace_id,
        project,
    };
    let args = &request.args;
    match spec.access {
        Access::Read => run_read(app, &request.provider, &request.verb, &scope, args).await,
        Access::Write => run_write(app, &request.provider, &request.verb, &scope, args).await,
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
                text(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("linear", "issues-assigned") => encode(
            crate::linear::linear_fetch_assigned_issues(
                scope.workspace.to_string(),
                optional_text(args, "team"),
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("linear", "comments") => encode(
            crate::linear::linear_fetch_issue_comments(
                scope.workspace.to_string(),
                text(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("sentry", "issues") => encode(
            crate::sentry::sentry_fetch_issues(
                scope.workspace.to_string(),
                optional_text(args, "query"),
                optional_text(args, "cursor"),
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("sentry", "issue") => encode(
            crate::sentry::sentry_fetch_issue(
                scope.workspace.to_string(),
                text(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("sentry", "issue-detail") => encode(
            crate::sentry::sentry_fetch_issue_detail(
                scope.workspace.to_string(),
                text(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "issues-assigned") => encode(
            crate::gitlab::gitlab_fetch_assigned_issues(
                scope.workspace.to_string(),
                config_field("gitlab", scope, "host")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "issue") => encode(
            crate::gitlab::gitlab_fetch_issue(
                scope.workspace.to_string(),
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
                config_field("gitlab", scope, "host")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "mrs") => encode(
            crate::gitlab::gitlab_fetch_project_mrs(
                scope.workspace.to_string(),
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
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                text(args, "branch")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("slack", "channels") => encode(
            crate::slack::slack_list_channels(scope.workspace.to_string(), app.state())
                .await
                .map_err(|error| error.to_string())?,
        ),
        ("slack", "thread-heads") => encode(
            crate::slack::slack_list_thread_heads(
                scope.workspace.to_string(),
                text(args, "channel")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("slack", "thread") => encode(
            crate::slack::slack_get_thread(
                scope.workspace.to_string(),
                text(args, "channel")?,
                text(args, "ts")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("slack", "permalink") => encode(
            crate::slack::slack_get_permalink(
                scope.workspace.to_string(),
                text(args, "channel")?,
                text(args, "ts")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("slack", "users") => encode(
            crate::slack::slack_list_users(scope.workspace.to_string(), app.state())
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
                text(args, "id")?,
                text(args, "body")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("linear", "issue-update") => encode(
            crate::linear::linear_update_issue(
                scope.workspace.to_string(),
                text(args, "id")?,
                text(args, "description")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "issue-update") => encode(
            crate::gitlab::gitlab_update_issue(
                scope.workspace.to_string(),
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
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                text(args, "body")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("gitlab", "mr-note-create") => encode(
            crate::gitlab::gitlab_create_mr_note(
                scope.workspace.to_string(),
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
                config_field("gitlab", scope, "host")?,
                text(args, "project")?,
                number(args, "iid")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("jira", "comment-create") => encode(
            crate::jira::jira_create_comment(
                scope.workspace.to_string(),
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
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                unsigned(args, "id")?,
                None,
                optional_text(args, "message"),
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("bitbucket", "pr-decline") => encode(
            crate::bitbucket::bitbucket_decline_pull_request(
                scope.workspace.to_string(),
                config_field("bitbucket", scope, "workspaceSlug")?,
                text(args, "repo")?,
                config_field("bitbucket", scope, "email")?,
                unsigned(args, "id")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("slack", "reply") => encode(
            crate::slack::slack_post_reply(
                scope.workspace.to_string(),
                text(args, "channel")?,
                text(args, "ts")?,
                text(args, "text")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
        ("slack", "reaction-add") => encode(
            crate::slack::slack_add_reaction(
                scope.workspace.to_string(),
                text(args, "channel")?,
                text(args, "ts")?,
                text(args, "name")?,
                app.state(),
            )
            .await
            .map_err(|error| error.to_string())?,
        ),
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
    fn an_absent_flag_reads_as_false() {
        assert!(!flag(&args(&[]), "all"));
        assert!(flag(&args(&[("all", Value::from(true))]), "all"));
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
        ("linear", "issue"),
        ("linear", "issues-assigned"),
        ("linear", "comments"),
        ("sentry", "issues"),
        ("sentry", "issue"),
        ("sentry", "issue-detail"),
        ("gitlab", "issues-assigned"),
        ("gitlab", "issue"),
        ("gitlab", "issue-notes"),
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
        ("linear", "comment-create"),
        ("linear", "issue-update"),
        ("gitlab", "issue-update"),
        ("gitlab", "issue-note-create"),
        ("gitlab", "mr-note-create"),
        ("gitlab", "mr-discussion-reply"),
        ("gitlab", "mr-discussion-resolve"),
        ("gitlab", "mr-approve"),
        ("gitlab", "mr-unapprove"),
        ("gitlab", "mr-merge"),
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
