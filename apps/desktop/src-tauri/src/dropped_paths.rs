use std::path::{Path, PathBuf};
use std::sync::Mutex;

const MAX_RECORDED_PATHS: usize = 512;

#[derive(Default)]
pub(crate) struct DroppedPaths(Mutex<Vec<PathBuf>>);

impl DroppedPaths {
    pub(crate) fn record(&self, paths: &[PathBuf]) {
        let Ok(mut recorded) = self.0.lock() else {
            return;
        };
        if recorded.len() + paths.len() > MAX_RECORDED_PATHS {
            recorded.clear();
        }
        recorded.extend(paths.iter().take(MAX_RECORDED_PATHS).cloned());
    }

    pub(crate) fn record_window_event(&self, event: &tauri::WindowEvent) {
        let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event else {
            return;
        };
        self.record(paths);
    }

    pub(crate) fn take(&self, path: &Path) -> bool {
        let Ok(mut recorded) = self.0.lock() else {
            return false;
        };
        let Some(index) = recorded.iter().position(|candidate| candidate == path) else {
            return false;
        };
        recorded.swap_remove(index);
        true
    }
}

#[cfg(test)]
mod tests {
    use super::{DroppedPaths, MAX_RECORDED_PATHS};
    use std::path::{Path, PathBuf};

    #[test]
    fn accepts_a_recorded_path_exactly_once() {
        let drops = DroppedPaths::default();
        drops.record(&[PathBuf::from("/tmp/harborline/brief.pdf")]);
        assert!(drops.take(Path::new("/tmp/harborline/brief.pdf")));
        assert!(!drops.take(Path::new("/tmp/harborline/brief.pdf")));
    }

    #[test]
    fn refuses_a_path_that_was_never_recorded() {
        let drops = DroppedPaths::default();
        drops.record(&[PathBuf::from("/tmp/harborline/brief.pdf")]);
        assert!(!drops.take(Path::new("/tmp/harborline/other.pdf")));
        assert!(drops.take(Path::new("/tmp/harborline/brief.pdf")));
    }

    #[test]
    fn records_the_paths_a_window_drop_reports() {
        let drops = DroppedPaths::default();
        drops.record_window_event(&tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop {
            paths: vec![PathBuf::from("/tmp/harborline/screen shot@2x.png")],
            position: tauri::PhysicalPosition::new(10.0, 20.0),
        }));
        assert!(drops.take(Path::new("/tmp/harborline/screen shot@2x.png")));
    }

    #[test]
    fn ignores_a_window_drag_that_did_not_drop() {
        let drops = DroppedPaths::default();
        drops.record_window_event(&tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Enter {
            paths: vec![PathBuf::from("/tmp/harborline/brief.pdf")],
            position: tauri::PhysicalPosition::new(10.0, 20.0),
        }));
        assert!(!drops.take(Path::new("/tmp/harborline/brief.pdf")));
    }

    #[test]
    fn keeps_the_record_bounded() {
        let drops = DroppedPaths::default();
        for index in 0..(MAX_RECORDED_PATHS + 10) {
            drops.record(&[PathBuf::from(format!("/tmp/northwind/{index}.txt"))]);
        }
        assert!(drops.take(Path::new(&format!(
            "/tmp/northwind/{}.txt",
            MAX_RECORDED_PATHS + 9
        ))));
        assert!(!drops.take(Path::new("/tmp/northwind/0.txt")));
    }
}
