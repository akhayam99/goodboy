#![allow(dead_code)]

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

pub const SOCKET_ENV: &str = "GOODBOY_QUERY_SOCKET";
pub const WORKSPACE_ENV: &str = "GOODBOY_WORKSPACE_ID";
pub const SOCKET_FILE: &str = "query.sock";
pub const BINARY_NAME: &str = "goodboy-query";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QueryRequest {
    pub workspace_id: String,
    pub provider: String,
    pub verb: String,
    #[serde(default)]
    pub args: BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl QueryResponse {
    pub fn ok(data: serde_json::Value) -> Self {
        Self {
            ok: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn failed(error: impl Into<String>) -> Self {
        Self {
            ok: false,
            data: None,
            error: Some(error.into()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Access {
    Read,
    Write,
}

#[derive(Debug, Clone, Copy)]
pub struct VerbSpec {
    pub provider: &'static str,
    pub verb: &'static str,
    pub params: &'static [Param],
    pub access: Access,
    pub summary: &'static str,
}

#[derive(Debug, Clone, Copy)]
pub struct Param {
    pub name: &'static str,
    pub required: bool,
    pub kind: ParamKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParamKind {
    Text,
    Number,
    Flag,
}

const fn req(name: &'static str) -> Param {
    Param {
        name,
        required: true,
        kind: ParamKind::Text,
    }
}

const fn opt(name: &'static str) -> Param {
    Param {
        name,
        required: false,
        kind: ParamKind::Text,
    }
}

const fn num(name: &'static str) -> Param {
    Param {
        name,
        required: true,
        kind: ParamKind::Number,
    }
}

const fn flag(name: &'static str) -> Param {
    Param {
        name,
        required: false,
        kind: ParamKind::Flag,
    }
}

pub const CATALOG: &[VerbSpec] = &[
    VerbSpec {
        provider: "linear",
        verb: "issue",
        params: &[req("id")],
        access: Access::Read,
        summary: "one issue by identifier, for example ENG-123",
    },
    VerbSpec {
        provider: "linear",
        verb: "issues-assigned",
        params: &[opt("team")],
        access: Access::Read,
        summary: "open issues assigned to the connected user",
    },
    VerbSpec {
        provider: "linear",
        verb: "comments",
        params: &[req("id")],
        access: Access::Read,
        summary: "every comment on an issue, oldest first",
    },
    VerbSpec {
        provider: "linear",
        verb: "comment-create",
        params: &[req("id"), req("body")],
        access: Access::Write,
        summary: "post a comment on an issue",
    },
    VerbSpec {
        provider: "linear",
        verb: "issue-update",
        params: &[req("id"), req("description")],
        access: Access::Write,
        summary: "replace an issue description",
    },
    VerbSpec {
        provider: "sentry",
        verb: "issues",
        params: &[opt("query"), opt("cursor")],
        access: Access::Read,
        summary: "issues in the connected project",
    },
    VerbSpec {
        provider: "sentry",
        verb: "issue",
        params: &[req("id")],
        access: Access::Read,
        summary: "one issue by id",
    },
    VerbSpec {
        provider: "sentry",
        verb: "issue-detail",
        params: &[req("id")],
        access: Access::Read,
        summary: "one issue with stack frames, tags and breadcrumbs",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "issues-assigned",
        params: &[],
        access: Access::Read,
        summary: "open issues assigned to the connected user",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "issue",
        params: &[req("project"), num("iid")],
        access: Access::Read,
        summary: "one issue by project path and iid",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "issue-notes",
        params: &[req("project"), num("iid")],
        access: Access::Read,
        summary: "notes on an issue",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "issue-update",
        params: &[req("project"), num("iid"), req("description")],
        access: Access::Write,
        summary: "replace an issue description",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "issue-note-create",
        params: &[req("project"), num("iid"), req("body")],
        access: Access::Write,
        summary: "post a note on an issue",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "mrs-assigned",
        params: &[],
        access: Access::Read,
        summary: "merge requests assigned to the connected user",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "mrs",
        params: &[req("project")],
        access: Access::Read,
        summary: "merge requests of one project",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "mr-for-branch",
        params: &[req("project"), req("branch")],
        access: Access::Read,
        summary: "the merge request opened from a source branch",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "mr-diff",
        params: &[req("project"), num("iid")],
        access: Access::Read,
        summary: "unified diff of a merge request",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "mr-discussions",
        params: &[req("project"), num("iid")],
        access: Access::Read,
        summary: "review threads on a merge request",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "mr-approval-state",
        params: &[req("project"), num("iid")],
        access: Access::Read,
        summary: "who approved a merge request and what is still required",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "mr-note-create",
        params: &[req("project"), num("iid"), req("body")],
        access: Access::Write,
        summary: "post a plain note on a merge request",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "mr-discussion-reply",
        params: &[req("project"), num("iid"), req("discussion"), req("body")],
        access: Access::Write,
        summary: "reply inside an existing review thread",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "mr-discussion-resolve",
        params: &[
            req("project"),
            num("iid"),
            req("discussion"),
            flag("unresolve"),
        ],
        access: Access::Write,
        summary: "resolve a review thread, or reopen it with --unresolve",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "mr-approve",
        params: &[req("project"), num("iid")],
        access: Access::Write,
        summary: "approve a merge request",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "mr-unapprove",
        params: &[req("project"), num("iid")],
        access: Access::Write,
        summary: "withdraw an approval",
    },
    VerbSpec {
        provider: "gitlab",
        verb: "mr-merge",
        params: &[req("project"), num("iid")],
        access: Access::Write,
        summary: "merge a merge request",
    },
    VerbSpec {
        provider: "jira",
        verb: "issues",
        params: &[opt("project"), flag("all")],
        access: Access::Read,
        summary: "issues of a project, assigned to the connected user unless --all",
    },
    VerbSpec {
        provider: "jira",
        verb: "issue",
        params: &[req("key")],
        access: Access::Read,
        summary: "one issue by key, for example ENG-123",
    },
    VerbSpec {
        provider: "jira",
        verb: "comments",
        params: &[req("key")],
        access: Access::Read,
        summary: "every comment on an issue",
    },
    VerbSpec {
        provider: "jira",
        verb: "transitions",
        params: &[req("key")],
        access: Access::Read,
        summary: "transitions available on an issue",
    },
    VerbSpec {
        provider: "jira",
        verb: "comment-create",
        params: &[req("key"), req("body")],
        access: Access::Write,
        summary: "post a comment on an issue",
    },
    VerbSpec {
        provider: "jira",
        verb: "issue-update",
        params: &[req("key"), req("description")],
        access: Access::Write,
        summary: "replace an issue description",
    },
    VerbSpec {
        provider: "jira",
        verb: "transition",
        params: &[req("key"), req("transition")],
        access: Access::Write,
        summary: "move an issue through a transition id",
    },
    VerbSpec {
        provider: "bitbucket",
        verb: "prs",
        params: &[req("repo"), opt("state")],
        access: Access::Read,
        summary: "pull requests of a repository",
    },
    VerbSpec {
        provider: "bitbucket",
        verb: "pr",
        params: &[req("repo"), num("id")],
        access: Access::Read,
        summary: "one pull request by id",
    },
    VerbSpec {
        provider: "bitbucket",
        verb: "pr-diff",
        params: &[req("repo"), num("id")],
        access: Access::Read,
        summary: "unified diff of a pull request",
    },
    VerbSpec {
        provider: "bitbucket",
        verb: "pr-comments",
        params: &[req("repo"), num("id")],
        access: Access::Read,
        summary: "comments on a pull request",
    },
    VerbSpec {
        provider: "bitbucket",
        verb: "pr-statuses",
        params: &[req("repo"), num("id")],
        access: Access::Read,
        summary: "build statuses reported on a pull request",
    },
    VerbSpec {
        provider: "bitbucket",
        verb: "pr-for-branch",
        params: &[req("repo"), req("branch")],
        access: Access::Read,
        summary: "the pull request opened from a source branch",
    },
    VerbSpec {
        provider: "bitbucket",
        verb: "pr-comment-create",
        params: &[req("repo"), num("id"), req("body")],
        access: Access::Write,
        summary: "post a comment on a pull request",
    },
    VerbSpec {
        provider: "bitbucket",
        verb: "pr-comment-reply",
        params: &[req("repo"), num("id"), num("parent"), req("body")],
        access: Access::Write,
        summary: "reply to an existing pull request comment",
    },
    VerbSpec {
        provider: "bitbucket",
        verb: "pr-approve",
        params: &[req("repo"), num("id")],
        access: Access::Write,
        summary: "approve a pull request",
    },
    VerbSpec {
        provider: "bitbucket",
        verb: "pr-unapprove",
        params: &[req("repo"), num("id")],
        access: Access::Write,
        summary: "withdraw an approval",
    },
    VerbSpec {
        provider: "bitbucket",
        verb: "pr-request-changes",
        params: &[req("repo"), num("id")],
        access: Access::Write,
        summary: "mark a pull request as needing changes",
    },
    VerbSpec {
        provider: "bitbucket",
        verb: "pr-unrequest-changes",
        params: &[req("repo"), num("id")],
        access: Access::Write,
        summary: "withdraw a changes-requested mark",
    },
    VerbSpec {
        provider: "bitbucket",
        verb: "pr-merge",
        params: &[req("repo"), num("id"), opt("message")],
        access: Access::Write,
        summary: "merge a pull request",
    },
    VerbSpec {
        provider: "bitbucket",
        verb: "pr-decline",
        params: &[req("repo"), num("id")],
        access: Access::Write,
        summary: "decline a pull request",
    },
    VerbSpec {
        provider: "slack",
        verb: "channels",
        params: &[],
        access: Access::Read,
        summary: "channels the connected bot can read",
    },
    VerbSpec {
        provider: "slack",
        verb: "thread-heads",
        params: &[req("channel")],
        access: Access::Read,
        summary: "root messages of a channel",
    },
    VerbSpec {
        provider: "slack",
        verb: "thread",
        params: &[req("channel"), req("ts")],
        access: Access::Read,
        summary: "every message in one thread",
    },
    VerbSpec {
        provider: "slack",
        verb: "permalink",
        params: &[req("channel"), req("ts")],
        access: Access::Read,
        summary: "the permalink of one message",
    },
    VerbSpec {
        provider: "slack",
        verb: "users",
        params: &[],
        access: Access::Read,
        summary: "members of the connected workspace",
    },
    VerbSpec {
        provider: "slack",
        verb: "reply",
        params: &[req("channel"), req("ts"), req("text")],
        access: Access::Write,
        summary: "post a reply in a thread",
    },
    VerbSpec {
        provider: "slack",
        verb: "reaction-add",
        params: &[req("channel"), req("ts"), req("name")],
        access: Access::Write,
        summary: "add an emoji reaction to a message",
    },
];

pub fn spec_for(provider: &str, verb: &str) -> Option<&'static VerbSpec> {
    CATALOG
        .iter()
        .find(|spec| spec.provider == provider && spec.verb == verb)
}

pub fn specs_for_provider(provider: &str) -> Vec<&'static VerbSpec> {
    CATALOG
        .iter()
        .filter(|spec| spec.provider == provider)
        .collect()
}

pub fn providers() -> Vec<&'static str> {
    let mut seen: Vec<&'static str> = Vec::new();
    for spec in CATALOG {
        if !seen.contains(&spec.provider) {
            seen.push(spec.provider);
        }
    }
    seen
}

pub fn usage(spec: &VerbSpec) -> String {
    let mut line = format!("{} {} {}", BINARY_NAME, spec.provider, spec.verb);
    for param in spec.params {
        let body = match param.kind {
            ParamKind::Flag => format!("--{}", param.name),
            _ => format!("--{} <{}>", param.name, param.name),
        };
        if param.required {
            line.push_str(&format!(" {}", body));
            continue;
        }
        line.push_str(&format!(" [{}]", body));
    }
    line
}

#[derive(Debug, PartialEq, Eq)]
pub struct ParsedArgv {
    pub provider: String,
    pub verb: String,
    pub args: BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ArgvOutcome {
    Help,
    Parsed(ParsedArgv),
}

pub fn parse_argv(argv: &[String]) -> Result<ArgvOutcome, String> {
    let mut positional: Vec<&str> = Vec::new();
    let mut flags: Vec<(&str, Option<&str>)> = Vec::new();
    let mut index = 0;
    while index < argv.len() {
        let token = argv[index].as_str();
        if token == "--help" || token == "-h" {
            return Ok(ArgvOutcome::Help);
        }
        let Some(name) = token.strip_prefix("--") else {
            positional.push(token);
            index += 1;
            continue;
        };
        if let Some((name, value)) = name.split_once('=') {
            flags.push((name, Some(value)));
            index += 1;
            continue;
        }
        if is_valueless(name) {
            flags.push((name, None));
            index += 1;
            continue;
        }
        let next = argv.get(index + 1).map(String::as_str);
        match next {
            Some(value) if !value.starts_with("--") => {
                flags.push((name, Some(value)));
                index += 2;
            }
            _ => {
                flags.push((name, None));
                index += 1;
            }
        }
    }

    if positional.is_empty() {
        return Ok(ArgvOutcome::Help);
    }
    let provider = positional[0];
    let Some(verb) = positional.get(1) else {
        return Err(format!(
            "missing verb. try: {} {} --help",
            BINARY_NAME, provider
        ));
    };
    let Some(spec) = spec_for(provider, verb) else {
        return Err(format!(
            "unknown command: {} {}. try: {} --help",
            provider, verb, BINARY_NAME
        ));
    };

    let mut args: BTreeMap<String, serde_json::Value> = BTreeMap::new();
    let mut free = positional[2..].iter();
    for param in spec.params {
        let supplied = flags
            .iter()
            .find(|(name, _)| *name == param.name)
            .map(|(_, value)| *value);
        let value = match (supplied, param.kind) {
            (Some(_), ParamKind::Flag) => Some(serde_json::Value::Bool(true)),
            (Some(Some(raw)), _) => Some(text_or_number(raw, param.kind)?),
            (Some(None), _) => {
                return Err(format!("--{} needs a value", param.name));
            }
            (None, ParamKind::Flag) => None,
            (None, _) => match free.next() {
                Some(raw) => Some(text_or_number(raw, param.kind)?),
                None => None,
            },
        };
        match value {
            Some(value) => {
                args.insert(param.name.to_string(), value);
            }
            None if param.required => {
                return Err(format!("missing --{}\nusage: {}", param.name, usage(spec)));
            }
            None => {}
        }
    }

    for (name, _) in &flags {
        let known = spec.params.iter().any(|param| param.name == *name)
            || *name == "workspace"
            || *name == "json";
        if !known {
            return Err(format!("unknown option --{}\nusage: {}", name, usage(spec)));
        }
    }

    Ok(ArgvOutcome::Parsed(ParsedArgv {
        provider: provider.to_string(),
        verb: (*verb).to_string(),
        args,
    }))
}

fn is_valueless(name: &str) -> bool {
    if name == "json" {
        return true;
    }
    CATALOG.iter().any(|spec| {
        spec.params
            .iter()
            .any(|param| param.name == name && param.kind == ParamKind::Flag)
    })
}

fn text_or_number(raw: &str, kind: ParamKind) -> Result<serde_json::Value, String> {
    if kind != ParamKind::Number {
        return Ok(serde_json::Value::String(raw.to_string()));
    }
    raw.parse::<i64>()
        .map(|value| serde_json::Value::Number(value.into()))
        .map_err(|_| format!("expected a number, got {}", raw))
}

pub fn help_text(provider: Option<&str>) -> String {
    let mut lines: Vec<String> = Vec::new();
    match provider {
        Some(provider) => {
            lines.push(format!("{} {} commands", BINARY_NAME, provider));
            for spec in specs_for_provider(provider) {
                lines.push(format!("  {}", usage(spec)));
                lines.push(format!("      {}", spec.summary));
            }
        }
        None => {
            lines.push(format!(
                "usage: {} <provider> <verb> [options]",
                BINARY_NAME
            ));
            lines.push(String::new());
            lines.push("providers:".to_string());
            for provider in providers() {
                let count = specs_for_provider(provider).len();
                lines.push(format!("  {} ({} commands)", provider, count));
            }
            lines.push(String::new());
            lines.push(format!(
                "run `{} <provider> --help` for that provider's commands",
                BINARY_NAME
            ));
            lines.push(format!(
                "the workspace comes from {}; override it with --workspace <id>",
                WORKSPACE_ENV
            ));
        }
    }
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_verb_takes_its_arguments_positionally_in_declaration_order() {
        let argv = vec![
            "linear".to_string(),
            "issue".to_string(),
            "ENG-1".to_string(),
        ];

        let outcome = parse_argv(&argv).expect("parsed");

        assert_eq!(
            outcome,
            ArgvOutcome::Parsed(ParsedArgv {
                provider: "linear".to_string(),
                verb: "issue".to_string(),
                args: BTreeMap::from([("id".to_string(), serde_json::json!("ENG-1"))]),
            })
        );
    }

    #[test]
    fn a_named_option_wins_over_the_positional_slot_it_covers() {
        let argv = vec![
            "linear".to_string(),
            "comment-create".to_string(),
            "--id".to_string(),
            "ENG-2".to_string(),
            "--body".to_string(),
            "ship it".to_string(),
        ];

        let ArgvOutcome::Parsed(parsed) = parse_argv(&argv).expect("parsed") else {
            panic!("expected a parsed command");
        };

        assert_eq!(parsed.args["id"], serde_json::json!("ENG-2"));
        assert_eq!(parsed.args["body"], serde_json::json!("ship it"));
    }

    #[test]
    fn a_numeric_parameter_reaches_the_bridge_as_a_number() {
        let argv = vec![
            "gitlab".to_string(),
            "issue".to_string(),
            "group/app".to_string(),
            "42".to_string(),
        ];

        let ArgvOutcome::Parsed(parsed) = parse_argv(&argv).expect("parsed") else {
            panic!("expected a parsed command");
        };

        assert_eq!(parsed.args["project"], serde_json::json!("group/app"));
        assert_eq!(parsed.args["iid"], serde_json::json!(42));
    }

    #[test]
    fn a_numeric_parameter_refuses_a_word() {
        let argv = vec![
            "gitlab".to_string(),
            "issue".to_string(),
            "group/app".to_string(),
            "iid-42".to_string(),
        ];

        assert!(parse_argv(&argv).is_err());
    }

    #[test]
    fn a_flag_parameter_needs_no_value_and_stays_absent_when_unused() {
        let with = vec![
            "jira".to_string(),
            "issues".to_string(),
            "--all".to_string(),
        ];
        let without = vec!["jira".to_string(), "issues".to_string()];

        let ArgvOutcome::Parsed(with) = parse_argv(&with).expect("parsed") else {
            panic!("expected a parsed command");
        };
        let ArgvOutcome::Parsed(without) = parse_argv(&without).expect("parsed") else {
            panic!("expected a parsed command");
        };

        assert_eq!(with.args["all"], serde_json::json!(true));
        assert!(without.args.get("all").is_none());
    }

    #[test]
    fn a_missing_required_argument_reports_the_usage_line() {
        let argv = vec!["linear".to_string(), "issue".to_string()];

        let error = parse_argv(&argv).expect_err("missing id");

        assert!(error.contains("--id"));
        assert!(error.contains("goodboy-query linear issue"));
    }

    #[test]
    fn an_unknown_verb_is_refused_before_the_socket_is_touched() {
        let argv = vec!["linear".to_string(), "delete-everything".to_string()];

        let error = parse_argv(&argv).expect_err("unknown verb");

        assert!(error.contains("unknown command"));
    }

    #[test]
    fn the_workspace_override_is_accepted_on_every_verb() {
        let argv = vec![
            "linear".to_string(),
            "issue".to_string(),
            "ENG-1".to_string(),
            "--workspace".to_string(),
            "ws-9".to_string(),
        ];

        let ArgvOutcome::Parsed(parsed) = parse_argv(&argv).expect("parsed") else {
            panic!("expected a parsed command");
        };

        assert!(parsed.args.get("workspace").is_none());
    }

    #[test]
    fn an_unknown_option_is_refused() {
        let argv = vec![
            "linear".to_string(),
            "issue".to_string(),
            "ENG-1".to_string(),
            "--force".to_string(),
        ];

        assert!(parse_argv(&argv)
            .expect_err("unknown option")
            .contains("--force"));
    }

    #[test]
    fn no_argument_at_all_asks_for_help() {
        assert_eq!(parse_argv(&[]).expect("help"), ArgvOutcome::Help);
    }

    #[test]
    fn every_catalog_entry_has_a_unique_provider_and_verb_pair() {
        let mut seen: Vec<(&str, &str)> = Vec::new();
        for spec in CATALOG {
            let key = (spec.provider, spec.verb);
            assert!(!seen.contains(&key), "duplicate verb: {:?}", key);
            seen.push(key);
        }
    }

    #[test]
    fn every_catalog_entry_declares_required_parameters_before_optional_ones() {
        for spec in CATALOG {
            let first_optional = spec
                .params
                .iter()
                .position(|param| !param.required)
                .unwrap_or(spec.params.len());
            assert!(
                spec.params[first_optional..]
                    .iter()
                    .all(|param| !param.required),
                "{} {} mixes a required parameter after an optional one",
                spec.provider,
                spec.verb
            );
        }
    }

    #[test]
    fn the_catalog_covers_every_credential_backed_provider() {
        assert_eq!(
            providers(),
            vec!["linear", "sentry", "gitlab", "jira", "bitbucket", "slack"]
        );
    }

    #[test]
    fn help_without_a_provider_lists_all_of_them() {
        let text = help_text(None);

        for provider in providers() {
            assert!(text.contains(provider), "{} missing from help", provider);
        }
    }
}
