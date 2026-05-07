use std::path::Path;
use std::process::Command;

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct GitRepoCheck {
    #[serde(rename = "isRepo")]
    pub is_repo: bool,
    #[serde(rename = "rootPath")]
    pub root_path: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn validate_git_repo(path: String) -> GitRepoCheck {
    let candidate = Path::new(&path);
    if !candidate.exists() {
        return GitRepoCheck {
            is_repo: false,
            root_path: None,
            error: Some(format!("path does not exist: {path}")),
        };
    }
    let output = match Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(candidate)
        .output()
    {
        Ok(out) => out,
        Err(err) => {
            return GitRepoCheck {
                is_repo: false,
                root_path: None,
                error: Some(err.to_string()),
            };
        }
    };
    if !output.status.success() {
        return GitRepoCheck {
            is_repo: false,
            root_path: None,
            error: Some("not a git repository".to_string()),
        };
    }
    let root = String::from_utf8(output.stdout)
        .unwrap_or_default()
        .trim()
        .to_string();
    GitRepoCheck {
        is_repo: true,
        root_path: Some(root),
        error: None,
    }
}
