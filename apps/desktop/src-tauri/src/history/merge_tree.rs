use super::commits::Author;
use super::plan::plan_error;
use super::runner::git_run;
use crate::proc::git::Git;
use crate::worktree::{git, WorktreeError};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout};

pub(super) const PREDICT_REF: &str = "refs/goodboy/predict";

pub(super) enum MergeResult {
    Tree(String),
    Conflict(Vec<String>),
}

pub(super) fn merge_in_memory(
    cwd: &Path,
    merge_base: &str,
    ours: &str,
    theirs: &str,
) -> Result<MergeResult, WorktreeError> {
    let base_arg = format!("--merge-base={merge_base}");
    let run = git_run(
        cwd,
        &[
            "merge-tree",
            "--write-tree",
            "--name-only",
            "--no-messages",
            &base_arg,
            ours,
            theirs,
        ],
        None,
        None,
    )?;
    let mut lines = run.stdout.lines().map(str::trim);
    let tree = lines.next().unwrap_or_default().to_string();
    match run.status {
        0 => Ok(MergeResult::Tree(tree)),
        1 => Ok(MergeResult::Conflict(
            lines
                .take_while(|line| !line.is_empty())
                .map(str::to_string)
                .collect(),
        )),
        _ => Err(plan_error(&format!(
            "git merge-tree failed: {}",
            run.stderr.trim()
        ))),
    }
}

pub(super) fn commit_tree(
    cwd: &Path,
    tree: &str,
    parent: &str,
    message: &str,
    author: &Author,
) -> Result<String, WorktreeError> {
    let run = git_run(
        cwd,
        &["commit-tree", tree, "-p", parent, "-F", "-"],
        Some(author),
        Some(message),
    )?;
    if run.status != 0 {
        return Err(plan_error(&format!(
            "git commit-tree failed: {}",
            run.stderr.trim()
        )));
    }
    Ok(run.stdout.trim().to_string())
}

pub(super) struct MergeStream {
    pub(super) child: Child,
    pub(super) input: ChildStdin,
    pub(super) output: BufReader<ChildStdout>,
}

impl MergeStream {
    pub(super) fn start(cwd: &Path) -> Result<Self, WorktreeError> {
        let mut child = Git::new()
            .args([
                "merge-tree",
                "--stdin",
                "--name-only",
                "--no-messages",
                "-z",
            ])
            .cwd(cwd)
            .spawn_streaming()?;
        let input = child.stdin.take();
        let output = child.stdout.take();
        let (Some(input), Some(output)) = (input, output) else {
            let _ = child.kill();
            let _ = child.wait();
            return Err(plan_error("git merge-tree did not open its pipes"));
        };
        Ok(Self {
            child,
            input,
            output: BufReader::new(output),
        })
    }

    pub(super) fn token(&mut self) -> Result<String, WorktreeError> {
        let mut raw = Vec::new();
        self.output.read_until(0, &mut raw)?;
        if raw.pop() != Some(0) {
            return Err(plan_error("git merge-tree stopped answering"));
        }
        Ok(String::from_utf8_lossy(&raw).into_owned())
    }

    pub(super) fn merge(
        &mut self,
        merge_base: &str,
        ours: &str,
        theirs: &str,
    ) -> Result<MergeResult, WorktreeError> {
        writeln!(self.input, "{merge_base} -- {ours} {theirs}")?;
        self.input.flush()?;
        let status = self.token()?;
        let tree = self.token()?;
        let mut files = Vec::new();
        loop {
            let file = self.token()?;
            if file.is_empty() {
                break;
            }
            files.push(file);
        }
        match status.as_str() {
            "1" => Ok(MergeResult::Tree(tree)),
            "0" => Ok(MergeResult::Conflict(files)),
            _ => Err(plan_error("git merge-tree answered with an unknown status")),
        }
    }
}

impl Drop for MergeStream {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub(super) struct PendingCommit {
    pub(super) tree: String,
    pub(super) parent: String,
    pub(super) message: String,
    pub(super) author: Author,
}

pub(super) enum Replayer {
    Batched {
        merges: MergeStream,
        commits: Vec<PendingCommit>,
    },
    Direct,
}

impl Replayer {
    pub(super) fn start(cwd: &Path, batched: bool) -> Result<Self, WorktreeError> {
        if !batched {
            return Ok(Self::Direct);
        }
        Ok(Self::Batched {
            merges: MergeStream::start(cwd)?,
            commits: Vec::new(),
        })
    }

    pub(super) fn merge(
        &mut self,
        cwd: &Path,
        merge_base: &str,
        tip: &str,
        tip_tree: &str,
        theirs: &str,
    ) -> Result<MergeResult, WorktreeError> {
        match self {
            Self::Batched { merges, .. } => merges.merge(merge_base, tip_tree, theirs),
            Self::Direct => merge_in_memory(cwd, merge_base, tip, theirs),
        }
    }

    pub(super) fn commit(
        &mut self,
        cwd: &Path,
        tree: &str,
        parent: &str,
        message: &str,
        author: &Author,
    ) -> Result<String, WorktreeError> {
        match self {
            Self::Batched { commits, .. } => {
                commits.push(PendingCommit {
                    tree: tree.to_string(),
                    parent: parent.to_string(),
                    message: message.to_string(),
                    author: author.clone(),
                });
                Ok(format!(":{}", commits.len()))
            }
            Self::Direct => commit_tree(cwd, tree, parent, message, author),
        }
    }

    pub(super) fn finish(self, cwd: &Path) -> Result<HashMap<String, String>, WorktreeError> {
        match self {
            Self::Batched { merges, commits } => {
                drop(merges);
                write_commits(cwd, &commits)
            }
            Self::Direct => Ok(HashMap::new()),
        }
    }
}

fn import_script(commits: &[PendingCommit], committer: &str) -> String {
    let mut script = String::new();
    for (index, pending) in commits.iter().enumerate() {
        script.push_str(&format!(
            "commit {PREDICT_REF}\nmark :{}\nauthor {} <{}> {}\ncommitter {committer}\ndata {}\n{}\nfrom {}\nM 040000 {} \"\"\n\n",
            index + 1,
            pending.author.name,
            pending.author.email,
            pending.author.date,
            pending.message.len(),
            pending.message,
            pending.parent,
            pending.tree,
        ));
    }
    for index in 1..=commits.len() {
        script.push_str(&format!("get-mark :{index}\n"));
    }
    script.push_str(&format!("reset {PREDICT_REF}\n\ndone\n"));
    script
}

fn write_commits(
    cwd: &Path,
    commits: &[PendingCommit],
) -> Result<HashMap<String, String>, WorktreeError> {
    if commits.is_empty() {
        return Ok(HashMap::new());
    }
    let committer = git(cwd, &["var", "GIT_COMMITTER_IDENT"])?
        .trim()
        .to_string();
    let script = import_script(commits, &committer);
    let output = Git::new()
        .args(["fast-import", "--quiet", "--done", "--cat-blob-fd=1"])
        .cwd(cwd)
        .input(script)
        .output()?;
    if !output.success() {
        return Err(plan_error(&format!(
            "git fast-import failed: {}",
            output.stderr_redacted().trim()
        )));
    }
    if let Some(error) = output.input_error {
        return Err(error.into());
    }
    let shas: Vec<String> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect();
    if shas.len() != commits.len() {
        return Err(plan_error(
            "git fast-import returned the wrong number of commits",
        ));
    }
    Ok(shas
        .into_iter()
        .enumerate()
        .map(|(index, sha)| (format!(":{}", index + 1), sha))
        .collect())
}
