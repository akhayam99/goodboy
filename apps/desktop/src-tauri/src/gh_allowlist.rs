use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use rusqlite::Connection;
use serde::Deserialize;

use crate::util::scoped_path::resolve_within;

const ALLOWLIST_JSON: &str = include_str!("../gh-allowlist.json");

const REFUSED_PREFIXES: [&str; 3] = ["--hostname", "--input", "GH_HOST"];

const REGISTERED_ROOTS_SQL: &str = "SELECT root_path FROM projects
     UNION SELECT worktree_path FROM session_worktrees
     UNION SELECT last_worktree_path FROM session_worktrees";

#[derive(Debug, Deserialize)]
struct Allowlist {
    mutations: Vec<String>,
    shapes: Vec<Shape>,
}

#[derive(Debug, Deserialize)]
struct Shape {
    verb: Vec<String>,
    positional: Vec<String>,
    flags: Vec<Flag>,
    #[serde(default)]
    tail: Option<String>,
    #[serde(default)]
    graphql: bool,
}

#[derive(Debug, Deserialize)]
struct Flag {
    name: String,
    #[serde(default)]
    slot: Option<String>,
    #[serde(default)]
    values: Option<Vec<String>>,
    #[serde(default)]
    repeat: bool,
    #[serde(default, rename = "isRequired")]
    is_required: bool,
}

fn allowlist() -> &'static Allowlist {
    static CELL: OnceLock<Allowlist> = OnceLock::new();
    CELL.get_or_init(|| serde_json::from_str(ALLOWLIST_JSON).expect("gh-allowlist.json is valid"))
}

fn is_word_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-'
}

fn is_word(value: &str) -> bool {
    !value.is_empty() && value.chars().all(is_word_char)
}

fn is_number(value: &str) -> bool {
    !value.is_empty() && value.len() <= 10 && value.chars().all(|c| c.is_ascii_digit())
}

fn is_slug(value: &str) -> bool {
    match value.split_once('/') {
        Some((owner, name)) => is_word(owner) && is_word(name),
        None => false,
    }
}

fn is_sha(value: &str) -> bool {
    (7..=64).contains(&value.len()) && value.chars().all(|c| c.is_ascii_hexdigit())
}

fn is_fields(value: &str) -> bool {
    !value.is_empty()
        && value
            .split(',')
            .all(|field| !field.is_empty() && field.chars().all(|c| c.is_ascii_alphabetic()))
}

fn is_ref(value: &str) -> bool {
    if is_number(value) {
        return true;
    }
    let Some(rest) = value.strip_prefix("https://github.com/") else {
        return false;
    };
    let parts: Vec<&str> = rest.split('/').collect();
    parts.len() == 4
        && is_word(parts[0])
        && is_word(parts[1])
        && parts[2] == "pull"
        && is_number(parts[3])
}

fn is_assignment(value: &str, is_file_read_refused: bool) -> bool {
    let Some((name, rest)) = value.split_once('=') else {
        return false;
    };
    let mut chars = name.chars();
    let is_name = match chars.next() {
        Some(first) => {
            (first.is_ascii_alphabetic() || first == '_')
                && chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
        }
        None => false,
    };
    is_name && !(is_file_read_refused && rest.starts_with('@'))
}

fn slot_matches(slot: &str, value: &str) -> bool {
    match slot {
        "number" => is_number(value),
        "slug" => is_slug(value),
        "word" => is_word(value),
        "sha" => is_sha(value),
        "fields" => is_fields(value),
        "ref" => is_ref(value),
        "text" => !value.contains('\0'),
        _ => false,
    }
}

fn consume_slot(slot: &str, rest: &str) -> Option<usize> {
    let word_len = |text: &str| text.chars().take_while(|c| is_word_char(*c)).count();
    match slot {
        "number" => {
            let len = rest.chars().take_while(|c| c.is_ascii_digit()).count();
            (1..=10).contains(&len).then_some(len)
        }
        "sha" => {
            let len = rest.chars().take_while(|c| c.is_ascii_hexdigit()).count();
            (7..=64).contains(&len).then_some(len)
        }
        "slug" => {
            let owner = word_len(rest);
            if owner == 0 || !rest[owner..].starts_with('/') {
                return None;
            }
            let name = word_len(&rest[owner + 1..]);
            (name > 0).then_some(owner + 1 + name)
        }
        "word" => {
            let len = word_len(rest);
            (len > 0).then_some(len)
        }
        _ => None,
    }
}

