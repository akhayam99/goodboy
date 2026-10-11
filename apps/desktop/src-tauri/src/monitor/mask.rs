use regex::Regex;
use std::sync::OnceLock;

const MASK: &str = "***";
const SECRET_FLAGS: [&str; 3] = ["--token", "--password", "--secret"];

fn secret_pair() -> &'static Regex {
    static PAIR: OnceLock<Regex> = OnceLock::new();
    PAIR.get_or_init(|| {
        Regex::new(r"(?i)^([A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|KEY)[A-Za-z0-9_]*)=(.*)$")
            .expect("secret pair pattern")
    })
}

fn is_secret_flag(token: &str) -> bool {
    let lower = token.to_ascii_lowercase();
    SECRET_FLAGS.iter().any(|flag| lower == *flag)
}

fn flag_with_value(token: &str) -> Option<String> {
    let lower = token.to_ascii_lowercase();
    SECRET_FLAGS.iter().find_map(|flag| {
        let prefix = format!("{flag}=");
        lower
            .starts_with(&prefix)
            .then(|| format!("{}{MASK}", &token[..prefix.len()]))
    })
}

fn opens_quote(value: &str) -> Option<char> {
    let first = value.chars().next()?;
    let is_quote = first == '"' || first == '\'';
    let is_closed = value.len() > 1 && value.ends_with(first);
    (is_quote && !is_closed).then_some(first)
}

pub(crate) fn mask_args(args: &str) -> String {
    let mut out: Vec<String> = Vec::new();
    let mut tokens = args.split_whitespace();
    while let Some(token) = tokens.next() {
        if is_secret_flag(token) {
            out.push(token.to_string());
            if tokens.next().is_some() {
                out.push(MASK.to_string());
            }
            continue;
        }
        if let Some(masked) = flag_with_value(token) {
            out.push(masked);
            continue;
        }
        let Some(captures) = secret_pair().captures(token) else {
            out.push(token.to_string());
            continue;
        };
        out.push(format!("{}={MASK}", &captures[1]));
        let Some(quote) = opens_quote(&captures[2]) else {
            continue;
        };
        for rest in tokens.by_ref() {
            if rest.ends_with(quote) {
                break;
            }
        }
    }
    out.join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_flag_forms_and_key_pairs() {
        let cases = [
            (
                "node server.js --token=abc123",
                "node server.js --token=***",
            ),
            (
                "run --PASSWORD=hunter2 --port=3000",
                "run --PASSWORD=*** --port=3000",
            ),
            ("tool --secret=x --verbose", "tool --secret=*** --verbose"),
            ("env API_KEY=abc node app.js", "env API_KEY=*** node app.js"),
            ("GITHUB_TOKEN=ghp_x vite", "GITHUB_TOKEN=*** vite"),
            ("db_secret=zzz run", "db_secret=*** run"),
            ("cli --token abc --port 80", "cli --token *** --port 80"),
            ("a KEY=\"two words\" b", "a KEY=*** b"),
            ("node --inspect=9229 app.js", "node --inspect=9229 app.js"),
            ("PORT=3000 vite", "PORT=3000 vite"),
            ("", ""),
            ("   ", ""),
        ];
        for (input, expected) in cases {
            assert_eq!(mask_args(input), expected, "input: {input}");
        }
    }

    #[test]
    fn leaves_no_secret_value_in_output() {
        let masked = mask_args("x --token=sekret TOKEN=sekret2 --password sekret3");
        assert!(!masked.contains("sekret"));
    }

    #[test]
    fn handles_one_hundred_thousand_characters() {
        let input = "A=b ".repeat(25_000);
        assert_eq!(mask_args(&input).split_whitespace().count(), 25_000);
    }
}
