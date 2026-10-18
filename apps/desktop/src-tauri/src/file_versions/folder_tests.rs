use std::fs;
use std::path::{Path, PathBuf};

use super::folder_prune::{
    folder_size, prune_folder, FolderPruneArgs, PruneSession, KEEP_AFTER_END_MS, MIN_CAP_BYTES,
};
use super::folder_restore::{
    check_folder_restore, read_folder_version, restore_folder_turn, FolderCheckArgs,
    FolderReadArgs, FolderRestoreArgs, ReadKind, ReadSide, RestoreStatus,
};
use super::folder_store::{
    copy_file_into, is_cancelled, load_index, locate_folder, mark_cancelled, open_folder,
    sync_mirror, walk_folder, CopyMethod, Store,
};
use super::folder_turns::{
    begin_folder_turn, discard_folder_turn, finalize_folder_turn, forget_folder, list_folder_turns,
    list_staged_folder_runs, prepare_folder, ChangeKind, FolderBeginArgs, FolderFinalizeResult,
    FolderPathArgs, FolderPrepareArgs, FolderRunArgs, FolderSessionArgs, TurnKind, TurnManifest,
};
use super::{FileVersionsError, DEFAULT_SIZE_CAP_BYTES};

const SESSION: &str = "11111111-1111-4111-8111-111111111111";
const OTHER_SESSION: &str = "55555555-5555-4555-8555-555555555555";
const RUN_1: &str = "22222222-2222-4222-8222-222222222222";
const RUN_2: &str = "33333333-3333-4333-8333-333333333333";
const RUN_3: &str = "44444444-4444-4444-8444-444444444444";
const RESTORE_1: &str = "66666666-6666-4666-8666-666666666666";
const RESTORE_2: &str = "77777777-7777-4777-8777-777777777777";

struct Fixture {
    base: PathBuf,
    store: Store,
    folder: PathBuf,
}

impl Fixture {
    fn new(name: &str) -> Self {
        let base = std::env::temp_dir().join(format!(
            "goodboy-folder-versions-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let folder = base.join("acme-notes");
        fs::create_dir_all(&folder).unwrap();
        let folder = fs::canonicalize(folder).unwrap();
        let data = base.join("data");
        Self {
            store: Store {
                versions: data.join("file-versions"),
                folders: data.join("folder-versions"),
            },
            folder,
            base,
        }
    }

    fn path(&self) -> String {
        self.folder.to_string_lossy().into_owned()
    }

    fn write(&self, relative: &str, bytes: &[u8]) {
        let path = self.folder.join(relative);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    fn read(&self, relative: &str) -> Option<Vec<u8>> {
        fs::read(self.folder.join(relative)).ok()
    }

    fn begin(&self, session: &str, run: &str) -> super::folder_turns::FolderBeginResult {
        begin_folder_turn(
            &self.store,
            FolderBeginArgs {
                folder_path: self.path(),
                folder_id: Some("project-acme-notes".to_string()),
                session_id: session.to_string(),
                run_id: run.to_string(),
                size_cap_bytes: None,
            },
        )
        .unwrap()
    }

    fn finalize(&self, session: &str, run: &str) -> FolderFinalizeResult {
        finalize_folder_turn(&self.store, self.run_args(session, run)).unwrap()
    }

    fn run_args(&self, session: &str, run: &str) -> FolderRunArgs {
        FolderRunArgs {
            folder_path: self.path(),
            session_id: session.to_string(),
            run_id: run.to_string(),
        }
    }

    fn turn(&self, session: &str, run: &str, edit: impl FnOnce(&Self)) -> TurnManifest {
        self.begin(session, run);
        edit(self);
        self.finalize(session, run).turn.unwrap()
    }

    fn restore(
        &self,
        run: &str,
        restore_run: &str,
        paths: Option<Vec<&str>>,
        is_forced: bool,
    ) -> Result<super::folder_restore::FolderRestoreResult, FileVersionsError> {
        restore_folder_turn(
            &self.store,
            FolderRestoreArgs {
                folder_path: self.path(),
                session_id: SESSION.to_string(),
                run_id: run.to_string(),
                restore_run_id: restore_run.to_string(),
                relative_paths: paths.map(|list| list.iter().map(|p| p.to_string()).collect()),
                is_forced,
            },
        )
    }

    fn turns(&self, session: &str) -> Vec<TurnManifest> {
        list_folder_turns(
            &self.store,
            FolderSessionArgs {
                folder_path: self.path(),
                session_id: session.to_string(),
            },
        )
        .unwrap()
    }

    fn folder_entries(&self) -> Vec<String> {
        let mut names = Vec::new();
        let mut stack = vec![self.folder.clone()];
        while let Some(dir) = stack.pop() {
            for entry in fs::read_dir(&dir).unwrap() {
                let path = entry.unwrap().path();
                if path.is_dir() {
                    stack.push(path.clone());
                }
                names.push(
                    path.strip_prefix(&self.folder)
                        .unwrap()
                        .to_string_lossy()
                        .into_owned(),
                );
            }
        }
        names.sort();
        names
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.base);
    }
}

fn change_of<'a>(turn: &'a TurnManifest, relative: &str) -> &'a super::folder_turns::TurnChange {
    turn.changes
        .iter()
        .find(|change| change.relative_path == relative)
        .unwrap()
}

