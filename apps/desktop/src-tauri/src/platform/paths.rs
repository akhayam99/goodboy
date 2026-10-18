use std::collections::HashSet;
use std::path::{Path, PathBuf};

const DEFAULT_PATHEXT: &str = ".COM;.EXE;.BAT;.CMD";

pub fn home_dir() -> Option<PathBuf> {
    std::env::home_dir().filter(|home| !home.as_os_str().is_empty())
}

fn dedup_key(segment: &Path) -> String {
    let text = segment.to_string_lossy();
    if cfg!(windows) {
        return text.trim_end_matches(['\\', '/']).to_lowercase();
    }
    text.into_owned()
}

pub fn merge_path_lists(lists: &[&str]) -> String {
    let mut seen: HashSet<String> = HashSet::new();
    let mut parts: Vec<PathBuf> = Vec::new();
    for list in lists {
        for segment in std::env::split_paths(list) {
            if segment.as_os_str().is_empty() {
                continue;
            }
            if std::env::join_paths([&segment]).is_err() {
                continue;
            }
            if seen.insert(dedup_key(&segment)) {
                parts.push(segment);
            }
        }
    }
    std::env::join_paths(parts)
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned()
}

pub fn join_path_list(parts: &[PathBuf]) -> String {
    let lists: Vec<String> = parts
        .iter()
        .filter_map(|part| std::env::join_paths([part]).ok())
        .map(|one| one.to_string_lossy().into_owned())
        .collect();
    let refs: Vec<&str> = lists.iter().map(String::as_str).collect();
    merge_path_lists(&refs)
}

pub fn program_extensions() -> Option<Vec<String>> {
    if !cfg!(windows) {
        return None;
    }
    let raw = std::env::var("PATHEXT")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_PATHEXT.to_string());
    Some(parse_extensions(&raw))
}

fn parse_extensions(raw: &str) -> Vec<String> {
    raw.split(';')
        .map(str::trim)
        .filter(|ext| ext.starts_with('.') && ext.len() > 1)
        .map(str::to_string)
        .collect()
}

fn has_extension(name: &str) -> bool {
    Path::new(name).extension().is_some()
}

pub fn program_candidates(name: &str, dir: &Path, extensions: Option<&[String]>) -> Vec<PathBuf> {
    let Some(extensions) = extensions else {
        return vec![dir.join(name)];
    };
    let mut out = Vec::new();
    if has_extension(name) {
        out.push(dir.join(name));
    }
    for ext in extensions {
        out.push(dir.join(format!("{name}{ext}")));
    }
    out
}

pub fn is_explicit_path(name: &str) -> bool {
    let path = Path::new(name);
    if path.is_absolute() {
        return true;
    }
    if cfg!(windows) {
        return name.contains(['/', '\\']);
    }
    name.contains('/')
}

#[cfg(unix)]
pub fn is_executable_file(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    std::fs::metadata(path)
        .map(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(not(unix))]
pub fn is_executable_file(path: &Path) -> bool {
    path.is_file()
}

pub fn find_program_in(
    name: &str,
    path_list: &str,
    extensions: Option<&[String]>,
) -> Option<PathBuf> {
    if name.trim().is_empty() {
        return None;
    }
    if is_explicit_path(name) {
        let path = Path::new(name);
        let dir = path.parent().unwrap_or_else(|| Path::new(""));
        let file = path.file_name()?.to_string_lossy().into_owned();
        return program_candidates(&file, dir, extensions)
            .into_iter()
            .find(|candidate| is_executable_file(candidate));
    }
    std::env::split_paths(path_list)
        .filter(|dir| !dir.as_os_str().is_empty() && dir.is_absolute())
        .flat_map(|dir| program_candidates(name, &dir, extensions))
        .find(|candidate| is_executable_file(candidate))
}

#[cfg(any(windows, test))]
pub fn windows_install_dirs(
    home: &Path,
    app_data: Option<&Path>,
    local_app_data: Option<&Path>,
) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(app_data) = app_data {
        dirs.push(app_data.join("npm"));
    }
    if let Some(local_app_data) = local_app_data {
        dirs.push(local_app_data.join("pnpm"));
    }
    for sub in [
        [".local", "bin"],
        [".bun", "bin"],
        [".cargo", "bin"],
        [".deno", "bin"],
        ["scoop", "shims"],
    ] {
        dirs.push(home.join(sub[0]).join(sub[1]));
    }
    dirs
}

