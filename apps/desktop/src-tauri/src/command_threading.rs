use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

const IN_MEMORY_SYNC_COMMANDS: &[&str] = &[
    "db.rs::db_path",
    "frame_protocol.rs::frame_release",
    "frame_protocol.rs::frame_stage",
    "provider_lifecycle.rs::provider_lifecycle_resize",
    "provider_lifecycle.rs::provider_lifecycle_write",
    "qa_preview.rs::qa_deciding_workflow_runs",
    "query_bridge/mod.rs::query_bridge_serving",
    "query_bridge/mount.rs::mount_command_result",
    "query_bridge/project.rs::project_materialize_result",
    "restart_marker.rs::restart_abort",
    "scroller_style.rs::system_scroller_style",
    "summarize.rs::summarize_cancel",
    "terminal.rs::terminal_resize",
    "terminal.rs::terminal_write",
    "worktree_writer.rs::worktree_writer_abandon",
    "worktree_writer.rs::worktree_writer_acquire",
    "worktree_writer.rs::worktree_writer_cancel",
    "worktree_writer.rs::worktree_writer_release",
    "worktree_writer.rs::worktree_writer_status",
];

fn rust_files(dir: &Path, out: &mut Vec<std::path::PathBuf>) {
    let mut entries: Vec<_> = fs::read_dir(dir)
        .expect("read src dir")
        .map(|entry| entry.expect("dir entry").path())
        .collect();
    entries.sort();
    for path in entries {
        if path.is_dir() {
            rust_files(&path, out);
        } else if path.extension().is_some_and(|ext| ext == "rs") {
            out.push(path);
        }
    }
}

fn fn_name(signature: &str) -> Option<&str> {
    let rest = signature.split("fn ").nth(1)?;
    rest.split(['(', '<']).next()
}

fn sync_main_thread_commands(source: &str, file: &str) -> Vec<String> {
    let lines: Vec<&str> = source.lines().collect();
    let mut found = Vec::new();
    for (index, line) in lines.iter().enumerate() {
        let attribute = line.trim_start();
        if !attribute.starts_with("#[tauri::command") || attribute.contains("(async)") {
            continue;
        }
        let Some(signature) = lines[index + 1..].iter().find(|next| next.contains("fn ")) else {
            continue;
        };
        if signature.contains("async fn") {
            continue;
        }
        if let Some(name) = fn_name(signature) {
            found.push(format!("{file}::{name}"));
        }
    }
    found
}

fn scan_sync_commands() -> BTreeSet<String> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut files = Vec::new();
    rust_files(&root, &mut files);
    let mut sync = BTreeSet::new();
    for path in files {
        let relative = path
            .strip_prefix(&root)
            .expect("under src")
            .to_string_lossy()
            .replace('\\', "/");
        if relative == "command_threading.rs" {
            continue;
        }
        let source = fs::read_to_string(&path).expect("read source");
        sync.extend(sync_main_thread_commands(&source, &relative));
    }
    sync
}

#[test]
fn only_in_memory_commands_run_synchronously_on_the_main_thread() {
    let sync = scan_sync_commands();
    let allowed: BTreeSet<String> = IN_MEMORY_SYNC_COMMANDS
        .iter()
        .map(|entry| entry.to_string())
        .collect();
    let unexpected: Vec<_> = sync.difference(&allowed).collect();
    assert!(
        unexpected.is_empty(),
        "sync #[tauri::command] fns run on the main thread; make these async with spawn_blocking or add them to IN_MEMORY_SYNC_COMMANDS if they are in-memory only: {unexpected:?}"
    );
    let stale: Vec<_> = allowed.difference(&sync).collect();
    assert!(
        stale.is_empty(),
        "these entries are no longer sync commands, remove them from IN_MEMORY_SYNC_COMMANDS: {stale:?}"
    );
}

#[test]
fn the_scan_tells_sync_commands_from_async_ones() {
    let source = "#[tauri::command]\npub fn quick(a: u8) {}\n\n#[tauri::command(async)]\npub fn attr_async() {}\n\n#[tauri::command]\npub async fn slow() {}\n\n#[tauri::command]\npub fn multi_line(\n    a: u8,\n) {}\n";
    assert_eq!(
        sync_main_thread_commands(source, "x.rs"),
        vec!["x.rs::quick".to_string(), "x.rs::multi_line".to_string()]
    );
}