#[test]
fn clone_on_apfs_copy_elsewhere() {
    let fx = Fixture::new("clone");
    fx.write("launch-memo.md", b"Acme Notes launch memo");
    let source = fx.folder.join("launch-memo.md");
    let cloned = fx.base.join("data").join("clone.bin");
    let copied = fx.base.join("data").join("copy.bin");

    let expected_clone = match cfg!(target_os = "macos") {
        true => CopyMethod::Clone,
        false => CopyMethod::Copy,
    };
    assert_eq!(
        copy_file_into(&source, &cloned, true).unwrap(),
        expected_clone
    );
    assert_eq!(
        copy_file_into(&source, &copied, false).unwrap(),
        CopyMethod::Copy
    );

    assert_eq!(fs::read(cloned).unwrap(), b"Acme Notes launch memo");
    assert_eq!(fs::read(copied).unwrap(), b"Acme Notes launch memo");
}

#[test]
fn the_first_copy_is_made_once_and_the_stat_cache_copies_only_what_moved() {
    let fx = Fixture::new("stat-cache");
    fx.write("launch-memo.md", b"v1");
    fx.write("interviews/notes.md", b"notes");

    let first = fx.begin(SESSION, RUN_1);
    assert!(!first.was_ready);
    assert_eq!(first.copied, 2);
    fx.finalize(SESSION, RUN_1);

    fx.write("faq.md", b"written by hand between turns");
    let second = fx.begin(SESSION, RUN_2);
    assert!(second.was_ready);
    assert_eq!(second.copied, 1);
    let turn = fx.finalize(SESSION, RUN_2);
    assert!(turn.turn.is_none());
    assert!(turn.kept.is_empty());
}

#[test]
fn a_turn_records_added_modified_and_deleted_with_before_and_after_hashes() {
    let fx = Fixture::new("manifest");
    fx.write("launch-memo.md", b"before");
    fx.write("pricing.md", b"old pricing");
    fx.write("same.md", b"untouched");

    let turn = fx.turn(SESSION, RUN_1, |fx| {
        fx.write("launch-memo.md", b"after");
        fs::remove_file(fx.folder.join("pricing.md")).unwrap();
        fx.write("interviews/summary.md", b"new summary");
    });

    let kinds: Vec<(&str, ChangeKind)> = turn
        .changes
        .iter()
        .map(|change| (change.relative_path.as_str(), change.change))
        .collect();
    assert_eq!(
        kinds,
        vec![
            ("interviews/summary.md", ChangeKind::Added),
            ("launch-memo.md", ChangeKind::Modified),
            ("pricing.md", ChangeKind::Deleted),
        ]
    );
    let memo = change_of(&turn, "launch-memo.md");
    assert!(memo.before_hash.is_some() && memo.after_hash.is_some());
    assert_ne!(memo.before_hash, memo.after_hash);
    assert!(change_of(&turn, "interviews/summary.md")
        .stored_name
        .is_none());
    let stored = fx
        .store
        .session_store(SESSION)
        .join(memo.stored_name.as_ref().unwrap());
    assert_eq!(fs::read(stored).unwrap(), b"before");
    assert_eq!(turn.kind, TurnKind::Turn);
    assert_eq!(turn.folder_id.as_deref(), Some("project-acme-notes"));
}

