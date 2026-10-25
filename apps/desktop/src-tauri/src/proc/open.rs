use std::io;
use std::path::Path;
use std::process::Command;

use crate::util::open_guard::{refuse_executable, ExecutableRefused};

#[derive(Debug, thiserror::Error)]
pub(crate) enum OpenError {
    #[error(transparent)]
    Refused(#[from] ExecutableRefused),
    #[error("io error: {0}")]
    Io(#[from] io::Error),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Intent {
    Open,
    Reveal,
}

#[cfg(target_os = "macos")]
fn command_for(target: &Path, intent: Intent) -> Command {
    let mut command = Command::new("open");
    if intent == Intent::Reveal {
        command.arg("-R");
    }
    command.arg(target);
    command
}

#[cfg(target_os = "linux")]
fn command_for(target: &Path, intent: Intent) -> Command {
    let mut command = Command::new("xdg-open");
    match intent {
        Intent::Reveal => command.arg(target.parent().unwrap_or(target)),
        Intent::Open => command.arg(target),
    };
    command
}

#[cfg(target_os = "windows")]
fn command_for(target: &Path, intent: Intent) -> Command {
    match intent {
        Intent::Reveal => {
            let mut command = Command::new("explorer.exe");
            command.arg(format!("/select,{}", target.to_string_lossy()));
            command
        }
        Intent::Open => {
            let mut command = Command::new("rundll32.exe");
            command.arg("url.dll,FileProtocolHandler").arg(target);
            command
        }
    }
}

fn launch(mut command: Command) -> io::Result<()> {
    command.spawn().map(crate::proc::detach::detach)
}

pub(crate) fn open_target(target: &str) -> io::Result<()> {
    launch(command_for(Path::new(target), Intent::Open))
}

pub(crate) fn open_path(path: &Path) -> Result<(), OpenError> {
    refuse_executable(path)?;
    launch(command_for(path, Intent::Open))?;
    Ok(())
}

pub(crate) fn reveal(path: &Path) -> io::Result<()> {
    launch(command_for(path, Intent::Reveal))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;

    fn args_of(command: &Command) -> Vec<OsString> {
        command.get_args().map(|arg| arg.to_os_string()).collect()
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn mac_opens_with_open_and_reveals_with_dash_r() {
        let open = command_for(Path::new("/mock/harborline/report.pdf"), Intent::Open);
        assert_eq!(open.get_program(), "open");
        assert_eq!(
            args_of(&open),
            vec![OsString::from("/mock/harborline/report.pdf")]
        );

        let reveal = command_for(Path::new("/mock/harborline/report.pdf"), Intent::Reveal);
        assert_eq!(
            args_of(&reveal),
            vec![
                OsString::from("-R"),
                OsString::from("/mock/harborline/report.pdf")
            ]
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_opens_with_xdg_open_and_reveals_the_parent_folder() {
        let open = command_for(Path::new("/mock/harborline/report.pdf"), Intent::Open);
        assert_eq!(open.get_program(), "xdg-open");
        assert_eq!(
            args_of(&open),
            vec![OsString::from("/mock/harborline/report.pdf")]
        );

        let reveal = command_for(Path::new("/mock/harborline/report.pdf"), Intent::Reveal);
        assert_eq!(args_of(&reveal), vec![OsString::from("/mock/harborline")]);
    }

    #[test]
    fn a_url_reaches_the_opener_unchanged() {
        let command = command_for(
            Path::new("https://harborline.example/docs?a=1&b=2"),
            Intent::Open,
        );
        assert!(args_of(&command)
            .iter()
            .any(|arg| arg == "https://harborline.example/docs?a=1&b=2"));
    }

    #[test]
    fn an_executable_is_refused_before_anything_starts() {
        let result = open_path(Path::new("/mock/harborline/Northwind.app"));
        assert!(matches!(result, Err(OpenError::Refused(_))));
        let script = open_path(Path::new("/mock/harborline/deploy.sh"));
        assert!(matches!(script, Err(OpenError::Refused(_))));
    }
}
