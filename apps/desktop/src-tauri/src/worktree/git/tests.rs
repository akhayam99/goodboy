use super::redact_credentials;

#[test]
fn a_remote_url_carrying_a_token_is_redacted_before_it_reaches_the_user() {
    let leaky = "fatal: unable to access 'https://someone:ghp_secretvalue@github.com/acme/widgets.git/': the remote hung up";

    let safe = redact_credentials(leaky);

    assert!(!safe.contains("ghp_secretvalue"));
    assert!(!safe.contains("someone"));
    assert!(safe.contains("https://***@github.com/acme/widgets.git/"));
    assert_eq!(
        redact_credentials("fatal: repository 'https://github.com/acme/widgets' not found"),
        "fatal: repository 'https://github.com/acme/widgets' not found"
    );
}
