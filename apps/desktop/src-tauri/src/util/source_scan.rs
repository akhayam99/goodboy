use std::path::{Path, PathBuf};

pub(crate) fn rust_files(dir: &Path, out: &mut Vec<PathBuf>) {
    for entry in std::fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            rust_files(&path, out);
            continue;
        }
        if path.extension().is_some_and(|ext| ext == "rs") {
            out.push(path);
        }
    }
}

fn production_lines(text: &str) -> Vec<(usize, &str)> {
    let mut kept = Vec::new();
    let mut skipping = false;
    let mut depth = 0i32;
    let mut opened = false;
    for (index, line) in text.lines().enumerate() {
        let trimmed = line.trim();
        if !skipping && trimmed.starts_with("#[cfg(") && trimmed.contains("test") {
            skipping = true;
            depth = 0;
            opened = false;
            continue;
        }
        if skipping {
            depth += line.matches('{').count() as i32 - line.matches('}').count() as i32;
            opened |= line.contains('{');
            if (opened && depth <= 0) || (!opened && trimmed.ends_with(';')) {
                skipping = false;
            }
            continue;
        }
        kept.push((index + 1, line));
    }
    kept
}

pub(crate) fn production_hits(needles: &[&str], allowed_files: &[&str]) -> Vec<String> {
    let src = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut files = Vec::new();
    rust_files(&src, &mut files);
    let mut hits = Vec::new();
    for path in files {
        let name = path.file_name().unwrap().to_string_lossy().into_owned();
        let relative = path
            .strip_prefix(&src)
            .unwrap()
            .to_string_lossy()
            .into_owned();
        if allowed_files.contains(&relative.as_str())
            || name.ends_with("tests.rs")
            || name == "fake_cli.rs"
            || name == "source_scan.rs"
        {
            continue;
        }
        let text = std::fs::read_to_string(&path).unwrap();
        for (line, content) in production_lines(&text) {
            if needles.iter().any(|needle| content.contains(needle)) {
                hits.push(format!("{relative}:{line}"));
            }
        }
    }
    hits
}