fn is_template_slot(name: &str) -> bool {
    matches!(name, "number" | "sha" | "slug" | "word" | "ref")
}

fn template_matches(template: &str, value: &str) -> bool {
    if template == "{ref}" {
        return is_ref(value);
    }
    let mut remaining_template = template;
    let mut remaining_value = value;
    while !remaining_template.is_empty() {
        if let Some(after_open) = remaining_template.strip_prefix('{') {
            if let Some((name, tail)) = after_open.split_once('}') {
                if is_template_slot(name) {
                    let Some(used) = consume_slot(name, remaining_value) else {
                        return false;
                    };
                    remaining_value = &remaining_value[used..];
                    remaining_template = tail;
                    continue;
                }
            }
        }
        let mut template_chars = remaining_template.chars();
        let mut value_chars = remaining_value.chars();
        match (template_chars.next(), value_chars.next()) {
            (Some(expected), Some(actual)) if expected == actual => {
                remaining_template = template_chars.as_str();
                remaining_value = value_chars.as_str();
            }
            _ => return false,
        }
    }
    remaining_value.is_empty()
}

fn flag_value_matches(flag: &Flag, value: &str) -> bool {
    if let Some(values) = &flag.values {
        return values.iter().any(|allowed| allowed == value);
    }
    match flag.slot.as_deref() {
        Some("assignment") => is_assignment(value, flag.name == "-F"),
        Some(slot) => slot_matches(slot, value),
        None => false,
    }
}

fn graphql_query_is_allowed(text: &str, mutations: &[String]) -> bool {
    let mut call_names: Vec<&str> = Vec::new();
    let mut search_from = 0;
    while let Some(offset) = text[search_from..].find("(input:") {
        let at = search_from + offset;
        let name_start = text[..at]
            .rfind(|c: char| !(c.is_ascii_alphanumeric() || c == '_'))
            .map(|index| index + 1)
            .unwrap_or(0);
        call_names.push(&text[name_start..at]);
        search_from = at + "(input:".len();
    }
    let is_mutation_text = text
        .split(|c: char| !(c.is_ascii_alphanumeric() || c == '_'))
        .any(|word| word == "mutation" || word == "subscription");
    if !is_mutation_text {
        return call_names.is_empty();
    }
    let opens_with_mutation = text.trim_start().starts_with("mutation");
    opens_with_mutation
        && !call_names.is_empty()
        && call_names
            .iter()
            .all(|name| mutations.iter().any(|allowed| allowed == name))
}

