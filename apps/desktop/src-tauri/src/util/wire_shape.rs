use serde::de::DeserializeOwned;
use serde::Serialize;

pub(crate) fn assert_wire_value<T: Serialize>(value: &T, expected: serde_json::Value) {
    assert_eq!(
        serde_json::to_value(value).expect("value serializes"),
        expected
    );
}

pub(crate) fn assert_wire_roundtrip<T: Serialize + DeserializeOwned>(wire: serde_json::Value) {
    let value: T = serde_json::from_value(wire.clone()).expect("wire value deserializes");
    assert_wire_value(&value, wire);
}

pub(crate) fn assert_wire_alias<T: Serialize + DeserializeOwned>(
    inbound: serde_json::Value,
    outbound: serde_json::Value,
) {
    let value: T = serde_json::from_value(inbound).expect("inbound value deserializes");
    assert_wire_value(&value, outbound);
}

fn leaves(value: &serde_json::Value, found: &mut Vec<String>) {
    match value {
        serde_json::Value::String(text) => found.push(format!("{text:?}")),
        serde_json::Value::Number(number) => found.push(number.to_string()),
        serde_json::Value::Array(items) => items.iter().for_each(|item| leaves(item, found)),
        serde_json::Value::Object(map) => map.values().for_each(|item| leaves(item, found)),
        serde_json::Value::Bool(_) | serde_json::Value::Null => {}
    }
}

pub(crate) fn assert_wire_reads<T: DeserializeOwned + std::fmt::Debug>(wire: serde_json::Value) {
    let value: T = serde_json::from_value(wire.clone()).expect("wire value deserializes");
    let debug = format!("{value:?}");
    let mut expected = Vec::new();
    leaves(&wire, &mut expected);
    for leaf in expected {
        assert!(debug.contains(&leaf), "{leaf} missing from {debug}");
    }
}

fn camel_case(name: &str) -> String {
    let mut parts = name.split('_');
    let first = parts.next().unwrap_or_default().to_string();
    parts.fold(first, |mut joined, part| {
        let mut chars = part.chars();
        if let Some(head) = chars.next() {
            joined.extend(head.to_uppercase());
            joined.push_str(chars.as_str());
        }
        joined
    })
}

fn joined_serde_attribute(lines: &[&str], index: usize) -> Option<(String, usize)> {
    let first = lines[index].trim();
    if !first.starts_with("#[serde(") {
        return None;
    }
    let mut text = first.to_string();
    let mut last = index;
    while !text.ends_with(")]") && last + 1 < lines.len() {
        last += 1;
        text.push(' ');
        text.push_str(lines[last].trim());
    }
    Some((text, last))
}

fn field_name(line: &str) -> Option<&str> {
    let rest = line.strip_prefix("    ")?;
    let rest = rest.strip_prefix("pub(crate) ").unwrap_or(rest);
    let rest = rest.strip_prefix("pub ").unwrap_or(rest);
    let name = rest.split_once(':')?.0;
    let is_name = !name.is_empty()
        && name
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_');
    is_name.then_some(name)
}

fn rename_of(attribute: &str) -> Option<&str> {
    let after = attribute.split("rename = \"").nth(1)?;
    after.split('"').next()
}

fn redundant_field_renames(source: &str) -> Vec<String> {
    let lines: Vec<&str> = source.lines().collect();
    let mut found = Vec::new();
    let mut index = 0;
    while index < lines.len() {
        let Some((attribute, last)) = joined_serde_attribute(&lines, index) else {
            index += 1;
            continue;
        };
        index = last + 1;
        let Some(renamed) = rename_of(&attribute) else {
            continue;
        };
        let Some(field) = lines.get(index).and_then(|line| field_name(line)) else {
            continue;
        };
        if renamed == camel_case(field) || renamed == field {
            found.push(format!("{field} renamed to {renamed}"));
        }
    }
    found
}

#[test]
fn camel_case_matches_serde() {
    assert_eq!(camel_case("id"), "id");
    assert_eq!(camel_case("run_id"), "runId");
    assert_eq!(camel_case("base64_data"), "base64Data");
    assert_eq!(camel_case("a_b_c"), "aBC");
}

#[test]
fn the_scan_finds_a_rename_that_repeats_the_camel_case() {
    let source = "pub struct A {\n    #[serde(rename = \"runId\", default)]\n    pub run_id: String,\n    #[serde(rename = \"type\")]\n    pub kind: String,\n    #[serde(\n        rename = \"isMain\",\n        default\n    )]\n    pub is_main: bool,\n    #[serde(rename = \"id\")]\n    pub id: String,\n}\n";
    assert_eq!(
        redundant_field_renames(source),
        vec![
            "run_id renamed to runId".to_string(),
            "is_main renamed to isMain".to_string(),
            "id renamed to id".to_string(),
        ]
    );
}

#[test]
fn a_field_never_renames_to_its_own_camel_case() {
    let src = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut files = Vec::new();
    crate::util::source_scan::rust_files(&src, &mut files);
    let mut offenders = Vec::new();
    for path in files {
        let text = std::fs::read_to_string(&path).expect("read source");
        for found in redundant_field_renames(&text) {
            offenders.push(format!("{}: {found}", path.display()));
        }
    }
    assert!(
        offenders.is_empty(),
        "put rename_all = \"camelCase\" on the struct and drop the per-field rename: {offenders:?}"
    );
}