#[test]
fn before_copies_keep_todays_layout_and_names() {
    let fx = Fixture::new("layout");
    fx.write("launch-memo.md", b"before");

    let finalized = {
        fx.begin(SESSION, RUN_1);
        fx.write("launch-memo.md", b"after");
        fx.finalize(SESSION, RUN_1)
    };

    let kept = &finalized.kept[0];
    assert_eq!(kept.change_kind, "modified");
    assert!(super::validate_uuid(&kept.id));
    assert_eq!(kept.stored_name, format!("{}-launch-memo.md", kept.id));
    let expected = super::session_store_dir(&fx.store.versions, SESSION).join(&kept.stored_name);
    assert!(expected.is_file());
}

#[test]
fn goodboy_writes_nothing_inside_the_folder() {
    let fx = Fixture::new("nothing-inside");
    fx.write("launch-memo.md", b"before");

    let turn = fx.turn(SESSION, RUN_1, |fx| fx.write("launch-memo.md", b"after"));
    fx.restore(&turn.run_id, RESTORE_1, None, false).unwrap();

    assert_eq!(fx.folder_entries(), vec!["launch-memo.md".to_string()]);
}

#[test]
fn restore_brings_back_a_file_deleted_by_a_shell_command() {
    let fx = Fixture::new("restore-rm");
    fx.write("interviews/notes.md", b"interview notes");

    let turn = fx.turn(SESSION, RUN_1, |fx| {
        fs::remove_dir_all(fx.folder.join("interviews")).unwrap();
    });
    let outcome = fx.restore(&turn.run_id, RESTORE_1, None, false).unwrap();

    assert_eq!(outcome.status, RestoreStatus::Restored);
    assert_eq!(fx.read("interviews/notes.md").unwrap(), b"interview notes");
}

#[test]
fn restore_of_a_moved_file_puts_it_back_and_removes_the_new_name() {
    let fx = Fixture::new("restore-mv");
    fx.write("draft.md", b"the draft");

    let turn = fx.turn(SESSION, RUN_1, |fx| {
        fs::rename(fx.folder.join("draft.md"), fx.folder.join("final.md")).unwrap();
    });
    assert_eq!(change_of(&turn, "draft.md").change, ChangeKind::Deleted);
    assert_eq!(change_of(&turn, "final.md").change, ChangeKind::Added);

    let outcome = fx.restore(&turn.run_id, RESTORE_1, None, false).unwrap();

    assert_eq!(outcome.status, RestoreStatus::Restored);
    assert_eq!(fx.read("draft.md").unwrap(), b"the draft");
    assert!(fx.read("final.md").is_none());
    let saved = outcome.turn.unwrap();
    let removed = change_of(&saved, "final.md");
    assert_eq!(removed.change, ChangeKind::Deleted);
    let copy = fx
        .store
        .session_store(SESSION)
        .join(removed.stored_name.as_ref().unwrap());
    assert_eq!(fs::read(copy).unwrap(), b"the draft");
}

#[test]
fn restore_saves_the_current_text_first_and_undo_restore_puts_it_back() {
    let fx = Fixture::new("restore-undo");
    fx.write("launch-memo.md", b"before turn");

    let turn = fx.turn(SESSION, RUN_1, |fx| {
        fx.write("launch-memo.md", b"agent text")
    });
    let outcome = fx
        .restore(&turn.run_id, RESTORE_1, Some(vec!["launch-memo.md"]), false)
        .unwrap();

    assert_eq!(fx.read("launch-memo.md").unwrap(), b"before turn");
    assert_eq!(outcome.kept.len(), 1);
    assert_eq!(outcome.kept[0].change_kind, "modified");
    let saved = fx
        .store
        .session_store(SESSION)
        .join(&outcome.kept[0].stored_name);
    assert_eq!(fs::read(saved).unwrap(), b"agent text");
    let restore = outcome.turn.unwrap();
    assert_eq!(restore.kind, TurnKind::Restore);
    assert_eq!(restore.restores_run_id.as_deref(), Some(RUN_1));

    let undo = fx.restore(RESTORE_1, RESTORE_2, None, false).unwrap();

    assert_eq!(undo.status, RestoreStatus::Restored);
    assert_eq!(fx.read("launch-memo.md").unwrap(), b"agent text");
}

