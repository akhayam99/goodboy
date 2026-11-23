use std::collections::VecDeque;
use std::fs::{self, File};
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const MAX_RECORDED_PATHS: usize = 64;

struct DroppedFile {
    path: PathBuf,
    held: io::Result<File>,
}

#[derive(Default)]
pub(crate) struct DroppedPaths(Mutex<VecDeque<DroppedFile>>);

fn open_regular_file(path: &Path) -> io::Result<File> {
    if !fs::metadata(path)?.is_file() {
        return Err(io::Error::from(io::ErrorKind::InvalidInput));
    }
    File::open(path)
}

impl DroppedPaths {
    pub(crate) fn record(&self, paths: &[PathBuf]) {
        let Ok(mut recorded) = self.0.lock() else {
            return;
        };
        for path in paths.iter().take(MAX_RECORDED_PATHS) {
            let held = open_regular_file(path);
            recorded.push_back(DroppedFile {
                path: path.clone(),
                held,
            });
            if recorded.len() > MAX_RECORDED_PATHS {
                recorded.pop_front();
            }
        }
    }

    pub(crate) fn record_window_event(&self, event: &tauri::WindowEvent) {
        let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event else {
            return;
        };
        self.record(paths);
    }

    pub(crate) fn record_webview_event(&self, event: &tauri::WebviewEvent) {
        let tauri::WebviewEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event else {
            return;
        };
        self.record(paths);
    }

    pub(crate) fn take(&self, path: &Path) -> Option<io::Result<File>> {
        let mut recorded = self.0.lock().ok()?;
        let index = recorded
            .iter()
            .rposition(|candidate| candidate.path == path)?;
        let dropped = recorded.remove(index)?;
        Some(dropped.held.or_else(|_| open_regular_file(path)))
    }
}