fn shape_accepts(shape: &Shape, args: &[String], mutations: &[String]) -> bool {
    if args.len() < shape.verb.len() || args[..shape.verb.len()] != shape.verb[..] {
        return false;
    }
    let mut positionals: Vec<&str> = Vec::new();
    let mut seen_flags: Vec<&str> = Vec::new();
    let mut query: Option<&str> = None;
    let mut index = shape.verb.len();
    while index < args.len() {
        let token = args[index].as_str();
        if token == "--" {
            if shape.tail.is_none() || index + 2 != args.len() {
                return false;
            }
            break;
        }
        if !token.starts_with('-') || token == "-" {
            positionals.push(token);
            index += 1;
            continue;
        }
        let Some(flag) = shape.flags.iter().find(|flag| flag.name == token) else {
            return false;
        };
        if !flag.repeat && seen_flags.contains(&flag.name.as_str()) {
            return false;
        }
        seen_flags.push(flag.name.as_str());
        let is_boolean = flag.slot.is_none() && flag.values.is_none();
        if is_boolean {
            index += 1;
            continue;
        }
        let Some(value) = args.get(index + 1) else {
            return false;
        };
        if !flag_value_matches(flag, value) {
            return false;
        }
        if shape.graphql && flag.slot.as_deref() == Some("assignment") {
            if let Some(body) = value.strip_prefix("query=") {
                if flag.name != "-f" || query.is_some() {
                    return false;
                }
                query = Some(body);
            }
        }
        index += 2;
    }
    let has_all_required = shape
        .flags
        .iter()
        .filter(|flag| flag.is_required)
        .all(|flag| seen_flags.contains(&flag.name.as_str()));
    if !has_all_required {
        return false;
    }
    let required = shape
        .positional
        .iter()
        .filter(|template| !template.ends_with('?'))
        .count();
    if positionals.len() < required || positionals.len() > shape.positional.len() {
        return false;
    }
    let is_each_positional_matching = positionals
        .iter()
        .zip(shape.positional.iter())
        .all(|(value, template)| template_matches(template.trim_end_matches('?'), value));
    if !is_each_positional_matching {
        return false;
    }
    if shape.graphql {
        return match query {
            Some(body) => graphql_query_is_allowed(body, mutations),
            None => false,
        };
    }
    true
}

pub(crate) fn check_args(args: &[String]) -> Result<(), String> {
    for arg in args {
        for prefix in REFUSED_PREFIXES {
            if arg.starts_with(prefix) {
                return Err(format!("{prefix} is not allowed in a gh command"));
            }
        }
    }
    let list = allowlist();
    if list
        .shapes
        .iter()
        .any(|shape| shape_accepts(shape, args, &list.mutations))
    {
        return Ok(());
    }
    let head: Vec<&str> = args.iter().take(2).map(String::as_str).collect();
    Err(format!(
        "gh {} is not a command Goodboy runs",
        head.join(" ")
    ))
}

pub(crate) fn check_cwd(cwd: Option<&str>, roots: &[PathBuf]) -> Result<(), String> {
    let Some(dir) = cwd.filter(|dir| !dir.is_empty()) else {
        return Ok(());
    };
    let path = Path::new(dir);
    let is_registered = roots.iter().any(|root| resolve_within(root, path).is_ok());
    if is_registered {
        return Ok(());
    }
    Err("the working directory is not a registered project or mount".to_string())
}

pub(crate) fn registered_roots(conn: &Connection) -> Result<Vec<PathBuf>, rusqlite::Error> {
    let mut stmt = conn.prepare(REGISTERED_ROOTS_SQL)?;
    let rows = stmt.query_map([], |row| row.get::<_, Option<String>>(0))?;
    let mut roots = Vec::new();
    for row in rows {
        if let Some(path) = row?.filter(|path| !path.is_empty()) {
            roots.push(PathBuf::from(path));
        }
    }
    Ok(roots)
}

#[cfg(test)]
mod tests {
    use super::{check_args, check_cwd, registered_roots};
    use rusqlite::Connection;
    use std::path::PathBuf;

    fn argv(args: &[&str]) -> Vec<String> {
        args.iter().map(|arg| (*arg).to_string()).collect()
    }

    const RESOLVE_QUERY: &str =
        "mutation($threadId:ID!){ resolveReviewThread(input:{threadId:$threadId}){ thread{ id } } }";
    const READ_QUERY: &str =
        "query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ id } }";