#[test]
fn remove_this_new_file_saves_it_first_and_undo_brings_it_back() {
    let fx = Fixture::new("remove-new");
    fx.write("launch-memo.md", b"memo");

    let turn = fx.turn(SESSION, RUN_1, |fx| {
        fx.write("interviews/summary.md", b"summary")
    });
    let outcome = fx
        .restore(
            &turn.run_id,
            RESTORE_1,
            Some(vec!["interviews/summary.md"]),
            false,
        )
        .unwrap();

    assert!(fx.read("interviews/summary.md").is_none());
    assert_eq!(outcome.kept[0].change_kind, "deleted");

    fx.restore(RESTORE_1, RESTORE_2, None, false).unwrap();

    assert_eq!(fx.read("interviews/summary.md").unwrap(), b"summary");
}

#[test]
fn restore_asks_when_the_file_changed_since_and_proceeds_when_forced() {
    let fx = Fixture::new("changed-since");
    fx.write("launch-memo.md", b"before turn");

    let turn = fx.turn(SESSION, RUN_1, |fx| {
        fx.write("launch-memo.md", b"agent text")
    });
    fx.write("launch-memo.md", b"edited by hand later");

    let check = check_folder_restore(
        &fx.store,
        FolderCheckArgs {
            folder_path: fx.path(),
            session_id: SESSION.to_string(),
            run_id: turn.run_id.clone(),
            relative_paths: None,
        },
    )
    .unwrap();
    assert_eq!(check.changed_since, vec!["launch-memo.md".to_string()]);

    let asked = fx.restore(&turn.run_id, RESTORE_1, None, false).unwrap();
    assert_eq!(asked.status, RestoreStatus::ChangedSince);
    assert_eq!(fx.read("launch-memo.md").unwrap(), b"edited by hand later");
    assert!(fx.turns(SESSION).iter().all(|t| t.run_id != RESTORE_1));

    let forced = fx.restore(&turn.run_id, RESTORE_1, None, true).unwrap();
    assert_eq!(forced.status, RestoreStatus::Restored);
    assert_eq!(fx.read("launch-memo.md").unwrap(), b"before turn");
    let saved = fx
        .store
        .session_store(SESSION)
        .join(&forced.kept[0].stored_name);
    assert_eq!(fs::read(saved).unwrap(), b"edited by hand later");
}

#[test]
fn a_restore_that_is_already_in_place_does_nothing() {
    let fx = Fixture::new("noop-restore");
    fx.write("launch-memo.md", b"before");
    let turn = fx.turn(SESSION, RUN_1, |fx| fx.write("launch-memo.md", b"after"));
    fx.write("launch-memo.md", b"before");

    let outcome = fx.restore(&turn.run_id, RESTORE_1, None, false).unwrap();

    assert_eq!(outcome.status, RestoreStatus::NothingToRestore);
    assert!(outcome.kept.is_empty());
}

#[test]
fn restore_refuses_while_a_turn_is_writing_in_the_folder() {
    let fx = Fixture::new("busy");
    fx.write("launch-memo.md", b"before");
    let turn = fx.turn(SESSION, RUN_1, |fx| fx.write("launch-memo.md", b"after"));
    fx.begin(OTHER_SESSION, RUN_2);

    let result = fx.restore(&turn.run_id, RESTORE_1, None, false);

    assert!(matches!(result, Err(FileVersionsError::FolderBusy)));
    assert_eq!(fx.read("launch-memo.md").unwrap(), b"after");
}

#[test]
fn a_failed_restore_leaves_the_file_unchanged() {
    let fx = Fixture::new("restore-missing-copy");
    fx.write("launch-memo.md", b"before");
    let turn = fx.turn(SESSION, RUN_1, |fx| fx.write("launch-memo.md", b"after"));
    fs::remove_dir_all(fx.store.session_store(SESSION)).unwrap();

    let result = fx.restore(&turn.run_id, RESTORE_1, None, false);

    assert!(matches!(result, Err(FileVersionsError::StoredCopyMissing)));
    assert_eq!(fx.read("launch-memo.md").unwrap(), b"after");
}

