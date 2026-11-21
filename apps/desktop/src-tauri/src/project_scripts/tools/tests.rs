use std::fs;
use std::path::PathBuf;

use super::{just_scripts, make_scripts, pyproject_scripts, toml_entries};
use crate::project_scripts::{scan, DiscoveredScript, ScriptSource};

struct Scratch(PathBuf);

impl Scratch {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!(
            "goodboy-tool-scripts-{:016x}",
            rand::random::<u64>()
        ));
        fs::create_dir_all(&path).expect("scratch dir");
        Self(path)
    }

    fn write(&self, relative: &str, content: &str) {
        let path = self.0.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("parent dir");
        }
        fs::write(path, content).expect("file written");
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn triples(scripts: &[DiscoveredScript]) -> Vec<(&str, &str, &str)> {
    scripts
        .iter()
        .map(|script| {
            (
                script.name.as_str(),
                script.command.as_str(),
                script.body.as_str(),
            )
        })
        .collect()
}

#[test]
fn make_targets_come_with_their_recipe_and_skip_special_and_pattern_rules() {
    let scripts = make_scripts(
        ".PHONY: test lint\nCC := clang\nVERSION = 1:2\n\ntest: build\n\t@cargo test\n\t-echo done\n\nbuild lint:\n\tcargo build\n%.o: %.c\n\t$(CC) -c $<\n# notes: here\ntest:\n\techo twice\n",
    );

    assert_eq!(
        triples(&scripts),
        vec![
            ("test", "make test", "cargo test && echo done"),
            ("build", "make build", "cargo build"),
            ("lint", "make lint", "cargo build"),
        ]
    );
}

#[test]
fn just_recipes_keep_parameters_and_skip_private_ones_and_settings() {
    let scripts = just_scripts(
        "set shell := [\"bash\", \"-c\"]\nalias t := test\nversion := \"1\"\n\n# run the suite\ntest filter=\"\": build\n    cargo test {{filter}}\n\n@build:\n    cargo build\n\n_helper:\n    echo hidden\n\n[private]\nsecret:\n    echo hidden\n\n[group('ci')]\nlint:\n    cargo clippy\n",
    );

    assert_eq!(
        triples(&scripts),
        vec![
            ("test", "just test", "cargo test {{filter}}"),
            ("build", "just build", "cargo build"),
            ("lint", "just lint", "cargo clippy"),
        ]
    );
}

#[test]
fn pyproject_reads_entry_points_and_tasks_through_the_runner() {
    let entries = toml_entries(
        "[project]\nname = \"ledger-core\"\n\n[project.scripts]\nledger = \"ledger_core.cli:main\"\n\n[tool.pdm.scripts]\nlint = \"ruff check .\"\nserve = { cmd = \"uvicorn app:api\" }\n\n[tool.poe.tasks]\n\"test:unit\" = \"pytest tests/unit\"\nfmt = [\"ruff\", \"format\"]\n\n[[tool.poe.other]]\nignored = \"x\"\n",
    );

    assert_eq!(
        triples(&pyproject_scripts("uv", &entries)),
        vec![
            ("ledger", "uv run ledger", "ledger_core.cli:main"),
            ("lint", "pdm run lint", "ruff check ."),
            ("serve", "pdm run serve", "uvicorn app:api"),
            ("test:unit", "poe test:unit", "pytest tests/unit"),
            ("fmt", "poe fmt", "ruff format"),
        ]
    );
}

#[test]
fn a_project_with_make_cargo_just_and_pyproject_shows_every_tool() {
    let dir = Scratch::new();
    dir.write("Makefile", "check:\n\tcargo check\n");
    dir.write("justfile", "dev:\n    cargo run\n");
    dir.write(
        "Cargo.toml",
        "[package]\nname = \"notify-relay\"\nversion = \"0.1.0\"\n",
    );
    dir.write("src/main.rs", "fn main() {}\n");
    dir.write(
        ".cargo/config.toml",
        "[alias]\nxtask = \"run -p xtask --\"\n",
    );
    dir.write(
        "pyproject.toml",
        "[tool.poetry]\nname = \"payments-api\"\n\n[tool.poetry.scripts]\nserve = \"payments_api:serve\"\n",
    );
    dir.write("poetry.lock", "");

    let groups = scan(&dir.0).expect("scan");

    let summary: Vec<(ScriptSource, &str, &str, usize)> = groups
        .iter()
        .map(|group| {
            (
                group.source.clone(),
                group.package_name.as_str(),
                group.manager.as_str(),
                group.scripts.len(),
            )
        })
        .collect();
    let folder = dir
        .0
        .file_name()
        .and_then(|name| name.to_str())
        .expect("folder name")
        .to_string();
    assert_eq!(
        summary,
        vec![
            (ScriptSource::Make, folder.as_str(), "make", 1),
            (ScriptSource::Just, folder.as_str(), "just", 1),
            (ScriptSource::Cargo, "notify-relay", "cargo", 7),
            (ScriptSource::Pyproject, "payments-api", "poetry", 1),
        ]
    );
    let cargo = &groups[2].scripts;
    assert_eq!(cargo[5].command, "cargo run");
    assert_eq!(
        (cargo[6].name.as_str(), cargo[6].body.as_str()),
        ("xtask", "cargo run -p xtask --")
    );
    assert_eq!(groups[3].scripts[0].command, "poetry run serve");
}

#[test]
fn tool_groups_serialize_as_their_kebab_source() {
    assert_eq!(
        serde_json::to_value([
            ScriptSource::Make,
            ScriptSource::Just,
            ScriptSource::Cargo,
            ScriptSource::Pyproject
        ])
        .expect("serializes"),
        serde_json::json!(["make", "just", "cargo", "pyproject"])
    );
}