    #[test]
    fn every_current_caller_shape_still_passes() {
        let callers: Vec<Vec<String>> = vec![
            argv(&[
                "pr",
                "view",
                "12",
                "--repo",
                "acme/ledger-core",
                "--json",
                "id,title",
            ]),
            argv(&[
                "pr",
                "view",
                "https://github.com/acme/ledger-core/pull/12",
                "--json",
                "files",
                "--jq",
                ".files[].path",
            ]),
            argv(&["pr", "view", "--json", "number"]),
            argv(&[
                "pr",
                "list",
                "--repo",
                "acme/ledger-core",
                "--head",
                "feat/x",
                "--state",
                "all",
                "--limit",
                "5",
                "--json",
                "number,state",
            ]),
            argv(&[
                "pr",
                "list",
                "--repo",
                "acme/ledger-core",
                "--state",
                "open",
                "--search",
                "review:required",
                "--limit",
                "50",
                "--json",
                "number,title",
            ]),
            argv(&[
                "pr",
                "create",
                "--repo",
                "acme/ledger-core",
                "--head",
                "feat/x",
                "--title",
                "Add ledger",
                "--body",
                "Body",
                "--base",
                "main",
                "--draft",
            ]),
            argv(&[
                "pr",
                "create",
                "--repo",
                "acme/ledger-core",
                "--head",
                "feat/x",
                "--fill",
            ]),
            argv(&["pr", "edit", "12", "--title", "New"]),
            argv(&["pr", "edit", "12", "--body", "New body"]),
            argv(&["pr", "edit", "12", "--add-reviewer", "mara,jin"]),
            argv(&["pr", "ready", "12", "--undo"]),
            argv(&["pr", "ready", "12"]),
            argv(&[
                "pr",
                "merge",
                "12",
                "--squash",
                "--match-head-commit",
                "abcdef1234",
            ]),
            argv(&["pr", "merge", "12", "--disable-auto"]),
            argv(&["pr", "close", "12"]),
            argv(&["pr", "reopen", "12"]),
            argv(&["pr", "diff", "12", "--repo", "acme/ledger-core"]),
            argv(&["pr", "checks", "--json", "name,state,bucket,link"]),
            argv(&["pr", "comment", "--body", "Looks good"]),
            argv(&[
                "issue",
                "view",
                "7",
                "--repo",
                "acme/ledger-core",
                "--json",
                "number,title",
            ]),
            argv(&[
                "issue",
                "list",
                "--repo",
                "acme/ledger-core",
                "--assignee",
                "@me",
                "--state",
                "open",
                "--limit",
                "50",
                "--json",
                "number,title",
            ]),
            argv(&[
                "issue",
                "create",
                "--repo",
                "acme/notify-relay",
                "--title",
                "T",
                "--body",
                "B",
            ]),
            argv(&[
                "issue",
                "comment",
                "7",
                "--repo",
                "acme/notify-relay",
                "--body",
                "B",
            ]),
            argv(&[
                "search",
                "issues",
                "--repo",
                "acme/notify-relay",
                "--state",
                "open",
                "--json",
                "number,title",
                "--limit",
                "1",
                "--",
                "crash on boot",
            ]),
            argv(&["run", "view", "123456", "--job", "789", "--log-failed"]),
            argv(&[
                "repo",
                "view",
                "--json",
                "nameWithOwner",
                "-q",
                ".nameWithOwner",
            ]),
            argv(&[
                "repo",
                "view",
                "acme/ledger-core",
                "--json",
                "squashMergeAllowed,mergeCommitAllowed",
            ]),
            argv(&[
                "repo",
                "list",
                "--limit",
                "100",
                "--json",
                "nameWithOwner,isPrivate",
            ]),
            argv(&["repo", "create", "payments-api", "--private"]),
            argv(&["api", "user"]),
            argv(&[
                "api",
                "repos/acme/ledger-core/issues/7",
                "-X",
                "PATCH",
                "-f",
                "body=Updated",
            ]),
            argv(&[
                "api",
                "repos/acme/ledger-core/issues/7/comments",
                "--paginate",
            ]),
            argv(&[
                "api",
                "repos/acme/ledger-core/issues/7/comments",
                "-X",
                "POST",
                "-f",
                "body=Hi",
            ]),
            argv(&[
                "api",
                "repos/acme/ledger-core/pulls/12/comments",
                "--paginate",
            ]),
            argv(&[
                "api",
                "-X",
                "GET",
                "search/issues",
                "-f",
                "q=repo:acme/ledger-core type:pr commenter:mara",
                "-f",
                "sort=updated",
                "-f",
                "per_page=30",
                "-f",
                "page=1",
            ]),
            argv(&[
                "api",
                "repos/acme/ledger-core/collaborators?per_page=100",
                "--jq",
                ".[].login",
            ]),
            argv(&[
                "api",
                "repos/acme/ledger-core",
                "--jq",
                ".delete_branch_on_merge",
            ]),
            argv(&[
                "api",
                "repos/{owner}/{repo}/branches?per_page=100",
                "--jq",
                ".[].name",
            ]),
            argv(&[
                "api",
                "repos/acme/ledger-core/commits/abcdef1234",
                "-H",
                "Accept: application/vnd.github.diff",
            ]),
            argv(&[
                "api",
                "graphql",
                "-f",
                &format!("query={READ_QUERY}"),
                "-F",
                "owner=acme",
                "-F",
                "name=ledger-core",
            ]),
            argv(&[
                "api",
                "graphql",
                "-f",
                &format!("query={RESOLVE_QUERY}"),
                "-F",
                "threadId=PRT_1",
            ]),
        ];
        for args in callers {
            assert_eq!(check_args(&args), Ok(()), "{args:?}");
        }
    }

