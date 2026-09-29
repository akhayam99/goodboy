use std::ffi::{OsStr, OsString};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::mpsc;
use std::time::Duration;

const NON_INTERACTIVE_EDITOR: &str = "true";
const BATCH_SSH_COMMAND: &str = "ssh -oBatchMode=yes";
const INHERITED_REPO_ENV: [&str; 3] = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"];
const NETWORK_VERBS: [&str; 5] = ["fetch", "push", "pull", "ls-remote", "clone"];
const KILL_GRACE: Duration = Duration::from_secs(1);

pub(crate) const LOCAL_TIMEOUT: Duration = Duration::from_secs(1800);
pub(crate) const NETWORK_TIMEOUT: Duration = Duration::from_secs(1800);

#[derive(Debug, thiserror::Error)]
pub(crate) enum GitError {
    #[error("{0}")]
    Spawn(#[from] std::io::Error),
    #[error("git {args} timed out after {secs}s")]
    Timeout { args: String, secs: u64 },
    #[error("{message}")]
    Failed { message: String },
    #[error("invalid utf-8 in git output")]
    InvalidUtf8,
}

impl GitError {
    fn kind(&self) -> &'static str {
        match self {
            GitError::Spawn(_) => "spawn",
            GitError::Timeout { .. } => "timeout",
            GitError::Failed { .. } => "failed",
            GitError::InvalidUtf8 => "invalid_utf8",
        }
    }
}

crate::util::impl_error_serialize!(GitError);

impl From<GitError> for std::io::Error {
    fn from(error: GitError) -> Self {
        match error {
            GitError::Spawn(inner) => inner,
            GitError::Timeout { .. } => std::io::Error::new(std::io::ErrorKind::TimedOut, error),
            other => std::io::Error::other(other),
        }
    }
}

#[derive(Debug)]
pub(crate) struct GitOutput {
    pub(crate) status: ExitStatus,
    pub(crate) stdout: Vec<u8>,
    pub(crate) stderr: Vec<u8>,
    pub(crate) input_error: Option<std::io::Error>,
}

impl GitOutput {
    pub(crate) fn success(&self) -> bool {
        self.status.success()
    }

    pub(crate) fn stdout_lossy(&self) -> String {
        String::from_utf8_lossy(&self.stdout).into_owned()
    }

    pub(crate) fn stderr_redacted(&self) -> String {
        crate::worktree::redact_credentials(&String::from_utf8_lossy(&self.stderr))
    }
}

pub(crate) struct Git {
    binary: OsString,
    args: Vec<OsString>,
    cwd: Option<PathBuf>,
    envs: Vec<(OsString, OsString)>,
    removed: Vec<OsString>,
    login_env: bool,
    batch_auth: bool,
    push_block: bool,
    timeout: Option<Duration>,
    input: Option<Vec<u8>>,
}

impl Git {
    pub(crate) fn new() -> Self {
        Self::with_binary("git")
    }

    pub(crate) fn with_binary(binary: impl AsRef<OsStr>) -> Self {
        Self {
            binary: binary.as_ref().to_os_string(),
            args: Vec::new(),
            cwd: None,
            envs: Vec::new(),
            removed: Vec::new(),
            login_env: false,
            batch_auth: false,
            push_block: false,
            timeout: None,
            input: None,
        }
    }

    pub(crate) fn arg(mut self, arg: impl AsRef<OsStr>) -> Self {
        self.args.push(arg.as_ref().to_os_string());
        self
    }

    pub(crate) fn args<I, S>(mut self, args: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        self.args
            .extend(args.into_iter().map(|arg| arg.as_ref().to_os_string()));
        self
    }

    pub(crate) fn cwd(mut self, cwd: impl AsRef<Path>) -> Self {
        self.cwd = Some(cwd.as_ref().to_path_buf());
        self
    }

    pub(crate) fn env(mut self, key: impl AsRef<OsStr>, value: impl AsRef<OsStr>) -> Self {
        self.envs
            .push((key.as_ref().to_os_string(), value.as_ref().to_os_string()));
        self
    }

    pub(crate) fn env_remove(mut self, key: impl AsRef<OsStr>) -> Self {
        self.removed.push(key.as_ref().to_os_string());
        self
    }

    pub(crate) fn login_env(mut self) -> Self {
        self.login_env = true;
        self
    }

    pub(crate) fn batch_auth(mut self) -> Self {
        self.batch_auth = true;
        self
    }

    #[cfg(test)]
    pub(crate) fn push_block(mut self) -> Self {
        self.push_block = true;
        self
    }

