const LINK = 'Opens in your browser.';
const LOCAL = 'Opens on your Mac.';
const HOST = 'Posts to your Git host.';

export const DEMO_EXIT_NOTICES: ReadonlyMap<string, string | null> = new Map([
  ['open_url', LINK],
  ['plugin:opener|open_url', LINK],
  ['plugin:shell|open', LINK],
  ['open_in_editor', LOCAL],
  ['open_file_in_workspace', LOCAL],
  ['reveal_in_file_manager', LOCAL],
  ['explore_open', LOCAL],
  ['artifact_mirror_open', LOCAL],
  ['artifact_mirror_open_root', LOCAL],
  ['artifact_mirror_reveal', LOCAL],
  ['open_command_in_external_terminal', LOCAL],
  ['plugin:opener|open_path', LOCAL],
  ['plugin:opener|reveal_item_in_dir', LOCAL],
  ['git_push', null],
  ['git_push_with_lease', null],
  ['project_publish_main', HOST],
  ['slack_post_reply', HOST],
  ['gitlab_reply_to_issue_discussion', HOST],
  ['gitlab_reply_to_mr_discussion', HOST],
  ['gitlab_merge_mr', HOST],
  ['bitbucket_reply_to_pull_request_comment', HOST],
  ['bitbucket_merge_pull_request', HOST],
]);

export const DEMO_HOST_NOTICE = HOST;
