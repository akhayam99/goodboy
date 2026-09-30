use std::fs;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;

use crate::integrations::http;
use crate::util::MessageError;

const REPO_SLUG: &str = "akhayam99/goodboy";
const PRIMARY_REF: &str = "main";
const CLIENT_USER_AGENT: &str = "goodboy-desktop";
const CACHE_ROOT_SEGMENTS: [&str; 2] = [".goodboy", "cache"];
const CACHE_DIR: &str = "changelog";
const CACHE_BUDGET_BYTES: u64 = 30 * 1024 * 1024;

fn is_valid_version(version: &str) -> bool {
    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() != 3 {
        return false;
    }
    parts
        .iter()
        .all(|part| !part.is_empty() && part.chars().all(|c| c.is_ascii_digit()))
}

fn is_valid_file_name(file: &str) -> bool {
    let Some(stem) = file.strip_suffix(".webp") else {
        return false;
    };
    let Some((name_and_variant, theme)) = stem.rsplit_once('-') else {
        return false;
    };
    if theme != "dark" && theme != "light" {
        return false;
    }
    let Some((name, variant)) = name_and_variant.rsplit_once('-') else {
        return false;
    };
    if variant != "before" && variant != "after" {
        return false;
    }
    !name.is_empty()
        && name.split('-').all(|segment| {
            !segment.is_empty()
                && segment
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        })
}

fn cache_root(home: &Path) -> PathBuf {
    let mut root = home.to_path_buf();
    for segment in CACHE_ROOT_SEGMENTS {
        root = root.join(segment);
    }
    root.join(CACHE_DIR)
}

fn cache_file_path(home: &Path, version: &str, file: &str) -> PathBuf {
    cache_root(home).join(version).join(file)
}

fn raw_url_for_ref(git_ref: &str, version: &str, file: &str) -> String {
    format!(
        "https://raw.githubusercontent.com/{}/{}/docs/changelog/{}/{}",
        REPO_SLUG, git_ref, version, file
    )
}

fn candidate_urls(version: &str, file: &str) -> Vec<String> {
    vec![
        raw_url_for_ref(PRIMARY_REF, version, file),
        raw_url_for_ref(&format!("v{version}"), version, file),
    ]
}

async fn fetch_image(url: &str) -> Result<Vec<u8>, FetchFailure> {
    let response = http::client()
        .get(url)
        .header(reqwest::header::USER_AGENT, CLIENT_USER_AGENT)
        .send()
        .await
        .map_err(|_| FetchFailure::Network)?;
    let status = response.status();
    if !status.is_success() {
        return Err(FetchFailure::Status(status.as_u16()));
    }
    response
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|_| FetchFailure::Body)
}

enum FetchFailure {
    Network,
    Status(u16),
    Body,
}

fn to_data_url(bytes: &[u8]) -> String {
    format!("data:image/webp;base64,{}", STANDARD.encode(bytes))
}

fn write_cache_file(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, bytes)
}

fn dir_size(dir: &Path) -> u64 {
    let Ok(entries) = fs::read_dir(dir) else {
        return 0;
    };
    entries
        .flatten()
        .map(|entry| entry.metadata().map(|meta| meta.len()).unwrap_or(0))
        .sum()
}

fn version_sort_key(version: &str) -> (u64, u64, u64) {
    let mut parts = version
        .split('.')
        .map(|part| part.parse::<u64>().unwrap_or(0));
    (
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
    )
}

fn evict_oldest_versions(root: &Path, budget: u64) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    let mut versions: Vec<(String, PathBuf, u64)> = entries
        .flatten()
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            if !is_valid_version(&name) {
                return None;
            }
            let path = entry.path();
            let size = dir_size(&path);
            Some((name, path, size))
        })
        .collect();
    versions.sort_by_key(|(name, _, _)| version_sort_key(name));

    let mut total: u64 = versions.iter().map(|(_, _, size)| size).sum();
    for (_, path, size) in versions {
        if total <= budget {
            break;
        }
        if fs::remove_dir_all(&path).is_ok() {
            total = total.saturating_sub(size);
        }
    }
}

