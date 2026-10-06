use std::io;
use std::path::{Path, PathBuf};

const NODE_MODULES: &str = "node_modules";

const MAX_DEPTH: usize = 3;

const SKIPPED_DIRS: [&str; 3] = ["target", "dist", "build"];

fn make_link(target: &Path, link: &Path) -> io::Result<()> {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(target, link)
    }
    #[cfg(windows)]
    {
        let source = if target.is_absolute() {
            target.to_path_buf()
        } else {
            link.parent().unwrap_or(link).join(target)
        };
        if source.is_dir() {
            std::os::windows::fs::symlink_dir(target, link)
        } else {
            std::os::windows::fs::symlink_file(target, link)
        }
    }
}

fn node_modules_dirs(main: &Path, dir: &Path, depth: usize, found: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if !kind.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name == NODE_MODULES {
            if let Ok(relative) = entry.path().strip_prefix(main) {
                found.push(relative.to_path_buf());
            }
            continue;
        }
        if depth >= MAX_DEPTH || name.starts_with('.') || SKIPPED_DIRS.contains(&name.as_str()) {
            continue;
        }
        node_modules_dirs(main, &entry.path(), depth + 1, found);
    }
}

fn mirror(source: &Path, mirror_dir: &Path) -> io::Result<()> {
    std::fs::create_dir(mirror_dir)?;
    for entry in std::fs::read_dir(source)?.flatten() {
        let link = mirror_dir.join(entry.file_name());
        let kind = entry.file_type()?;
        if kind.is_symlink() {
            make_link(&std::fs::read_link(entry.path())?, &link)?;
            continue;
        }
        if kind.is_dir() && entry.file_name().to_string_lossy().starts_with('@') {
            mirror(&entry.path(), &link)?;
            continue;
        }
        make_link(&entry.path(), &link)?;
    }
    Ok(())
}

pub(super) fn link_dependencies(main: &Path, copy: &Path) {
    let Ok(main) = std::fs::canonicalize(main) else {
        return;
    };
    let mut found = Vec::new();
    node_modules_dirs(&main, &main, 0, &mut found);
    for relative in found {
        let target = copy.join(&relative);
        let parent_is_dir = target.parent().is_some_and(Path::is_dir);
        if !parent_is_dir || target.symlink_metadata().is_ok() {
            continue;
        }
        crate::logging::note_failure(
            "copy dependency link",
            mirror(&main.join(&relative), &target),
        );
    }
}