    #[cfg(test)]
    pub(crate) fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    pub(crate) fn input(mut self, input: impl Into<Vec<u8>>) -> Self {
        self.input = Some(input.into());
        self
    }

    fn label(&self) -> String {
        self.args
            .iter()
            .map(|arg| arg.to_string_lossy())
            .collect::<Vec<_>>()
            .join(" ")
    }

    fn verb(&self) -> Option<String> {
        let mut args = self.args.iter().map(|arg| arg.to_string_lossy());
        while let Some(arg) = args.next() {
            if arg == "-c" || arg == "-C" {
                args.next();
                continue;
            }
            if arg.starts_with('-') {
                continue;
            }
            return Some(arg.into_owned());
        }
        None
    }

    fn effective_timeout(&self) -> Duration {
        if let Some(timeout) = self.timeout {
            return timeout;
        }
        match self.verb() {
            Some(verb) if NETWORK_VERBS.contains(&verb.as_str()) => NETWORK_TIMEOUT,
            _ => LOCAL_TIMEOUT,
        }
    }

    fn build(&self) -> Command {
        let binary = self.binary.to_string_lossy();
        let mut command = if self.login_env {
            crate::path_env::command_with_login_env(&binary)
        } else {
            crate::path_env::command(&binary)
        };
        command
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("GIT_EDITOR", NON_INTERACTIVE_EDITOR)
            .env("GIT_SEQUENCE_EDITOR", NON_INTERACTIVE_EDITOR);
        if self.batch_auth {
            command
                .env("GIT_ASKPASS", "")
                .env("SSH_ASKPASS", "")
                .env("GIT_SSH_COMMAND", BATCH_SSH_COMMAND);
        }
        for (key, value) in &self.envs {
            command.env(key, value);
        }
        for key in self.removed.iter().map(OsString::as_os_str) {
            command.env_remove(key);
        }
        for key in INHERITED_REPO_ENV {
            command.env_remove(key);
        }
        if self.push_block {
            crate::turn::apply_push_block(&mut command);
        }
        command.args(&self.args);
        if let Some(cwd) = &self.cwd {
            command.current_dir(cwd);
        }
        command
    }

    pub(crate) fn output(self) -> Result<GitOutput, GitError> {
        let timeout = self.effective_timeout();
        let label = crate::worktree::redact_credentials(&self.label());
        let command = self.build();
        execute(command, self.input, timeout).ok_or_timeout(label, timeout)
    }

    pub(crate) fn stdout(self) -> Result<String, GitError> {
        let label = self.label();
        let output = self.output()?;
        if !output.success() {
            let message = format!("git {label} failed: {}", output.stderr_redacted());
            return Err(GitError::Failed {
                message: message.trim().to_string(),
            });
        }
        String::from_utf8(output.stdout).map_err(|_| GitError::InvalidUtf8)
    }

    pub(crate) fn spawn_streaming(self) -> std::io::Result<Child> {
        let mut command = self.build();
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        command.spawn()
    }
}

enum Executed {
    Done(Result<GitOutput, std::io::Error>),
    TimedOut,
}

impl Executed {
    fn ok_or_timeout(self, label: String, timeout: Duration) -> Result<GitOutput, GitError> {
        match self {
            Executed::Done(result) => result.map_err(GitError::Spawn),
            Executed::TimedOut => Err(GitError::Timeout {
                args: label,
                secs: timeout.as_secs(),
            }),
        }
    }
}

