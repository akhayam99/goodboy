import { NAMES, formerNamesOf } from '../../shared/utils/names';
import { RUN_ROUTE_COPY } from '../session/startRun/runRouteCopy';
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
};

type RowParams = {
  readonly key: string;
  readonly label: string;
  readonly help: string;
  readonly page: SettingRowPage;
  readonly band: string | null;
  readonly formerNames?: ReadonlyArray<string>;
};

const row = ({ formerNames = [], ...entry }: RowParams): SettingRow => ({
  ...entry,
  formerNames: [...formerNames, ...formerNamesOf(entry.label)],
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
  return row({ ...entry, label: def.label, page: { scope: 'workspace', section: def.page } });
};

const GENERAL: SettingRowPage = { scope: 'app', section: 'general' };
const ADVANCED: SettingRowPage = { scope: 'app', section: 'advanced' };
const STORAGE: SettingRowPage = { scope: 'app', section: 'storage' };
const SHORTCUTS: SettingRowPage = { scope: 'app', section: 'shortcuts' };
const BACKUP: SettingRowPage = { scope: 'app', section: 'backup' };
const IPHONE: SettingRowPage = { scope: 'app', section: 'iphone' };
const PROJECTS: SettingRowPage = { scope: 'workspace', section: 'projects' };
const RUN_DEFAULTS: SettingRowPage = { scope: 'workspace', section: 'general' };
const MODELS: SettingRowPage = { scope: 'workspace', section: 'models' };
const NEW_RUNS = 'New runs';

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
    help: 'Stronger borders and quiet text. Follows your system setting too.',
    page: GENERAL,
    band: 'Appearance',
  }),
  row({
    key: 'away-banner',
    label: 'Banner when you are away',
    help: 'A system banner when an agent needs you and Goodboy is behind.',
    page: GENERAL,
    band: 'Notifications',
  }),
  row({
    key: 'dock-badge',
    label: 'Dock badge',
    help: 'The number of sessions that need you, on the app icon.',
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
    help: 'Opens projects, and runs provider commands.',
    page: GENERAL,
    band: 'Open with',
  }),
  row({
    key: 'open-browser',
    label: 'Browser',
    help: 'Your browser, for links, wireframes, and anything opened outside a session.',
    page: GENERAL,
    band: 'Open with',
  }),
  row({
    key: 'links-open',
    label: 'Links',
    help: 'Click on a link, plan or report, in a session.',
    page: GENERAL,
    band: 'Open with',
  }),
  row({
    key: 'command-status',
    label: 'Show if a command passed or failed',
    help: 'A small zsh hook; your own shell files stay untouched.',
    page: ADVANCED,
    band: 'Built-in terminal',
    formerNames: ['Command status', 'Exit status'],
  }),
  row({
    key: 'check-origin',
    label: 'Check origin',
    help: 'How often each base branch is compared with origin.',
    page: ADVANCED,
    band: 'Git',
    formerNames: ['Fetch'],
  }),
  row({
    key: 'search-index',
    label: 'Index',
    help: 'Kept up to date as you work.',
    page: ADVANCED,
    band: 'Search',
    formerNames: ['Search index'],
  }),
  row({
    key: 'search-rebuild',
    label: 'Rebuild',
    help: 'Empties the index and fills it again while the app is idle.',
    page: ADVANCED,
    band: 'Search',
    formerNames: ['Rebuild the index'],
  }),
  row({
    key: 'search-leave-out',
    label: 'Leave out',
    help: 'Sessions, messages and branches of these folders stop showing in search.',
    page: ADVANCED,
    band: 'Search',
    formerNames: ['Skip folders'],
  }),
  row({
    key: 'work',
    label: 'Work (experimental)',
    help: 'Adds the Work section and starts runs from one composer.',
    page: ADVANCED,
    band: 'Experiments',
  }),
  row({
    key: 'background-download',
    label: 'Download updates in the background',
    help: 'Restart to use a new version once it lands.',
    page: GENERAL,
    band: 'Updates',
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
    key: 'classic-send-keys',
    label: 'Keys from before 0.15.5',
    help: 'Return adds a line and the send shortcut starts an agent.',
    page: SHORTCUTS,
    band: 'Message boxes',
    formerNames: ['Classic send keys'],
  }),
  row({
    key: 'backup-export',
    label: 'Backup file',
    help: 'Move your setup to another Mac, or keep a copy.',
    page: BACKUP,
    band: 'Export',
    formerNames: ['Export'],
  }),
  row({
    key: 'backup-import',
    label: 'Setup file',
    help: 'Import adds and updates. It never deletes anything.',
    page: BACKUP,
    band: 'Import',
    formerNames: ['Import'],
  }),
  row({
    key: 'delete-all-data',
    label: NAMES.deleteAllData,
    help: 'Every workspace, session, transcript and rule.',
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
    help: 'Files stay on disk.',
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
    help: 'Starts every new session branch. Letters, numbers, - and /.',
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
    help: 'Signs every comment and review reply Goodboy posts.',
    band: 'Replies',
    formerNames: ['Written by Goodboy'],
  }),
  fieldRow({
    key: 'parallel-agents',
    field: 'parallelAgents',
    help: 'Lets eligible agents split independent work and reconcile it in one output.',
    band: 'Agents',
  }),
  fieldRow({
    key: 'reply-length',
    field: 'verbosity',
    help: 'How much agents explain while they work.',
    band: 'Agents',
    formerNames: ['Verbosity'],
  }),
  row({
    key: 'workflow-asks',
    label: `${NAMES.runKind.workflow} asks you`,
    help: 'When a new workflow run stops for your go.',
    page: RUN_DEFAULTS,
    band: NEW_RUNS,
    formerNames: ['Asks you', 'Workflow runs ask you'],
  }),
  row({
    key: 'auto-asks',
    label: `${NAMES.runKind.autoAgent} asks you`,
    help: 'When Auto stops for your go in this workspace.',
    page: RUN_DEFAULTS,
    band: NEW_RUNS,
    formerNames: ['Auto asks you', 'Auto runs ask you'],
  }),
  row({
    key: 'start-as',
    label: RUN_ROUTE_COPY.workspaceDefault,
    help: RUN_ROUTE_COPY.workspaceDefaultHelp,
    page: RUN_DEFAULTS,
    band: NEW_RUNS,
    formerNames: ['New runs start as'],
  }),
  row({
    key: 'spend-limit',
    label: NAMES.spendCap,
    help: 'The most a new run may spend, and what happens at the limit.',
    page: RUN_DEFAULTS,
    band: NEW_RUNS,
  }),
  row({
    key: 'run-models',
    label: NAMES.models,
    help: 'The providers a new run may use, and the backup when one is out.',
    page: RUN_DEFAULTS,
    band: NEW_RUNS,
  }),
  fieldRow({
    key: 'after-merge',
    field: 'afterMerge',
    help: 'What happens to the folder and branch once its pull request merges.',
    band: 'After merge',
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
    help: 'Off leaves it open for the reviewer to resolve.',
    band: 'Threads',
    formerNames: ['Resolve the thread'],
  }),
  fieldRow({
    key: 'edit-posted-reply',
    field: 'editPostedReply',
    help: 'Adds an Update line to a posted reply after a squash or fixup.',
    band: 'Threads',
  }),
  fieldRow({
    key: 'commit-style',
    field: 'resolveCommitStyle',
    help: 'A fix for a comment lands as a new commit or a fixup.',
    band: 'Commits',
    formerNames: ['A fix for a comment lands as'],
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
    key: 'typed-requests',
    label: 'Typed requests',
    help: 'Let a small model read typed requests before Auto starts.',
    page: MODELS,
    band: 'Choosing models',
  }),
  row({
    key: 'models-in-workflows',
    label: 'Models in workflows',
    help: 'Let the workflow orchestrator choose models.',
    page: MODELS,
    band: 'Choosing models',
  }),
];
