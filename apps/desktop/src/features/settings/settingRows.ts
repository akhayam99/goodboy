import { AFTER_MERGE_NEVER } from '../../shared/utils/afterMergeCopy';
import { NAMES, formerNamesOf } from '../../shared/utils/names';
import { STOPS_LEVEL_COPY } from '../workflows/stopsLevelCopy';
import type { WorkspaceSettingField } from './pageKeys';
import type { SettingsPageScope } from './settingsFocus';
import { fieldDef } from './workspaceSettings/fields';

export type SettingRowPage = {
  readonly scope: SettingsPageScope;
  readonly section: string;
};

export type SettingRow = {
  readonly key: string;
  readonly label: string;
  readonly help: string;
  readonly page: SettingRowPage;
  readonly band: string | null;
  readonly formerNames: ReadonlyArray<string>;
  readonly field: WorkspaceSettingField | null;
};

type RowParams = {
  readonly key: string;
  readonly label: string;
  readonly help: string;
  readonly page: SettingRowPage;
  readonly band: string | null;
  readonly formerNames?: ReadonlyArray<string>;
  readonly field?: WorkspaceSettingField;
};

const row = ({ formerNames = [], field, ...entry }: RowParams): SettingRow => ({
  ...entry,
  formerNames: [...formerNames, ...formerNamesOf(entry.label)],
  field: field ?? null,
});

type FieldRowParams = {
  readonly key: string;
  readonly field: WorkspaceSettingField;
  readonly help: string;
  readonly band: string | null;
  readonly formerNames?: ReadonlyArray<string>;
};

const fieldRow = ({ field, ...entry }: FieldRowParams): SettingRow => {
  const def = fieldDef({ field });
  return row({
    ...entry,
    field,
    label: def.label,
    page: { scope: 'workspace', section: def.page },
  });
};

const GENERAL: SettingRowPage = { scope: 'app', section: 'general' };
const ADVANCED: SettingRowPage = { scope: 'app', section: 'advanced' };
const STORAGE: SettingRowPage = { scope: 'app', section: 'storage' };
const BACKUP: SettingRowPage = { scope: 'app', section: 'backup' };
const IPHONE: SettingRowPage = { scope: 'app', section: 'iphone' };
const PROJECTS: SettingRowPage = { scope: 'workspace', section: 'projects' };
const RUNS: SettingRowPage = { scope: 'workspace', section: 'general' };
const MODELS: SettingRowPage = { scope: 'workspace', section: 'models' };

