use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;

static STAGED: AtomicU64 = AtomicU64::new(0);
static SHARED: OnceLock<PathBuf> = OnceLock::new();

fn shared_copy() -> &'static Path {
    SHARED.get_or_init(|| {
        let root =
            std::env::temp_dir().join(format!("goodboy-fake-cli-shared-{}", std::process::id()));
        let source = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/fake-cli");
        copy_tree(&source, &root);
        root
    })
}

pub(crate) struct FakeCli {
    root: PathBuf,
}

impl FakeCli {
    pub(crate) fn stage(mode: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "goodboy-fake-cli-{}-{}",
            std::process::id(),
            STAGED.fetch_add(1, Ordering::Relaxed)
        ));
        let bin = root.join("bin");
        std::fs::create_dir_all(&bin).expect("create the bin dir");
        for entry in std::fs::read_dir(shared_copy()).expect("read the shared copy") {
            let entry = entry.expect("read a shared entry");
            std::os::unix::fs::symlink(entry.path(), bin.join(entry.file_name()))
                .expect("link a fixture");
        }
        std::fs::create_dir_all(root.join("work")).expect("create the work dir");
        std::fs::write(root.join("bin/mode"), mode).expect("write the mode file");
        Self { root }
    }

    pub(crate) fn binary(&self, name: &str) -> String {
        self.root
            .join("bin")
            .join(name)
            .to_string_lossy()
            .into_owned()
    }

    pub(crate) fn work_dir(&self) -> String {
        self.root.join("work").to_string_lossy().into_owned()
    }

    pub(crate) fn work_file(&self, name: &str) -> Option<String> {
        std::fs::read_to_string(self.root.join("work").join(name)).ok()
    }

    pub(crate) fn stream_lines(name: &str) -> Vec<String> {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/fake-cli/streams")
            .join(name);
        std::fs::read_to_string(path)
            .expect("read a recorded stream")
            .lines()
            .map(str::to_string)
            .collect()
    }
}

impl Drop for FakeCli {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn copy_tree(from: &Path, to: &Path) {
    std::fs::create_dir_all(to).expect("create a fixture dir");
    for entry in std::fs::read_dir(from).expect("read the fixture dir") {
        let entry = entry.expect("read a fixture entry");
        let target = to.join(entry.file_name());
        if entry.file_type().expect("read a fixture type").is_dir() {
            copy_tree(&entry.path(), &target);
            continue;
        }
        std::fs::copy(entry.path(), target).expect("copy a fixture file");
    }
}
