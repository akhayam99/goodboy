use std::cell::Cell;
use std::collections::HashSet;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

use super::{
    encode_claude_project, scan_other_tools, OtherToolId, OtherToolUsage, OtherToolsRequest,
    OtherToolsScan, ToolRoots,
};

fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-other-tools-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&root).unwrap();
    root
}

fn write(path: &Path, bytes: usize) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, vec![b'x'; bytes]).unwrap();
}

fn never() -> bool {
    false
}

fn roots(home: &Path) -> ToolRoots {
    ToolRoots {
        claude: Some(home.join(".claude")),
        codex: Some(home.join(".codex")),
        cursor: Some(home.join(".cursor")),
        goodboy: Some(home.join(".goodboy")),
        home: Some(home.to_path_buf()),
    }
}

fn tools(scan: OtherToolsScan) -> Vec<OtherToolUsage> {
    match scan {
        OtherToolsScan::Ready { tools } => tools,
        OtherToolsScan::Cancelled => panic!("the scan was cancelled"),
    }
}

fn tool(all: &[OtherToolUsage], id: OtherToolId) -> &OtherToolUsage {
    all.iter()
        .find(|tool| tool.id == id)
        .expect("tool measured")
}

#[test]
fn claude_counts_sessions_and_matches_goodboy_folders_by_their_encoded_path() {
    let home = temp_root("claude");
    let repo_worktree = Path::new("/repos/ledger-core/.goodboy/worktrees/har-212-refund-retry");
    let scratch = home.join(".goodboy").join("scratch").join("session-1");
    let projects = home.join(".claude").join("projects");
    write(
        &projects
            .join(encode_claude_project(repo_worktree))
            .join("a.jsonl"),
        300,
    );
    write(
        &projects
            .join(encode_claude_project(&scratch))
            .join("b.jsonl"),
        200,
    );
    write(&projects.join("-repos-ledger-core").join("c.jsonl"), 1_000);
    write(&projects.join("-repos-ledger-core").join("notes.txt"), 7);
    write(&home.join(".claude").join("history.jsonl"), 50);

    let all = tools(scan_other_tools(
        &roots(&home),
        &OtherToolsRequest::default(),
        &never,
    ));
    let claude = tool(&all, OtherToolId::ClaudeCode);

    assert_eq!(claude.display_path, "~/.claude");
    assert_eq!(claude.path, home.join(".claude").to_string_lossy());
    assert_eq!(claude.bytes, 1_557);
    assert_eq!(claude.sessions, 3);
    assert_eq!(claude.goodboy_bytes, 500);
    fs::remove_dir_all(home).ok();
}

#[test]
fn codex_and_cursor_count_goodboy_sessions_by_their_ids_in_file_names() {
    let home = temp_root("ids");
    let ours = "019fe249-3eed-7113-b53f-092b9c96a11b";
    let theirs = "019fdeb5-bef5-73c3-9ba2-f5b351e6b05d";
    let day = home
        .join(".codex")
        .join("sessions")
        .join("2026")
        .join("09")
        .join("14");
    write(
        &day.join(format!("rollout-2026-09-14T10-00-00-{ours}.jsonl")),
        400,
    );
    write(
        &day.join(format!("rollout-2026-09-14T11-00-00-{theirs}.jsonl")),
        600,
    );
    write(&home.join(".codex").join("config.toml"), 10);
    let chats = home
        .join(".cursor")
        .join("chats")
        .join("315948f0d057d722e4ee8cf44cd9b63d");
    write(
        &chats
            .join("e2dc3122-2988-405d-a4a9-b518ab49475e")
            .join("store.db"),
        900,
    );
    write(
        &chats
            .join("d898edb5-701d-43a8-adbe-422726dc60fa")
            .join("store.db"),
        100,
    );
    let request = OtherToolsRequest {
        codex_thread_ids: vec![ours.to_string()],
        cursor_chat_ids: vec!["e2dc3122-2988-405d-a4a9-b518ab49475e".to_string()],
    };

    let all = tools(scan_other_tools(&roots(&home), &request, &never));
    let codex = tool(&all, OtherToolId::Codex);
    let cursor = tool(&all, OtherToolId::Cursor);

    assert_eq!(
        (codex.bytes, codex.sessions, codex.goodboy_bytes),
        (1_010, 2, 400)
    );
    assert_eq!(
        (cursor.bytes, cursor.sessions, cursor.goodboy_bytes),
        (1_000, 2, 900)
    );
    assert!(all.iter().all(|tool| tool.id != OtherToolId::ClaudeCode));
    fs::remove_dir_all(home).ok();
}

#[test]
fn five_thousand_unreadable_files_are_measured_from_metadata_alone() {
    let home = temp_root("unreadable");
    let project = home
        .join(".claude")
        .join("projects")
        .join("-repos-payments-api");
    fs::create_dir_all(&project).unwrap();
    for index in 0..5_000 {
        let path = project.join(format!("session-{index}.jsonl"));
        fs::write(&path, b"x").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o000)).unwrap();
    }

    let all = tools(scan_other_tools(
        &roots(&home),
        &OtherToolsRequest::default(),
        &never,
    ));
    let claude = tool(&all, OtherToolId::ClaudeCode);

    assert_eq!(claude.sessions, 5_000);
    assert_eq!(claude.bytes, 5_000);
    assert!(fs::read(project.join("session-0.jsonl")).is_err());
    fs::remove_dir_all(home).ok();
}

#[test]
fn a_cancelled_scan_stops_and_says_so() {
    let home = temp_root("cancel");
    let projects = home.join(".claude").join("projects");
    for index in 0..50 {
        write(
            &projects.join(format!("-repos-p{index}")).join("a.jsonl"),
            10,
        );
    }
    let checks = Cell::new(0_u32);
    let is_cancelled = || {
        checks.set(checks.get() + 1);
        checks.get() > 5
    };

    let scan = scan_other_tools(&roots(&home), &OtherToolsRequest::default(), &is_cancelled);

    assert_eq!(scan, OtherToolsScan::Cancelled);
    assert!(checks.get() < 10);
    fs::remove_dir_all(home).ok();
}

#[test]
fn tools_that_are_not_installed_are_left_out() {
    let home = temp_root("missing");
    write(&home.join(".codex").join("config.toml"), 10);

    let all = tools(scan_other_tools(
        &roots(&home),
        &OtherToolsRequest::default(),
        &never,
    ));

    let ids: HashSet<_> = all.iter().map(|tool| format!("{:?}", tool.id)).collect();
    assert_eq!(ids, HashSet::from(["Codex".to_string()]));
    fs::remove_dir_all(home).ok();
}
