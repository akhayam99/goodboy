use std::path::{Path, PathBuf};

use crate::proc::reap::StoppedProcess;

pub(crate) fn install_root(binary: &str) -> Option<PathBuf> {
    let found = PathBuf::from(crate::path_env::which(binary)?);
    let resolved = std::fs::canonicalize(&found).ok()?;
    let root = resolved.parent()?;
    let entry = found
        .parent()
        .and_then(|dir| std::fs::canonicalize(dir).ok());
    if entry.as_deref() == Some(root) {
        return None;
    }
    Some(root.to_path_buf())
}

pub(crate) fn without_provider_helpers(
    stopped: Vec<StoppedProcess>,
    root: Option<&Path>,
) -> Vec<StoppedProcess> {
    let Some(root) = root else {
        return stopped;
    };
    stopped
        .into_iter()
        .filter(|process| !Path::new(&process.path).starts_with(root))
        .collect()
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    fn stopped(name: &str, path: &str) -> StoppedProcess {
        StoppedProcess {
            pid: 7,
            name: name.to_string(),
            port: None,
            path: path.to_string(),
        }
    }

    fn fresh_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-provider-helpers-{label}-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("create the test folder");
        std::fs::canonicalize(&dir).expect("resolve the test folder")
    }

    #[test]
    fn a_symlinked_cli_names_the_folder_it_is_installed_in() {
        let dir = fresh_dir("linked");
        let versions = dir.join("share").join("acme-agent").join("1.0");
        let bin = dir.join("bin");
        std::fs::create_dir_all(&versions).expect("create the install folder");
        std::fs::create_dir_all(&bin).expect("create the bin folder");
        std::fs::write(versions.join("acme-agent"), "").expect("write the cli");
        std::os::unix::fs::symlink(versions.join("acme-agent"), bin.join("acme-agent"))
            .expect("link the cli");

        let root = install_root(&bin.join("acme-agent").to_string_lossy());

        assert_eq!(root, Some(versions));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_cli_that_is_no_link_names_no_folder() {
        let dir = fresh_dir("plain");
        std::fs::write(dir.join("acme-agent"), "").expect("write the cli");

        assert_eq!(
            install_root(&dir.join("acme-agent").to_string_lossy()),
            None
        );
        assert_eq!(install_root("/nonexistent/acme-agent"), None);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_cli_own_helpers_are_left_out_and_what_the_agent_started_stays() {
        let root = Path::new("/opt/acme/share/acme-agent/1.0");
        let left = without_provider_helpers(
            vec![
                stopped("node", "/opt/acme/share/acme-agent/1.0/node"),
                stopped("rg", "/opt/acme/share/acme-agent/1.0/bin/rg"),
                stopped("node", "/opt/acme/bin/node"),
                stopped("next-server", "next-server"),
            ],
            Some(root),
        );

        let names: Vec<&str> = left.iter().map(|process| process.path.as_str()).collect();
        assert_eq!(names, vec!["/opt/acme/bin/node", "next-server"]);
    }

    #[test]
    fn without_a_folder_every_process_is_reported() {
        let all = vec![stopped("node", "/opt/acme/share/acme-agent/1.0/node")];

        assert_eq!(without_provider_helpers(all.clone(), None), all);
    }
}