#[cfg(unix)]
#[test]
fn a_link_that_leaves_the_folder_is_never_followed_or_written_through() {
    let fx = Fixture::new("link-out");
    let outside = fx.base.join("outside");
    fs::create_dir_all(&outside).unwrap();
    fs::write(outside.join("secret.md"), b"outside").unwrap();
    std::os::unix::fs::symlink(&outside, fx.folder.join("linked")).unwrap();
    std::os::unix::fs::symlink(fx.folder.join("memo.md"), fx.folder.join("inside-link")).unwrap();
    fx.write("memo.md", b"memo");

    let begin = fx.begin(SESSION, RUN_1);

    assert!(begin
        .skipped
        .iter()
        .any(|skip| skip.relative_path == "linked" && skip.reason == "link_outside"));
    assert!(begin
        .skipped
        .iter()
        .any(|skip| skip.relative_path == "inside-link" && skip.reason == "link"));
    let folder = locate_folder(&fx.store, &fx.path()).unwrap();
    assert!(!folder.mirror_path("linked/secret.md").exists());
    let escaped = super::resolve_session_path(&fx.folder, "linked/secret.md", true);
    assert!(matches!(
        escaped,
        Err(FileVersionsError::PathEscapesSession)
    ));
}

#[test]
fn files_over_15_mb_and_dependency_folders_are_not_versioned() {
    let fx = Fixture::new("skips");
    fx.write("memo.md", b"memo");
    fx.write("node_modules/acme/index.js", b"module");
    fx.write(".DS_Store", b"finder");
    let big = fs::File::create(fx.folder.join("recording.mov")).unwrap();
    big.set_len(DEFAULT_SIZE_CAP_BYTES + 1).unwrap();
    drop(big);
    fx.write("sessions/draft-the-faq/notes.md", b"legacy");
    crate::session_dir::session_dir_create_blocking(crate::session_dir::CreateArgs {
        base_path: fx.folder.join("legacy").to_string_lossy().into_owned(),
        slug: "draft-the-faq".to_string(),
        directory_name: None,
        session_id: OTHER_SESSION.to_string(),
        workspace_id: "workspace-1".to_string(),
    })
    .unwrap();

    let walk = walk_folder(&fx.folder, DEFAULT_SIZE_CAP_BYTES).unwrap();

    let files: Vec<&str> = walk
        .files
        .iter()
        .map(|f| f.relative_path.as_str())
        .collect();
    assert_eq!(files, vec!["memo.md", "sessions/draft-the-faq/notes.md"]);
    assert!(walk
        .skipped
        .iter()
        .any(|skip| skip.relative_path == "recording.mov"
            && skip.reason == "too_large"
            && skip.size_bytes == Some(DEFAULT_SIZE_CAP_BYTES + 1)));
    assert!(walk
        .skipped
        .iter()
        .any(|skip| skip.relative_path == "node_modules" && skip.reason == "skipped_folder"));
    assert!(walk
        .skipped
        .iter()
        .any(|skip| skip.reason == "session_folder" && skip.relative_path.starts_with("legacy/")));
    assert!(walk
        .skipped
        .iter()
        .all(|skip| skip.relative_path != ".DS_Store"));
}

#[test]
fn finalize_after_restart_finishes_a_turn_from_staging() {
    let fx = Fixture::new("restart");
    fx.write("launch-memo.md", b"before");
    fx.begin(SESSION, RUN_1);
    fx.write("launch-memo.md", b"after the crash");

    let staged = list_staged_folder_runs(&fx.store).unwrap();
    assert_eq!(staged.len(), 1);
    assert_eq!(staged[0].run_id, RUN_1);
    assert_eq!(staged[0].folder_path, fx.path());

    let restarted = Store {
        versions: fx.store.versions.clone(),
        folders: fx.store.folders.clone(),
    };
    let finalized = finalize_folder_turn(&restarted, fx.run_args(SESSION, RUN_1)).unwrap();

    assert_eq!(finalized.kept.len(), 1);
    assert!(list_staged_folder_runs(&fx.store).unwrap().is_empty());
    let again = fx.finalize(SESSION, RUN_1);
    assert_eq!(again.kept.len(), 1);
    assert_eq!(again.kept[0].id, finalized.kept[0].id);
}

