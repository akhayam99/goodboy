use std::process::Stdio;

use serde::Serialize;
use thiserror::Error;

use crate::secrets;

const TOKEN_KEY: &str = "github.pat";

#[derive(Debug, Error)]
pub enum GithubError {
    #[error("gh binary not found in PATH")]
    NotFound,
    #[error("gh command failed: {0}")]
    Spawn(#[from] std::io::Error),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
    #[error("gh validation failed: {0}")]
    Validation(String),
}

impl Serialize for GithubError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GhStatus {
    pub available: bool,
    pub mode: String,
    pub version: Option<String>,
    pub user: Option<String>,
    pub scopes: Vec<String>,
    pub scoped: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GhRunResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

fn gh_available() -> bool {
    crate::path_env::command("gh")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn run_gh(
    args: &[&str],
    cwd: Option<&str>,
    token: Option<&str>,
) -> Result<GhRunResult, GithubError> {
    if !gh_available() {
        return Err(GithubError::NotFound);
    }
    let mut cmd = crate::path_env::command("gh");
    cmd.args(args);
    if let Some(dir) = cwd {
        if !dir.is_empty() {
            cmd.current_dir(dir);
        }
    }
    if let Some(t) = token {
        if !t.is_empty() {
            cmd.env("GH_TOKEN", t);
            cmd.env("GITHUB_TOKEN", t);
        }
    }
    let output = cmd.output()?;
    Ok(GhRunResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

fn run_git_push(args: &[&str], cwd: &str, token: Option<&str>) -> Result<GhRunResult, GithubError> {
    let mut cmd = crate::path_env::command("git");
    if gh_available() {
        cmd.args([
            "-c",
            "credential.https://github.com.helper=",
            "-c",
            "credential.https://github.com.helper=!gh auth git-credential",
        ]);
    }
    cmd.args(args);
    if !cwd.is_empty() {
        cmd.current_dir(cwd);
    }
    if let Some(t) = token {
        if !t.is_empty() {
            cmd.env("GH_TOKEN", t);
            cmd.env("GITHUB_TOKEN", t);
        }
    }
    let output = cmd.output()?;
    Ok(GhRunResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

fn parse_version(stdout: &str) -> Option<String> {
    stdout
        .lines()
        .find_map(|l| l.strip_prefix("gh version "))
        .and_then(|rest| rest.split_whitespace().next().map(|s| s.to_string()))
}

fn token_key(workspace_id: Option<&str>) -> String {
    match workspace_id {
        Some(id) if !id.is_empty() => format!("{TOKEN_KEY}.{id}"),
        _ => TOKEN_KEY.to_string(),
    }
}

fn read_token(workspace_id: Option<&str>) -> Option<String> {
    if let Some(id) = workspace_id.filter(|s| !s.is_empty()) {
        if let Ok(Some(tok)) = secrets::read(&token_key(Some(id))) {
            return Some(tok);
        }
    }
    secrets::read(TOKEN_KEY).ok().flatten()
}

fn status_blocking(workspace_id: Option<String>) -> GhStatus {
    let ws = workspace_id.as_deref();
    if !gh_available() {
        return GhStatus {
            available: false,
            mode: "absent".to_string(),
            version: None,
            user: None,
            scopes: Vec::new(),
            scoped: false,
        };
    }
    let version = run_gh(&["--version"], None, None)
        .ok()
        .and_then(|r| parse_version(&r.stdout));

    let pat = read_token(ws);
    let token_ref = pat.as_deref();
    let scoped = ws
        .filter(|s| !s.is_empty())
        .map(|id| matches!(secrets::read(&token_key(Some(id))), Ok(Some(_))))
        .unwrap_or(false);

    let user = run_gh(&["api", "user", "-q", ".login"], None, token_ref)
        .ok()
        .filter(|r| r.exit_code == 0)
        .map(|r| r.stdout.trim().to_string())
        .filter(|s| !s.is_empty());

    let mode = match (&user, pat.is_some()) {
        (Some(_), true) => "pat",
        (Some(_), false) => "gh-cli",
        _ => "absent",
    };

    GhStatus {
        available: true,
        mode: mode.to_string(),
        version,
        user,
        scopes: Vec::new(),
        scoped,
    }
}

#[tauri::command]
pub async fn gh_status(workspace_id: Option<String>) -> GhStatus {
    tauri::async_runtime::spawn_blocking(move || status_blocking(workspace_id))
        .await
        .unwrap_or_else(|_| GhStatus {
            available: false,
            mode: "absent".to_string(),
            version: None,
            user: None,
            scopes: Vec::new(),
            scoped: false,
        })
}

#[tauri::command]
pub async fn gh_set_token(
    token: String,
    workspace_id: Option<String>,
) -> Result<GhStatus, GithubError> {
    tauri::async_runtime::spawn_blocking(move || {
        if token.trim().is_empty() {
            return Err(GithubError::Validation("token is empty".to_string()));
        }
        let res = run_gh(&["api", "user", "-q", ".login"], None, Some(&token))?;
        if res.exit_code != 0 {
            return Err(GithubError::Validation(if res.stderr.is_empty() {
                format!("gh exited with {}", res.exit_code)
            } else {
                res.stderr.trim().to_string()
            }));
        }
        secrets::set(&token_key(workspace_id.as_deref()), &token)?;
        Ok(status_blocking(workspace_id))
    })
    .await
    .map_err(|e| GithubError::Spawn(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub fn gh_clear_token(workspace_id: Option<String>) -> Result<(), GithubError> {
    secrets::clear(&token_key(workspace_id.as_deref()))?;
    Ok(())
}

#[tauri::command]
pub async fn gh_run(
    args: Vec<String>,
    cwd: Option<String>,
    workspace_id: Option<String>,
) -> Result<GhRunResult, GithubError> {
    tauri::async_runtime::spawn_blocking(move || {
        let token = read_token(workspace_id.as_deref());
        let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        run_gh(&arg_refs, cwd.as_deref(), token.as_deref())
    })
    .await
    .map_err(|e| GithubError::Spawn(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn git_push(
    cwd: String,
    branch: Option<String>,
    workspace_id: Option<String>,
) -> Result<GhRunResult, GithubError> {
    tauri::async_runtime::spawn_blocking(move || {
        let token = read_token(workspace_id.as_deref());
        let mut args: Vec<&str> = vec!["push"];
        if let Some(b) = branch.as_deref().filter(|b| !b.is_empty()) {
            args.push("origin");
            args.push(b);
        }
        run_git_push(&args, &cwd, token.as_deref())
    })
    .await
    .map_err(|e| GithubError::Spawn(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn gh_pr_diff(
    repo: String,
    pr: u32,
    cwd: Option<String>,
    workspace_id: Option<String>,
) -> Result<String, GithubError> {
    tauri::async_runtime::spawn_blocking(move || {
        let token = read_token(workspace_id.as_deref());
        let pr_str = pr.to_string();
        let res = run_gh(
            &["pr", "diff", &pr_str, "--repo", &repo],
            cwd.as_deref(),
            token.as_deref(),
        )?;
        if res.exit_code != 0 {
            return Err(GithubError::Validation(res.stderr.trim().to_string()));
        }
        Ok(res.stdout)
    })
    .await
    .map_err(|e| GithubError::Spawn(std::io::Error::other(e.to_string())))?
}
