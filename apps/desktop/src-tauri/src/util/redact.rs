use regex::Regex;
use std::sync::OnceLock;

pub(crate) const MASK: &str = "***";

pub(crate) const SECRET_FLAGS: [&str; 7] = [
    "--token",
    "--password",
    "--secret",
    "--api-key",
    "--apikey",
    "--access-token",
    "--auth-token",
];

const OPAQUE_PATTERNS: [&str; 13] = [
    r"\bgh[pousr]_[A-Za-z0-9]{16,}",
    r"\bgithub_pat_[A-Za-z0-9_]{20,}",
    r"\bxox[abprs]-[A-Za-z0-9-]{10,}",
    r"\bxapp-[0-9]-[A-Za-z0-9-]{10,}",
    r"\bsk-[A-Za-z0-9_-]{16,}",
    r"\bglpat-[A-Za-z0-9_-]{16,}",
    r"\blin_(?:api|oauth)_[A-Za-z0-9]{16,}",
    r"\bsntrys_[A-Za-z0-9+/=_-]{16,}",
    r"\bsntryu_[A-Za-z0-9]{16,}",
    r"\bATATT[A-Za-z0-9_=+/-]{20,}",
    r"\bATBB[A-Za-z0-9_=+/-]{16,}",
    r"\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}",
    r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b",
];

const PRIVATE_KEY_PATTERN: &str = r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[A-Za-z0-9+/=\s]*(?:-----END [A-Z0-9 ]*PRIVATE KEY-----)?";

const URL_USERINFO_PATTERN: &str = r"([A-Za-z][A-Za-z0-9+.\-]*://)[^/@\s]+@";

const BEARER_PATTERN: &str = r#"(?i)\b(bearer)(\s+)[^\s"',;&]+"#;

const LABELLED_PATTERN: &str = r#"(?i)(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|secret)(?:(\s*[:=]\s*)|(\s+))(?:(?:bearer|basic|digest|token|jwt|apikey|negotiate|dpop)\s+)?("[^"\n]*"|'[^'\n]*'|[^\s"',;&]+)"#;

const TOKEN_LABEL_PATTERN: &str = r#"(?i)(token|bearer)(\s*[:=]\s*)(?:(?:bearer|basic|token)\s+)?("[^"\n]*"|'[^'\n]*'|[^\s"',;&]+)"#;

const MIN_LOOSE_VALUE: usize = 6;

fn compiled(source: &'static str) -> Regex {
    Regex::new(source).expect("redaction pattern compiles")
}

fn opaque() -> &'static [Regex] {
    static OPAQUE: OnceLock<Vec<Regex>> = OnceLock::new();
    OPAQUE.get_or_init(|| {
        OPAQUE_PATTERNS
            .iter()
            .map(|source| compiled(source))
            .collect()
    })
}

fn private_key() -> &'static Regex {
    static KEY: OnceLock<Regex> = OnceLock::new();
    KEY.get_or_init(|| compiled(PRIVATE_KEY_PATTERN))
}

fn url_userinfo() -> &'static Regex {
    static USERINFO: OnceLock<Regex> = OnceLock::new();
    USERINFO.get_or_init(|| compiled(URL_USERINFO_PATTERN))
}

fn bearer() -> &'static Regex {
    static BEARER: OnceLock<Regex> = OnceLock::new();
    BEARER.get_or_init(|| compiled(BEARER_PATTERN))
}

fn labelled() -> &'static Regex {
    static LABELLED: OnceLock<Regex> = OnceLock::new();
    LABELLED.get_or_init(|| compiled(LABELLED_PATTERN))
}

fn token_label() -> &'static Regex {
    static TOKEN: OnceLock<Regex> = OnceLock::new();
    TOKEN.get_or_init(|| compiled(TOKEN_LABEL_PATTERN))
}

pub(crate) fn redact_text(raw: &str) -> String {
    let without_userinfo = url_userinfo().replace_all(raw, "${1}***@");
    let without_keys = private_key().replace_all(&without_userinfo, MASK);
    let without_opaque = opaque().iter().fold(without_keys.into_owned(), |text, re| {
        re.replace_all(&text, MASK).into_owned()
    });
    let without_bearer = bearer().replace_all(&without_opaque, "${1}${2}***");
    let without_labelled = labelled().replace_all(&without_bearer, |caps: &regex::Captures| {
        let label = &caps[1];
        if let Some(separator) = caps.get(2) {
            return format!("{label}{}{MASK}", separator.as_str());
        }
        if caps[4].len() < MIN_LOOSE_VALUE {
            return caps[0].to_string();
        }
        format!("{label}{}{MASK}", &caps[3])
    });
    token_label()
        .replace_all(&without_labelled, "${1}${2}***")
        .into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct Corpus {
        cases: Vec<Case>,
    }

    #[derive(Deserialize)]
    struct Case {
        name: String,
        input: String,
        leaks: Vec<String>,
        keeps: Vec<String>,
    }

    #[test]
    fn corpus_leaves_no_leak_and_keeps_every_keep() {
        let corpus: Corpus =
            serde_json::from_str(include_str!("redact_corpus.json")).expect("shared corpus parses");
        assert!(corpus.cases.len() > 20);
        for case in corpus.cases {
            let out = redact_text(&case.input);
            for leak in &case.leaks {
                assert!(
                    !out.contains(leak.as_str()),
                    "{}: leaked {leak} in {out}",
                    case.name
                );
            }
            for keep in &case.keeps {
                assert!(
                    out.contains(keep.as_str()),
                    "{}: lost {keep} in {out}",
                    case.name
                );
            }
        }
    }

    #[test]
    fn redaction_is_idempotent() {
        let once = redact_text("Authorization: Bearer abcdefghijklmnop https://u:p@host/x");
        assert_eq!(redact_text(&once), once);
    }

    #[test]
    fn handles_a_long_input_without_blowing_up() {
        let input = "A=b token budget ".repeat(20_000);
        assert_eq!(redact_text(&input), input);
    }
}
