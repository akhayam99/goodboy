use std::{env, fs, path::Path};

use serde_json::Value;

const PARITY_PATH: &str = "src/attention/parity.json";

fn variant_of(table: &[(&str, &str)], word: &str) -> String {
    table
        .iter()
        .find(|(name, _)| *name == word)
        .map(|(_, variant)| (*variant).to_string())
        .unwrap_or_else(|| panic!("{PARITY_PATH} holds the unknown word {word}"))
}

fn attention_reasons_source() -> String {
    let raw = fs::read_to_string(PARITY_PATH).expect("the attention parity source is readable");
    let parity: Value = serde_json::from_str(&raw).expect("the attention parity source parses");
    let reasons = parity["reasons"]
        .as_array()
        .expect("the attention parity source lists its reasons");
    let tones = [("danger", "Danger"), ("warning", "Warning")];
    let kinds = [
        ("error", "Error"),
        ("human-input", "HumanInput"),
        ("other", "Other"),
    ];
    let rows: Vec<String> = reasons
        .iter()
        .map(|entry| {
            let code = entry["reason"].as_str().expect("a reason has a code");
            let tone = variant_of(&tones, entry["tone"].as_str().expect("a reason has a tone"));
            let kind = variant_of(&kinds, entry["kind"].as_str().expect("a reason has a kind"));
            format!("    Reason {{ code: \"{code}\", tone: Tone::{tone}, kind: Kind::{kind} }},\n")
        })
        .collect();
    format!(
        "const REASONS: [Reason; {}] = [\n{}];\n",
        rows.len(),
        rows.concat()
    )
}

fn main() {
    println!("cargo:rerun-if-changed={PARITY_PATH}");
    let out_dir = env::var("OUT_DIR").expect("cargo sets OUT_DIR");
    fs::write(
        Path::new(&out_dir).join("attention_reasons.rs"),
        attention_reasons_source(),
    )
    .expect("the generated reason table is writable");
    tauri_build::build()
}
