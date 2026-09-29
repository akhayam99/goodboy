use super::{sanitize_slug, slugify, MAX_SLUG_LEN};
use serde::Deserialize;

#[derive(Deserialize)]
struct SlugCase {
    name: String,
    input: String,
    #[serde(rename = "maxLength")]
    max_length: Option<usize>,
    expected: String,
}

#[derive(Deserialize)]
struct SlugFixture {
    #[serde(rename = "defaultMaxLength")]
    default_max_length: usize,
    cases: Vec<SlugCase>,
}

const SLUG_FIXTURE: &str =
    include_str!("../../../../../../packages/core/src/slug/slug.fixture.json");

#[test]
fn matches_the_shared_fixture_the_typescript_slugify_is_tested_against() {
    let fixture: SlugFixture = serde_json::from_str(SLUG_FIXTURE).unwrap();

    assert_eq!(fixture.default_max_length, MAX_SLUG_LEN);
    assert!(!fixture.cases.is_empty());
    for case in fixture.cases {
        let max_len = case.max_length.unwrap_or(MAX_SLUG_LEN);
        assert_eq!(
            slugify(&case.input, max_len),
            case.expected,
            "case: {}",
            case.name
        );
    }
}

#[test]
fn replaces_a_branch_separator_so_the_directory_never_nests() {
    assert_eq!(sanitize_slug("alice/fix-parser"), "alice-fix-parser");
}

#[test]
fn truncates_at_the_slug_budget_without_a_trailing_dash() {
    let sanitized = sanitize_slug(&format!("{}-tail", "a".repeat(MAX_SLUG_LEN - 1)));

    assert_eq!(sanitized, "a".repeat(MAX_SLUG_LEN - 1));
}

#[test]
fn lowercases_ascii_only() {
    assert_eq!(sanitize_slug("Fix-Parser"), "fix-parser");
    assert_eq!(sanitize_slug("caff\u{c8}"), "caff");
}

#[test]
fn leaves_an_already_sanitized_name_untouched() {
    let once = sanitize_slug("Alice/Fix   Parser/../weird");

    assert_eq!(sanitize_slug(&once), once);
}

#[test]
fn leaves_a_mount_directory_name_untouched() {
    let name = "alice-fix-p-9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f";

    assert_eq!(name.len(), MAX_SLUG_LEN);
    assert_eq!(sanitize_slug(name), name);
}
