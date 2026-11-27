#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Property {
    pub name: String,
    pub params: Vec<(String, String)>,
    pub value: String,
}

impl Property {
    pub(crate) fn param(&self, name: &str) -> Option<&str> {
        self.params
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .map(|(_, value)| value.as_str())
    }
}

pub(crate) fn unfold(text: &str) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();
    for raw in text.split('\n') {
        let line = raw.strip_suffix('\r').unwrap_or(raw);
        let continued = line.strip_prefix(' ').or_else(|| line.strip_prefix('\t'));
        if let (Some(rest), Some(last)) = (continued, lines.last_mut()) {
            last.push_str(rest);
            continue;
        }
        if line.is_empty() {
            continue;
        }
        lines.push(line.to_string());
    }
    lines
}

fn split_outside_quotes(text: &str, separator: char) -> Vec<&str> {
    let mut parts = Vec::new();
    let mut is_quoted = false;
    let mut start = 0;
    for (index, character) in text.char_indices() {
        if character == '"' {
            is_quoted = !is_quoted;
            continue;
        }
        if character == separator && !is_quoted {
            parts.push(&text[start..index]);
            start = index + character.len_utf8();
        }
    }
    parts.push(&text[start..]);
    parts
}

fn value_start(line: &str) -> Option<usize> {
    let mut is_quoted = false;
    for (index, character) in line.char_indices() {
        if character == '"' {
            is_quoted = !is_quoted;
            continue;
        }
        if character == ':' && !is_quoted {
            return Some(index);
        }
    }
    None
}

pub(crate) fn parse_line(line: &str) -> Option<Property> {
    let colon = value_start(line)?;
    let head = &line[..colon];
    let value = line[colon + 1..].to_string();
    let mut parts = split_outside_quotes(head, ';').into_iter();
    let name = parts.next()?.trim().to_ascii_uppercase();
    if name.is_empty() {
        return None;
    }
    let params = parts
        .filter_map(|part| {
            let (key, raw) = part.split_once('=')?;
            Some((
                key.trim().to_ascii_uppercase(),
                raw.trim().trim_matches('"').to_string(),
            ))
        })
        .collect();
    Some(Property {
        name,
        params,
        value,
    })
}

pub(crate) fn unescape_text(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut chars = value.chars();
    while let Some(character) = chars.next() {
        if character != '\\' {
            out.push(character);
            continue;
        }
        match chars.next() {
            Some('n') | Some('N') => out.push('\n'),
            Some(other) => out.push(other),
            None => out.push('\\'),
        }
    }
    out
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct Component {
    pub name: String,
    pub properties: Vec<Property>,
    pub children: Vec<Component>,
}

impl Component {
    pub(crate) fn first(&self, name: &str) -> Option<&Property> {
        self.properties
            .iter()
            .find(|property| property.name == name)
    }

    pub(crate) fn all<'a>(&'a self, name: &'a str) -> impl Iterator<Item = &'a Property> + 'a {
        self.properties
            .iter()
            .filter(move |property| property.name == name)
    }

    pub(crate) fn text(&self, name: &str) -> Option<String> {
        self.first(name)
            .map(|property| unescape_text(&property.value))
            .filter(|text| !text.trim().is_empty())
    }
}

const MAX_DEPTH: usize = 8;

pub(crate) fn parse_components(text: &str) -> Vec<Component> {
    let mut stack: Vec<Component> = Vec::new();
    let mut roots = Vec::new();
    for line in unfold(text) {
        let Some(property) = parse_line(&line) else {
            continue;
        };
        if property.name == "BEGIN" {
            if stack.len() >= MAX_DEPTH {
                continue;
            }
            stack.push(Component {
                name: property.value.trim().to_ascii_uppercase(),
                ..Component::default()
            });
            continue;
        }
        if property.name == "END" {
            let Some(done) = stack.pop() else {
                continue;
            };
            match stack.last_mut() {
                Some(parent) => parent.children.push(done),
                None => roots.push(done),
            }
            continue;
        }
        if let Some(open) = stack.last_mut() {
            open.properties.push(property);
        }
    }
    roots
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folded_lines_join_and_crlf_is_dropped() {
        let lines = unfold("SUMMARY:Northwind\r\n  planning\r\n\tday\r\nUID:1\r\n");
        assert_eq!(lines, vec!["SUMMARY:Northwind planningday", "UID:1"]);
    }

    #[test]
    fn a_quoted_parameter_may_hold_a_colon_and_a_semicolon() {
        let property = parse_line(
            "ATTENDEE;CN=\"Acme: Ana; Ops\";ROLE=REQ-PARTICIPANT:mailto:ana@acme.example",
        )
        .unwrap();
        assert_eq!(property.name, "ATTENDEE");
        assert_eq!(property.param("cn"), Some("Acme: Ana; Ops"));
        assert_eq!(property.value, "mailto:ana@acme.example");
    }

    #[test]
    fn text_values_unescape() {
        assert_eq!(
            unescape_text("Room 4\\, Harborline\\nFloor 2\\; east \\\\ wing"),
            "Room 4, Harborline\nFloor 2; east \\ wing"
        );
    }

    #[test]
    fn components_nest_and_an_unclosed_tail_is_dropped() {
        let roots = parse_components(
            "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:a\nBEGIN:VALARM\nACTION:DISPLAY\nEND:VALARM\nEND:VEVENT\nEND:VCALENDAR\nBEGIN:VEVENT\nUID:b\n",
        );
        assert_eq!(roots.len(), 1);
        let event = &roots[0].children[0];
        assert_eq!(event.name, "VEVENT");
        assert_eq!(event.text("UID").as_deref(), Some("a"));
        assert_eq!(event.children[0].name, "VALARM");
    }
}
