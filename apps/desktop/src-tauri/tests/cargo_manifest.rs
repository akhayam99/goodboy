use std::fs;
use std::path::Path;

fn package_field(manifest: &str, key: &str) -> Option<String> {
    let mut in_package = false;
    for line in manifest.lines() {
        let trimmed = line.trim();
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
        return Some(raw_value.trim().trim_matches('"').to_string());
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

#[test]
fn multiple_bin_targets_require_a_default_run() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let manifest = fs::read_to_string(root.join("Cargo.toml")).expect("Cargo.toml is readable");
    let package_name = package_field(&manifest, "name").expect("[package] declares a name");
    let bins = bin_target_names(root, &package_name);
    assert!(
        !bins.is_empty(),
        "no bin target found, expected at least src/main.rs"
    );

    let default_run = package_field(&manifest, "default-run");
    if bins.len() < 2 {
        return;
    }

    let declared = default_run.unwrap_or_else(|| {
        panic!(
            "{} bin targets exist ({}) but [package] has no default-run, so `cargo run` and `tauri dev` cannot pick one",
            bins.len(),
            bins.join(", ")
        )
    });
    assert!(
        bins.contains(&declared),
        "default-run points at {declared}, which is not one of the bin targets ({})",
        bins.join(", ")
    );
}
