use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use super::{fallback_package_name, shell_word, DiscoveredScript, ScriptGroup, ScriptSource};

const MAX_TOOL_SCRIPTS: usize = 100;
const MAKEFILES: [&str; 3] = ["GNUmakefile", "makefile", "Makefile"];
const JUSTFILES: [&str; 3] = ["justfile", "Justfile", ".justfile"];
const CARGO_COMMANDS: [&str; 5] = ["build", "check", "test", "clippy", "fmt"];
const JUST_KEYWORDS: [&str; 7] = ["set", "alias", "export", "import", "mod", "unexport", "if"];

fn read_first(root: &Path, names: &[&str]) -> Option<String> {
    names
        .iter()
        .find_map(|name| fs::read_to_string(root.join(name)).ok())
}

fn is_target_char(character: char) -> bool {
    character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | '/' | ':')
}

fn is_name_char(character: char) -> bool {
    character.is_ascii_alphanumeric() || matches!(character, '-' | '_')
}

fn joined_body(lines: &[String]) -> String {
    lines.join(" && ")
}

fn push_script(
    scripts: &mut Vec<DiscoveredScript>,
    seen: &mut BTreeSet<String>,
    script: DiscoveredScript,
) {
    if scripts.len() >= MAX_TOOL_SCRIPTS || !seen.insert(script.name.clone()) {
        return;
    }
    scripts.push(script);
}

fn make_targets(line: &str) -> Option<Vec<String>> {
    if line.starts_with(char::is_whitespace) || line.starts_with('#') {
        return None;
    }
    let colon = line.find(':')?;
    let (head, rest) = line.split_at(colon);
    if rest.starts_with(":=") || rest.starts_with("::=") || head.contains('=') {
        return None;
    }
    let targets: Vec<String> = head
        .split_whitespace()
        .filter(|target| !target.starts_with('.') && target.chars().all(is_target_char))
        .map(str::to_string)
        .collect();
    let is_rule = !head.trim().is_empty() && !head.contains('%') && !head.contains('$');
    Some(targets).filter(|targets| is_rule && !targets.is_empty())
}

pub(super) fn make_scripts(content: &str) -> Vec<DiscoveredScript> {
    let mut scripts = Vec::new();
    let mut seen = BTreeSet::new();
    let mut current: Vec<String> = Vec::new();
    let mut recipe: Vec<String> = Vec::new();
    let mut flush = |current: &mut Vec<String>, recipe: &mut Vec<String>| {
        for target in current.drain(..) {
            push_script(
                &mut scripts,
                &mut seen,
                DiscoveredScript {
                    command: format!("make {}", shell_word(&target)),
                    name: target,
                    body: joined_body(recipe),
                },
            );
        }
        recipe.clear();
    };
    for line in content.lines() {
        if let Some(command) = line.strip_prefix('\t') {
            let command = command.trim();
            if !current.is_empty() && !command.is_empty() {
                recipe.push(command.trim_start_matches(['@', '-']).to_string());
            }
            continue;
        }
        if line.trim().is_empty() || line.trim_start().starts_with('#') {
            continue;
        }
        flush(&mut current, &mut recipe);
        if let Some(targets) = make_targets(line) {
            current = targets;
        }
    }
    flush(&mut current, &mut recipe);
    scripts
}

fn just_recipe_name(line: &str) -> Option<String> {
    let line = line.strip_prefix('@').unwrap_or(line);
    let name: String = line.chars().take_while(|c| is_name_char(*c)).collect();
    if name.is_empty() || JUST_KEYWORDS.contains(&name.as_str()) {
        return None;
    }
    let rest = &line[name.len()..];
    let colon = rest.find(':')?;
    let is_assignment = rest[colon..].starts_with(":=");
    let parameters = &rest[..colon];
    let is_parameter_list = parameters.is_empty() || parameters.starts_with(char::is_whitespace);
    (!is_assignment && is_parameter_list).then_some(name)
}

