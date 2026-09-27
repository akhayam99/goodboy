use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::artifact_folder::{is_safe_segment, write_folder, FolderFile, FolderLimits};
use crate::artifacts::ArtifactExportError;

const MIRROR_DIR: &str = if cfg!(debug_assertions) {
    "artifacts-dev"
} else {
    "artifacts"
};

const META_FILE: &str = "meta.json";

const MIRROR_LIMITS: FolderLimits = FolderLimits {
    max_files: 512,
    max_depth: 3,
    max_bytes: 32 * 1024 * 1024,
};

const PRUNED_EXTENSIONS: [&str; 3] = [".html", ".css", ".json"];

fn destination(message: &str) -> ArtifactExportError {
    ArtifactExportError::Destination(message.to_string())
}

fn home() -> Result<PathBuf, ArtifactExportError> {
    dirs::home_dir().ok_or_else(|| destination("the home folder is unavailable"))
}

pub(crate) fn mirror_root(
    home: &Path,
    workspace_slug: &str,
) -> Result<PathBuf, ArtifactExportError> {
    let slug = crate::worktree::sanitize_slug(workspace_slug);
    if slug.is_empty() {
        return Err(destination("the workspace has no usable name"));
    }
    Ok(home
        .join(".goodboy")
        .join("workspaces")
        .join(slug)
        .join(MIRROR_DIR))
}

fn is_date_prefix(prefix: &str) -> bool {
    prefix.len() == 11
        && prefix.char_indices().all(|(index, character)| match index {
            4 | 7 | 10 => character == '-',
            _ => character.is_ascii_digit(),
        })
}

fn renamed_twin(root: &Path, folder: &str) -> Option<String> {
    let date = folder.get(..11).filter(|prefix| is_date_prefix(prefix))?;
    let (head, suffix) = folder.rsplit_once('-')?;
    if suffix.is_empty() || head.len() < 10 {
        return None;
    }
    let ending = format!("-{suffix}");
    let mut twins: Vec<String> = std::fs::read_dir(root)
        .ok()?
        .flatten()
        .filter(|entry| entry.path().is_dir())
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .filter(|name| {
            name != folder
                && name.len() >= date.len() + suffix.len()
                && name.starts_with(date)
                && name.ends_with(&ending)
        })
        .collect();
    twins.sort();
    twins.into_iter().next()
}

fn resolve_folder(root: &Path, folder: &str) -> String {
    if root.join(folder).is_dir() {
        return folder.to_string();
    }
    renamed_twin(root, folder).unwrap_or_else(|| folder.to_string())
}

fn mirror_folder(
    home: &Path,
    workspace_slug: &str,
    folder: &str,
) -> Result<PathBuf, ArtifactExportError> {
    if !is_safe_segment(folder) {
        return Err(destination("the folder name is not a plain name"));
    }
    let root = mirror_root(home, workspace_slug)?;
    let resolved = resolve_folder(&root, folder);
    Ok(root.join(resolved))
}

fn prune_dir(
    dir: &Path,
    prefix: &str,
    written: &HashSet<&str>,
    extensions: &[&str],
) -> Result<(), ArtifactExportError> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Ok(());
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let relative = format!("{prefix}{name}");
        let is_generated =
            entry.path().is_file() && extensions.iter().any(|extension| name.ends_with(extension));
        if is_generated && !written.contains(relative.as_str()) {
            std::fs::remove_file(entry.path())?;
        }
    }
    Ok(())
}

fn is_version_dir(name: &str) -> bool {
    name.len() > 1 && name.starts_with('v') && name[1..].chars().all(|c| c.is_ascii_digit())
}

fn prune_stale(root: &Path, files: &[FolderFile]) -> Result<(), ArtifactExportError> {
    let written: HashSet<&str> = files.iter().map(|file| file.path.as_str()).collect();
    prune_dir(root, "", &written, &PRUNED_EXTENSIONS)?;
    prune_dir(&root.join("screens"), "screens/", &written, &[".html"])?;
    let _ = std::fs::remove_dir(root.join("screens"));
    let Ok(entries) = std::fs::read_dir(root) else {
        return Ok(());
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !is_version_dir(&name) || !entry.path().is_dir() {
            continue;
        }
        let has_written = written
            .iter()
            .any(|path| path.starts_with(&format!("{name}/")));
        if !has_written {
            continue;
        }
        prune_dir(
            &entry.path().join("screens"),
            &format!("{name}/screens/"),
            &written,
            &[".html"],
        )?;
    }
    Ok(())
}