#[cfg(test)]
mod tests {
    use super::{DroppedPaths, MAX_RECORDED_PATHS};
    use std::fs;
    use std::io::{ErrorKind, Read};
    use std::path::{Path, PathBuf};

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-dropped-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn contents(drops: &DroppedPaths, path: &Path) -> Vec<u8> {
        let mut file = drops.take(path).expect("recorded").expect("readable");
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes).unwrap();
        bytes
    }

    #[test]
    fn accepts_a_recorded_path_exactly_once() {
        let drops = DroppedPaths::default();
        drops.record(&[PathBuf::from("/tmp/harborline/brief.pdf")]);
        assert!(drops.take(Path::new("/tmp/harborline/brief.pdf")).is_some());
        assert!(drops.take(Path::new("/tmp/harborline/brief.pdf")).is_none());
    }

    #[test]
    fn refuses_a_path_that_was_never_recorded() {
        let drops = DroppedPaths::default();
        drops.record(&[PathBuf::from("/tmp/harborline/brief.pdf")]);
        assert!(drops.take(Path::new("/tmp/harborline/other.pdf")).is_none());
        assert!(drops.take(Path::new("/tmp/harborline/brief.pdf")).is_some());
    }

    #[test]
    fn records_the_paths_a_window_drop_reports() {
        let drops = DroppedPaths::default();
        drops.record_window_event(&tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop {
            paths: vec![PathBuf::from("/tmp/harborline/screen shot@2x.png")],
            position: tauri::PhysicalPosition::new(10.0, 20.0),
        }));
        assert!(drops
            .take(Path::new("/tmp/harborline/screen shot@2x.png"))
            .is_some());
    }

    #[test]
    fn records_the_paths_a_child_webview_drop_reports() {
        let drops = DroppedPaths::default();
        drops.record_webview_event(&tauri::WebviewEvent::DragDrop(tauri::DragDropEvent::Drop {
            paths: vec![PathBuf::from("/tmp/northwind/board.png")],
            position: tauri::PhysicalPosition::new(10.0, 20.0),
        }));
        assert!(drops.take(Path::new("/tmp/northwind/board.png")).is_some());
    }

    #[test]
    fn ignores_a_window_drag_that_did_not_drop() {
        let drops = DroppedPaths::default();
        drops.record_window_event(&tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Enter {
            paths: vec![PathBuf::from("/tmp/harborline/brief.pdf")],
            position: tauri::PhysicalPosition::new(10.0, 20.0),
        }));
        assert!(drops.take(Path::new("/tmp/harborline/brief.pdf")).is_none());
    }

    #[test]
    fn ignores_a_child_webview_drag_that_did_not_drop() {
        let drops = DroppedPaths::default();
        drops.record_webview_event(&tauri::WebviewEvent::DragDrop(
            tauri::DragDropEvent::Enter {
                paths: vec![PathBuf::from("/tmp/northwind/board.png")],
                position: tauri::PhysicalPosition::new(10.0, 20.0),
            },
        ));
        assert!(drops.take(Path::new("/tmp/northwind/board.png")).is_none());
    }

    #[test]
    fn keeps_the_record_bounded() {
        let drops = DroppedPaths::default();
        for index in 0..(MAX_RECORDED_PATHS + 10) {
            drops.record(&[PathBuf::from(format!("/tmp/northwind/{index}.txt"))]);
        }
        assert!(drops
            .take(Path::new(&format!(
                "/tmp/northwind/{}.txt",
                MAX_RECORDED_PATHS + 9
            )))
            .is_some());
        assert!(drops.take(Path::new("/tmp/northwind/0.txt")).is_none());
    }

    #[test]
    fn keeps_the_bytes_of_a_file_deleted_right_after_the_drop() {
        let dir = scratch("unlinked");
        let shot = dir.join("ledger-core shot.png");
        fs::write(&shot, b"pixels").unwrap();
        let drops = DroppedPaths::default();
        drops.record(std::slice::from_ref(&shot));
        fs::remove_file(&shot).unwrap();
        assert_eq!(contents(&drops, &shot), b"pixels");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn keeps_the_bytes_of_a_file_moved_right_after_the_drop() {
        let dir = scratch("moved");
        let shot = dir.join("shot.png");
        fs::write(&shot, b"pixels").unwrap();
        let drops = DroppedPaths::default();
        drops.record(std::slice::from_ref(&shot));
        fs::rename(&shot, dir.join("kept.png")).unwrap();
        assert_eq!(contents(&drops, &shot), b"pixels");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn retries_the_open_when_the_file_arrives_after_the_drop() {
        let dir = scratch("late");
        let shot = dir.join("late.png");
        let drops = DroppedPaths::default();
        drops.record(std::slice::from_ref(&shot));
        fs::write(&shot, b"late pixels").unwrap();
        assert_eq!(contents(&drops, &shot), b"late pixels");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn reports_a_file_that_was_gone_at_the_drop_and_at_the_read() {
        let dir = scratch("gone");
        let shot = dir.join("gone.png");
        let drops = DroppedPaths::default();
        drops.record(std::slice::from_ref(&shot));
        let error = drops.take(&shot).expect("recorded").unwrap_err();
        assert_eq!(error.kind(), ErrorKind::NotFound);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn never_opens_a_folder() {
        let dir = scratch("folder");
        let drops = DroppedPaths::default();
        drops.record(std::slice::from_ref(&dir));
        let error = drops.take(&dir).expect("recorded").unwrap_err();
        assert_eq!(error.kind(), ErrorKind::InvalidInput);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn claims_the_latest_drop_of_a_path_dropped_twice() {
        let dir = scratch("twice");
        let shot = dir.join("shot.png");
        let drops = DroppedPaths::default();
        drops.record(std::slice::from_ref(&shot));
        fs::write(&shot, b"second").unwrap();
        drops.record(std::slice::from_ref(&shot));
        fs::remove_file(&shot).unwrap();
        assert_eq!(contents(&drops, &shot), b"second");
        assert!(drops.take(&shot).is_some());
        let _ = fs::remove_dir_all(&dir);
    }
}
