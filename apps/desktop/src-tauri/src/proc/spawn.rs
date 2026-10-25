use std::io;
use std::process::{Child, ChildStderr, ChildStdout, Command, Stdio};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum StdinMode {
    Null,
    Piped,
}

impl StdinMode {
    pub(crate) fn for_prompt(prompt: Option<&str>) -> Self {
        match prompt {
            Some(_) => StdinMode::Piped,
            None => StdinMode::Null,
        }
    }

    fn stdio(self) -> Stdio {
        match self {
            StdinMode::Null => Stdio::null(),
            StdinMode::Piped => Stdio::piped(),
        }
    }
}

pub(crate) struct Pipes {
    pub child: Child,
    pub stdout: ChildStdout,
    pub stderr: ChildStderr,
}

pub(crate) fn spawn_command(command: &mut Command, stdin: StdinMode) -> io::Result<Child> {
    command
        .stdin(stdin.stdio())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
}

pub(crate) fn take_pipes(mut child: Child) -> io::Result<Pipes> {
    let (Some(stdout), Some(stderr)) = (child.stdout.take(), child.stderr.take()) else {
        crate::logging::note_kill_failure("spawned child without pipes", child.kill());
        let _ = child.wait();
        return Err(io::Error::other("no stdout or stderr"));
    };
    Ok(Pipes {
        child,
        stdout,
        stderr,
    })
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    const REPORT_FD_ZERO: &str = r#"my @in = stat(STDIN); my @null = stat("/dev/null"); print(($in[1] == $null[1] && $in[6] == $null[6]) ? "null" : "other");"#;

    #[test]
    fn a_null_stdin_is_dev_null_even_when_the_command_asked_for_a_pipe() {
        let mut command = Command::new("/usr/bin/perl");
        command.args(["-e", REPORT_FD_ZERO]).stdin(Stdio::piped());
        let child = spawn_command(&mut command, StdinMode::Null).expect("spawn perl");
        let mut pipes = take_pipes(child).expect("pipes");
        let mut out = String::new();
        io::Read::read_to_string(&mut pipes.stdout, &mut out).expect("read the report");
        pipes.child.wait().expect("wait");

        assert_eq!(out, "null");
    }

    #[test]
    fn a_piped_stdin_reaches_the_child() {
        let mut command = Command::new("/bin/cat");
        let mut child = spawn_command(&mut command, StdinMode::Piped).expect("spawn cat");
        let mut stdin = child.stdin.take().expect("stdin");
        io::Write::write_all(&mut stdin, b"hello").expect("write");
        drop(stdin);
        let mut pipes = take_pipes(child).expect("pipes");
        let mut out = String::new();
        io::Read::read_to_string(&mut pipes.stdout, &mut out).expect("read");
        pipes.child.wait().expect("wait");

        assert_eq!(out, "hello");
    }

    #[test]
    fn a_prompt_picks_the_stdin_mode() {
        assert_eq!(StdinMode::for_prompt(Some("plan")), StdinMode::Piped);
        assert_eq!(StdinMode::for_prompt(None), StdinMode::Null);
    }

    #[test]
    fn a_child_without_pipes_is_killed_before_the_error_returns() {
        let child = Command::new("sleep")
            .arg("30")
            .spawn()
            .expect("spawn sleep");
        let pid = child.id();

        assert!(take_pipes(child).is_err());

        assert!(crate::proc::reap::unix::test_support::is_gone(pid));
    }
}
