use std::collections::BTreeSet;
use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

const MAX_PACKAGES: usize = 50;
const EXCLUDED_DIRS: [&str; 3] = ["node_modules", ".git", "vendor"];

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ScriptSource {
    PackageJson,
    Composer,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredScript {
    name: String,
    command: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptGroup {
    source: ScriptSource,
    package_name: String,
    rel_dir: String,
    manager: String,
    scripts: Vec<DiscoveredScript>,
}

#[derive(Debug, thiserror::Error)]
pub enum ScriptScanError {
    #[error("io error: {0}")]
    Io(String),
}

crate::util::impl_error_serialize!(ScriptScanError);

impl ScriptScanError {
    fn kind(&self) -> &'static str {
        match self {
            ScriptScanError::Io(_) => "io",
        }
    }
}

fn fallback_package_name(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("package")
        .to_string()
}

fn package_scripts(value: &Value, manager: &str) -> Vec<DiscoveredScript> {
    let Some(scripts) = value.get("scripts").and_then(Value::as_object) else {
        return Vec::new();
    };
    scripts
        .keys()
        .map(|name| DiscoveredScript {
            name: name.clone(),
            command: format!("{manager} run {name}"),
        })
        .collect()
}

fn composer_scripts(value: &Value) -> Vec<DiscoveredScript> {
    let Some(scripts) = value.get("scripts").and_then(Value::as_object) else {
        return Vec::new();
    };
    scripts
        .keys()
        .map(|name| DiscoveredScript {
            name: name.clone(),
            command: format!("composer run-script {name}"),
        })
        .collect()
}

fn read_json(path: &Path) -> Option<Value> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn workspace_patterns(value: &Value) -> Vec<String> {
    let Some(workspaces) = value.get("workspaces") else {
        return Vec::new();
    };
    let values = match workspaces {
        Value::Array(values) => Some(values),
        Value::Object(object) => object.get("packages").and_then(Value::as_array),
        _ => None,
    };
    values
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .map(str::to_string)
        .collect()
}

fn clean_yaml_value(value: &str) -> Option<String> {
    let without_comment = value.split('#').next().unwrap_or("").trim();
    let cleaned = without_comment
        .trim_end_matches(',')
        .trim()
        .trim_matches(|character| character == '\'' || character == '"')
        .trim();
    if cleaned.is_empty() {
        return None;
    }
    Some(cleaned.to_string())
}

fn pnpm_workspace_patterns(root: &Path) -> Vec<String> {
    let Ok(content) = fs::read_to_string(root.join("pnpm-workspace.yaml")) else {
        return Vec::new();
    };
    let mut patterns = Vec::new();
    let mut is_packages = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("packages:") {
            is_packages = true;
            let inline = trimmed.trim_start_matches("packages:").trim();
            if inline.starts_with('[') && inline.ends_with(']') {
                patterns.extend(
                    inline[1..inline.len() - 1]
                        .split(',')
                        .filter_map(clean_yaml_value),
                );
            }
            continue;
        }
        if !is_packages {
            continue;
        }
        if !line.starts_with(char::is_whitespace) && !trimmed.is_empty() {
            break;
        }
        let Some(value) = trimmed.strip_prefix('-') else {
            continue;
        };
        if let Some(pattern) = clean_yaml_value(value) {
            patterns.push(pattern);
        }
    }
    patterns
}

fn normalized_relative_path(value: &str) -> Option<PathBuf> {
    let path = Path::new(value.trim().trim_end_matches('/'));
    if path.as_os_str().is_empty() {
        return None;
    }
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(segment) => {
                let segment = segment.to_str()?;
                if EXCLUDED_DIRS.contains(&segment) {
                    return None;
                }
                normalized.push(segment);
            }
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return None,
        }
    }
    Some(normalized)
}