pub(crate) fn write_mirror(
    home: &Path,
    workspace_slug: &str,
    folder: &str,
    files: &[FolderFile],
) -> Result<PathBuf, ArtifactExportError> {
    let root = mirror_root(home, workspace_slug)?;
    std::fs::create_dir_all(&root)?;
    if !is_safe_segment(folder) {
        return Err(destination("the folder name is not a plain name"));
    }
    let resolved = resolve_folder(&root, folder);
    let written = write_folder(&root, &resolved, files, MIRROR_LIMITS)?;
    prune_stale(&written, files)?;
    Ok(written)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MirrorEntry {
    pub workspace_slug: String,
    pub folder: String,
    pub revision: i64,
    pub updated_at: String,
    pub renderer_version: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MirrorMeta {
    revision: Option<i64>,
    updated_at: Option<String>,
    renderer_version: Option<String>,
}

fn is_current(home: &Path, entry: &MirrorEntry) -> bool {
    let Ok(folder) = mirror_folder(home, &entry.workspace_slug, &entry.folder) else {
        return true;
    };
    let Ok(text) = std::fs::read_to_string(folder.join(META_FILE)) else {
        return false;
    };
    let Ok(meta) = serde_json::from_str::<MirrorMeta>(&text) else {
        return false;
    };
    meta.revision == Some(entry.revision)
        && meta.updated_at.as_deref() == Some(&entry.updated_at)
        && meta.renderer_version.as_deref() == Some(&entry.renderer_version)
}

pub(crate) fn pending_mirrors(home: &Path, entries: &[MirrorEntry]) -> Vec<String> {
    entries
        .iter()
        .filter(|entry| !is_current(home, entry))
        .map(|entry| entry.folder.clone())
        .collect()
}

#[derive(Debug, Serialize)]
pub struct MirrorLocation {
    pub path: String,
    pub exists: bool,
}

pub(crate) fn locate_mirror(
    home: &Path,
    workspace_slug: &str,
    folder: &str,
) -> Result<MirrorLocation, ArtifactExportError> {
    let path = mirror_folder(home, workspace_slug, folder)?;
    Ok(MirrorLocation {
        exists: path.join(META_FILE).is_file(),
        path: path.to_string_lossy().into_owned(),
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MirrorFolderRef {
    pub workspace_slug: String,
    pub folder: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MirrorSize {
    pub workspace_slug: String,
    pub folder: String,
    pub size_bytes: Option<u64>,
}

pub(crate) fn measure_mirrors(home: &Path, refs: &[MirrorFolderRef]) -> Vec<MirrorSize> {
    refs.iter()
        .map(|entry| {
            let size_bytes = mirror_folder(home, &entry.workspace_slug, &entry.folder)
                .ok()
                .filter(|path| path.is_dir())
                .and_then(|path| crate::worktree::directory_size(&path).0);
            MirrorSize {
                workspace_slug: entry.workspace_slug.clone(),
                folder: entry.folder.clone(),
                size_bytes,
            }
        })
        .collect()
}

pub(crate) fn remove_mirror(
    home: &Path,
    workspace_slug: &str,
    folder: &str,
) -> Result<bool, ArtifactExportError> {
    let path = mirror_folder(home, workspace_slug, folder)?;
    let Ok(meta) = std::fs::symlink_metadata(&path) else {
        return Ok(false);
    };
    if !meta.is_dir() {
        return Err(destination("the saved copy is not a folder"));
    }
    std::fs::remove_dir_all(&path)?;
    Ok(true)
}

#[cfg(target_os = "macos")]
fn macos_default_browser_app_path() -> Option<PathBuf> {
    use core_foundation_sys::base::{kCFAllocatorDefault, CFRelease, CFTypeRef};
    use core_foundation_sys::string::{
        kCFStringEncodingUTF8, CFStringCreateWithBytes, CFStringRef,
    };
    use core_foundation_sys::url::{
        CFURLCreateWithString, CFURLGetFileSystemRepresentation, CFURLRef,
    };

    const K_LS_ROLES_VIEWER: u32 = 0x0000_0002;

    #[link(name = "CoreServices", kind = "framework")]
    extern "C" {
        fn LSCopyDefaultApplicationURLForURL(
            in_url: CFURLRef,
            in_role_mask: u32,
            out_error: *mut CFTypeRef,
        ) -> CFURLRef;
    }

    unsafe {
        let scheme = b"https://example.com";
        let cf_string: CFStringRef = CFStringCreateWithBytes(
            kCFAllocatorDefault,
            scheme.as_ptr(),
            scheme.len() as isize,
            kCFStringEncodingUTF8,
            0,
        );
        if cf_string.is_null() {
            return None;
        }
        let cf_url: CFURLRef =
            CFURLCreateWithString(kCFAllocatorDefault, cf_string, std::ptr::null());
        CFRelease(cf_string as CFTypeRef);
        let cf_url = cf_url;
        if cf_url.is_null() {
            return None;
        }

        let mut error: CFTypeRef = std::ptr::null_mut();
        let app_url = LSCopyDefaultApplicationURLForURL(cf_url, K_LS_ROLES_VIEWER, &mut error);
        CFRelease(cf_url as CFTypeRef);
        if !error.is_null() {
            CFRelease(error);
        }
        if app_url.is_null() {
            return None;
        }

        let mut buffer = [0u8; 1024];
        let ok = CFURLGetFileSystemRepresentation(
            app_url,
            1,
            buffer.as_mut_ptr(),
            buffer.len() as isize,
        );
        CFRelease(app_url as CFTypeRef);
        if ok == 0 {
            return None;
        }
        let end = buffer.iter().position(|&b| b == 0).unwrap_or(buffer.len());
        std::str::from_utf8(&buffer[..end]).ok().map(PathBuf::from)
    }
}

#[cfg(target_os = "windows")]
fn windows_default_browser_command() -> Option<String> {
    use windows_sys::core::{PCWSTR, PWSTR};
    use windows_sys::Win32::UI::Shell::{AssocQueryStringW, ASSOCF_IS_PROTOCOL, ASSOCSTR_COMMAND};

    fn to_wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    let scheme = to_wide("http");
    let mut buffer = [0u16; 1024];
    let mut len = buffer.len() as u32;
    let status = unsafe {
        AssocQueryStringW(
            ASSOCF_IS_PROTOCOL,
            ASSOCSTR_COMMAND,
            PCWSTR(scheme.as_ptr()),
            PCWSTR(std::ptr::null()),
            PWSTR(buffer.as_mut_ptr()),
            &mut len,
        )
    };
    if status < 0 {
        return None;
    }
    let end = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
    let command = String::from_utf16_lossy(&buffer[..end]);
    if command.is_empty() {
        None
    } else {
        Some(command)
    }
}

fn open_with_browser(path: &Path) -> std::io::Result<()> {
    #[cfg(target_os = "macos")]
    {
        if let Some(app_path) = macos_default_browser_app_path() {
            let status = Command::new("open")
                .arg("-a")
                .arg(&app_path)
                .arg(path)
                .status();
            if status.map(|s| s.success()).unwrap_or(false) {
                return Ok(());
            }
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Some(template) = windows_default_browser_command() {
            let path_str = path.to_string_lossy();
            let invocation = if template.contains("%1") {
                template.replace("%1", &format!("\"{path_str}\""))
            } else {
                format!("{template} \"{path_str}\"")
            };
            let status = Command::new("cmd").args(["/C", &invocation]).status();
            if status.map(|s| s.success()).unwrap_or(false) {
                return Ok(());
            }
        }
    }
    crate::explore::spawn_open(path, false)
}

#[tauri::command]
pub async fn artifact_mirror_open_root(workspace_slug: String) -> Result<(), ArtifactExportError> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = mirror_root(&home()?, &workspace_slug)?;
        std::fs::create_dir_all(&root)?;
        crate::explore::spawn_open(&root, false)?;
        Ok(())
    })
    .await
    .map_err(|error| destination(&error.to_string()))?
}

#[tauri::command]
pub async fn artifact_mirror_measure(
    entries: Vec<MirrorFolderRef>,
) -> Result<Vec<MirrorSize>, ArtifactExportError> {
    tauri::async_runtime::spawn_blocking(move || Ok(measure_mirrors(&home()?, &entries)))
        .await
        .map_err(|error| destination(&error.to_string()))?
}

#[tauri::command]
pub async fn artifact_mirror_remove(
    workspace_slug: String,
    folder: String,
) -> Result<bool, ArtifactExportError> {
    tauri::async_runtime::spawn_blocking(move || remove_mirror(&home()?, &workspace_slug, &folder))
        .await
        .map_err(|error| destination(&error.to_string()))?
}

#[tauri::command]
pub async fn artifact_mirror_write(
    workspace_slug: String,
    folder: String,
    files: Vec<FolderFile>,
) -> Result<String, ArtifactExportError> {
    tauri::async_runtime::spawn_blocking(move || {
        write_mirror(&home()?, &workspace_slug, &folder, &files)
            .map(|path| path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|error| destination(&error.to_string()))?
}

#[tauri::command]
pub async fn artifact_mirror_pending(
    entries: Vec<MirrorEntry>,
) -> Result<Vec<String>, ArtifactExportError> {
    tauri::async_runtime::spawn_blocking(move || Ok(pending_mirrors(&home()?, &entries)))
        .await
        .map_err(|error| destination(&error.to_string()))?
}

#[tauri::command]
pub async fn artifact_mirror_locate(
    workspace_slug: String,
    folder: String,
) -> Result<MirrorLocation, ArtifactExportError> {
    locate_mirror(&home()?, &workspace_slug, &folder)
}

pub(crate) fn mirror_file(
    home: &Path,
    workspace_slug: &str,
    folder: &str,
    file: &str,
) -> Result<PathBuf, ArtifactExportError> {
    let segments: Vec<&str> = file.split('/').collect();
    if segments.len() > 3 || !segments.iter().all(|segment| is_safe_segment(segment)) {
        return Err(destination(
            "the file is not a plain name inside the saved copy",
        ));
    }
    if !file.ends_with(".html") {
        return Err(destination("only pages open in the browser"));
    }
    let root = mirror_folder(home, workspace_slug, folder)?;
    let path = segments
        .iter()
        .fold(root, |path, segment| path.join(segment));
    if !path.is_file() {
        return Err(destination("the saved copy is not on disk yet"));
    }
    Ok(path)
}

#[tauri::command]
pub async fn artifact_mirror_open(
    workspace_slug: String,
    folder: String,
    file: String,
) -> Result<(), ArtifactExportError> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = mirror_file(&home()?, &workspace_slug, &folder, &file)?;
        open_with_browser(&path)?;
        Ok(())
    })
    .await
    .map_err(|error| destination(&error.to_string()))?
}

#[tauri::command]
pub async fn artifact_mirror_reveal(
    workspace_slug: String,
    folder: String,
) -> Result<(), ArtifactExportError> {
    let path = mirror_folder(&home()?, &workspace_slug, &folder)?;
    if !path.is_dir() {
        return Err(destination("the saved copy is not on disk yet"));
    }
    crate::explore::spawn_open(&path, true)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch_home() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-artifact-mirror-{}",
            crate::util::uuid_v4()
        ));
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    fn file(path: &str, contents: &str) -> FolderFile {
        FolderFile {
            path: path.to_string(),
            contents: contents.to_string(),
        }
    }

    fn meta(revision: i64, updated_at: &str) -> String {
        format!(
            "{{\"revision\":{revision},\"updatedAt\":\"{updated_at}\",\"rendererVersion\":\"1\"}}"
        )
    }

    fn entry(revision: i64, updated_at: &str) -> MirrorEntry {
        MirrorEntry {
            workspace_slug: "harborline".into(),
            folder: "report".into(),
            revision,
            updated_at: updated_at.into(),
            renderer_version: "1".into(),
        }
    }

    #[test]
    fn writes_under_the_workspace_mirror_root() {
        let home = scratch_home();
        let path = write_mirror(
            &home,
            "Harborline",
            "2026-09-25-rounding-drift-3f9a1c",
            &[file("index.html", "<p>x</p>"), file("meta.json", "{}")],
        )
        .expect("write");
        let expected = home
            .join(".goodboy")
            .join("workspaces")
            .join("harborline")
            .join(MIRROR_DIR)
            .join("2026-09-25-rounding-drift-3f9a1c");
        assert_eq!(path, expected);
        assert!(expected.join("index.html").is_file());
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn refuses_a_folder_that_climbs_out_of_the_root() {
        let home = scratch_home();
        assert!(write_mirror(&home, "harborline", "..", &[file("a.html", "x")]).is_err());
        assert!(write_mirror(&home, "harborline", "a/b", &[file("a.html", "x")]).is_err());
        assert!(locate_mirror(&home, "harborline", "../..").is_err());
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn prunes_screen_pages_a_new_revision_dropped() {
        let home = scratch_home();
        let first = [
            file("screens/a.html", "a"),
            file("screens/b.html", "b"),
            file("index.html", "i"),
        ];
        let root = write_mirror(&home, "harborline", "flow", &first).expect("first");
        let second = [file("screens/a.html", "a2"), file("index.html", "i2")];
        write_mirror(&home, "harborline", "flow", &second).expect("second");
        assert!(root.join("screens").join("a.html").is_file());
        assert!(!root.join("screens").join("b.html").exists());
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn reports_a_mirror_as_pending_until_its_meta_matches() {
        let home = scratch_home();
        let want = entry(2, "2026-09-25T10:00:00.000Z");
        assert_eq!(pending_mirrors(&home, &[want]), vec!["report".to_string()]);
        write_mirror(
            &home,
            "harborline",
            "report",
            &[file("meta.json", &meta(1, "2026-09-24T10:00:00.000Z"))],
        )
        .expect("old");
        let stale = entry(2, "2026-09-25T10:00:00.000Z");
        assert_eq!(pending_mirrors(&home, &[stale]).len(), 1);
        write_mirror(
            &home,
            "harborline",
            "report",
            &[file("meta.json", &meta(2, "2026-09-25T10:00:00.000Z"))],
        )
        .expect("new");
        let current = entry(2, "2026-09-25T10:00:00.000Z");
        assert!(pending_mirrors(&home, &[current]).is_empty());
        let located = locate_mirror(&home, "harborline", "report").expect("locate");
        assert!(located.exists);
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn reports_a_mirror_as_pending_when_only_the_renderer_version_moves() {
        let home = scratch_home();
        write_mirror(
            &home,
            "harborline",
            "report",
            &[file("meta.json", &meta(2, "2026-09-25T10:00:00.000Z"))],
        )
        .expect("write");
        let same = entry(2, "2026-09-25T10:00:00.000Z");
        assert!(pending_mirrors(&home, &[same]).is_empty());
        let newer_renderer = MirrorEntry {
            renderer_version: "2".into(),
            ..entry(2, "2026-09-25T10:00:00.000Z")
        };
        assert_eq!(
            pending_mirrors(&home, &[newer_renderer]),
            vec!["report".to_string()]
        );
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn measures_a_mirror_and_reports_a_missing_one_as_unknown() {
        let home = scratch_home();
        write_mirror(
            &home,
            "harborline",
            "report",
            &[file("index.html", &"x".repeat(9000))],
        )
        .expect("write");
        let sizes = measure_mirrors(
            &home,
            &[
                MirrorFolderRef {
                    workspace_slug: "harborline".into(),
                    folder: "report".into(),
                },
                MirrorFolderRef {
                    workspace_slug: "harborline".into(),
                    folder: "gone".into(),
                },
                MirrorFolderRef {
                    workspace_slug: "harborline".into(),
                    folder: "..".into(),
                },
            ],
        );
        assert!(sizes[0].size_bytes.unwrap_or(0) >= 9000);
        assert_eq!(sizes[1].size_bytes, None);
        assert_eq!(sizes[2].size_bytes, None);
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn keeps_the_first_folder_when_the_title_changes() {
        let home = scratch_home();
        let first = write_mirror(
            &home,
            "harborline",
            "2026-09-25-rounding-drift-3f9a1c",
            &[file("meta.json", &meta(1, "2026-09-25T10:00:00.000Z"))],
        )
        .expect("first");
        write_mirror(
            &home,
            "harborline",
            "2026-09-25-other-report-aaaaaa",
            &[file("meta.json", "{}")],
        )
        .expect("other");
        let renamed = "2026-09-25-settlement-rounding-3f9a1c";
        let second = write_mirror(
            &home,
            "harborline",
            renamed,
            &[file("meta.json", &meta(2, "2026-09-26T10:00:00.000Z"))],
        )
        .expect("second");
        assert_eq!(second, first);
        assert!(!first.with_file_name(renamed).exists());
        let renamed_entry = MirrorEntry {
            folder: renamed.into(),
            ..entry(2, "2026-09-26T10:00:00.000Z")
        };
        assert!(pending_mirrors(&home, &[renamed_entry]).is_empty());
        let located = locate_mirror(&home, "harborline", renamed).expect("locate");
        assert_eq!(located.path, first.to_string_lossy());
        assert!(remove_mirror(&home, "harborline", renamed).expect("remove"));
        assert!(!first.exists());
        assert!(first
            .with_file_name("2026-09-25-other-report-aaaaaa")
            .is_dir());
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn keeps_every_version_folder_and_drops_the_flat_layout() {
        let home = scratch_home();
        let flat = [
            file("index.html", "i"),
            file("screens/a.html", "a"),
            file("wireframe.css", "c"),
            file("wireframe.json", "{}"),
            file("meta.json", "{}"),
        ];
        let root = write_mirror(&home, "harborline", "flow", &flat).expect("flat");
        let versioned = [
            file("index.html", "versions"),
            file("v1/index.html", "i1"),
            file("v1/screens/a.html", "a1"),
            file("v1/screens/a--empty.html", "a1e"),
            file("v2/index.html", "i2"),
            file("v2/screens/a.html", "a2"),
            file("v2/wireframe.css", "c2"),
            file("wireframe.schema.json", "{}"),
            file("meta.json", "{}"),
        ];
        write_mirror(&home, "harborline", "flow", &versioned).expect("versioned");
        assert!(!root.join("screens").exists());
        assert!(!root.join("wireframe.css").exists());
        assert!(!root.join("wireframe.json").exists());
        assert!(root
            .join("v1")
            .join("screens")
            .join("a--empty.html")
            .is_file());
        let next = [
            file("index.html", "versions"),
            file("v2/index.html", "i2"),
            file("v2/screens/b.html", "b2"),
            file("meta.json", "{}"),
        ];
        write_mirror(&home, "harborline", "flow", &next).expect("next");
        assert!(root.join("v1").join("screens").join("a.html").is_file());
        assert!(!root.join("v2").join("screens").join("a.html").exists());
        assert!(root.join("v2").join("screens").join("b.html").is_file());
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn opens_only_pages_inside_the_saved_copy() {
        let home = scratch_home();
        write_mirror(
            &home,
            "harborline",
            "flow",
            &[
                file("index.html", "i"),
                file("screens/a.html", "a"),
                file("meta.json", "{}"),
            ],
        )
        .expect("write");
        assert!(mirror_file(&home, "harborline", "flow", "screens/a.html").is_ok());
        assert!(mirror_file(&home, "harborline", "flow", "index.html").is_ok());
        assert!(mirror_file(&home, "harborline", "flow", "meta.json").is_err());
        assert!(mirror_file(&home, "harborline", "flow", "../flow/index.html").is_err());
        assert!(mirror_file(&home, "harborline", "flow", "screens/missing.html").is_err());
        assert!(mirror_file(&home, "harborline", "..", "index.html").is_err());
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn removes_only_the_named_mirror_folder() {
        let home = scratch_home();
        let kept =
            write_mirror(&home, "harborline", "kept", &[file("meta.json", "{}")]).expect("kept");
        let gone =
            write_mirror(&home, "harborline", "gone", &[file("meta.json", "{}")]).expect("gone");
        assert!(remove_mirror(&home, "harborline", "gone").expect("remove"));
        assert!(!gone.exists());
        assert!(kept.is_dir());
        assert!(!remove_mirror(&home, "harborline", "gone").expect("again"));
        assert!(remove_mirror(&home, "harborline", "..").is_err());
        assert!(remove_mirror(&home, "harborline", "a/b").is_err());
        let _ = std::fs::remove_dir_all(home);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_default_browser_app_path_resolves_a_real_app_bundle() {
        let path = macos_default_browser_app_path().expect("Launch Services must resolve https");
        assert!(path.exists(), "resolved app bundle must exist: {path:?}");
        assert_eq!(
            path.extension().and_then(|ext| ext.to_str()),
            Some("app"),
            "resolved path must be an app bundle: {path:?}"
        );
    }
}
