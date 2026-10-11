mod app_platform;
mod artifact_folder;
mod artifact_mirror;
mod artifacts;
mod attachment;
mod aux_spawn;
mod bitbucket;
mod boot_breadcrumb;
mod bootstrap;
mod branch_cleanup;
mod branch_remote;
mod bridge;
mod budget;
mod changelog_images;
mod chat;
mod chat_images;
mod codex_app_server;
mod codex_rollout;
mod config_export;
mod cursor_config;
mod db;
mod editor;
mod explore;
mod external_terminal;
#[cfg(all(test, unix))]
mod fake_cli;
mod file_versions;
mod frame_protocol;
mod github;
mod gitlab;
mod goodboy_ignore;
mod history;
mod history_graph;
mod integration_credentials;
mod integrations;
mod jira;
mod last_crash;
mod linear;
mod live_child;
mod local_image;
mod logging;
mod path_env;
mod permissions;
mod planner;
mod proc;
mod process_group;
mod project_folder;
mod project_relocation;
mod project_scripts;
mod provider_credentials;
mod provider_lifecycle;
mod provider_standing_log;
mod providers;
mod pty_ring;
mod publish;
mod qa_preview;
mod query_bridge;
mod releases;
mod remote_image;
mod remote_probe;
mod repo;
mod restart_marker;
mod scratch_dir;
mod scripts;
mod scroller_style;
mod secrets;
mod sentry;
mod session_dir;
mod settings_overrides;
mod skills;
mod slack;
mod storage;
mod summarize;
mod terminal;
mod thread_git;
mod turn;
mod turn_backlog;
mod usage_probe;
mod util;
mod workflows;
mod worktree;
mod worktree_writer;

#[cfg(test)]
mod command_threading;

#[cfg(target_os = "macos")]
mod fullscreen_escape;
#[cfg(target_os = "macos")]
mod help_menu;

#[cfg(target_os = "macos")]
fn suppress_webkit_media_remote() {
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send};
    unsafe {
        let defaults: *mut AnyObject = msg_send![class!(NSUserDefaults), standardUserDefaults];
        let key: *mut AnyObject = msg_send![
            class!(NSString),
            stringWithUTF8String: c"WebKitMediaRemoteEnabled".as_ptr()
        ];
        let no: i8 = 0;
        let _: () = msg_send![defaults, setBool: no, forKey: key];
    }
}

/// Kills every child process the app still owns. Idempotent: each registry is
/// drained, so a second call after the window teardown finds nothing left.
pub(crate) fn drain_child_processes(app: &tauri::AppHandle, is_app_exit: bool) {
    use tauri::Manager;
    if is_app_exit {
        turn::mark_exiting();
    }
    restart_marker::persist(app, &turn::live_run_ids(&app.state::<turn::TurnRegistry>()));
    stop_running_work(app);
    provider_lifecycle::shutdown(&app.state::<provider_lifecycle::ProviderLifecycleRegistry>());
    query_bridge::shutdown();
}

pub(crate) fn stop_running_work(app: &tauri::AppHandle) {
    use tauri::Manager;
    turn::shutdown(&app.state::<turn::TurnRegistry>());
    chat::shutdown(&app.state::<chat::ChatRegistry>());
    summarize::shutdown(&app.state::<summarize::SummarizeRegistry>());
    planner::shutdown(&app.state::<planner::PlannerRegistry>());
    scripts::shutdown(&app.state::<scripts::ScriptRegistry>());
    terminal::shutdown(&app.state::<terminal::TerminalRegistry>());
}