fn relative_display(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(segment) => segment.to_str().map(str::to_string),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn add_candidate(root: &Path, relative: &Path, candidates: &mut BTreeSet<String>) {
    if candidates.len() >= MAX_PACKAGES.saturating_sub(1) {
        return;
    }
    let candidate = root.join(relative);
    let Ok(canonical) = candidate.canonicalize() else {
        return;
    };
    if !canonical.starts_with(root) || !canonical.join("package.json").is_file() {
        return;
    }
    candidates.insert(relative_display(relative));
}

fn expand_pattern(root: &Path, pattern: &str, candidates: &mut BTreeSet<String>) {
    if candidates.len() >= MAX_PACKAGES.saturating_sub(1) {
        return;
    }
    if let Some(base) = pattern.strip_suffix("/*") {
        let Some(base_path) = normalized_relative_path(base) else {
            return;
        };
        let Ok(entries) = fs::read_dir(root.join(&base_path)) else {
            return;
        };
        let mut children = entries.flatten().collect::<Vec<_>>();
        children.sort_by_key(|entry| entry.file_name());
        for entry in children {
            if candidates.len() >= MAX_PACKAGES.saturating_sub(1) {
                break;
            }
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if !file_type.is_dir() {
                continue;
            }
            let Some(name) = entry.file_name().to_str().map(str::to_string) else {
                continue;
            };
            if EXCLUDED_DIRS.contains(&name.as_str()) {
                continue;
            }
            add_candidate(root, &base_path.join(name), candidates);
        }
        return;
    }
    if pattern.contains('*') {
        return;
    }
    let Some(relative) = normalized_relative_path(pattern) else {
        return;
    };
    add_candidate(root, &relative, candidates);
}

fn detect_manager(root: &Path) -> &'static str {
    if root.join("pnpm-lock.yaml").is_file() {
        return "pnpm";
    }
    if root.join("yarn.lock").is_file() {
        return "yarn";
    }
    if root.join("bun.lockb").is_file() || root.join("bun.lock").is_file() {
        return "bun";
    }
    "npm"
}

fn package_group(path: &Path, rel_dir: &str, manager: &str) -> Option<ScriptGroup> {
    let value = read_json(&path.join("package.json"))?;
    let scripts = package_scripts(&value, manager);
    if scripts.is_empty() {
        return None;
    }
    let package_name = value
        .get("name")
        .and_then(Value::as_str)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| fallback_package_name(path));
    Some(ScriptGroup {
        source: ScriptSource::PackageJson,
        package_name,
        rel_dir: rel_dir.to_string(),
        manager: manager.to_string(),
        scripts,
    })
}

fn scan(root: &Path) -> Result<Vec<ScriptGroup>, ScriptScanError> {
    let root = root
        .canonicalize()
        .map_err(|error| ScriptScanError::Io(error.to_string()))?;
    let manager = detect_manager(&root);
    let root_manifest = read_json(&root.join("package.json"));
    let mut patterns = root_manifest
        .as_ref()
        .map(workspace_patterns)
        .unwrap_or_default();
    patterns.extend(pnpm_workspace_patterns(&root));
    let mut candidates = BTreeSet::new();
    for pattern in patterns {
        expand_pattern(&root, &pattern, &mut candidates);
    }

    let mut groups = Vec::new();
    if let Some(group) = package_group(&root, "", manager) {
        groups.push(group);
    }
    for rel_dir in candidates.into_iter().take(MAX_PACKAGES.saturating_sub(1)) {
        if let Some(group) = package_group(&root.join(&rel_dir), &rel_dir, manager) {
            groups.push(group);
        }
    }
    if let Some(value) = read_json(&root.join("composer.json")) {
        let scripts = composer_scripts(&value);
        if !scripts.is_empty() {
            let package_name = value
                .get("name")
                .and_then(Value::as_str)
                .filter(|name| !name.is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| fallback_package_name(&root));
            groups.push(ScriptGroup {
                source: ScriptSource::Composer,
                package_name,
                rel_dir: String::new(),
                manager: "composer".to_string(),
                scripts,
            });
        }
    }
    Ok(groups)
}

