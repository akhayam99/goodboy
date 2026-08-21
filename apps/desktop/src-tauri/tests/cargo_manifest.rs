use std::fs;
use std::path::Path;

fn strip_inline_comment(line: &str) -> &str {
    let mut in_basic = false;
    let mut in_literal = false;
    let mut escaped = false;
    for (index, character) in line.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if in_basic && character == '\\' {
            escaped = true;
            continue;
        }
        if character == '"' && !in_literal {
            in_basic = !in_basic;
            continue;
        }
        if character == '\'' && !in_basic {
            in_literal = !in_literal;
            continue;
        }
        if character == '#' && !in_basic && !in_literal {
            return &line[..index];
        }
    }
    line
}

fn unquote(value: &str) -> String {
    let trimmed = value.trim();
    for quote in ['"', '\''] {
        let is_quoted =
            trimmed.len() >= 2 && trimmed.starts_with(quote) && trimmed.ends_with(quote);
        if is_quoted {
            return trimmed[1..trimmed.len() - 1].to_string();
        }
    }
    trimmed.to_string()
}

fn package_field(manifest: &str, key: &str) -> Option<String> {
    let mut in_package = false;
    for line in manifest.lines() {
        let trimmed = strip_inline_comment(line).trim();
        if trimmed.starts_with('[') {
            in_package = trimmed == "[package]";
            continue;
        }
        if !in_package {
            continue;
        }
        let Some((raw_key, raw_value)) = trimmed.split_once('=') else {
            continue;
        };
        if raw_key.trim() != key {
            continue;
        }
        return Some(unquote(raw_value));
    }
    None
}

fn bin_target_names(root: &Path, package_name: &str) -> Vec<String> {
    let mut names = Vec::new();
    if root.join("src").join("main.rs").is_file() {
        names.push(package_name.to_string());
    }
    let Ok(entries) = fs::read_dir(root.join("src").join("bin")) else {
        return names;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("rs") {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) else {
            continue;
        };
        names.push(stem.to_string());
    }
    names.sort();
    names
}

fn check_default_run(bins: &[String], default_run: Option<&str>) -> Result<(), String> {
    let Some(declared) = default_run else {
        if bins.len() > 1 {
            return Err(format!(
                "{} bin targets exist ({}) but [package] has no default-run, so `cargo run` and `tauri dev` cannot pick one",
                bins.len(),
                bins.join(", ")
            ));
        }
        return Ok(());
    };
    if bins.iter().any(|bin| bin == declared) {
        return Ok(());
    }
    Err(format!(
        "default-run points at {declared}, which is not one of the bin targets ({})",
        bins.join(", ")
    ))
}

fn owned(names: &[&str]) -> Vec<String> {
    names.iter().map(|name| name.to_string()).collect()
}

#[test]
fn the_manifest_can_pick_a_bin_for_a_bare_cargo_run() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let manifest = fs::read_to_string(root.join("Cargo.toml")).expect("Cargo.toml is readable");
    let package_name = package_field(&manifest, "name").expect("[package] declares a name");
    let bins = bin_target_names(root, &package_name);
    assert!(
        !bins.is_empty(),
        "no bin target found, expected at least src/main.rs"
    );

    let default_run = package_field(&manifest, "default-run");
    if let Err(reason) = check_default_run(&bins, default_run.as_deref()) {
        panic!("{reason}");
    }
}

#[test]
fn a_field_keeps_its_value_when_an_inline_comment_follows() {
    let manifest = "[package]\ndefault-run = \"goodboy-desktop\" # pick the UI app\n";
    assert_eq!(
        package_field(manifest, "default-run").as_deref(),
        Some("goodboy-desktop")
    );
}

#[test]
fn a_single_quoted_field_reads_the_same_as_a_double_quoted_one() {
    let manifest = "[package]\ndefault-run = 'goodboy-desktop'\n";
    assert_eq!(
        package_field(manifest, "default-run").as_deref(),
        Some("goodboy-desktop")
    );
}

#[test]
fn a_hash_inside_a_quoted_value_is_not_a_comment() {
    let manifest = "[package]\nname = \"good#boy\" # trailing\n";
    assert_eq!(package_field(manifest, "name").as_deref(), Some("good#boy"));
}

#[test]
fn a_commented_section_header_still_opens_the_package_table() {
    let manifest = "[package] # the crate\ndefault-run = \"goodboy-desktop\"\n";
    assert_eq!(
        package_field(manifest, "default-run").as_deref(),
        Some("goodboy-desktop")
    );
}

#[test]
fn a_field_outside_the_package_table_is_ignored() {
    let manifest = "[dependencies]\ndefault-run = \"nope\"\n";
    assert_eq!(package_field(manifest, "default-run"), None);
}

#[test]
fn several_bins_without_a_default_run_are_rejected() {
    let bins = owned(&["goodboy-desktop", "goodboy-query"]);
    let reason = check_default_run(&bins, None).expect_err("two bins need a default-run");
    assert!(reason.contains("no default-run"), "{reason}");
}

#[test]
fn a_single_bin_without_a_default_run_is_accepted() {
    let bins = owned(&["goodboy-desktop"]);
    assert!(check_default_run(&bins, None).is_ok());
}

#[test]
fn a_single_bin_with_an_unknown_default_run_is_rejected() {
    let bins = owned(&["goodboy-desktop"]);
    let reason = check_default_run(&bins, Some("goodboy-query"))
        .expect_err("default-run must name a real bin target");
    assert!(reason.contains("goodboy-query"), "{reason}");
}

#[test]
fn several_bins_with_a_known_default_run_are_accepted() {
    let bins = owned(&["goodboy-desktop", "goodboy-query"]);
    assert!(check_default_run(&bins, Some("goodboy-desktop")).is_ok());
}