#[cfg(windows)]
pub fn env_dir(name: &str) -> Option<PathBuf> {
    std::env::var_os(name)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-platform-paths-{}-{}",
            std::process::id(),
            tag
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("create the temp dir");
        dir
    }

    #[cfg(unix)]
    fn make_executable(path: &Path) {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755))
            .expect("make it executable");
    }

    #[cfg(not(unix))]
    fn make_executable(_path: &Path) {}

    fn install(dir: &Path, file: &str) -> PathBuf {
        let path = dir.join(file);
        std::fs::write(&path, "").expect("write the program");
        make_executable(&path);
        path
    }

    fn windows_extensions() -> Vec<String> {
        parse_extensions(".COM;.EXE;.BAT;.CMD")
    }

    #[test]
    fn a_bare_name_tries_every_extension_in_order() {
        let extensions = windows_extensions();
        let candidates = program_candidates("claude", Path::new("bin"), Some(&extensions));
        let names: Vec<String> = candidates
            .iter()
            .map(|candidate| {
                candidate
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();
        assert_eq!(
            names,
            ["claude.COM", "claude.EXE", "claude.BAT", "claude.CMD"]
        );
    }

    #[test]
    fn a_name_with_an_extension_is_tried_as_written_first() {
        let extensions = windows_extensions();
        let candidates = program_candidates("node.exe", Path::new("bin"), Some(&extensions));
        assert_eq!(candidates[0], Path::new("bin").join("node.exe"));
        assert_eq!(candidates[1], Path::new("bin").join("node.exe.COM"));
    }

    #[test]
    fn without_extensions_the_name_is_used_as_is() {
        let candidates = program_candidates("claude", Path::new("bin"), None);
        assert_eq!(candidates, [Path::new("bin").join("claude")]);
    }

    #[test]
    fn the_extension_list_drops_malformed_entries() {
        assert_eq!(parse_extensions(" .EXE ;;CMD;.;.Bat"), [".EXE", ".Bat"]);
    }

    #[test]
    fn find_program_finds_a_cmd_shim_on_the_path() {
        let first = temp_dir("first");
        let second = temp_dir("second");
        let shim = install(&second, "claude.CMD");
        let list = merge_path_lists(&[&first.to_string_lossy(), &second.to_string_lossy()]);
        let extensions = windows_extensions();

        let found = find_program_in("claude", &list, Some(&extensions));

        assert_eq!(found, Some(shim));
        let _ = std::fs::remove_dir_all(&first);
        let _ = std::fs::remove_dir_all(&second);
    }

    #[test]
    fn find_program_prefers_an_exe_over_a_cmd_in_the_same_folder() {
        let dir = temp_dir("exe-first");
        install(&dir, "codex.CMD");
        let exe = install(&dir, "codex.EXE");
        let extensions = windows_extensions();

        let found = find_program_in("codex", &dir.to_string_lossy(), Some(&extensions));

        assert_eq!(found, Some(exe));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn find_program_skips_relative_path_entries() {
        let found = find_program_in("goodboy-no-such-program", "relative-dir", None);
        assert_eq!(found, None);
    }

    #[test]
    fn find_program_checks_an_explicit_path_directly() {
        let dir = temp_dir("explicit");
        let program = install(&dir, "agent");

        let found = find_program_in(&program.to_string_lossy(), "", None);

        assert_eq!(found, Some(program));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn merging_keeps_the_first_copy_of_each_folder() {
        let first = temp_dir("merge-a");
        let second = temp_dir("merge-b");
        let a = first.to_string_lossy().into_owned();
        let b = second.to_string_lossy().into_owned();
        let ab = merge_path_lists(&[&a, &b]);

        let merged = merge_path_lists(&[&ab, &a, &b]);

        let segments: Vec<PathBuf> = std::env::split_paths(&merged).collect();
        assert_eq!(segments, [first.clone(), second.clone()]);
        let _ = std::fs::remove_dir_all(&first);
        let _ = std::fs::remove_dir_all(&second);
    }

    #[test]
    fn the_windows_install_dirs_cover_npm_pnpm_and_the_native_installers() {
        let home = Path::new("home");
        let dirs = windows_install_dirs(home, Some(Path::new("roaming")), Some(Path::new("local")));
        assert!(dirs.contains(&Path::new("roaming").join("npm")));
        assert!(dirs.contains(&Path::new("local").join("pnpm")));
        assert!(dirs.contains(&home.join(".local").join("bin")));
        assert!(dirs.contains(&home.join("scoop").join("shims")));
    }

    #[cfg(windows)]
    #[test]
    fn the_home_folder_is_the_user_profile() {
        assert_eq!(home_dir(), env_dir("USERPROFILE"));
    }
}
