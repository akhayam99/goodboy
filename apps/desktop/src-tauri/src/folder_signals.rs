use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use thiserror::Error;

pub(crate) const FOLDER_SIGNALS_ENTRY_CAP: u32 = 2_000;

pub(crate) const SKIPPED_FOLDERS: &[&str] = &[
    "node_modules",
    "target",
    "dist",
    "build",
    "out",
    "vendor",
    "Pods",
    "DerivedData",
    "__pycache__",
    "venv",
];

const MARKER_FILES: &[(&str, &str)] = &[
    ("package.json", "package.json"),
    ("Cargo.toml", "Cargo.toml"),
    ("pyproject.toml", "pyproject.toml"),
    ("go.mod", "go.mod"),
    ("Gemfile", "Gemfile"),
    ("pom.xml", "pom.xml"),
    ("Makefile", "Makefile"),
    ("makefile", "Makefile"),
    ("GNUmakefile", "Makefile"),
    ("build.gradle", "build.gradle"),
    ("build.gradle.kts", "build.gradle"),
    ("CMakeLists.txt", "CMakeLists.txt"),
    ("Package.swift", "Package.swift"),
    ("composer.json", "composer.json"),
];

const XCODE_MARKER: &str = "xcode";

const SOURCE_EXTENSIONS: &[&str] = &[
    "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rs", "go", "rb", "java", "kt", "kts", "swift",
    "c", "h", "cc", "cpp", "cxx", "hpp", "m", "mm", "cs", "php", "scala", "sh", "bash", "zsh",
    "lua", "dart", "ex", "exs", "erl", "hs", "ml", "clj", "vue", "svelte", "css", "scss", "sass",
    "less", "sql", "jl", "zig", "nim",
];

#[derive(Debug, Error)]
pub enum FolderSignalsError {
    #[error("not an absolute path: {0}")]
    InvalidPath(String),
    #[error("path does not exist: {0}")]
    NotFound(String),
    #[error("not a folder: {0}")]
    NotADirectory(String),
    #[error("permission denied: {0}")]
    PermissionDenied(String),
    #[error("couldn't read {0}")]
    Io(String),
}

crate::util::impl_error_serialize!(FolderSignalsError);

