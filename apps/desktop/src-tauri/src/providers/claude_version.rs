use std::path::{Path, PathBuf};

use super::auth_reason::AuthReason;
use super::{AuthState, AuthStateKind};

pub(crate) const CLAUDE_AUTH_MIN_VERSION: &str = "2.1.41";

type Semver = (u64, u64, u64);

fn semver_of(word: &str) -> Option<Semver> {
    let mut parts = word.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    Some((major, minor, patch))
}

pub(crate) fn version_number(output: &str) -> Option<String> {
    output
        .split_whitespace()
        .map(|word| word.trim_start_matches('v'))
        .find(|word| semver_of(word).is_some())
        .map(str::to_string)
}

pub(crate) fn has_auth_subcommand(version: &str) -> bool {
    let (Some(found), Some(minimum)) = (semver_of(version), semver_of(CLAUDE_AUTH_MIN_VERSION))
    else {
        return false;
    };
    found >= minimum
}

pub(crate) fn too_old_reason(version: Option<String>) -> AuthReason {
    AuthReason::CliTooOld {
        version,
        minimum: CLAUDE_AUTH_MIN_VERSION.to_string(),
    }
}

const AUTH_ACTIONS: [&str; 2] = ["login", "logout"];

fn auth_action_refusal(action: &str, version: Option<&str>) -> Option<String> {
    if !AUTH_ACTIONS.contains(&action) {
        return None;
    }
    let Some(version) = version else {
        return Some(format!(
            "The Claude Code version is unreadable, so Goodboy did not start the {action}. Update Claude Code to {CLAUDE_AUTH_MIN_VERSION} or later, then try again."
        ));
    };
    if has_auth_subcommand(version) {
        return None;
    }
    Some(format!(
        "Claude Code {version} has no {action} command Goodboy can call. Update Claude Code to {CLAUDE_AUTH_MIN_VERSION} or later, then try again."
    ))
}

pub(crate) fn lifecycle_refusal(provider: &str, action: &str) -> Option<String> {
    if provider != "anthropic" || !AUTH_ACTIONS.contains(&action) {
        return None;
    }
    let version = super::cli_probe::version_cached("claude").and_then(|line| version_number(&line));
    auth_action_refusal(action, version.as_deref())
}

pub(crate) fn config_file() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os("CLAUDE_CONFIG_DIR") {
        if !dir.is_empty() {
            return Some(PathBuf::from(dir).join(".claude.json"));
        }
    }
    Some(dirs::home_dir()?.join(".claude.json"))
}

fn account_in(config: &Path) -> Option<String> {
    let content = std::fs::read_to_string(config).ok()?;
    let root: serde_json::Value = serde_json::from_str(&content).ok()?;
    root.get("oauthAccount")?
        .get("emailAddress")?
        .as_str()
        .map(str::trim)
        .filter(|email| !email.is_empty())
        .map(str::to_string)
}

pub(crate) fn local_auth(version: Option<String>, config: Option<&Path>) -> AuthState {
    let reason = too_old_reason(version);
    let Some(identity) = config.and_then(account_in) else {
        return AuthState::unknown(reason);
    };
    AuthState {
        state: AuthStateKind::Connected,
        identity: Some(identity),
        plan: None,
        verified: false,
        reason: Some(reason),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_version_is_read_from_what_the_cli_prints() {
        assert_eq!(
            version_number("2.1.37 (Claude Code)\n").as_deref(),
            Some("2.1.37")
        );
        assert_eq!(version_number("v2.1.90").as_deref(), Some("2.1.90"));
        assert_eq!(version_number("Claude Code"), None);
        assert_eq!(version_number(""), None);
    }

    #[test]
    fn the_auth_subcommand_is_used_only_from_the_minimum_version() {
        let cases = [
            ("1.0.120", false),
            ("2.0.99", false),
            ("2.1.4", false),
            ("2.1.37", false),
            ("2.1.40", false),
            ("2.1.41", true),
            ("2.1.90", true),
            ("2.2.0", true),
            ("3.0.0", true),
            ("garbage", false),
        ];
        for (version, expected) in cases {
            assert_eq!(has_auth_subcommand(version), expected, "{version}");
        }
    }

    #[test]
    fn sign_in_and_sign_out_are_refused_on_an_old_or_unreadable_cli() {
        for action in AUTH_ACTIONS {
            let old = auth_action_refusal(action, Some("2.1.37")).expect("refused");
            assert!(old.contains("Claude Code 2.1.37"), "{old}");
            assert!(old.contains(CLAUDE_AUTH_MIN_VERSION), "{old}");
            assert!(auth_action_refusal(action, None).is_some());
            assert_eq!(auth_action_refusal(action, Some("2.1.41")), None);
        }
    }

    #[test]
    fn install_and_update_are_never_refused_for_the_version() {
        for action in ["install", "update"] {
            assert_eq!(auth_action_refusal(action, Some("2.1.37")), None);
            assert_eq!(auth_action_refusal(action, None), None);
            assert_eq!(lifecycle_refusal("anthropic", action), None);
        }
        assert_eq!(lifecycle_refusal("codex", "login"), None);
    }

    fn scratch(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-claude-config-{label}-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).expect("create the scratch dir");
        dir.join(".claude.json")
    }

    #[test]
    fn an_old_cli_with_an_account_in_its_config_is_connected_but_not_verified() {
        let config = scratch("account");
        std::fs::write(
            &config,
            r#"{"oauthAccount":{"emailAddress":"avery@harborline.test"},"numStartups":3}"#,
        )
        .expect("write the config");

        let auth = local_auth(Some("2.1.37".into()), Some(&config));

        assert_eq!(auth.state, AuthStateKind::Connected);
        assert_eq!(auth.identity.as_deref(), Some("avery@harborline.test"));
        assert!(!auth.verified);
        assert_eq!(
            auth.reason,
            Some(AuthReason::CliTooOld {
                version: Some("2.1.37".into()),
                minimum: CLAUDE_AUTH_MIN_VERSION.into(),
            })
        );
    }

    #[test]
    fn an_old_cli_without_an_account_cannot_be_checked() {
        let config = scratch("empty");
        std::fs::write(&config, r#"{"numStartups":3}"#).expect("write the config");

        let auth = local_auth(Some("2.1.37".into()), Some(&config));

        assert_eq!(auth.state, AuthStateKind::Unknown);
        assert_eq!(auth.identity, None);
        assert_eq!(auth.reason, Some(too_old_reason(Some("2.1.37".into()))));
    }

    #[test]
    fn a_missing_or_unreadable_config_cannot_be_checked() {
        let missing = scratch("missing").with_file_name("nope.json");
        assert_eq!(
            local_auth(None, Some(&missing)).state,
            AuthStateKind::Unknown
        );
        let broken = scratch("broken");
        std::fs::write(&broken, "not json").expect("write the config");
        assert_eq!(
            local_auth(None, Some(&broken)).state,
            AuthStateKind::Unknown
        );
        assert_eq!(local_auth(None, None).state, AuthStateKind::Unknown);
    }
}