pub(super) fn just_scripts(content: &str) -> Vec<DiscoveredScript> {
    let mut scripts = Vec::new();
    let mut seen = BTreeSet::new();
    let mut current: Option<String> = None;
    let mut is_private_next = false;
    let mut recipe: Vec<String> = Vec::new();
    let mut flush = |current: &mut Option<String>, recipe: &mut Vec<String>| {
        if let Some(name) = current.take() {
            push_script(
                &mut scripts,
                &mut seen,
                DiscoveredScript {
                    command: format!("just {}", shell_word(&name)),
                    name,
                    body: joined_body(recipe),
                },
            );
        }
        recipe.clear();
    };
    for line in content.lines() {
        if line.starts_with(char::is_whitespace) {
            let command = line.trim();
            if current.is_some() && !command.is_empty() && !command.starts_with('#') {
                recipe.push(command.trim_start_matches(['@', '-']).to_string());
            }
            continue;
        }
        if line.trim().is_empty() || line.starts_with('#') {
            continue;
        }
        flush(&mut current, &mut recipe);
        if line.starts_with('[') {
            is_private_next = is_private_next || line.contains("private");
            continue;
        }
        let name = just_recipe_name(line);
        let is_private = is_private_next || name.as_deref().is_some_and(|n| n.starts_with('_'));
        is_private_next = false;
        if !is_private {
            current = name;
        }
    }
    flush(&mut current, &mut recipe);
    scripts
}

fn unquoted(value: &str) -> Option<String> {
    let value = value.trim();
    let quote = value.chars().next().filter(|c| *c == '"' || *c == '\'')?;
    let inner = value.strip_prefix(quote)?;
    let end = inner.find(quote)?;
    Some(inner[..end].to_string())
}

fn toml_string(value: &str) -> Option<String> {
    let value = value.trim();
    if let Some(text) = unquoted(value) {
        return Some(text);
    }
    let inner = value.strip_prefix('[')?.strip_suffix(']')?;
    let parts: Vec<String> = inner.split(',').filter_map(unquoted).collect();
    Some(parts.join(" ")).filter(|joined| !joined.is_empty())
}

fn inline_table_command(value: &str) -> Option<String> {
    let inner = value.trim().strip_prefix('{')?.strip_suffix('}')?;
    inner.split(',').find_map(|pair| {
        let (key, value) = pair.split_once('=')?;
        matches!(key.trim(), "cmd" | "shell" | "script")
            .then(|| unquoted(value))
            .flatten()
    })
}

fn toml_key(key: &str) -> Option<String> {
    let key = key.trim();
    let name = unquoted(key).unwrap_or_else(|| key.to_string());
    Some(name).filter(|name| !name.is_empty() && name.chars().all(is_target_char))
}

pub(super) struct TomlEntry {
    pub(super) section: String,
    pub(super) key: String,
    pub(super) value: String,
}

pub(super) fn toml_entries(content: &str) -> Vec<TomlEntry> {
    let mut section = String::new();
    let mut entries = Vec::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if line.starts_with("[[") {
            section = String::new();
            continue;
        }
        if let Some(header) = line.strip_prefix('[').and_then(|l| l.split(']').next()) {
            section = header
                .split('.')
                .map(|part| unquoted(part).unwrap_or_else(|| part.trim().to_string()))
                .collect::<Vec<_>>()
                .join(".");
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let Some(key) = toml_key(key) else {
            continue;
        };
        entries.push(TomlEntry {
            section: section.clone(),
            key,
            value: value.trim().to_string(),
        });
    }
    entries
}

fn toml_name(entries: &[TomlEntry], sections: &[&str]) -> Option<String> {
    entries
        .iter()
        .find(|entry| sections.contains(&entry.section.as_str()) && entry.key == "name")
        .and_then(|entry| unquoted(&entry.value))
        .filter(|name| !name.is_empty())
}

fn cargo_aliases(root: &Path) -> Vec<TomlEntry> {
    read_first(root, &[".cargo/config.toml", ".cargo/config"])
        .map(|content| toml_entries(&content))
        .unwrap_or_default()
        .into_iter()
        .filter(|entry| entry.section == "alias")
        .collect()
}