    #[test]
    fn every_listed_mutation_passes_and_an_unlisted_one_is_refused() {
        let listed = [
            "resolveReviewThread",
            "addPullRequestReviewThreadReply",
            "updatePullRequestReviewComment",
            "addPullRequestReview",
            "addPullRequestReviewThread",
            "submitPullRequestReview",
            "deletePullRequestReview",
        ];
        for name in listed {
            let query = format!(
                "query=mutation($id:ID!){{ {name}(input:{{id:$id}}){{ clientMutationId }} }}"
            );
            assert_eq!(
                check_args(&argv(&["api", "graphql", "-f", &query, "-F", "id=X"])),
                Ok(()),
                "{name}"
            );
        }
        for name in ["mergePullRequest", "deleteRef", "createRef", "closeIssue"] {
            let query = format!(
                "query=mutation($id:ID!){{ {name}(input:{{id:$id}}){{ clientMutationId }} }}"
            );
            assert!(
                check_args(&argv(&["api", "graphql", "-f", &query, "-F", "id=X"])).is_err(),
                "{name}"
            );
        }
    }

    #[test]
    fn a_listed_mutation_cannot_carry_an_unlisted_one_beside_it() {
        let query = "query=mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ clientMutationId } mergePullRequest(input:{pullRequestId:$id}){ clientMutationId } }";
        assert!(check_args(&argv(&["api", "graphql", "-f", query, "-F", "id=X"])).is_err());
    }

    #[test]
    fn a_mutation_hidden_in_a_read_query_is_refused() {
        let query = "query=query{ viewer{ login } } mutation{ mergePullRequest(input:{}){ clientMutationId } }";
        assert!(check_args(&argv(&["api", "graphql", "-f", query])).is_err());
        let query = "query=query{ mergePullRequest(input:{}){ id } }";
        assert!(check_args(&argv(&["api", "graphql", "-f", query])).is_err());
    }

    #[test]
    fn graphql_without_a_query_or_with_a_file_read_is_refused() {
        assert!(check_args(&argv(&["api", "graphql", "-F", "owner=acme"])).is_err());
        let query = format!("query={READ_QUERY}");
        assert!(check_args(&argv(&[
            "api",
            "graphql",
            "-f",
            &query,
            "-F",
            "owner=@/etc/passwd"
        ]))
        .is_err());
        assert!(check_args(&argv(&["api", "graphql", "-F", &query])).is_err());
    }

    #[test]
    fn hostname_input_and_gh_host_are_refused_everywhere() {
        let query = format!("query={READ_QUERY}");
        for args in [
            argv(&["pr", "view", "12", "--hostname", "evil.example"]),
            argv(&["api", "user", "--hostname", "evil.example"]),
            argv(&["api", "user", "--hostname=evil.example"]),
            argv(&["api", "graphql", "--input", "/tmp/query.json"]),
            argv(&["api", "graphql", "-f", &query, "--input", "-"]),
            argv(&["pr", "view", "GH_HOST=evil.example"]),
        ] {
            assert!(check_args(&args).is_err(), "{args:?}");
        }
    }

