use super::protocol::{
    self, help_text, parse_argv, ArgvOutcome, QueryRequest, QueryResponse, SOCKET_ENV, SUBCOMMAND,
    WORKSPACE_ENV,
};

pub(crate) fn dispatch() -> Option<i32> {
    let tokens: Vec<String> = std::env::args().skip(1).collect();
    let argv = query_argv(&tokens)?;
    match run(&argv) {
        Ok(out) => {
            println!("{}", out);
            Some(0)
        }
        Err(error) => {
            eprintln!("{}", error);
            Some(1)
        }
    }
}

fn query_argv(tokens: &[String]) -> Option<Vec<String>> {
    let (first, rest) = tokens.split_first()?;
    (first == SUBCOMMAND).then(|| rest.to_vec())
}

fn run(argv: &[String]) -> Result<String, String> {
    let parsed = match parse_argv(argv)? {
        ArgvOutcome::Help => return Ok(help_text(help_provider(argv))),
        ArgvOutcome::Parsed(parsed) => parsed,
    };
    let workspace_id = named_value(argv, "workspace")
        .or_else(|| std::env::var(WORKSPACE_ENV).ok())
        .unwrap_or_default();
    if workspace_id.trim().is_empty() {
        return Err(format!(
            "no workspace: {} is unset, pass --workspace <id>",
            WORKSPACE_ENV
        ));
    }
    let request = QueryRequest {
        workspace_id: workspace_id.trim().to_string(),
        provider: parsed.provider,
        verb: parsed.verb,
        args: parsed.args,
    };
    let response = ask(&request)?;
    if !response.ok {
        return Err(response
            .error
            .unwrap_or_else(|| "the bridge refused the request".to_string()));
    }
    let data = response.data.unwrap_or(serde_json::Value::Null);
    if named_flag(argv, "json") {
        return serde_json::to_string_pretty(&data).map_err(|error| error.to_string());
    }
    Ok(render(&data))
}

fn help_provider(argv: &[String]) -> Option<&str> {
    argv.iter()
        .map(String::as_str)
        .find(|token| !token.starts_with('-'))
        .filter(|token| protocol::providers().contains(token))
}

fn named_value(argv: &[String], name: &str) -> Option<String> {
    let flag = format!("--{}", name);
    let inline = format!("--{}=", name);
    let mut index = 0;
    while index < argv.len() {
        let token = argv[index].as_str();
        if let Some(value) = token.strip_prefix(inline.as_str()) {
            return Some(value.to_string());
        }
        if token == flag {
            return argv.get(index + 1).cloned();
        }
        index += 1;
    }
    None
}

fn named_flag(argv: &[String], name: &str) -> bool {
    let flag = format!("--{}", name);
    argv.iter().any(|token| token == &flag)
}

#[cfg(unix)]
fn ask(request: &QueryRequest) -> Result<QueryResponse, String> {
    use std::io::{BufRead, BufReader, Write};
    use std::os::unix::net::UnixStream;

    let socket = std::env::var(SOCKET_ENV).map_err(|_| {
        format!(
            "{} is unset: run this inside a Goodboy agent, or start the Goodboy app",
            SOCKET_ENV
        )
    })?;
    let mut stream = UnixStream::connect(&socket)
        .map_err(|error| format!("cannot reach Goodboy at {}: {}", socket, error))?;
    let mut payload = serde_json::to_string(request).map_err(|error| error.to_string())?;
    payload.push('\n');
    stream
        .write_all(payload.as_bytes())
        .map_err(|error| error.to_string())?;
    stream.flush().map_err(|error| error.to_string())?;
    let mut line = String::new();
    BufReader::new(&stream)
        .read_line(&mut line)
        .map_err(|error| error.to_string())?;
    if line.trim().is_empty() {
        return Err("Goodboy closed the connection without answering".to_string());
    }
    serde_json::from_str(&line).map_err(|error| format!("unreadable answer: {}", error))
}

#[cfg(not(unix))]
fn ask(_request: &QueryRequest) -> Result<QueryResponse, String> {
    Err("the Goodboy query bridge runs on macOS and Linux only".to_string())
}

