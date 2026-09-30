use super::{parse_git_version, MERGE_TREE_BASE_MIN};

#[test]
fn git_versions_parse_with_vendor_suffixes() {
    assert_eq!(
        parse_git_version("git version 2.50.1 (Apple Git-155)"),
        Some((2, 50))
    );
    assert_eq!(parse_git_version("git version 2.39.0"), Some((2, 39)));
    assert!(Some((2, 39)) < Some(MERGE_TREE_BASE_MIN));
    assert_eq!(parse_git_version("nonsense"), None);
}
