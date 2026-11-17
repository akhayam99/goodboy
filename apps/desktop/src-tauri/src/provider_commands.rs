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
    same("copilot", "update", "npm install -g @github/copilot@latest"),
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

const NPM_GLOBAL_INSTALL: &str = "npm install -g ";
const PUBLIC_NPM_REGISTRY: &str = "https://registry.npmjs.org/";

fn official_installer_hint(provider: &str) -> &'static str {
    match provider {
        "anthropic" => "printf '\\nnpm did not install Claude Code. The official installer does not use npm: curl -fsSL https://claude.ai/install.sh | bash\\n'\n",
        _ => "",
    }
}

fn with_registry_fallback(provider: &str, command: &str) -> String {
    if !command.starts_with(NPM_GLOBAL_INSTALL) {
        return command.to_string();
    }
    format!(
        "{command} && exit 0\n\
         status=$?\n\
         registry=$(npm config get registry 2>/dev/null)\n\
         case \"$registry\" in {PUBLIC_NPM_REGISTRY}*) exit $status ;; esac\n\
         if npm ping --fetch-timeout=10000 --fetch-retries=0 >/dev/null 2>&1; then exit $status; fi\n\
         printf '\\nnpm could not reach the registry it is set to use (%s). Installing from the public npm registry for this install only. Your npm settings stay as they are.\\n\\n' \"$registry\"\n\
         {command} --registry={PUBLIC_NPM_REGISTRY} && exit 0\n\
         {hint}exit 1",
        hint = official_installer_hint(provider),
    )
}

pub fn shell_command(provider: &str, action: &str) -> Result<String, ProviderCommandError> {
    lifecycle_command(provider, action).map(|command| with_registry_fallback(provider, command))
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
            "npm install -g @github/copilot@latest"
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
    fn only_a_global_npm_install_gets_the_registry_fallback() {
        assert_eq!(
            shell_command("anthropic", "update").unwrap(),
            "claude update"
        );
        assert_eq!(
            shell_command("cursor", "login").unwrap(),
            "cursor-agent login"
        );
        let install = shell_command("anthropic", "install").unwrap();
        assert!(install.starts_with("npm install -g @anthropic-ai/claude-code && exit 0\n"));
        assert!(install.contains(
            "npm install -g @anthropic-ai/claude-code --registry=https://registry.npmjs.org/"
        ));
        assert!(install.contains("https://claude.ai/install.sh"));
        let codex = shell_command("codex", "update").unwrap();
        assert!(codex.contains("--registry=https://registry.npmjs.org/"));
        assert!(!codex.contains("install.sh"));
    }

    #[test]
    fn the_fallback_never_writes_npm_config() {
        let install = shell_command("anthropic", "install").unwrap();
        assert!(!install.contains("npm config set"));
        assert!(!install.contains("npmrc"));
    }

    #[cfg(unix)]
    mod fake_npm {
        use super::*;
        use std::os::unix::fs::PermissionsExt;
        use std::path::{Path, PathBuf};

        fn stage(label: &str, ping_exit: u8, registry: &str) -> PathBuf {
            let dir = std::env::temp_dir()
                .join(format!("goodboy-fake-npm-{label}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).expect("create the fake npm dir");
            let script = format!(
                "#!/bin/sh\n\
                 printf '%s\\n' \"$*\" >> '{calls}'\n\
                 case \"$1\" in\n\
                 config) printf '%s\\n' '{registry}' ;;\n\
                 ping) exit {ping_exit} ;;\n\
                 install) case \"$*\" in *registry.npmjs.org*) exit 0 ;; *) exit 1 ;; esac ;;\n\
                 esac\n",
                calls = dir.join("calls").display(),
            );
            let npm = dir.join("npm");
            std::fs::write(&npm, script).expect("write the fake npm");
            std::fs::set_permissions(&npm, std::fs::Permissions::from_mode(0o755))
                .expect("make the fake npm runnable");
            dir
        }

        fn run(dir: &Path) -> (Option<i32>, String, Vec<String>) {
            let out = std::process::Command::new("bash")
                .arg("-c")
                .arg(shell_command("anthropic", "install").unwrap())
                .env("PATH", format!("{}:/usr/bin:/bin", dir.display()))
                .output()
                .expect("run the install script");
            let calls = std::fs::read_to_string(dir.join("calls"))
                .unwrap_or_default()
                .lines()
                .map(str::to_string)
                .collect();
            (
                out.status.code(),
                String::from_utf8_lossy(&out.stdout).into_owned(),
                calls,
            )
        }

        #[test]
        fn an_unreachable_registry_retries_once_on_the_public_one() {
            let dir = stage("unreachable", 1, "https://npm.acme.test/");

            let (code, stdout, calls) = run(&dir);

            assert_eq!(code, Some(0));
            assert!(stdout.contains("https://npm.acme.test/"), "{stdout}");
            assert!(stdout.contains("for this install only"), "{stdout}");
            assert_eq!(
                calls,
                vec![
                    "install -g @anthropic-ai/claude-code",
                    "config get registry",
                    "ping --fetch-timeout=10000 --fetch-retries=0",
                    "install -g @anthropic-ai/claude-code --registry=https://registry.npmjs.org/",
                ]
            );
        }

        #[test]
        fn a_reachable_registry_keeps_the_first_failure_and_never_retries() {
            let dir = stage("reachable", 0, "https://npm.acme.test/");

            let (code, _, calls) = run(&dir);

            assert_eq!(code, Some(1));
            assert_eq!(
                calls
                    .iter()
                    .filter(|call| call.starts_with("install"))
                    .count(),
                1
            );
        }

        #[test]
        fn the_public_registry_is_never_tried_twice() {
            let dir = stage("public", 1, "https://registry.npmjs.org/");

            let (code, _, calls) = run(&dir);

            assert_eq!(code, Some(1));
            assert!(!calls.iter().any(|call| call.starts_with("ping")));
        }
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
