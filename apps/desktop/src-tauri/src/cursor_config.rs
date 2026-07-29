use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde_json::Value;

pub fn source_config_dir() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("CURSOR_CONFIG_DIR") {
        return Some(PathBuf::from(path));
    }
    if let Some(path) = std::env::var_os("XDG_CONFIG_HOME") {
        return Some(PathBuf::from(path).join("cursor"));
    }
    Some(dirs::home_dir()?.join(".cursor"))
}

pub fn write_max_mode_config(source: &Path, target: &Path) -> io::Result<()> {
    let source_config = fs::read(source.join("cli-config.json"))?;
    let mut config: Value = serde_json::from_slice(&source_config)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let config_object = config.as_object_mut().ok_or_else(|| {
        io::Error::new(io::ErrorKind::InvalidData, "cursor config is not an object")
    })?;
    config_object.insert("maxMode".to_string(), Value::Bool(true));

    fs::create_dir_all(target)?;
    let output = serde_json::to_vec_pretty(&config).map_err(io::Error::other)?;
    fs::write(target.join("cli-config.json"), output)?;

    let source_permissions = source.join("permissions.json");
    if source_permissions.exists() {
        fs::copy(source_permissions, target.join("permissions.json"))?;
    }

    Ok(())
}

pub fn max_mode_config_dir() -> Option<PathBuf> {
    let source = source_config_dir()?;
    let target = dirs::cache_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("goodboy")
        .join("cursor-max-mode");
    write_max_mode_config(&source, &target).ok()?;
    Some(target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_DIRECTORY: AtomicU64 = AtomicU64::new(0);

    fn unique_directory(name: &str) -> PathBuf {
        let sequence = NEXT_DIRECTORY.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!(
            "goodboy-cursor-config-{name}-{}-{sequence}",
            std::process::id()
        ))
    }

    #[test]
    fn writes_max_mode_and_preserves_existing_keys() {
        let source = unique_directory("patch-source");
        let target = unique_directory("patch-target");
        fs::create_dir_all(&source).unwrap();
        fs::write(
            source.join("cli-config.json"),
            r#"{"theme":"dark","maxMode":false,"nested":{"enabled":true}}"#,
        )
        .unwrap();

        write_max_mode_config(&source, &target).unwrap();

        let output: Value =
            serde_json::from_slice(&fs::read(target.join("cli-config.json")).unwrap()).unwrap();
        assert_eq!(output["maxMode"], Value::Bool(true));
        assert_eq!(output["theme"], Value::String("dark".to_string()));
        assert_eq!(output["nested"]["enabled"], Value::Bool(true));

        fs::remove_dir_all(source).unwrap();
        fs::remove_dir_all(target).unwrap();
    }

    #[test]
    fn copies_existing_permissions() {
        let source = unique_directory("permissions-source");
        let target = unique_directory("permissions-target");
        fs::create_dir_all(&source).unwrap();
        fs::write(source.join("cli-config.json"), r#"{"theme":"light"}"#).unwrap();
        fs::write(source.join("permissions.json"), r#"{"allow":["Read"]}"#).unwrap();

        write_max_mode_config(&source, &target).unwrap();

        assert_eq!(
            fs::read(target.join("permissions.json")).unwrap(),
            br#"{"allow":["Read"]}"#
        );

        fs::remove_dir_all(source).unwrap();
        fs::remove_dir_all(target).unwrap();
    }

    #[test]
    fn missing_source_config_returns_an_error() {
        let source = unique_directory("missing-source");
        let target = unique_directory("missing-target");
        fs::create_dir_all(&source).unwrap();

        assert!(write_max_mode_config(&source, &target).is_err());
        assert!(!target.exists());

        fs::remove_dir_all(source).unwrap();
    }
}