    #[test]
    fn an_unregistered_command_flag_or_endpoint_is_refused() {
        for args in [
            argv(&[]),
            argv(&["auth", "token"]),
            argv(&["auth", "login"]),
            argv(&["extension", "install", "x/y"]),
            argv(&["alias", "set", "a", "b"]),
            argv(&["pr", "merge", "12", "--admin"]),
            argv(&["pr", "view", "12", "--web"]),
            argv(&["pr", "view", "--repo", "not a slug"]),
            argv(&["pr", "list", "--state", "weird"]),
            argv(&[
                "api",
                "repos/acme/ledger-core/git/refs/heads/main",
                "-X",
                "DELETE",
            ]),
            argv(&["api", "repos/acme/ledger-core/issues/7", "-X", "DELETE"]),
            argv(&["api", "repos/acme/ledger-core/issues/7", "-f", "body=x"]),
            argv(&[
                "api",
                "repos/acme/ledger-core/issues/7",
                "-X",
                "PATCH",
                "-F",
                "body=@/etc/passwd",
            ]),
            argv(&["api", "orgs/acme/members"]),
            argv(&["api", "-X", "POST", "user/repos"]),
            argv(&["repo", "delete", "acme/ledger-core", "--yes"]),
            argv(&["repo", "view", "-R", "acme/ledger-core"]),
            argv(&["issue", "view", "--web"]),
            argv(&["pr", "view", "12", "--json", "id;rm"]),
            argv(&["search", "issues", "--", "a", "b"]),
        ] {
            assert!(check_args(&args).is_err(), "{args:?}");
        }
    }

    #[test]
    fn a_repeated_single_flag_is_refused() {
        assert!(check_args(&argv(&[
            "pr",
            "view",
            "12",
            "--repo",
            "acme/ledger-core",
            "--repo",
            "acme/notify-relay"
        ]))
        .is_err());
    }

    fn fixture() -> (PathBuf, PathBuf) {
        let base = std::env::temp_dir().join(format!("gh-allowlist-{}", std::process::id()));
        let root = base.join("ledger-core");
        let other = base.join("elsewhere");
        std::fs::create_dir_all(root.join("src")).expect("root");
        std::fs::create_dir_all(&other).expect("other");
        (root, other)
    }

    #[test]
    fn an_unregistered_cwd_is_refused_and_a_registered_one_passes() {
        let (root, other) = fixture();
        let roots = vec![root.clone()];
        assert_eq!(
            check_cwd(Some(root.to_str().expect("utf8")), &roots),
            Ok(())
        );
        assert_eq!(
            check_cwd(Some(root.join("src").to_str().expect("utf8")), &roots),
            Ok(())
        );
        assert!(check_cwd(Some(other.to_str().expect("utf8")), &roots).is_err());
        assert!(check_cwd(Some("/"), &roots).is_err());
        assert!(check_cwd(Some("relative/dir"), &roots).is_err());
        assert_eq!(check_cwd(None, &roots), Ok(()));
        assert!(check_cwd(Some(root.to_str().expect("utf8")), &[]).is_err());
    }

    #[test]
    fn registered_roots_read_projects_and_session_worktrees() {
        let conn = Connection::open_in_memory().expect("db");
        conn.execute_batch(
            "CREATE TABLE projects (id TEXT, root_path TEXT);
             CREATE TABLE session_worktrees (id TEXT, worktree_path TEXT, last_worktree_path TEXT);
             INSERT INTO projects VALUES ('p1', '/work/ledger-core');
             INSERT INTO session_worktrees VALUES ('w1', '/work/wt/one', NULL);
             INSERT INTO session_worktrees VALUES ('w2', NULL, '/work/wt/two');",
        )
        .expect("seed");
        let mut roots = registered_roots(&conn).expect("roots");
        roots.sort();
        assert_eq!(
            roots,
            vec![
                PathBuf::from("/work/ledger-core"),
                PathBuf::from("/work/wt/one"),
                PathBuf::from("/work/wt/two"),
            ]
        );
    }
}
