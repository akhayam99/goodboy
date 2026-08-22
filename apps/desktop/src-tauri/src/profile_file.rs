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
    pub role: Option<String>,
    pub discipline: Option<String>,
    pub topics: Vec<String>,
    pub notes: Option<String>,
}

fn frontmatter_value(value: Option<&str>) -> String {
    match value {
        Some(text) if !text.trim().is_empty() => text.trim().to_string(),
        _ => "null".to_string(),
    }
}

fn render_profile(args: &ProfileProjectArgs) -> String {
    let topics = args
        .topics
        .iter()
        .map(|topic| format!("\"{}\"", topic.replace('"', "'")))
        .collect::<Vec<_>>()
        .join(", ");
    let notes = args
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .unwrap_or("");
    let mut out = format!(
        "---\nrole: {}\ndiscipline: {}\ntopics: [{}]\n---\n",
        frontmatter_value(args.role.as_deref()),
        frontmatter_value(args.discipline.as_deref()),
        topics,
    );
    if !notes.is_empty() {
        out.push('\n');
        out.push_str(notes);
        out.push('\n');
    }
    out
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
    fn renders_frontmatter_with_notes_body() {
        let rendered = render_profile(&ProfileProjectArgs {
            workspace_slug: "serenis".into(),
            role: Some("developer".into()),
            discipline: Some("frontend".into()),
            topics: vec!["design systems".into(), "a11y".into()],
            notes: Some("prefers short answers".into()),
        });
        assert_eq!(
            rendered,
            "---\nrole: developer\ndiscipline: frontend\ntopics: [\"design systems\", \"a11y\"]\n---\n\nprefers short answers\n"
        );
    }

    #[test]
    fn renders_null_fields_and_no_body_when_empty() {
        let rendered = render_profile(&ProfileProjectArgs {
            workspace_slug: "serenis".into(),
            role: None,
            discipline: Some("  ".into()),
            topics: vec![],
            notes: None,
        });
        assert_eq!(rendered, "---\nrole: null\ndiscipline: null\ntopics: []\n---\n");
    }
}
