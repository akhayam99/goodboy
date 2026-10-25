use super::{redact_credentials, validated_rev};

#[test]
fn a_revision_is_a_hex_sha_head_or_a_branch_name_and_never_an_option() {
    assert_eq!(validated_rev(" 1a2b3c4 ").unwrap(), "1a2b3c4");
    assert_eq!(validated_rev("HEAD").unwrap(), "HEAD");
    assert_eq!(validated_rev("origin/main").unwrap(), "origin/main");
    for refused in [
        "",
        "--output=leak.txt",
        "-n",
        "a b",
        "x..y",
        "main:path",
        "--end-of-options",
    ] {
        assert!(validated_rev(refused).is_err(), "{refused} must be refused");
    }
}

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
