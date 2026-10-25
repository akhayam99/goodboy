use std::path::Path;

const EXECUTABLE_EXTENSIONS: &[&str] = &[
    "app",
    "action",
    "appimage",
    "applescript",
    "bash",
    "bat",
    "bin",
    "cmd",
    "com",
    "command",
    "cpl",
    "csh",
    "desktop",
    "dmg",
    "exe",
    "fileloc",
    "fish",
    "hta",
    "inetloc",
    "jar",
    "ksh",
    "lnk",
    "msi",
    "pif",
    "pkg",
    "ps1",
    "psm1",
    "reg",
    "run",
    "scpt",
    "scptd",
    "scr",
    "sh",
    "terminal",
    "tool",
    "vbe",
    "vbs",
    "webloc",
    "workflow",
    "wsf",
    "wsh",
    "zsh",
];

#[derive(Debug, thiserror::Error)]
#[error("executable files are not opened; reveal the file instead")]
pub(crate) struct ExecutableRefused;

fn has_executable_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .is_some_and(|extension| EXECUTABLE_EXTENSIONS.contains(&extension.as_str()))
}

#[cfg(unix)]
fn has_execute_bit(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;

    std::fs::metadata(path)
        .map(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(not(unix))]
fn has_execute_bit(_path: &Path) -> bool {
    false
}

pub(crate) fn refuse_executable(path: &Path) -> Result<(), ExecutableRefused> {
    if has_executable_extension(path) || has_execute_bit(path) {
        return Err(ExecutableRefused);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-open-guard-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn every_listed_extension_is_refused_in_any_case() {
        for extension in EXECUTABLE_EXTENSIONS {
            let lower = Path::new("/tmp/Report").with_extension(extension);
            let upper = Path::new("/tmp/Report").with_extension(extension.to_ascii_uppercase());
            assert!(refuse_executable(&lower).is_err(), "{extension}");
            assert!(refuse_executable(&upper).is_err(), "{extension}");
        }
    }

    #[test]
    fn plain_documents_are_allowed() {
        for name in [
            "/tmp/Report.md",
            "/tmp/chart.png",
            "/tmp/index.html",
            "/tmp/notes",
        ] {
            assert!(refuse_executable(Path::new(name)).is_ok(), "{name}");
        }
    }

    #[test]
    fn a_folder_named_like_an_app_bundle_is_refused() {
        let dir = scratch("bundle");
        let bundle = dir.join("Northwind.app");
        std::fs::create_dir_all(&bundle).unwrap();
        assert!(refuse_executable(&bundle).is_err());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_file_with_the_execute_bit_is_refused_whatever_its_name() {
        use std::os::unix::fs::PermissionsExt;

        let dir = scratch("exec-bit");
        let file = dir.join("Report.txt");
        std::fs::write(&file, "echo acme").unwrap();
        assert!(refuse_executable(&file).is_ok());
        std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o755)).unwrap();
        assert!(refuse_executable(&file).is_err());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