fn execute(mut command: Command, input: Option<Vec<u8>>, timeout: Duration) -> Executed {
    crate::process_group::isolate(&mut command);
    command
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => return Executed::Done(Err(error)),
    };
    let pid = child.id();
    let stdin = child.stdin.take();
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        let writer = match (stdin, input) {
            (Some(mut pipe), Some(bytes)) => {
                Some(std::thread::spawn(move || pipe.write_all(&bytes)))
            }
            _ => None,
        };
        let waited = child.wait_with_output();
        let input_error = writer
            .and_then(|handle| handle.join().ok())
            .and_then(Result::err);
        let _ = sender.send(waited.map(|output| GitOutput {
            status: output.status,
            stdout: output.stdout,
            stderr: output.stderr,
            input_error,
        }));
    });
    match receiver.recv_timeout(timeout) {
        Ok(result) => Executed::Done(result),
        Err(mpsc::RecvTimeoutError::Timeout) => {
            crate::process_group::terminate(pid);
            let _ = receiver.recv_timeout(KILL_GRACE);
            Executed::TimedOut
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => Executed::Done(Err(std::io::Error::other(
            "git wait thread stopped before reporting",
        ))),
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use crate::fake_cli::FakeCli;
    use crate::worktree::WorktreeError;
    use std::path::Path;
    use std::time::Instant;

    const SHORT: Duration = Duration::from_millis(300);
    const UNSET: &str = "__unset__";

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-proc-git-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        root.canonicalize().unwrap()
    }

    fn git_ok(cwd: &Path, args: &[&str]) -> String {
        Git::new()
            .cwd(cwd)
            .args(args)
            .stdout()
            .unwrap_or_else(|err| panic!("git {} failed: {err}", args.join(" ")))
            .trim()
            .to_string()
    }

    fn init_repo(name: &str) -> PathBuf {
        let root = temp_root(name);
        git_ok(&root, &["init", "-b", "main"]);
        git_ok(&root, &["config", "user.email", "avery@harborline.test"]);
        git_ok(&root, &["config", "user.name", "Avery"]);
        git_ok(&root, &["config", "commit.gpgsign", "false"]);
        root
    }

    fn recorded_env(fake: &FakeCli, key: &str) -> String {
        let env = fake.work_file("fake-git-env.txt").expect("env record");
        env.lines()
            .find_map(|line| line.strip_prefix(&format!("{key}=")))
            .unwrap_or_else(|| panic!("no {key} line"))
            .to_string()
    }

    fn inherited(key: &str) -> String {
        std::env::var(key).unwrap_or_else(|_| UNSET.to_string())
    }

    fn is_alive(pid: libc::pid_t) -> bool {
        unsafe { libc::kill(pid, 0) == 0 }
    }

    #[test]
    fn stdout_returns_what_a_real_repo_prints() {
        let root = init_repo("stdout");
        std::fs::write(root.join("ledger.txt"), "entry\n").unwrap();
        git_ok(&root, &["add", "ledger.txt"]);
        git_ok(&root, &["commit", "--no-verify", "-m", "first"]);

        assert_eq!(
            git_ok(&root, &["rev-parse", "--abbrev-ref", "HEAD"]),
            "main"
        );
        assert_eq!(git_ok(&root, &["log", "-1", "--format=%s"]), "first");
    }

    #[test]
    fn a_failing_command_names_its_arguments_and_the_stderr() {
        let root = init_repo("failing");

        let error = Git::new()
            .cwd(&root)
            .args(["checkout", "no-such-branch"])
            .stdout()
            .unwrap_err();

        let GitError::Failed { message } = error else {
            panic!("expected a failed command");
        };
        assert!(message.starts_with("git checkout no-such-branch failed: "));
        assert!(message.contains("no-such-branch"));
    }

    #[test]
    fn stderr_credentials_are_redacted_in_the_error() {
        let fake = FakeCli::stage("leak");

        let error = Git::with_binary(fake.binary("git"))
            .cwd(fake.work_dir())
            .args(["fetch", "origin"])
            .stdout()
            .unwrap_err();

        let GitError::Failed { message } = error else {
            panic!("expected a failed command");
        };
        assert!(message.starts_with("git fetch origin failed: "));
        assert!(message.contains("https://***@harborline.test/ledger-core.git"));
        assert!(!message.contains("s3cret"));
    }

    #[test]
    fn every_error_serializes_as_kind_and_message() {
        let failed = GitError::Failed {
            message: "git status failed: boom".to_string(),
        };
        let timeout = GitError::Timeout {
            args: "fetch origin".to_string(),
            secs: 300,
        };
        let spawn = GitError::Spawn(std::io::Error::other("no git"));

        assert_eq!(
            serde_json::to_value(&failed).unwrap(),
            serde_json::json!({"kind": "failed", "message": "git status failed: boom"})
        );
        assert_eq!(
            serde_json::to_value(&timeout).unwrap(),
            serde_json::json!({"kind": "timeout", "message": "git fetch origin timed out after 300s"})
        );
        assert_eq!(
            serde_json::to_value(&spawn).unwrap(),
            serde_json::json!({"kind": "spawn", "message": "no git"})
        );
        assert_eq!(
            serde_json::to_value(GitError::InvalidUtf8).unwrap(),
            serde_json::json!({"kind": "invalid_utf8", "message": "invalid utf-8 in git output"})
        );
    }

    #[test]
    fn worktree_errors_keep_their_wire_shape_for_each_git_error() {
        let failed = WorktreeError::from(GitError::Failed {
            message: "git status failed: boom".to_string(),
        });
        let timeout = WorktreeError::from(GitError::Timeout {
            args: "push origin".to_string(),
            secs: 300,
        });
        let spawn = WorktreeError::from(GitError::Spawn(std::io::Error::other("no git")));
        let utf8 = WorktreeError::from(GitError::InvalidUtf8);

        assert_eq!(
            serde_json::to_value(&failed).unwrap(),
            serde_json::json!({"kind": "git", "message": "git failed: git status failed: boom"})
        );
        assert_eq!(
            serde_json::to_value(&timeout).unwrap(),
            serde_json::json!({"kind": "git", "message": "git failed: git push origin timed out after 300s"})
        );
        assert_eq!(
            serde_json::to_value(&spawn).unwrap(),
            serde_json::json!({"kind": "io", "message": "io error: no git"})
        );
        assert_eq!(
            serde_json::to_value(&utf8).unwrap(),
            serde_json::json!({"kind": "invalid_utf8", "message": "invalid utf-8 in git output"})
        );
    }

    #[test]
    fn a_missing_binary_is_a_spawn_error() {
        let error = Git::with_binary("/nonexistent/goodboy/git")
            .arg("status")
            .stdout()
            .unwrap_err();

        assert!(matches!(error, GitError::Spawn(_)));
    }

    #[test]
    fn non_utf8_output_is_reported_not_lossily_returned() {
        let fake = FakeCli::stage("binary");

        let error = Git::with_binary(fake.binary("git"))
            .cwd(fake.work_dir())
            .arg("log")
            .stdout()
            .unwrap_err();

        assert!(matches!(error, GitError::InvalidUtf8));
    }

    #[test]
    fn an_inherited_git_dir_never_decides_which_repo_git_reads() {
        let here = init_repo("inherit-here");
        let elsewhere = init_repo("inherit-elsewhere");

        let toplevel = Git::new()
            .cwd(&here)
            .args(["rev-parse", "--show-toplevel"])
            .env("GIT_DIR", elsewhere.join(".git"))
            .env("GIT_WORK_TREE", &elsewhere)
            .stdout()
            .unwrap();

        assert_eq!(PathBuf::from(toplevel.trim()), here);
    }

    #[test]
    fn every_call_turns_prompts_off_and_removes_repo_env() {
        let fake = FakeCli::stage("env");

        Git::with_binary(fake.binary("git"))
            .cwd(fake.work_dir())
            .env("GIT_DIR", "/elsewhere/.git")
            .env("GIT_INDEX_FILE", "/elsewhere/index")
            .arg("status")
            .output()
            .unwrap();

        assert_eq!(recorded_env(&fake, "GIT_TERMINAL_PROMPT"), "0");
        assert_eq!(recorded_env(&fake, "GIT_EDITOR"), "true");
        assert_eq!(recorded_env(&fake, "GIT_SEQUENCE_EDITOR"), "true");
        assert_eq!(recorded_env(&fake, "GIT_DIR"), UNSET);
        assert_eq!(recorded_env(&fake, "GIT_WORK_TREE"), UNSET);
        assert_eq!(recorded_env(&fake, "GIT_INDEX_FILE"), UNSET);
        assert_eq!(recorded_env(&fake, "GIT_ASKPASS"), inherited("GIT_ASKPASS"));
        assert_eq!(
            recorded_env(&fake, "GIT_SSH_COMMAND"),
            inherited("GIT_SSH_COMMAND")
        );
    }

    #[test]
    fn batch_auth_blanks_askpass_and_forces_ssh_batch_mode() {
        let fake = FakeCli::stage("env");

        Git::with_binary(fake.binary("git"))
            .cwd(fake.work_dir())
            .batch_auth()
            .arg("fetch")
            .output()
            .unwrap();

        assert_eq!(recorded_env(&fake, "GIT_ASKPASS"), "");
        assert_eq!(recorded_env(&fake, "SSH_ASKPASS"), "");
        assert_eq!(
            recorded_env(&fake, "GIT_SSH_COMMAND"),
            "ssh -oBatchMode=yes"
        );
    }

    #[test]
    fn arguments_cwd_and_caller_env_reach_git_unchanged() {
        let fake = FakeCli::stage("env");

        Git::with_binary(fake.binary("git"))
            .cwd(fake.work_dir())
            .args(["-c", "core.pager=cat"])
            .arg("log")
            .env("GH_TOKEN", "ghp_fixture")
            .output()
            .unwrap();

        assert_eq!(
            fake.work_file("fake-git-argv.txt").unwrap(),
            "-c\ncore.pager=cat\nlog\n"
        );
        assert_eq!(recorded_env(&fake, "GH_TOKEN"), "ghp_fixture");
        let cwd = recorded_env(&fake, "cwd");
        assert_eq!(
            PathBuf::from(cwd).canonicalize().unwrap(),
            PathBuf::from(fake.work_dir()).canonicalize().unwrap()
        );
    }

    #[test]
    fn a_blocked_push_env_reaches_git() {
        let fake = FakeCli::stage("env");

        Git::with_binary(fake.binary("git"))
            .cwd(fake.work_dir())
            .push_block()
            .arg("push")
            .output()
            .unwrap();

        assert_eq!(
            recorded_env(&fake, "GIT_CONFIG_KEY_0"),
            "remote.origin.pushurl"
        );
        assert_eq!(
            recorded_env(&fake, "GIT_CONFIG_VALUE_0"),
            crate::turn::PUSH_BLOCK_URL
        );
    }

    #[test]
    fn input_reaches_git_on_stdin() {
        let root = init_repo("stdin");

        let sha = Git::new()
            .cwd(&root)
            .args(["hash-object", "--stdin"])
            .input("hello\n")
            .stdout()
            .unwrap();

        assert_eq!(sha.trim(), "ce013625030ba8dba906f756967f9e9ca394464a");
    }

    #[test]
    fn a_hung_git_is_killed_with_its_children_after_the_timeout() {
        let fake = FakeCli::stage("hang");
        let started = Instant::now();

        let error = Git::with_binary(fake.binary("git"))
            .cwd(fake.work_dir())
            .args(["fetch", "origin"])
            .timeout(SHORT)
            .output()
            .unwrap_err();

        assert!(matches!(error, GitError::Timeout { secs: 0, .. }));
        assert!(started.elapsed() < Duration::from_secs(5));
        let sleeper: libc::pid_t = fake
            .work_file("fake-git-sleeper.pid")
            .expect("sleeper pid")
            .trim()
            .parse()
            .unwrap();
        let mut alive = true;
        for _ in 0..60 {
            if !is_alive(sleeper) {
                alive = false;
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        assert!(!alive, "the grandchild of a timed-out git must not survive");
    }

    #[test]
    fn a_timeout_becomes_an_io_timed_out_error_for_io_callers() {
        let error = std::io::Error::from(GitError::Timeout {
            args: "ls-remote origin".to_string(),
            secs: 300,
        });

        assert_eq!(error.kind(), std::io::ErrorKind::TimedOut);
    }

    #[test]
    fn network_verbs_get_the_network_timeout_and_the_rest_the_local_one() {
        let timeout_of = |args: &[&str]| Git::new().args(args).effective_timeout();

        assert_eq!(timeout_of(&["fetch", "origin"]), NETWORK_TIMEOUT);
        assert_eq!(
            timeout_of(&["push", "-u", "origin", "main"]),
            NETWORK_TIMEOUT
        );
        assert_eq!(timeout_of(&["ls-remote", "--heads"]), NETWORK_TIMEOUT);
        assert_eq!(
            timeout_of(&["-c", "credential.helper=", "push", "origin"]),
            NETWORK_TIMEOUT
        );
        assert_eq!(
            timeout_of(&["-C", "/tmp/ledger-core", "fetch"]),
            NETWORK_TIMEOUT
        );
        assert_eq!(timeout_of(&["status", "--porcelain"]), LOCAL_TIMEOUT);
        assert_eq!(timeout_of(&["log", "--", "fetch"]), LOCAL_TIMEOUT);
        assert_eq!(timeout_of(&[]), LOCAL_TIMEOUT);
    }

    #[test]
    fn an_explicit_timeout_beats_the_verb_default() {
        let git = Git::new().args(["fetch"]).timeout(SHORT);

        assert_eq!(git.effective_timeout(), SHORT);
    }

    fn rust_files(dir: &Path, out: &mut Vec<PathBuf>) {
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

    #[test]
    fn only_proc_git_launches_git_in_production_code() {
        let src = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
        let mut files = Vec::new();
        rust_files(&src, &mut files);
        let mut offenders = Vec::new();
        for path in files {
            let name = path.file_name().unwrap().to_string_lossy().into_owned();
            let relative = path
                .strip_prefix(&src)
                .unwrap()
                .to_string_lossy()
                .into_owned();
            if relative == "proc/git.rs" || name.ends_with("tests.rs") || name == "fake_cli.rs" {
                continue;
            }
            let text = std::fs::read_to_string(&path).unwrap();
            for (line, content) in production_lines(&text) {
                let spawns_git = content.contains("command(\"git\")")
                    || content.contains("Command::new(\"git\")")
                    || content.contains("command_with_login_env(\"git\")");
                if spawns_git {
                    offenders.push(format!("{relative}:{line}"));
                }
            }
        }

        assert!(
            offenders.is_empty(),
            "launch git through proc::git::Git: {offenders:?}"
        );
    }
}