pub(super) fn cargo_scripts(root: &Path, manifest: &str) -> Vec<DiscoveredScript> {
    let mut scripts = Vec::new();
    let mut seen = BTreeSet::new();
    let has_binary = root.join("src/main.rs").is_file() || manifest.contains("[[bin]]");
    let commands = CARGO_COMMANDS
        .iter()
        .copied()
        .chain(has_binary.then_some("run"));
    for command in commands {
        push_script(
            &mut scripts,
            &mut seen,
            DiscoveredScript {
                name: command.to_string(),
                command: format!("cargo {command}"),
                body: format!("cargo {command}"),
            },
        );
    }
    for alias in cargo_aliases(root) {
        let Some(body) = toml_string(&alias.value) else {
            continue;
        };
        push_script(
            &mut scripts,
            &mut seen,
            DiscoveredScript {
                command: format!("cargo {}", shell_word(&alias.key)),
                name: alias.key,
                body: format!("cargo {body}"),
            },
        );
    }
    scripts
}

fn python_runner(root: &Path) -> &'static str {
    if root.join("uv.lock").is_file() {
        return "uv";
    }
    if root.join("poetry.lock").is_file() {
        return "poetry";
    }
    if root.join("pdm.lock").is_file() {
        return "pdm";
    }
    "python"
}

fn entry_point_command(runner: &str, name: &str) -> String {
    if runner == "python" {
        return shell_word(name);
    }
    format!("{runner} run {}", shell_word(name))
}

fn task_body(value: &str) -> Option<String> {
    toml_string(value).or_else(|| inline_table_command(value))
}

pub(super) fn pyproject_scripts(runner: &str, entries: &[TomlEntry]) -> Vec<DiscoveredScript> {
    let mut scripts = Vec::new();
    let mut seen = BTreeSet::new();
    for entry in entries {
        let script = match entry.section.as_str() {
            "project.scripts" | "tool.poetry.scripts" => {
                unquoted(&entry.value).map(|body| DiscoveredScript {
                    name: entry.key.clone(),
                    command: entry_point_command(runner, &entry.key),
                    body,
                })
            }
            "tool.pdm.scripts" => task_body(&entry.value).map(|body| DiscoveredScript {
                name: entry.key.clone(),
                command: format!("pdm run {}", shell_word(&entry.key)),
                body,
            }),
            "tool.poe.tasks" => task_body(&entry.value).map(|body| DiscoveredScript {
                name: entry.key.clone(),
                command: format!("poe {}", shell_word(&entry.key)),
                body,
            }),
            _ => None,
        };
        if let Some(script) = script {
            push_script(&mut scripts, &mut seen, script);
        }
    }
    scripts
}

fn group(
    source: ScriptSource,
    package_name: String,
    manager: &str,
    scripts: Vec<DiscoveredScript>,
) -> Option<ScriptGroup> {
    if scripts.is_empty() {
        return None;
    }
    Some(ScriptGroup {
        source,
        package_name,
        rel_dir: String::new(),
        manager: manager.to_string(),
        scripts,
    })
}

pub(super) fn tool_groups(root: &Path) -> Vec<ScriptGroup> {
    let folder_name = fallback_package_name(root);
    let mut groups = Vec::new();
    if let Some(content) = read_first(root, &MAKEFILES) {
        groups.extend(group(
            ScriptSource::Make,
            folder_name.clone(),
            "make",
            make_scripts(&content),
        ));
    }
    if let Some(content) = read_first(root, &JUSTFILES) {
        groups.extend(group(
            ScriptSource::Just,
            folder_name.clone(),
            "just",
            just_scripts(&content),
        ));
    }
    if let Ok(manifest) = fs::read_to_string(root.join("Cargo.toml")) {
        let name = toml_name(&toml_entries(&manifest), &["package"]);
        groups.extend(group(
            ScriptSource::Cargo,
            name.unwrap_or_else(|| folder_name.clone()),
            "cargo",
            cargo_scripts(root, &manifest),
        ));
    }
    if let Ok(manifest) = fs::read_to_string(root.join("pyproject.toml")) {
        let entries = toml_entries(&manifest);
        let runner = python_runner(root);
        let name = toml_name(&entries, &["project", "tool.poetry"]);
        groups.extend(group(
            ScriptSource::Pyproject,
            name.unwrap_or(folder_name),
            runner,
            pyproject_scripts(runner, &entries),
        ));
    }
    groups
}

#[cfg(test)]
mod tests;