fn render(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => String::new(),
        serde_json::Value::String(text) => text.clone(),
        serde_json::Value::Bool(flag) => flag.to_string(),
        serde_json::Value::Number(number) => number.to_string(),
        serde_json::Value::Array(items) => items
            .iter()
            .map(render_entry)
            .collect::<Vec<String>>()
            .join("\n\n"),
        serde_json::Value::Object(_) => render_entry(value),
    }
}

fn render_entry(value: &serde_json::Value) -> String {
    let serde_json::Value::Object(fields) = value else {
        return render(value);
    };
    let mut lines: Vec<String> = Vec::new();
    for (key, field) in fields {
        let rendered = match field {
            serde_json::Value::String(text) => text.clone(),
            serde_json::Value::Null => continue,
            serde_json::Value::Array(items) if items.is_empty() => continue,
            other => serde_json::to_string(other).unwrap_or_default(),
        };
        if rendered.contains('\n') {
            lines.push(format!("{}:\n{}", key, rendered));
            continue;
        }
        lines.push(format!("{}: {}", key, rendered));
    }
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn owned(tokens: &[&str]) -> Vec<String> {
        tokens.iter().map(|token| token.to_string()).collect()
    }

    #[test]
    fn the_query_subcommand_hands_the_rest_of_argv_to_the_client() {
        let tokens = owned(&["query", "linear", "issue", "ENG-1"]);

        assert_eq!(
            query_argv(&tokens),
            Some(owned(&["linear", "issue", "ENG-1"]))
        );
    }

    #[test]
    fn a_bare_launch_or_another_first_token_leaves_the_app_alone() {
        assert_eq!(query_argv(&[]), None);
        assert_eq!(query_argv(&owned(&["--version"])), None);
        assert_eq!(query_argv(&owned(&["linear", "issue"])), None);
    }

    #[test]
    fn the_subcommand_with_nothing_after_it_asks_for_help() {
        let argv = query_argv(&owned(&["query"])).expect("the query subcommand");

        assert!(argv.is_empty());
        assert!(run(&argv).expect("help").contains("usage:"));
    }

    #[test]
    fn the_workspace_override_is_read_from_argv_in_both_spellings() {
        let spaced = vec!["--workspace".to_string(), "ws-1".to_string()];
        let inline = vec!["--workspace=ws-2".to_string()];

        assert_eq!(named_value(&spaced, "workspace").as_deref(), Some("ws-1"));
        assert_eq!(named_value(&inline, "workspace").as_deref(), Some("ws-2"));
        assert_eq!(named_value(&[], "workspace"), None);
    }

    #[test]
    fn a_provider_named_before_help_narrows_the_help_text() {
        let argv = vec!["linear".to_string(), "--help".to_string()];

        assert_eq!(help_provider(&argv), Some("linear"));
        assert_eq!(help_provider(&["--help".to_string()]), None);
    }

    #[test]
    fn a_string_answer_prints_as_itself_and_not_as_quoted_json() {
        let rendered = render(&serde_json::json!("a unified diff"));

        assert_eq!(rendered, "a unified diff");
    }

    #[test]
    fn an_object_prints_one_readable_field_per_line() {
        let rendered = render(&serde_json::json!({
            "identifier": "ENG-1",
            "title": "ship the bridge",
            "assignee": null
        }));

        assert!(rendered.contains("identifier: ENG-1"));
        assert!(rendered.contains("title: ship the bridge"));
        assert!(!rendered.contains("assignee"));
    }

    #[test]
    fn a_list_separates_its_entries_with_a_blank_line() {
        let rendered = render(&serde_json::json!([{ "id": "a" }, { "id": "b" }]));

        assert_eq!(rendered, "id: a\n\nid: b");
    }

    #[test]
    fn a_multiline_field_keeps_its_own_lines_under_its_key() {
        let rendered = render(&serde_json::json!({ "description": "one\ntwo" }));

        assert_eq!(rendered, "description:\none\ntwo");
    }
}
