const BUILD_SHA: Option<&str> = option_env!("GOODBOY_BUILD_SHA");
const SHORT_SHA_LENGTH: usize = 12;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPlatform {
    pub os: &'static str,
    pub os_version: Option<String>,
    pub arch: &'static str,
    pub build_sha: Option<String>,
}

#[tauri::command(async)]
pub fn app_platform() -> AppPlatform {
    AppPlatform {
        os: std::env::consts::OS,
        os_version: os_version(),
        arch: std::env::consts::ARCH,
        build_sha: short_sha(BUILD_SHA),
    }
}

fn short_sha(raw: Option<&str>) -> Option<String> {
    let trimmed = raw?.trim();
    if trimmed.is_empty() || !trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    Some(trimmed.chars().take(SHORT_SHA_LENGTH).collect())
}

#[cfg_attr(not(any(target_os = "macos", target_os = "linux")), allow(dead_code))]
fn clean_version(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || !trimmed.chars().all(|c| c.is_ascii_digit() || c == '.') {
        return None;
    }
    Some(trimmed.to_string())
}

#[cfg(target_os = "macos")]
fn os_version() -> Option<String> {
    let output = std::process::Command::new("/usr/bin/sw_vers")
        .arg("-productVersion")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    clean_version(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(target_os = "linux")]
fn os_version() -> Option<String> {
    let output = std::process::Command::new("uname")
        .arg("-r")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let raw = String::from_utf8_lossy(&output.stdout);
    let numeric: String = raw
        .trim()
        .chars()
        .take_while(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    clean_version(&numeric)
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn os_version() -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_sha_keeps_twelve_hex_characters() {
        assert_eq!(
            short_sha(Some("fc2f08994a1b2c3d4e5f60718293a4b5c6d7e8f9")),
            Some("fc2f08994a1b".to_string())
        );
    }

    #[test]
    fn short_sha_rejects_missing_or_non_hex_values() {
        assert_eq!(short_sha(None), None);
        assert_eq!(short_sha(Some("  ")), None);
        assert_eq!(short_sha(Some("main")), None);
    }

    #[test]
    fn clean_version_keeps_only_dotted_numbers() {
        assert_eq!(clean_version("15.1.1\n"), Some("15.1.1".to_string()));
        assert_eq!(clean_version("rowan's mac"), None);
        assert_eq!(clean_version(""), None);
    }

    #[test]
    fn app_platform_reports_the_compile_target() {
        let platform = app_platform();
        assert_eq!(platform.os, std::env::consts::OS);
        assert_eq!(platform.arch, std::env::consts::ARCH);
    }
}