#[test]
fn a_crash_after_the_manifest_is_finished_without_losing_the_before_copy() {
    let fx = Fixture::new("crash-after-manifest");
    fx.write("launch-memo.md", b"before");
    let turn = fx.turn(SESSION, RUN_1, |fx| fx.write("launch-memo.md", b"after"));
    let folder = locate_folder(&fx.store, &fx.path()).unwrap();
    super::folder_store::write_json_atomic(
        &folder.staging_path(RUN_1),
        &serde_json::json!({
            "version": 1,
            "sessionId": SESSION,
            "runId": RUN_1,
            "folderPath": fx.path(),
            "folderId": null,
            "startedAtMs": 1
        }),
    )
    .unwrap();

    let again = fx.finalize(SESSION, RUN_1);

    assert_eq!(again.turn.unwrap().changes, turn.changes);
    assert!(!folder.staging_path(RUN_1).exists());
}

#[test]
fn begin_finishes_a_leftover_turn_first_and_hands_it_back() {
    let fx = Fixture::new("leftover");
    fx.write("launch-memo.md", b"before");
    fx.begin(SESSION, RUN_1);
    fx.write("launch-memo.md", b"after");

    let next = fx.begin(SESSION, RUN_2);

    assert_eq!(next.recovered.len(), 1);
    assert_eq!(next.recovered[0].run_id, RUN_1);
    assert_eq!(next.recovered[0].kept.len(), 1);
}

#[test]
fn a_discarded_run_leaves_no_staging_and_no_turn() {
    let fx = Fixture::new("discard");
    fx.write("launch-memo.md", b"before");
    fx.begin(SESSION, RUN_1);

    assert!(discard_folder_turn(&fx.store, fx.run_args(SESSION, RUN_1)).unwrap());
    assert!(!discard_folder_turn(&fx.store, fx.run_args(SESSION, RUN_1)).unwrap());

    assert!(list_staged_folder_runs(&fx.store).unwrap().is_empty());
    let finalized = fx.finalize(SESSION, RUN_1);
    assert!(finalized.turn.is_none());
    assert!(fx.turns(SESSION).is_empty());
}

#[test]
fn resume_after_kill_copies_only_what_is_left() {
    let fx = Fixture::new("resume");
    for index in 0..1100 {
        fx.write(&format!("notes/{index:04}.md"), b"n");
    }
    let folder = open_folder(&fx.store, &fx.path()).unwrap();
    let walk = walk_folder(&folder.root, DEFAULT_SIZE_CAP_BYTES).unwrap();
    let mut index = load_index(&folder).unwrap();

    let killed = sync_mirror(&folder, &mut index, &walk, &|| true);

    assert!(matches!(killed, Err(FileVersionsError::Cancelled)));
    let persisted = load_index(&folder).unwrap();
    assert_eq!(persisted.entries.len(), 500);
    assert!(!persisted.is_ready);

    let status = prepare_folder(
        &fx.store,
        FolderPrepareArgs {
            folder_path: fx.path(),
            folder_id: None,
        },
    )
    .unwrap();

    assert!(status.is_ready);
    assert_eq!(status.file_count, 1100);
    let begin = fx.begin(SESSION, RUN_1);
    assert_eq!(begin.copied, 0);
}

#[test]
fn forget_cancels_and_removes_the_first_copy_but_keeps_turns() {
    let fx = Fixture::new("forget");
    fx.write("launch-memo.md", b"before");
    fx.turn(SESSION, RUN_1, |fx| fx.write("launch-memo.md", b"after"));
    let folder = locate_folder(&fx.store, &fx.path()).unwrap();

    forget_folder(
        &fx.store,
        FolderPathArgs {
            folder_path: fx.path(),
        },
    )
    .unwrap();

    assert!(!folder.mirror_dir().exists());
    assert!(!is_cancelled(&folder.key));
    assert_eq!(fx.turns(SESSION).len(), 1);
    mark_cancelled(&folder.key, false);
}

#[test]
fn forget_refuses_while_a_turn_is_writing_and_keeps_its_staging() {
    let fx = Fixture::new("forget-busy");
    fx.write("launch-memo.md", b"before");
    fx.begin(SESSION, RUN_1);
    let folder = locate_folder(&fx.store, &fx.path()).unwrap();

    let refused = forget_folder(
        &fx.store,
        FolderPathArgs {
            folder_path: fx.path(),
        },
    );

    assert!(matches!(refused, Err(FileVersionsError::FolderBusy)));
    assert!(folder.staging_path(RUN_1).exists());
    assert!(folder.mirror_dir().exists());
    assert!(!is_cancelled(&folder.key));
    fx.write("launch-memo.md", b"after");
    assert!(fx.finalize(SESSION, RUN_1).turn.is_some());
    forget_folder(
        &fx.store,
        FolderPathArgs {
            folder_path: fx.path(),
        },
    )
    .unwrap();
    assert!(!folder.mirror_dir().exists());
}

