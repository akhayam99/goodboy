use super::copy_path_of;
use crate::history::fixtures::slug;
use std::path::PathBuf;

#[test]
fn copies_are_reserved_in_the_app_folder_and_never_in_tmp() {
    let copy = copy_path_of(&slug("tmp-check"));
    let tmp = std::env::temp_dir();
    for outside in [
        tmp.clone(),
        std::fs::canonicalize(&tmp).unwrap(),
        PathBuf::from("/tmp"),
        PathBuf::from("/private/tmp"),
    ] {
        assert!(!copy.starts_with(&outside), "{}", copy.display());
    }
    assert!(copy.starts_with(dirs::home_dir().unwrap().join(".goodboy")));
}