pub fn run_query_cli() -> Option<i32> {
    query_bridge::run_cli()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    last_crash::install_panic_hook();
    boot_breadcrumb::record("process-start", Some("start"));
    #[cfg(target_os = "macos")]
    suppress_webkit_media_remote();
    let database = match db::open() {
        Ok(database) => Some(database),
        Err(error) => {
            boot_breadcrumb::record("error", Some("error"));
            logging::early(format!(
                "[goodboy] the local database could not be opened: {}",
                logging::detail(&error)
            ));
            None
        }
    };
    let bridge_state = bridge::BridgeState::new().expect("failed to init companion bridge");
    let turn_registry = turn::TurnRegistry::new();
    let chat_registry = chat::ChatRegistry::new();
    let summarize_registry = summarize::SummarizeRegistry::new();
    let planner_registry = planner::PlannerRegistry::new();
    let script_registry = scripts::ScriptRegistry::new();
    let terminal_registry = terminal::TerminalRegistry::new();
    let writer_leases = worktree_writer::WriterLeases::new();
    let provider_lifecycle_registry = provider_lifecycle::ProviderLifecycleRegistry::new();
    let linear_token_cache = linear::LinearTokenCache::new();
    let sentry_token_cache = sentry::SentryTokenCache::new();
    let gitlab_token_cache = gitlab::GitlabTokenCache::new();
    let jira_token_cache = jira::JiraTokenCache::new();
    let bitbucket_token_cache = bitbucket::BitbucketTokenCache::new();
    let slack_token_cache = slack::SlackTokenCache::new();

    let builder = tauri::Builder::default()
        .on_window_event(|window, event| {
            use tauri::Manager;
            if !matches!(event, tauri::WindowEvent::Destroyed) {
                return;
            }
            let app = window.app_handle();
            let survivors = app
                .webview_windows()
                .keys()
                .filter(|label| label.as_str() != window.label())
                .count();
            if survivors == 0 {
                drain_child_processes(app, false);
            }
        })
        .register_asynchronous_uri_scheme_protocol(
            frame_protocol::FRAME_SCHEME,
            frame_protocol::handle,
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init());

    let builder = match database {
        Some(database) => builder.manage(database),
        None => builder,
    };

    builder
        .manage(bridge_state)
        .manage(turn_registry)
        .manage(chat_registry)
        .manage(writer_leases)
        .manage(summarize_registry)
        .manage(planner_registry)
        .manage(script_registry)
        .manage(terminal_registry)
        .manage(provider_lifecycle_registry)
        .manage(linear_token_cache)
        .manage(sentry_token_cache)
        .manage(gitlab_token_cache)
        .manage(jira_token_cache)
        .manage(bitbucket_token_cache)
        .manage(slack_token_cache)
        .manage(frame_protocol::FrameStages::default())
        .setup(move |app| {
            use tauri::Manager;
            logging::init(app.handle());
            query_bridge::start(app.handle().clone());
            std::thread::spawn(history::clean_stale_copies);
            let sweep_handle = app.handle().clone();
            std::thread::spawn(move || {
                use tauri::Emitter;
                let count = proc::reap::sweep_orphans();
                if count == 0 {
                    return;
                }
                log::info!("[reap] startup sweep stopped {count} orphaned processes");
                let _ = sweep_handle.emit("orphans-swept", serde_json::json!({ "count": count }));
            });
            #[cfg(target_os = "macos")]
            help_menu::install(app.handle())?;
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            let windows = app.webview_windows();
            if !windows.is_empty() {
                boot_breadcrumb::record("window-created", Some("ok"));
                for window in windows.values() {
                    #[cfg(target_os = "macos")]
                    fullscreen_escape::install(window);
                    let _ = window.show();
                }
                boot_breadcrumb::record("webview-attached", Some("ok"));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            secrets::secret_set,
            secrets::secret_delete,
            editor::detect_editors,
            editor::detect_browsers,
            editor::open_in_editor,
            editor::open_file_in_workspace,
            editor::open_url,
            remote_image::fetch_remote_image,
            remote_image::load_tool_image,
            local_image::local_image_read,
            releases::releases_list,
            releases::release_changelog,
            changelog_images::changelog_image,
            explore::explore_list,
            explore::explore_read,
            explore::explore_open,
            boot_breadcrumb::boot_breadcrumb,
            app_platform::app_platform,
            last_crash::last_crash_write,
            last_crash::last_crash_claim,
            last_crash::last_crash_delete,
            db::db_exec,
            db::db_execute,
            db::db_list_migration_snapshots,
            db::db_path,
            db::db_remove_migration_snapshot,
            db::db_restore_migration_snapshot,
            db::db_select,
            db::db_transaction,
            db::db_wipe,
            bridge::bridge_start,
            bridge::bridge_status,
            bridge::bridge_command_result,
            bridge::bridge_revoke,
            bridge::bridge_stop,
            artifact_folder::export_artifact_folder,
            artifact_mirror::artifact_mirror_write,
            artifact_mirror::artifact_mirror_pending,
            artifact_mirror::artifact_mirror_locate,
            artifact_mirror::artifact_mirror_reveal,
            artifact_mirror::artifact_mirror_open,
            artifact_mirror::artifact_mirror_open_root,
            artifact_mirror::artifact_mirror_measure,
            artifact_mirror::artifact_mirror_remove,
            frame_protocol::frame_stage,
            frame_protocol::frame_release,
            artifacts::export_artifact_to_file,
            session_dir::session_dir_create,
            session_dir::session_dir_remove,
            session_dir::session_dir_exists,
            scratch_dir::scratch_dir_prepare,
            scratch_dir::scratch_dir_remove,
            worktree::worktree_create,
            worktree::worktree_inspect,
            worktree::worktree_git_common_dir,
            worktree::worktree_remove_checked,
            worktree::worktree_detach_assessment,
            worktree::worktree_directory_size,
            worktree::worktree_tidy_goodboy,
            goodboy_ignore::goodboy_ignore_status,
            goodboy_ignore::goodboy_ignore_apply,
            worktree::worktree_orphans,
            worktree::worktree_folder_remove,
            storage::worktree_folder_facts,
            storage::disk_free,
            storage::app_data_usage,
            storage::reveal_in_file_manager,
            storage::other_tools::other_tools_scan,
            storage::other_tools::other_tools_cancel,
            worktree::worktree_remote_url,
            worktree::worktree_diff,
            worktree::worktree_diff_file,
            worktree::worktree_changed_files,
            worktree::worktree_commits,
            worktree::worktree_is_ancestor,
            worktree::worktree_abort_rebase,
            worktree::worktree_commit_range,
            worktree::worktree_blame_line,
            worktree::worktree_remote_head,
            worktree::worktree_diff_commit,
            worktree::worktree_diff_range,
            worktree::worktree_scratch_add,
            worktree::worktree_scratch_remove,
            history::history_plan_predict,
            history::history_plan_try,
            history::history_plan_run,
            history::history_remote_lease,
            history_graph::history_graph,
            history::history_plan_apply,
            history::history_restore,
            history::history_backups_list,
            history::history_git_supported,
            history::history_rebase_plan,
            history::history_origin_ahead,
            history::history_rewriter_prepare,
            history::history_rewriter_collect,
            history::history_copy_discard,
            history::resolve_copy_prepare,
            history::history_copy_git_dirs,
            worktree::worktree_diff_working,
            worktree::worktree_status,
            branch_remote::worktree_sync_branch_ref,
            thread_git::worktree_fetch_origin_branch,
            thread_git::worktree_fix_on_origin,
            thread_git::worktree_locate_fix,
            thread_git::worktree_origin_commits_touching,
            worktree::checkout_fast_forward,
            worktree::worktree_list_local_branches,
            worktree::worktree_list_branch_names,
            worktree::worktree_repo_default_base_branch,
            worktree::worktree_branch_merge_state,
            branch_cleanup::branch_delete_checked,
            branch_cleanup::branch_restore,
            branch_cleanup::branch_forget_deleted,
            branch_cleanup::branch_head_sha,
            branch_cleanup::project_branches,
            worktree::worktree_change_branch,
            worktree::worktree_branch_holder,
            worktree::worktree_list_remote_branches,
            worktree::worktree_fetch_remote_branches,
            worktree::worktree_remote_branch_state,
            worktree::worktree_use_remote_commits,
            worktree::worktree_integrate_candidate,
            worktree::worktree_quarantine_candidate,
            worktree::worktree_split_candidates,
            providers::refresh_provider_status,
            providers::refresh_cursor_status,
            providers::refresh_codex_status,
            providers::refresh_gemini_status,
            providers::refresh_opencode_status,
            providers::refresh_openrouter_status,
            providers::refresh_moonshot_status,
            providers::check_provider_auth,
            providers::test_connection::provider_test_connection,
            provider_standing_log::log_provider_standing,
            provider_credentials::provider_api_key_validate,
            provider_lifecycle::provider_lifecycle_run,
            provider_lifecycle::provider_lifecycle_write,
            provider_lifecycle::provider_lifecycle_resize,
            provider_lifecycle::provider_lifecycle_cancel,
            external_terminal::open_command_in_external_terminal,
            turn::turn_spawn,
            turn::turn_cancel,
            turn::turn_attach,
            turn::turn_release,
            restart_marker::restart_prepare,
            restart_marker::restart_abort,
            turn::turn_list_live,
            chat::chat_turn,
            chat::chat_cancel,
            chat::ask_turn,
            chat_images::chat_attachment_write,
            chat_images::chat_attachment_read,
            chat_images::chat_attachments_remove,
            chat_images::chat_attachments_prune,
            worktree_writer::worktree_writer_acquire,
            worktree_writer::worktree_writer_release,
            worktree_writer::worktree_writer_cancel,
            worktree_writer::worktree_writer_abandon,
            worktree_writer::worktree_writer_status,
            query_bridge::query_bridge_serving,
            query_bridge::project::project_materialize_result,
            query_bridge::mount::mount_command_result,
            attachment::attachment_write,
            attachment::attachment_read,
            attachment::attachment_delete,
            attachment::attachment_read_dropped,
            attachment::attachment_cleanup_orphans,
            file_versions::file_versions_begin_snapshot,
            file_versions::file_versions_finalize_snapshot,
            file_versions::file_versions_list_staged_snapshots,
            file_versions::file_versions_restore,
            file_versions::file_versions_delete,
            file_versions::file_versions_purge_session,
            summarize::summarize_session,
            summarize::summarize_cancel,
            planner::planner_run,
            codex_rollout::codex_rollout_context,
            codex_rollout::codex_rate_limits_latest,
            usage_probe::claude_usage_probe,
            codex_app_server::codex_rate_limits_probe,
            codex_app_server::codex_consume_reset_credit,
            repo::validate_git_repo,
            repo::project_git_status,
            repo::project_fetch,
            remote_probe::project_remote_probe,
            publish::project_link_remote,
            bootstrap::bootstrap_prepare,
            bootstrap::bootstrap_apply,
            bootstrap::bootstrap_clear_root,
            bootstrap::bootstrap_align_main,
            bootstrap::bootstrap_recover,
            bootstrap::bootstrap_rollback,
            publish::project_publish_main,
            repo::repo_init_with_remote,
            repo::repo_init,
            project_folder::project_folder_create,
            repo::scan_child_repos,
            repo::repo_identity,
            repo::find_moved_projects,
            project_relocation::project_relocate,
            project_relocation::project_relocation_undo,
            budget::budget_rule_upsert,
            budget::budget_rule_list,
            budget::budget_rule_delete,
            budget::session_budget_set,
            budget::session_budget_get,
            budget::session_budget_clear,
            budget::budget_alerts_list,
            budget::budget_alert_dismiss,
            budget::budget_emit_alerts,
            budget::check_provider_budget,
            budget::provider_budget_overview,
            skills::skill_list,
            skills::skill_get,
            skills::skill_upsert,
            skills::skill_delete,
            skills::skill_rescan,
            skills::skill_run_script,
            project_scripts::project_scripts_scan,
            scripts::workspace_script_run,
            scripts::workspace_script_run_adhoc,
            scripts::workspace_script_list_live,
            scripts::workspace_script_snapshot,
            scripts::workspace_script_cancel,
            terminal::terminal_open,
            terminal::terminal_list_live,
            terminal::terminal_snapshot,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_close,
            proc::ledger::process_ledger_list,
            workflows::workflow_list,
            workflows::workflows_for_session,
            workflows::step_def_list,
            workflows::step_def_upsert,
            workflows::step_def_delete,
            workflows::workspaces_with_unread,
            permissions::permission_rule_list,
            permissions::permission_rule_upsert,
            permissions::permission_rule_delete,
            permissions::permission_audit_list,
            permissions::permission_audit_insert,
            permissions::permission_audit_retry_enqueue,
            permissions::permission_audit_retry_drain,
            permissions::permission_audit_retry_update,
            permissions::permission_audit_retry_delete,
            settings_overrides::get_workspace_overrides,
            settings_overrides::set_workspace_overrides,
            settings_overrides::get_session_overrides,
            scroller_style::system_scroller_style,
            config_export::config_export_preview,
            config_export::config_export_write,
            config_export::config_import_preview,
            config_export::config_import_apply,
            github::gh_status,
            github::gh_set_token,
            github::gh_clear_token,
            github::gh_run,
            github::git_push,
            github::git_push_with_lease,
            github::gh_pr_diff,
            integration_credentials::integration_credentials_adopt,
            integration_credentials::integration_credential_forget,
            integration_credentials::integration_credential_has_secret,
            linear::linear_validate_connection,
            linear::linear_connect,
            linear::linear_fetch_assigned_issues,
            linear::linear_fetch_issue,
            linear::linear_fetch_issues_by_ids,
            linear::linear_fetch_team_keys,
            linear::linear_fetch_issue_comments,
            linear::linear_create_comment,
            linear::linear_update_issue,
            linear::linear_fetch_team_states,
            linear::linear_update_issue_state,
            linear::linear_fetch_team_members,
            linear::linear_update_issue_assignee,
            sentry::sentry_validate_connection,
            sentry::sentry_connect,
            sentry::sentry_list_organizations,
            sentry::sentry_list_projects,
            sentry::sentry_list_code_mappings,
            sentry::sentry_fetch_issues,
            sentry::sentry_fetch_issue,
            sentry::sentry_resolve_short_id,
            sentry::sentry_fetch_issue_detail,
            gitlab::gitlab_validate_connection,
            gitlab::gitlab_connect,
            gitlab::gitlab_fetch_assigned_issues,
            gitlab::gitlab_fetch_issue,
            gitlab::gitlab_fetch_issues,
            gitlab::gitlab_update_issue,
            gitlab::gitlab_create_issue_note,
            gitlab::gitlab_list_issue_discussions,
            gitlab::gitlab_reply_to_issue_discussion,
            gitlab::gitlab_fetch_assigned_mrs,
            gitlab::gitlab_mr_for_branch,
            gitlab::gitlab_create_mr,
            gitlab::gitlab_merge_mr,
            gitlab::gitlab_mr_diff,
            gitlab::gitlab_mr_diff_refs,
            gitlab::gitlab_create_mr_discussion,
            gitlab::gitlab_create_mr_note,
            gitlab::gitlab_list_mr_discussions,
            gitlab::gitlab_reply_to_mr_discussion,
            gitlab::gitlab_resolve_mr_discussion,
            gitlab::gitlab_mr_approval_state,
            gitlab::gitlab_approve_mr,
            gitlab::gitlab_unapprove_mr,
            gitlab::gitlab_update_mr_state,
            gitlab::gitlab_update_mr,
            gitlab::gitlab_get_mr,
            gitlab::gitlab_project_merge_methods,
            gitlab::gitlab_search_project_users,
            gitlab::gitlab_mr_pipeline_jobs,
            gitlab::gitlab_mr_commits,
            jira::jira_validate_connection,
            jira::jira_connect,
            jira::jira_list_projects,
            jira::jira_list_issues,
            jira::jira_get_issue,
            jira::jira_get_issues,
            jira::jira_list_comments,
            jira::jira_create_comment,
            jira::jira_update_issue,
            jira::jira_set_assignee,
            jira::jira_list_assignable_users,
            jira::jira_list_transitions,
            jira::jira_transition_issue,
            bitbucket::bitbucket_validate_connection,
            bitbucket::bitbucket_connect,
            bitbucket::bitbucket_list_pull_requests,
            bitbucket::bitbucket_get_pull_request,
            bitbucket::bitbucket_pull_request_diff,
            bitbucket::bitbucket_list_pull_request_comments,
            bitbucket::bitbucket_list_pull_request_statuses,
            bitbucket::bitbucket_pull_request_for_branch,
            bitbucket::bitbucket_approve_pull_request,
            bitbucket::bitbucket_unapprove_pull_request,
            bitbucket::bitbucket_request_changes,
            bitbucket::bitbucket_unrequest_changes,
            bitbucket::bitbucket_merge_pull_request,
            bitbucket::bitbucket_update_pull_request,
            bitbucket::bitbucket_search_workspace_members,
            bitbucket::bitbucket_list_pull_request_commits,
            bitbucket::bitbucket_decline_pull_request,
            bitbucket::bitbucket_create_pull_request_comment,
            bitbucket::bitbucket_reply_to_pull_request_comment,
            slack::slack_validate_connection,
            slack::slack_connect,
            slack::slack_list_channels,
            slack::slack_list_thread_heads,
            slack::slack_get_thread,
            slack::slack_get_permalink,
            slack::slack_list_users,
            slack::slack_post_reply,
            slack::slack_add_reaction,
            qa_preview::qa_deciding_workflow_runs,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(
                event,
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
            ) {
                drain_child_processes(app, true);
            }
        });
}
