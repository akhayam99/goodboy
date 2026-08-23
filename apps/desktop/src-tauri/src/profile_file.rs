use serde::Deserialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProfileFileError {
    #[error("home directory is unavailable")]
    HomeUnavailable,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

crate::util::impl_error_serialize!(ProfileFileError);

impl ProfileFileError {
    fn kind(&self) -> &'static str {
        match self {
            ProfileFileError::HomeUnavailable => "home_unavailable",
            ProfileFileError::Io(_) => "io",
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ProfileProjectArgs {
    #[serde(rename = "workspaceSlug")]
    pub workspace_slug: String,
    pub bio: Option<String>,
}

fn render_profile(args: &ProfileProjectArgs) -> String {
    let bio = args
        .bio
        .as_deref()
        .map(str::trim)
        .filter(|text| !text.is_empty());
    match bio {
        Some(text) => format!("{text}\n"),
        None => String::new(),
    }
}

#[tauri::command]
pub fn workspace_profile_project(args: ProfileProjectArgs) -> Result<String, ProfileFileError> {
    let home = dirs::home_dir().ok_or(ProfileFileError::HomeUnavailable)?;
    let slug = crate::worktree::sanitize_slug(&args.workspace_slug);
    let dir = home.join(".goodboy").join("workspaces").join(slug);
    std::fs::create_dir_all(&dir)?;
    let path = dir.join("PROFILE.md");
    std::fs::write(&path, render_profile(&args))?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_the_bio_as_plain_text() {
        let rendered = render_profile(&ProfileProjectArgs {
            workspace_slug: "demo-team".into(),
            bio: Some("  I lead design for the checkout team.  ".into()),
        });
        assert_eq!(rendered, "I lead design for the checkout team.\n");
    }

    #[test]
    fn renders_nothing_when_the_bio_is_empty() {
        let rendered = render_profile(&ProfileProjectArgs {
            workspace_slug: "demo-team".into(),
            bio: Some("   ".into()),
        });
        assert_eq!(rendered, "");
        let missing = render_profile(&ProfileProjectArgs {
            workspace_slug: "demo-team".into(),
            bio: None,
        });
        assert_eq!(missing, "");
    }
}
