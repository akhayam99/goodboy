use serde_json::Value;

use super::dispatch::Args;
use super::protocol::BridgeError;

pub(super) fn optional_text(args: &Args, key: &str) -> Option<String> {
    args.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

pub(super) fn required_text(args: &Args, key: &str) -> Result<String, BridgeError> {
    optional_text(args, key).ok_or_else(|| format!("--{} must not be empty", key).into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(pairs: &[(&str, Value)]) -> Args {
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_string(), value.clone()))
            .collect()
    }

    #[test]
    fn required_text_is_trimmed() {
        let value = required_text(&args(&[("name", Value::from("  app  "))]), "name");
        assert_eq!(value.expect("trimmed name"), "app");
    }

    #[test]
    fn required_text_refuses_whitespace_only() {
        let error =
            required_text(&args(&[("name", Value::from("   "))]), "name").expect_err("blank name");
        assert_eq!(error.message, "--name must not be empty");
    }

    #[test]
    fn required_text_names_a_missing_key() {
        let error = required_text(&args(&[]), "reason").expect_err("missing reason");
        assert_eq!(error.message, "--reason must not be empty");
    }

    #[test]
    fn optional_text_is_none_when_empty_or_not_text() {
        assert_eq!(
            optional_text(&args(&[("state", Value::from(""))]), "state"),
            None
        );
        assert_eq!(
            optional_text(&args(&[("state", Value::from(3))]), "state"),
            None
        );
        assert_eq!(optional_text(&args(&[]), "state"), None);
        assert_eq!(
            optional_text(&args(&[("state", Value::from(" open "))]), "state"),
            Some("open".to_string())
        );
    }
}