#[tauri::command]
pub async fn changelog_image(version: String, file: String) -> Result<String, MessageError> {
    if !is_valid_version(&version) {
        return Err(MessageError::Refused(format!(
            "\"{version}\" is not a usable release version"
        )));
    }
    if !is_valid_file_name(&file) {
        return Err(MessageError::Refused(format!(
            "\"{file}\" is not a usable changelog image name"
        )));
    }
    let home = dirs::home_dir().ok_or_else(|| "the home folder is unavailable".to_string())?;
    let path = cache_file_path(&home, &version, &file);

    if let Ok(bytes) = fs::read(&path) {
        return Ok(to_data_url(&bytes));
    }

    let mut last_failure = FetchFailure::Network;
    let mut fetched = None;
    for url in candidate_urls(&version, &file) {
        match fetch_image(&url).await {
            Ok(bytes) => {
                fetched = Some(bytes);
                break;
            }
            Err(failure) => last_failure = failure,
        }
    }
    let bytes = fetched.ok_or_else(|| match last_failure {
        FetchFailure::Network => format!("could not load {file} for v{version}"),
        FetchFailure::Status(code) => format!("github answered {code} for {file}"),
        FetchFailure::Body => format!("could not read {file} for v{version}"),
    })?;

    write_cache_file(&path, &bytes).map_err(|e| e.to_string())?;
    evict_oldest_versions(&cache_root(&home), CACHE_BUDGET_BYTES);

    Ok(to_data_url(&bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn accepts_a_well_formed_version() {
        assert!(is_valid_version("0.10.0"));
        assert!(is_valid_version("12.3.45"));
    }

    #[test]
    fn refuses_a_malformed_version() {
        for version in ["v0.10.0", "0.10", "0.10.0.1", "0.a.0", "", "../../etc"] {
            assert!(!is_valid_version(version), "accepted {version}");
        }
    }

    #[test]
    fn accepts_a_well_formed_file_name() {
        for file in [
            "scroll-fade-after-dark.webp",
            "scroll-fade-after-light.webp",
            "crumb-menu-before-dark.webp",
            "a1-before-light.webp",
        ] {
            assert!(is_valid_file_name(file), "rejected {file}");
        }
    }

    #[test]
    fn refuses_a_malformed_file_name() {
        for file in [
            "../secrets-after-dark.webp",
            "scroll-fade-after-dark.png",
            "scroll-fade-sideways-dark.webp",
            "scroll-fade-after-blue.webp",
            "ScrollFade-after-dark.webp",
            "-after-dark.webp",
            "scroll_fade-after-dark.webp",
            "scroll-fade-after-dark",
        ] {
            assert!(!is_valid_file_name(file), "accepted {file}");
        }
    }

    #[test]
    fn builds_the_cache_path_under_the_home_goodboy_cache_dir() {
        let home = PathBuf::from("/home/n-bro");
        let path = cache_file_path(&home, "0.10.0", "scroll-fade-after-dark.webp");
        assert_eq!(
            path,
            PathBuf::from(
                "/home/n-bro/.goodboy/cache/changelog/0.10.0/scroll-fade-after-dark.webp"
            )
        );
    }

    #[test]
    fn changelog_image_builds_the_raw_url_for_a_given_ref() {
        assert_eq!(
            raw_url_for_ref("main", "0.5.0", "scroll-fade-after-dark.webp"),
            "https://raw.githubusercontent.com/akhayam99/goodboy/main/docs/changelog/0.5.0/scroll-fade-after-dark.webp"
        );
        assert_eq!(
            raw_url_for_ref("v0.10.0", "0.10.0", "scroll-fade-after-dark.webp"),
            "https://raw.githubusercontent.com/akhayam99/goodboy/v0.10.0/docs/changelog/0.10.0/scroll-fade-after-dark.webp"
        );
    }

    #[test]
    fn changelog_image_tries_main_first_then_the_release_tag() {
        assert_eq!(
            candidate_urls("0.5.0", "crumb-menu-before-light.webp"),
            vec![
                "https://raw.githubusercontent.com/akhayam99/goodboy/main/docs/changelog/0.5.0/crumb-menu-before-light.webp".to_string(),
                "https://raw.githubusercontent.com/akhayam99/goodboy/v0.5.0/docs/changelog/0.5.0/crumb-menu-before-light.webp".to_string(),
            ]
        );
    }

    #[test]
    fn wraps_bytes_in_a_webp_data_url() {
        let uri = to_data_url(&[0x00, 0x01, 0x02]);
        assert!(uri.starts_with("data:image/webp;base64,"), "{uri}");
    }

    #[test]
    fn writes_cache_files_into_directories_that_do_not_exist_yet() {
        let dir =
            std::env::temp_dir().join(format!("gb-changelog-images-write-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let path = dir.join("0.10.0").join("scroll-fade-after-dark.webp");

        write_cache_file(&path, b"abc").unwrap();

        assert_eq!(fs::read(&path).unwrap(), b"abc");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn evicts_the_oldest_release_directories_first_to_fit_the_budget() {
        let dir =
            std::env::temp_dir().join(format!("gb-changelog-images-evict-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let sizes = [("0.8.0", 10), ("0.9.0", 10), ("0.10.0", 10)];
        for (version, size) in sizes {
            let version_dir = dir.join(version);
            fs::create_dir_all(&version_dir).unwrap();
            fs::write(version_dir.join("a-after-dark.webp"), vec![0u8; size]).unwrap();
        }

        evict_oldest_versions(&dir, 15);

        assert!(
            !dir.join("0.8.0").exists(),
            "oldest version should be evicted first"
        );
        assert!(
            !dir.join("0.9.0").exists(),
            "second oldest should also be evicted to fit the budget"
        );
        assert!(dir.join("0.10.0").exists(), "newest version should be kept");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn keeps_every_version_when_the_total_already_fits_the_budget() {
        let dir =
            std::env::temp_dir().join(format!("gb-changelog-images-fit-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        for version in ["0.8.0", "0.9.0"] {
            let version_dir = dir.join(version);
            fs::create_dir_all(&version_dir).unwrap();
            fs::write(version_dir.join("a-after-dark.webp"), vec![0u8; 5]).unwrap();
        }

        evict_oldest_versions(&dir, 30 * 1024 * 1024);

        assert!(dir.join("0.8.0").exists());
        assert!(dir.join("0.9.0").exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn ignores_a_non_version_entry_in_the_cache_root_instead_of_evicting_it() {
        let dir =
            std::env::temp_dir().join(format!("gb-changelog-images-ignore-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::create_dir_all(dir.join(".DS_Store_dir")).unwrap();

        evict_oldest_versions(&dir, 0);

        assert!(dir.join(".DS_Store_dir").exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_command_stays_registered_with_the_webview() {
        let lib_src = include_str!("lib.rs");
        assert!(lib_src.contains("changelog_images::changelog_image"));
    }
}
