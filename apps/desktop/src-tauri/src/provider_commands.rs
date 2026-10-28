use std::collections::HashMap;

const NPM_CODEX: &str = "npm install -g @openai/codex";
const NPM_OPENCODE: &str = "npm install -g opencode-ai";
const NPM_OPENCODE_LATEST: &str = "npm install -g opencode-ai@latest";
const NPM_COPILOT: &str = "npm install -g @github/copilot";
const CURL_GEMINI: &str = "curl -fsSL https://antigravity.google/cli/install.sh | bash";

const ALLOWED_ENV: &[&str] = &["NO_OPEN_BROWSER"];

struct Row {
    provider: &'static str,
    action: &'static str,
    darwin: &'static str,
    linux: &'static str,
    win32: &'static str,
}

const fn same(provider: &'static str, action: &'static str, command: &'static str) -> Row {
    Row {
        provider,
        action,
        darwin: command,
        linux: command,
        win32: command,
    }
}

const OPENCODE_FAMILY: [&str; 3] = ["opencode", "openrouter", "moonshot"];

const ROWS: &[Row] = &[
    same(
        "anthropic",
        "install",
        "npm install -g @anthropic-ai/claude-code",
    ),
    same("anthropic", "update", "claude update"),
    same("anthropic", "login", "claude auth login --claudeai"),
    same("anthropic", "logout", "claude auth logout"),
    Row {
        provider: "cursor",
        action: "install",
        darwin: "curl https://cursor.com/install -fsS | bash",
        linux: "curl https://cursor.com/install -fsS | bash",
        win32: "powershell -Command \"irm https://cursor.com/install.ps1 | iex\"",
    },
    same("cursor", "login", "cursor-agent login"),
    same("cursor", "logout", "cursor-agent logout"),
    same("codex", "install", NPM_CODEX),
    same("codex", "update", "npm install -g @openai/codex@latest"),
    same("codex", "login", "codex login"),
    same("codex", "logout", "codex logout"),
    same("copilot", "install", NPM_COPILOT),
    same("copilot", "update", "copilot update"),
    same("copilot", "login", "copilot login"),
    same("gemini", "install", CURL_GEMINI),
    same(
        "gemini",
        "logout",
        "rm -rf ~/.gemini/antigravity-cli && echo \"antigravity credentials removed\"",
    ),
];

const OPENCODE_ROWS: &[(&str, &str)] = &[
    ("install", NPM_OPENCODE),
    ("update", NPM_OPENCODE_LATEST),
    ("login", "opencode auth login"),
    ("logout", "opencode auth logout"),
];

#[derive(Debug, thiserror::Error)]
pub enum ProviderCommandError {
    #[error("no {action} command for provider: {provider}")]
    Unknown { provider: String, action: String },
    #[error("environment variable not allowed: {0}")]
    EnvNotAllowed(String),
}

crate::util::impl_error_serialize!(ProviderCommandError);

impl ProviderCommandError {
    fn kind(&self) -> &'static str {
        match self {
            ProviderCommandError::Unknown { .. } => "unknown_command",
            ProviderCommandError::EnvNotAllowed(_) => "env_not_allowed",
        }
    }
}

fn pick(row: &Row) -> &'static str {
    if cfg!(target_os = "macos") {
        return row.darwin;
    }
    if cfg!(target_os = "windows") {
        return row.win32;
    }
    row.linux
}

pub fn lifecycle_command(
    provider: &str,
    action: &str,
) -> Result<&'static str, ProviderCommandError> {
    let unknown = || ProviderCommandError::Unknown {
        provider: provider.to_string(),
        action: action.to_string(),
    };
    if OPENCODE_FAMILY.contains(&provider) {
        return OPENCODE_ROWS
            .iter()
            .find(|(name, _)| *name == action)
            .map(|(_, command)| *command)
            .ok_or_else(unknown);
    }
    ROWS.iter()
        .find(|row| row.provider == provider && row.action == action)
        .map(pick)
        .ok_or_else(unknown)
}

pub fn checked_env(
    env: Option<HashMap<String, String>>,
) -> Result<HashMap<String, String>, ProviderCommandError> {
    let env = env.unwrap_or_default();
    if let Some(key) = env.keys().find(|key| !ALLOWED_ENV.contains(&key.as_str())) {
        return Err(ProviderCommandError::EnvNotAllowed(key.clone()));
    }
    Ok(env)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_provider_is_refused() {
        assert!(lifecycle_command("evil", "login").is_err());
    }

    #[test]
    fn unknown_action_is_refused() {
        assert!(lifecycle_command("anthropic", "rm -rf ~").is_err());
        assert!(lifecycle_command("gemini", "login").is_err());
        assert!(lifecycle_command("cursor", "update").is_err());
    }

    #[test]
    fn every_listed_row_resolves() {
        for row in ROWS {
            assert!(lifecycle_command(row.provider, row.action).is_ok());
        }
        for provider in OPENCODE_FAMILY {
            for (action, _) in OPENCODE_ROWS {
                assert!(lifecycle_command(provider, action).is_ok());
            }
        }
    }

    #[test]
    fn copilot_installs_from_npm_signs_in_through_its_own_login_and_has_no_logout() {
        assert_eq!(
            lifecycle_command("copilot", "install").unwrap(),
            "npm install -g @github/copilot"
        );
        assert_eq!(
            lifecycle_command("copilot", "update").unwrap(),
            "copilot update"
        );
        assert_eq!(
            lifecycle_command("copilot", "login").unwrap(),
            "copilot login"
        );
        assert!(lifecycle_command("copilot", "logout").is_err());
    }

    #[test]
    fn opencode_family_shares_one_command() {
        assert_eq!(
            lifecycle_command("moonshot", "login").unwrap(),
            lifecycle_command("opencode", "login").unwrap()
        );
    }

    #[test]
    fn env_outside_the_list_is_refused() {
        let env = HashMap::from([("LD_PRELOAD".to_string(), "/tmp/x.so".to_string())]);
        assert!(checked_env(Some(env)).is_err());
        let env = HashMap::from([("PATH".to_string(), "/tmp".to_string())]);
        assert!(checked_env(Some(env)).is_err());
    }

    #[test]
    fn listed_env_and_none_pass() {
        let env = HashMap::from([("NO_OPEN_BROWSER".to_string(), "1".to_string())]);
        assert_eq!(checked_env(Some(env)).unwrap().len(), 1);
        assert!(checked_env(None).unwrap().is_empty());
    }
}