#[tauri::command]
pub async fn project_scripts_scan(
    worktree_path: String,
) -> Result<Vec<ScriptGroup>, ScriptScanError> {
    tauri::async_runtime::spawn_blocking(move || scan(Path::new(&worktree_path)))
        .await
        .map_err(|error| ScriptScanError::Io(error.to_string()))?
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU64, Ordering};

    use super::*;

    static NEXT_DIR: AtomicU64 = AtomicU64::new(0);

    struct TestDir(PathBuf);

    impl TestDir {
        fn new(name: &str) -> Self {
            let ordinal = NEXT_DIR.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "goodboy-project-scripts-{}-{}-{}",
                std::process::id(),
                ordinal,
                name
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }

        fn write(&self, relative: &str, content: &str) {
            let path = self.0.join(relative);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::write(path, content).unwrap();
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn scans_plain_package() {
        let dir = TestDir::new("plain");
        dir.write(
            "package.json",
            r#"{"name":"plain-app","scripts":{"build":"vite build","dev":"vite"}}"#,
        );

        let groups = scan(&dir.0).unwrap();

        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].package_name, "plain-app");
        assert_eq!(groups[0].rel_dir, "");
        assert_eq!(groups[0].manager, "npm");
        assert_eq!(groups[0].scripts[0].command, "npm run build");
    }

    #[test]
    fn scans_pnpm_monorepo_globs() {
        let dir = TestDir::new("pnpm");
        dir.write(
            "package.json",
            r#"{"name":"root","scripts":{"dev":"vite"}}"#,
        );
        dir.write("pnpm-lock.yaml", "lockfileVersion: '9.0'");
        dir.write("pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n");
        dir.write(
            "packages/api/package.json",
            r#"{"name":"api","scripts":{"test":"vitest"}}"#,
        );
        dir.write(
            "packages/web/package.json",
            r#"{"name":"web","scripts":{"build":"vite build"}}"#,
        );

        let groups = scan(&dir.0).unwrap();

        assert_eq!(groups.len(), 3);
        assert_eq!(groups[1].rel_dir, "packages/api");
        assert_eq!(groups[2].rel_dir, "packages/web");
        assert!(groups.iter().all(|group| group.manager == "pnpm"));
    }

    #[test]
    fn scans_package_workspaces_array_and_explicit_paths() {
        let dir = TestDir::new("workspaces");
        dir.write(
            "package.json",
            r#"{"workspaces":["apps/*","tools/cli"],"scripts":{"root":"true"}}"#,
        );
        dir.write("apps/site/package.json", r#"{"scripts":{"dev":"vite"}}"#);
        dir.write(
            "tools/cli/package.json",
            r#"{"name":"cli","scripts":{"check":"cargo check"}}"#,
        );

        let groups = scan(&dir.0).unwrap();

        assert_eq!(groups.len(), 3);
        assert_eq!(groups[1].package_name, "site");
        assert_eq!(groups[2].package_name, "cli");
    }

    #[test]
    fn scans_composer_scripts_last() {
        let dir = TestDir::new("composer");
        dir.write(
            "package.json",
            r#"{"name":"web","scripts":{"build":"vite build"}}"#,
        );
        dir.write(
            "composer.json",
            r#"{"name":"acme/server","scripts":{"post-install-cmd":"@php artisan","test":"phpunit"}}"#,
        );

        let groups = scan(&dir.0).unwrap();

        assert_eq!(groups.len(), 2);
        assert_eq!(groups[1].source, ScriptSource::Composer);
        assert_eq!(groups[1].scripts.len(), 2);
        assert_eq!(groups[1].scripts[1].command, "composer run-script test");
    }

    #[test]
    fn skips_malformed_manifests() {
        let dir = TestDir::new("malformed");
        dir.write(
            "package.json",
            r#"{"workspaces":["packages/*"],"scripts":{"root":"true"}}"#,
        );
        dir.write("packages/bad/package.json", "{");
        dir.write(
            "packages/good/package.json",
            r#"{"name":"good","scripts":{"test":"vitest"}}"#,
        );

        let groups = scan(&dir.0).unwrap();

        assert_eq!(groups.len(), 2);
        assert_eq!(groups[1].package_name, "good");
    }

    #[test]
    fn excludes_dependency_directories() {
        let dir = TestDir::new("excluded");
        dir.write(
            "package.json",
            r#"{"workspaces":["node_modules/*","vendor/*","packages/*"],"scripts":{"root":"true"}}"#,
        );
        dir.write(
            "node_modules/dependency/package.json",
            r#"{"name":"dependency","scripts":{"postinstall":"bad"}}"#,
        );
        dir.write(
            "vendor/dependency/package.json",
            r#"{"name":"vendor-dependency","scripts":{"test":"bad"}}"#,
        );
        dir.write(
            "packages/app/package.json",
            r#"{"name":"app","scripts":{"test":"vitest"}}"#,
        );

        let groups = scan(&dir.0).unwrap();

        assert_eq!(groups.len(), 2);
        assert_eq!(groups[1].package_name, "app");
    }

    #[test]
    fn detects_yarn_and_bun_managers() {
        let yarn = TestDir::new("yarn");
        yarn.write("package.json", r#"{"scripts":{"test":"vitest"}}"#);
        yarn.write("yarn.lock", "");
        let bun = TestDir::new("bun");
        bun.write("package.json", r#"{"scripts":{"test":"bun test"}}"#);
        bun.write("bun.lock", "");

        assert_eq!(scan(&yarn.0).unwrap()[0].manager, "yarn");
        assert_eq!(scan(&bun.0).unwrap()[0].manager, "bun");
    }
}