impl FolderSignalsError {
    fn kind(&self) -> &'static str {
        match self {
            FolderSignalsError::InvalidPath(_) => "invalid_path",
            FolderSignalsError::NotFound(_) => "not_found",
            FolderSignalsError::NotADirectory(_) => "not_a_directory",
            FolderSignalsError::PermissionDenied(_) => "permission_denied",
            FolderSignalsError::Io(_) => "io",
        }
    }
}

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderFileCounts {
    pub markdown: u32,
    pub text: u32,
    pub pdf: u32,
    pub word: u32,
    pub pages: u32,
    pub keynote: u32,
    pub numbers: u32,
    pub excel: u32,
    pub powerpoint: u32,
    pub image: u32,
    pub video: u32,
    pub audio: u32,
    pub source: u32,
    pub other: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FileKind {
    Markdown,
    Text,
    Pdf,
    Word,
    Pages,
    Keynote,
    Numbers,
    Excel,
    Powerpoint,
    Image,
    Video,
    Audio,
    Source,
    Other,
}

impl FolderFileCounts {
    fn add(&mut self, kind: FileKind) {
        let slot = match kind {
            FileKind::Markdown => &mut self.markdown,
            FileKind::Text => &mut self.text,
            FileKind::Pdf => &mut self.pdf,
            FileKind::Word => &mut self.word,
            FileKind::Pages => &mut self.pages,
            FileKind::Keynote => &mut self.keynote,
            FileKind::Numbers => &mut self.numbers,
            FileKind::Excel => &mut self.excel,
            FileKind::Powerpoint => &mut self.powerpoint,
            FileKind::Image => &mut self.image,
            FileKind::Video => &mut self.video,
            FileKind::Audio => &mut self.audio,
            FileKind::Source => &mut self.source,
            FileKind::Other => &mut self.other,
        };
        *slot += 1;
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSignals {
    pub path: String,
    pub markers: Vec<&'static str>,
    pub counts: FolderFileCounts,
    pub total_files: u32,
    pub total_bytes: u64,
    pub entries_read: u32,
    pub is_truncated: bool,
}

#[derive(Default)]
struct Scan {
    markers: Vec<&'static str>,
    counts: FolderFileCounts,
    total_files: u32,
    total_bytes: u64,
    entries_read: u32,
    is_truncated: bool,
}

impl Scan {
    fn is_full(&self) -> bool {
        self.is_truncated || self.entries_read >= FOLDER_SIGNALS_ENTRY_CAP
    }

    fn mark(&mut self, marker: &'static str) {
        if !self.markers.contains(&marker) {
            self.markers.push(marker);
        }
    }

    fn count_file(&mut self, kind: FileKind, bytes: u64) {
        self.counts.add(kind);
        self.total_files += 1;
        self.total_bytes = self.total_bytes.saturating_add(bytes);
    }
}

#[tauri::command]
pub async fn read_folder_signals(path: String) -> Result<FolderSignals, FolderSignalsError> {
    let fallback = path.clone();
    tauri::async_runtime::spawn_blocking(move || read_folder_signals_blocking(&path))
        .await
        .map_err(|_| FolderSignalsError::Io(fallback))?
}

pub(crate) fn read_folder_signals_blocking(
    path: &str,
) -> Result<FolderSignals, FolderSignalsError> {
    let trimmed = path.trim();
    let root = Path::new(trimmed);
    if !root.is_absolute() {
        return Err(FolderSignalsError::InvalidPath(trimmed.to_string()));
    }
    let metadata = fs::metadata(root).map_err(|error| access_error(&error, trimmed))?;
    if !metadata.is_dir() {
        return Err(FolderSignalsError::NotADirectory(trimmed.to_string()));
    }
    let entries = fs::read_dir(root).map_err(|error| access_error(&error, trimmed))?;
    let mut scan = Scan::default();
    let mut subfolders: Vec<PathBuf> = Vec::new();
    visit(&mut scan, entries, Some(&mut subfolders));
    for folder in subfolders {
        if scan.is_truncated {
            break;
        }
        let Ok(entries) = fs::read_dir(&folder) else {
            continue;
        };
        visit(&mut scan, entries, None);
    }
    scan.markers.sort_unstable();
    Ok(FolderSignals {
        path: trimmed.to_string(),
        markers: scan.markers,
        counts: scan.counts,
        total_files: scan.total_files,
        total_bytes: scan.total_bytes,
        entries_read: scan.entries_read,
        is_truncated: scan.is_truncated,
    })
}

fn access_error(error: &std::io::Error, path: &str) -> FolderSignalsError {
    match error.kind() {
        std::io::ErrorKind::NotFound => FolderSignalsError::NotFound(path.to_string()),
        std::io::ErrorKind::PermissionDenied => {
            FolderSignalsError::PermissionDenied(path.to_string())
        }
        std::io::ErrorKind::NotADirectory => FolderSignalsError::NotADirectory(path.to_string()),
        _ => FolderSignalsError::Io(path.to_string()),
    }
}

fn visit(scan: &mut Scan, entries: fs::ReadDir, mut subfolders: Option<&mut Vec<PathBuf>>) {
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }
        if scan.is_full() {
            scan.is_truncated = true;
            return;
        }
        scan.entries_read += 1;
        if file_type.is_dir() {
            visit_folder(scan, &entry.path(), &name, subfolders.as_deref_mut());
            continue;
        }
        if !file_type.is_file() {
            continue;
        }
        if let Some(marker) = marker_of(&name) {
            scan.mark(marker);
        }
        let bytes = entry.metadata().map(|found| found.len()).unwrap_or(0);
        scan.count_file(kind_of(&extension_of(&name)), bytes);
    }
}

fn visit_folder(scan: &mut Scan, path: &Path, name: &str, subfolders: Option<&mut Vec<PathBuf>>) {
    let extension = extension_of(name);
    if extension == "xcodeproj" || extension == "xcworkspace" {
        scan.mark(XCODE_MARKER);
        return;
    }
    if let Some(kind) = bundle_kind(&extension) {
        scan.count_file(kind, 0);
        return;
    }
    if SKIPPED_FOLDERS.contains(&name) {
        return;
    }
    if let Some(list) = subfolders {
        list.push(path.to_path_buf());
    }
}

fn extension_of(name: &str) -> String {
    Path::new(name)
        .extension()
        .map(|found| found.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default()
}

fn marker_of(name: &str) -> Option<&'static str> {
    MARKER_FILES
        .iter()
        .find(|(file, _)| *file == name)
        .map(|(_, marker)| *marker)
}

fn bundle_kind(extension: &str) -> Option<FileKind> {
    match extension {
        "pages" => Some(FileKind::Pages),
        "key" => Some(FileKind::Keynote),
        "numbers" => Some(FileKind::Numbers),
        "app" | "bundle" | "framework" | "photoslibrary" => Some(FileKind::Other),
        _ => None,
    }
}

fn kind_of(extension: &str) -> FileKind {
    if let Some(kind) = bundle_kind(extension) {
        return kind;
    }
    if SOURCE_EXTENSIONS.contains(&extension) {
        return FileKind::Source;
    }
    match extension {
        "md" | "markdown" | "mdx" => FileKind::Markdown,
        "txt" | "rtf" | "rst" | "org" | "tex" | "csv" | "tsv" => FileKind::Text,
        "pdf" => FileKind::Pdf,
        "doc" | "docx" | "odt" => FileKind::Word,
        "xls" | "xlsx" | "ods" => FileKind::Excel,
        "ppt" | "pptx" | "odp" => FileKind::Powerpoint,
        "png" | "jpg" | "jpeg" | "gif" | "heic" | "webp" | "tif" | "tiff" | "bmp" | "svg" => {
            FileKind::Image
        }
        "mp4" | "mov" | "m4v" | "avi" | "mkv" | "webm" => FileKind::Video,
        "mp3" | "wav" | "m4a" | "aac" | "flac" | "ogg" | "aif" | "aiff" => FileKind::Audio,
        _ => FileKind::Other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "goodboy-folder-signals-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn write(root: &Path, relative: &str, body: &str) {
        let path = root.join(relative);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, body).unwrap();
    }

    fn read(root: &Path) -> FolderSignals {
        read_folder_signals_blocking(&root.to_string_lossy()).unwrap()
    }

    #[test]
    fn finds_code_markers_and_source_files_two_levels_down() {
        let root = temp_root("code");
        write(&root, "package.json", "{}");
        write(&root, "Makefile", "all:");
        write(&root, "src/index.ts", "export {}");
        write(&root, "src/app.tsx", "export {}");
        write(&root, "server/Cargo.toml", "[package]");
        write(&root, "src/deep/hidden.ts", "export {}");
        write(&root, "README.md", "# Acme web");
        fs::create_dir_all(root.join("AcmeApp.xcodeproj/project.xcworkspace")).unwrap();
        write(&root, "node_modules/left-pad/index.js", "");
        write(&root, ".git/HEAD", "ref: refs/heads/main");

        let signals = read(&root);

        assert_eq!(
            signals.markers,
            vec!["Cargo.toml", "Makefile", "package.json", "xcode"]
        );
        assert_eq!(signals.counts.source, 2);
        assert_eq!(signals.counts.markdown, 1);
        assert!(!signals.is_truncated);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn counts_document_kinds_and_their_size() {
        let root = temp_root("documents");
        write(&root, "launch-memo.md", "# Launch");
        write(&root, "interviews/northwind.md", "notes");
        write(&root, "interviews/cascadia.txt", "notes");
        write(&root, "contracts/acme.pdf", "%PDF");
        write(&root, "contracts/acme.docx", "doc");
        write(&root, "budget.xlsx", "x");
        write(&root, "photos/team.jpg", "jpg");
        write(&root, "photos/demo.mov", "mov");
        fs::create_dir_all(root.join("Roadmap.key")).unwrap();
        fs::create_dir_all(root.join("Brief.pages")).unwrap();

        let signals = read(&root);

        assert!(signals.markers.is_empty());
        assert_eq!(signals.counts.markdown, 2);
        assert_eq!(signals.counts.text, 1);
        assert_eq!(signals.counts.pdf, 1);
        assert_eq!(signals.counts.word, 1);
        assert_eq!(signals.counts.excel, 1);
        assert_eq!(signals.counts.image, 1);
        assert_eq!(signals.counts.video, 1);
        assert_eq!(signals.counts.keynote, 1);
        assert_eq!(signals.counts.pages, 1);
        assert_eq!(signals.counts.source, 0);
        assert_eq!(signals.total_files, 10);
        let bytes: u64 = [
            "# Launch", "notes", "notes", "%PDF", "doc", "x", "jpg", "mov",
        ]
        .iter()
        .map(|body| body.len() as u64)
        .sum();
        assert_eq!(signals.total_bytes, bytes);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn an_empty_folder_reads_as_nothing() {
        let root = temp_root("empty");
        write(&root, ".DS_Store", "");
        fs::create_dir_all(root.join("drafts")).unwrap();

        let signals = read(&root);

        assert!(signals.markers.is_empty());
        assert_eq!(signals.total_files, 0);
        assert_eq!(signals.counts, FolderFileCounts::default());
        assert_eq!(signals.entries_read, 1);
        assert!(!signals.is_truncated);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn stops_at_the_entry_cap_and_says_so() {
        let root = temp_root("cap");
        for index in 0..(FOLDER_SIGNALS_ENTRY_CAP + 50) {
            write(&root, &format!("note-{index}.md"), "");
        }
        write(&root, "later/package.json", "{}");

        let signals = read(&root);

        assert_eq!(signals.entries_read, FOLDER_SIGNALS_ENTRY_CAP);
        assert!(signals.is_truncated);
        assert!(signals.markers.is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn an_exact_fill_is_not_truncated() {
        let root = temp_root("exact");
        for index in 0..FOLDER_SIGNALS_ENTRY_CAP {
            write(&root, &format!("note-{index}.md"), "");
        }

        let signals = read(&root);

        assert_eq!(signals.entries_read, FOLDER_SIGNALS_ENTRY_CAP);
        assert!(!signals.is_truncated);
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn never_follows_a_link_out_of_the_folder() {
        let root = temp_root("link");
        let outside = temp_root("link-outside");
        write(&outside, "package.json", "{}");
        write(&outside, "main.rs", "fn main() {}");
        std::os::unix::fs::symlink(&outside, root.join("elsewhere")).unwrap();
        std::os::unix::fs::symlink(outside.join("main.rs"), root.join("main.rs")).unwrap();

        let signals = read(&root);

        assert!(signals.markers.is_empty());
        assert_eq!(signals.total_files, 0);
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn says_why_a_folder_cannot_be_read() {
        let root = temp_root("errors");
        write(&root, "notes.md", "");

        let missing = read_folder_signals_blocking(&root.join("gone").to_string_lossy());
        let file = read_folder_signals_blocking(&root.join("notes.md").to_string_lossy());
        let relative = read_folder_signals_blocking("acme-notes");

        assert_eq!(missing.unwrap_err().kind(), "not_found");
        assert_eq!(file.unwrap_err().kind(), "not_a_directory");
        assert_eq!(relative.unwrap_err().kind(), "invalid_path");
        fs::remove_dir_all(root).unwrap();
    }
}