export const SETTING_ROWS: ReadonlyArray<SettingRow> = [
  row({
    key: 'theme',
    label: 'Theme',
    help: 'Applies to every window.',
    page: GENERAL,
    band: 'Appearance',
    formerNames: ['Dark mode', 'Light mode', 'Color scheme'],
  }),
  row({
    key: 'contrast',
    label: 'More contrast',
    help: 'Stronger borders and text. Follows macOS.',
    page: GENERAL,
    band: 'Appearance',
  }),
  row({
    key: 'away-banner',
    label: NAMES.bannerWhenAway,
    help: 'When an agent needs you and Goodboy is in the background.',
    page: GENERAL,
    band: 'Notifications',
  }),
  row({
    key: 'dock-badge',
    label: 'Dock badge',
    help: 'Sessions that need you, on the app icon.',
    page: GENERAL,
    band: 'Notifications',
  }),
  row({
    key: 'open-editor',
    label: 'Editor',
    help: 'Opens session worktrees.',
    page: GENERAL,
    band: 'Open with',
  }),
  row({
    key: 'open-terminal',
    label: 'Terminal',
    help: 'Opens projects and runs provider CLIs.',
    page: GENERAL,
    band: 'Open with',
  }),
  row({
    key: 'open-browser',
    label: 'Browser',
    help: 'Opens wireframes and links outside a session.',
    page: GENERAL,
    band: 'Open with',
  }),
  row({
    key: 'links-open',
    label: NAMES.linksInSession,
    help: 'Where a click opens. Cmd-click opens the other one.',
    page: GENERAL,
    band: 'Open with',
  }),
  row({
    key: 'command-status',
    label: NAMES.commandStatus,
    help: 'A check or a cross after each command. Your dotfiles stay untouched.',
    page: ADVANCED,
    band: 'Built-in terminal',
  }),
  row({
    key: 'check-origin',
    label: 'Check origin',
    help: 'How often base branches are fetched. Goodboy never pulls.',
    page: ADVANCED,
    band: 'Git',
    formerNames: ['Fetch'],
  }),
  row({
    key: 'search-index',
    label: 'Index',
    help: 'Kept up to date as you work. Never leaves this Mac.',
    page: ADVANCED,
    band: 'Search',
    formerNames: ['Search index'],
  }),
  row({
    key: 'search-rebuild',
    label: 'Rebuild the index',
    help: 'Empties it and fills it again while the app is idle.',
    page: ADVANCED,
    band: 'Search',
    formerNames: ['Rebuild'],
  }),
  row({
    key: 'search-leave-out',
    label: NAMES.skipFolders,
    help: 'Their sessions and branches stay out of search.',
    page: ADVANCED,
    band: 'Search',
  }),
  row({
    key: 'background-download',
    label: 'Download in the background',
    help: 'New versions land while you work.',
    page: GENERAL,
    band: 'Updates',
    formerNames: ['Download updates in the background'],
  }),
  row({
    key: 'suggest-cleanup',
    label: 'Suggest cleanup after',
    help: 'Folders idle this long show up as safe to remove.',
    page: STORAGE,
    band: 'Worktrees',
    formerNames: ['Cleanup policy'],
  }),
  row({
    key: 'backup-export',
    label: 'Export backup',
    help: 'Saves a backup file with the groups you ticked.',
    page: BACKUP,
    band: 'Export',
    formerNames: ['Export', 'Backup file'],
  }),
  row({
    key: 'backup-import',
    label: 'Import a backup',
    help: 'Opens a backup file and shows what changes first.',
    page: BACKUP,
    band: 'Import',
    formerNames: ['Import', 'Setup file'],
  }),
  row({
    key: 'delete-all-data',
    label: NAMES.deleteAllData,
    help: 'Every workspace, session, transcript and rule. Keychain keys stay.',
    page: BACKUP,
    band: 'Danger zone',
  }),
  row({
    key: 'pair-iphone',
    label: NAMES.pairIphone,
    help: 'Goodboy for iPhone is in private testing.',
    page: IPHONE,
    band: null,
    formerNames: ['iPhone', 'Phone', 'Companion'],
  }),
  row({
    key: 'workspace-name',
    label: 'Name',
    help: 'Shown in the title bar and the workspace switcher.',
    page: PROJECTS,
    band: 'Workspace',
    formerNames: ['Workspace name', 'Rename workspace'],
  }),
  row({
    key: 'disconnect-workspace',
    label: 'Disconnect this workspace',
    help: 'Files stay on disk. Open the folder again to bring it back.',
    page: PROJECTS,
    band: 'Danger zone',
  }),
  fieldRow({
    key: 'your-job',
    field: 'roles',
    help: 'Agents read this by role.',
    band: 'Profile',
  }),
  fieldRow({
    key: 'about-work',
    field: 'aboutWork',
    help: 'What you work on, in your words.',
    band: 'Profile',
  }),
  fieldRow({
    key: 'working-rules',
    field: 'workingRules',
    help: 'How agents should work with you.',
    band: 'Profile',
  }),
  fieldRow({
    key: 'explain-more',
    field: 'explainMore',
    help: 'Topics where agents explain more.',
    band: 'Profile',
  }),
  fieldRow({
    key: 'branch-prefix',
    field: 'branchPrefix',
    help: 'Starts every session branch. a to z, 0 to 9, - and /.',
    band: 'Naming',
  }),
  fieldRow({
    key: 'branch-name',
    field: 'branchTemplate',
    help: 'The name a new session branch gets.',
    band: 'Naming',
    formerNames: ['Branch template'],
  }),
  fieldRow({
    key: 'attribution',
    field: 'attribution',
    help: 'Adds "Written by Goodboy" to every comment and reply.',
    band: 'Replies',
    formerNames: ['Written by Goodboy'],
  }),
  fieldRow({
    key: 'parallel-agents',
    field: 'parallelAgents',
    help: 'Eligible agents split independent work, then merge one result.',
    band: 'Advanced',
  }),
  fieldRow({
    key: 'reply-length',
    field: 'verbosity',
    help: 'How much agents say while they work.',
    band: 'Agents',
    formerNames: ['Verbosity'],
  }),
  row({
    key: 'stops-for-ok',
    label: STOPS_LEVEL_COPY.label,
    help: STOPS_LEVEL_COPY.help,
    page: RUNS,
    band: 'When a run stops for you',
    formerNames: [
      'Asks you',
      `${NAMES.runKind.workflow} asks you`,
      `${NAMES.lead} asks you`,
      'Auto asks you',
      'Auto runs ask you',
    ],
  }),
  row({
    key: 'spend-limit',
    label: NAMES.spendCap,
    help: 'Per new run, saved on Enter. The session limit still applies.',
    page: RUNS,
    band: 'Spending',
  }),
  fieldRow({
    key: 'after-merge',
    field: 'afterMerge',
    help: AFTER_MERGE_NEVER,
    band: 'After merge',
    formerNames: ['When a pull request merges'],
  }),
  fieldRow({
    key: 'reply-voice',
    field: 'replyVoice',
    help: 'How Goodboy sounds when it replies to a review.',
    band: 'Replies',
  }),
  fieldRow({
    key: 'reply-template-fixed',
    field: 'replyTemplateFixed',
    help: 'Template around the reason.',
    band: 'Templates',
  }),
  fieldRow({
    key: 'reply-template-no-change',
    field: 'replyTemplateNoChange',
    help: 'Template around the reason.',
    band: 'Templates',
  }),
  fieldRow({
    key: 'resolve-thread',
    field: 'resolveOnGithub',
    help: 'Off leaves it to the reviewer. Bitbucket threads stay open.',
    band: 'Threads',
    formerNames: ['Resolve the thread'],
  }),
  fieldRow({
    key: 'edit-posted-reply',
    field: 'editPostedReply',
    help: 'After a squash or fixup, adds an Update line. GitHub may notify.',
    band: 'Threads',
  }),
  fieldRow({
    key: 'commit-style',
    field: 'resolveCommitStyle',
    help: 'Fixup targets the commit that added the line.',
    band: 'Commits',
    formerNames: ['Commit style'],
  }),
  fieldRow({
    key: 'permission-default',
    field: 'permissionMode',
    help: 'Read only, Ask first, Edits allowed or Full access.',
    band: null,
    formerNames: ['Default mode', 'Permission mode'],
  }),
  row({
    key: 'provider-order',
    label: 'When a provider is out',
    help: 'The order Goodboy tries providers in, and the backups.',
    page: MODELS,
    band: 'Providers',
    formerNames: ['Fallback', 'Provider order'],
  }),
  row({
    key: 'models-in-workflows',
    label: 'Models in older plan runs',
    help: 'Let the orchestrator of an older plan run choose models.',
    page: MODELS,
    band: 'Choosing models',
    formerNames: ['Models in workflows'],
  }),
];
