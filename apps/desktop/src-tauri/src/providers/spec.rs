use super::cli_args::Cli;
use super::{
    check_claude_auth, check_codex_auth, check_cursor_auth, check_gemini_auth, check_moonshot_auth,
    check_opencode_auth, check_openrouter_auth, AuthState,
};

pub(crate) struct ProviderSpec {
    pub id: &'static str,
    pub cli: Cli,
    pub binary: &'static str,
    pub chat_shape: Option<&'static str>,
    pub check_auth: fn() -> AuthState,
}

pub(crate) const PROVIDER_SPECS: [ProviderSpec; 7] = [
    ProviderSpec {
        id: "anthropic",
        cli: Cli::Claude,
        binary: "claude",
        chat_shape: Some("claude"),
        check_auth: check_claude_auth,
    },
    ProviderSpec {
        id: "cursor",
        cli: Cli::Cursor,
        binary: "cursor-agent",
        chat_shape: None,
        check_auth: check_cursor_auth,
    },
    ProviderSpec {
        id: "codex",
        cli: Cli::Codex,
        binary: "codex",
        chat_shape: Some("codex"),
        check_auth: check_codex_auth,
    },
    ProviderSpec {
        id: "gemini",
        cli: Cli::Agy,
        binary: "agy",
        chat_shape: None,
        check_auth: check_gemini_auth,
    },
    ProviderSpec {
        id: "opencode",
        cli: Cli::Opencode,
        binary: "opencode",
        chat_shape: None,
        check_auth: check_opencode_auth,
    },
    ProviderSpec {
        id: "openrouter",
        cli: Cli::Opencode,
        binary: "opencode",
        chat_shape: None,
        check_auth: check_openrouter_auth,
    },
    ProviderSpec {
        id: "moonshot",
        cli: Cli::Opencode,
        binary: "opencode",
        chat_shape: None,
        check_auth: check_moonshot_auth,
    },
];

pub(crate) fn spec_of(provider_id: &str) -> Option<&'static ProviderSpec> {
    PROVIDER_SPECS.iter().find(|spec| spec.id == provider_id)
}

pub(crate) fn cli_of_binary_name(name: &str) -> Option<Cli> {
    PROVIDER_SPECS
        .iter()
        .find(|spec| spec.binary == name)
        .map(|spec| spec.cli)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_id_appears_once() {
        for spec in &PROVIDER_SPECS {
            let rows = PROVIDER_SPECS
                .iter()
                .filter(|row| row.id == spec.id)
                .count();
            assert_eq!(rows, 1, "{}", spec.id);
        }
    }

    #[test]
    fn providers_on_one_binary_agree_on_the_cli() {
        for spec in &PROVIDER_SPECS {
            assert_eq!(
                cli_of_binary_name(spec.binary),
                Some(spec.cli),
                "{}",
                spec.id
            );
        }
    }

    #[test]
    fn only_claude_and_codex_have_a_read_only_chat_shape() {
        let shaped: Vec<&str> = PROVIDER_SPECS
            .iter()
            .filter(|spec| spec.chat_shape.is_some())
            .map(|spec| spec.id)
            .collect();
        assert_eq!(shaped, vec!["anthropic", "codex"]);
    }

    #[test]
    fn an_unknown_id_has_no_row() {
        assert!(spec_of("nope").is_none());
        assert!(spec_of("openai").is_none());
    }
}
