use std::path::{Path, PathBuf};

use thiserror::Error;

pub(crate) const APP_DIR: &str = ".goodboy";

#[derive(Debug, Error, PartialEq, Eq)]
pub(crate) enum AppPathsError {
    #[error("home directory not available")]
    NoHomeDir,
}

pub(crate) struct DataDirUnderParams<'a> {
    pub home: &'a Path,
}

pub(crate) fn data_dir_under(params: DataDirUnderParams) -> PathBuf {
    params.home.join(APP_DIR)
}

pub(crate) fn data_dir() -> Result<PathBuf, AppPathsError> {
    let home = dirs::home_dir().ok_or(AppPathsError::NoHomeDir)?;
    Ok(data_dir_under(DataDirUnderParams { home: &home }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_data_dir_is_the_app_folder_under_the_home() {
        let home = Path::new("/home/rowan");

        assert_eq!(
            data_dir_under(DataDirUnderParams { home }),
            PathBuf::from("/home/rowan/.goodboy")
        );
    }

    #[test]
    fn the_data_dir_lives_under_the_real_home() {
        let home = dirs::home_dir().expect("a home directory");

        assert_eq!(data_dir().unwrap(), home.join(APP_DIR));
    }
}