#[test]
fn takes_any_safe_run_id_and_refuses_one_that_could_leave_the_folder() {
    let fx = Fixture::new("run-ids");
    fx.write("launch-memo.md", b"before");
    let begin = |run: &str| {
        begin_folder_turn(
            &fx.store,
            FolderBeginArgs {
                folder_path: fx.path(),
                folder_id: None,
                session_id: SESSION.to_string(),
                run_id: run.to_string(),
                size_cap_bytes: None,
            },
        )
    };

    assert!(begin("operator-0b6f2c1e-5a1d-4c3b-9e2f-7a8b9c0d1e2f").is_ok());
    for hostile in ["../escape", "", "a/b", "run.json"] {
        assert!(
            matches!(begin(hostile), Err(FileVersionsError::InvalidRunId)),
            "{hostile:?} must be refused"
        );
    }
}

#[test]
fn refuses_the_home_folder_and_the_disk_root() {
    let fx = Fixture::new("refuse");
    let home = dirs::home_dir().unwrap();
    for refused in [home.to_string_lossy().into_owned(), "/".to_string()] {
        assert!(matches!(
            open_folder(&fx.store, &refused),
            Err(FileVersionsError::FolderRefused)
        ));
    }
    let inside = fx.base.join("data").join("inside");
    fs::create_dir_all(&inside).unwrap();
    assert!(matches!(
        open_folder(&fx.store, &inside.to_string_lossy()),
        Err(FileVersionsError::FolderRefused)
    ));
    assert!(matches!(
        open_folder(&fx.store, "relative/acme-notes"),
        Err(FileVersionsError::FolderNotFound)
    ));
}

#[test]
fn read_gives_the_text_before_and_after_a_turn() {
    let fx = Fixture::new("read");
    fx.write("launch-memo.md", b"line one\n");
    let first = fx.turn(SESSION, RUN_1, |fx| {
        fx.write("launch-memo.md", b"line two\n")
    });
    fx.turn(SESSION, RUN_2, |fx| {
        fx.write("launch-memo.md", b"line three\n")
    });
    let read = |run: &str, side: ReadSide| {
        read_folder_version(
            &fx.store,
            FolderReadArgs {
                folder_path: fx.path(),
                session_id: SESSION.to_string(),
                run_id: run.to_string(),
                relative_path: "launch-memo.md".to_string(),
                side,
            },
        )
        .unwrap()
    };

    let before = read(&first.run_id, ReadSide::Before);
    let after = read(&first.run_id, ReadSide::After);
    let latest = read(RUN_2, ReadSide::After);

    assert_eq!(before.kind, ReadKind::Text);
    assert_eq!(before.text.as_deref(), Some("line one\n"));
    assert_eq!(after.text.as_deref(), Some("line two\n"));
    assert_eq!(latest.text.as_deref(), Some("line three\n"));
}

#[test]
fn pruning_drops_sessions_30_days_after_they_end() {
    let fx = Fixture::new("prune-ended");
    fx.write("launch-memo.md", b"v1");
    let turn = fx.turn(SESSION, RUN_1, |fx| fx.write("launch-memo.md", b"v2"));
    let ended_at = turn.finished_at_ms;
    let prune = |now_ms: i64| {
        prune_folder(
            &fx.store,
            FolderPruneArgs {
                folder_path: fx.path(),
                sessions: vec![PruneSession {
                    session_id: SESSION.to_string(),
                    ended_at_ms: Some(ended_at),
                }],
                now_ms,
                cap_bytes: None,
            },
        )
        .unwrap()
    };

    let early = prune(ended_at + KEEP_AFTER_END_MS - 1);
    assert!(early.pruned.is_empty());
    assert_eq!(fx.turns(SESSION).len(), 1);

    let late = prune(ended_at + KEEP_AFTER_END_MS + 1);
    assert_eq!(late.pruned.len(), 1);
    assert_eq!(late.removed_turns, 1);
    assert!(fx.turns(SESSION).is_empty());
    let copy = fx
        .store
        .session_store(SESSION)
        .join(&late.pruned[0].stored_name);
    assert!(!copy.exists());
}

#[test]
fn never_drops_the_last_version_of_a_file_a_live_session_changed() {
    let fx = Fixture::new("prune-cap");
    fx.write("launch-memo.md", b"version one");
    fx.write("faq.md", b"faq one");
    fx.turn(SESSION, RUN_1, |fx| {
        fx.write("launch-memo.md", b"version two");
        fx.write("faq.md", b"faq two");
    });
    std::thread::sleep(std::time::Duration::from_millis(5));
    fx.turn(SESSION, RUN_2, |fx| {
        fx.write("launch-memo.md", b"version three")
    });
    std::thread::sleep(std::time::Duration::from_millis(5));
    fx.turn(OTHER_SESSION, RUN_3, |fx| fx.write("faq.md", b"faq three"));

    let result = prune_folder(
        &fx.store,
        FolderPruneArgs {
            folder_path: fx.path(),
            sessions: vec![
                PruneSession {
                    session_id: SESSION.to_string(),
                    ended_at_ms: None,
                },
                PruneSession {
                    session_id: OTHER_SESSION.to_string(),
                    ended_at_ms: Some(crate::util::now_ms()),
                },
            ],
            now_ms: crate::util::now_ms(),
            cap_bytes: Some(0),
        },
    )
    .unwrap();

    let dropped: Vec<(&str, &str)> = result
        .pruned
        .iter()
        .map(|version| (version.run_id.as_str(), version.relative_path.as_str()))
        .collect();
    assert_eq!(dropped, vec![(RUN_1, "launch-memo.md"), (RUN_3, "faq.md")]);
    let turns = fx.turns(SESSION);
    let run_1 = turns.iter().find(|turn| turn.run_id == RUN_1).unwrap();
    assert!(change_of(run_1, "launch-memo.md").is_pruned);
    assert!(!change_of(run_1, "faq.md").is_pruned);
    assert!(fx
        .restore(RUN_1, RESTORE_1, Some(vec!["launch-memo.md"]), true)
        .is_err());
}

#[test]
fn the_cap_is_a_gigabyte_or_the_folder_size_whichever_is_larger() {
    let fx = Fixture::new("size");
    fx.write("launch-memo.md", b"before");
    fx.turn(SESSION, RUN_1, |fx| fx.write("launch-memo.md", b"after!"));

    let size = folder_size(
        &fx.store,
        FolderPathArgs {
            folder_path: fx.path(),
        },
    )
    .unwrap();

    assert!(size.is_ready);
    assert_eq!(size.kept_bytes, 6);
    assert_eq!(size.version_bytes, 6);
    assert_eq!(size.version_count, 1);
    assert_eq!(size.cap_bytes, MIN_CAP_BYTES);
    assert_eq!(
        super::folder_prune::cap_for(MIN_CAP_BYTES * 3),
        MIN_CAP_BYTES * 3
    );
}

#[test]
fn two_folders_in_one_turn_keep_separate_records() {
    let fx = Fixture::new("two-folders");
    let research = fx.base.join("acme-research");
    fs::create_dir_all(&research).unwrap();
    let research = fs::canonicalize(research).unwrap();
    fs::write(research.join("plan.md"), b"plan").unwrap();
    fx.write("launch-memo.md", b"memo");
    let other = |path: &Path| path.to_string_lossy().into_owned();

    fx.begin(SESSION, RUN_1);
    begin_folder_turn(
        &fx.store,
        FolderBeginArgs {
            folder_path: other(&research),
            folder_id: None,
            session_id: SESSION.to_string(),
            run_id: RUN_1.to_string(),
            size_cap_bytes: None,
        },
    )
    .unwrap();
    fs::write(research.join("plan.md"), b"plan two").unwrap();
    let notes = fx.finalize(SESSION, RUN_1);
    let research_turn = finalize_folder_turn(
        &fx.store,
        FolderRunArgs {
            folder_path: other(&research),
            session_id: SESSION.to_string(),
            run_id: RUN_1.to_string(),
        },
    )
    .unwrap();

    assert!(notes.turn.is_none());
    assert_eq!(research_turn.kept.len(), 1);
    assert_eq!(research_turn.kept[0].relative_path, "plan.md");
}
