import type { MountId, Project, SessionProjectMount } from '@goodboy/types';

type ScopeGuardParams = {
  readonly workingDir: string;
  readonly projects: ReadonlyArray<Project>;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly activeMountId?: MountId | null;
  readonly isBridgeServing: boolean;
  readonly isSessionDirScope: boolean;
  readonly canWrite: boolean;
};

type ProjectLineParams = {
  readonly project: Project;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

const mountSummary = ({ mount }: { readonly mount: SessionProjectMount }): string => {
  const branch = mount.branch === '' ? 'no branch' : `branch ${mount.branch}`;
  return `${mount.worktreePath} (${branch})`;
};

const projectLine = ({ project, mounts }: ProjectLineParams): string => {
  const owned = mounts.filter((candidate) => candidate.projectId === project.id);
  const identity = `- ${project.name} (${project.kind}) root: ${project.rootPath}`;
  if (owned.length === 0) {
    return `${identity} | NOT materialized: read it freely, mount it only to write`;
  }
  const summaries = owned.map((mount) => mountSummary({ mount })).join(', ');
  return `${identity} | materialized at ${summaries}`;
};

const READING_LINES: ReadonlyArray<string> = [
  'You may read and search every project listed in this workspace to answer the current request. This permission is already granted and needs no mount, no activation and no confirmation.',
  'Your starting directory and your bound mount do not limit which listed projects you may inspect.',
  'Reading another listed project is ordinary workspace work. Name the source you used, and do not describe the read as a scope exception.',
  'Stay on the assigned task. Workspace membership does not authorize unrelated exploration or access to locations that are not listed.',
  'A project root and a session mount can hold different revisions. Use the one the question is about and say which one you used.',
];

type MaterializeLineParams = {
  readonly isBridgeServing: boolean;
};

const MOUNT_RULE_LINES: ReadonlyArray<string> = [
  'NEVER materialize a project to read it, to run its tests, or because it looks related to the goal. Reading needs no mount.',
  'Materialize ONLY a project whose files you must edit. A project name in the goal, plan, or prompt is not write intent or authorization.',
  'The active project, projects linked by external tasks, and existing mounts are authorized. Up to two other projects mount automatically per session; further projects wait for owner approval.',
];

const materializeLine = ({ isBridgeServing }: MaterializeLineParams): string => {
  const marker =
    'To materialize the project you must write to, emit on its own line: <<materialize: <project name> | <why you need it>>> and the mount is ready from your next turn.';
  if (!isBridgeServing) {
    return `${marker} After emitting the marker, end your turn. The mount is ready on the next one.`;
  }
  return `${marker} For an immediate mount, run \`"$GOODBOY_BIN" query project materialize <name> --reason "<why you need it>"\`; it prints the mount path and branch, or tells you the mount was deferred to the owner.`;
};

type MountCommandParams = {
  readonly isBridgeServing: boolean;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

const mountCommandLines = ({
  isBridgeServing,
  mounts,
}: MountCommandParams): ReadonlyArray<string> => {
  if (!isBridgeServing || mounts.length === 0) {
    return [];
  }
  return [
    'Each mount has an id: `"$GOODBOY_BIN" query mount list` shows them, and `mount inspect|fork|switch|attach|unmount|activate --mount <id> --reason "<why>" --request-id <unique>` acts on one. Cutting a branch to start a second line of work with its own pull request is `mount fork`; moving this mount onto another branch is `mount switch`. Declare which one you mean, Goodboy never infers it from git.',
    'Before you begin an independent pull request line, run `mount fork --mount <id> --branch <name>`. The fork starts from the configured origin base unless you pass `--base <branch>`, and it answers with a new mount id.',
    'A fork or an attach only takes effect on the next turn: this process keeps the directory and the write permissions it was started with. Work in the returned mount on that next turn, then cherry-pick what belongs there and resolve conflicts normally.',
    'Use `mount switch --mount <id> --branch <name>` only when you intend to replace THIS mount current branch. Pull requests stay linked to the mount, so earlier ones become history rather than moving with the branch.',
    'Push and open requests through the mount-scoped commands: `"$GOODBOY_BIN" query github push --mount <id>` and `"$GOODBOY_BIN" query github pr-create --mount <id> --title "<title>"`.',
    'When one change ships as several ordered requests, group them: `"$GOODBOY_BIN" query series create --project <name> --name "<series>" --total <n> --request-id <unique>`, then `series set-member --series <id> --position <n> --mount <id> --request-id <unique>` for each one, and `series list` to read them back. The order is yours to declare, Goodboy never reads it out of git, and members carry `Part of` instead of a closing reference.',
    'NEVER use a raw `git checkout -b` as a way of declaring a fork. Goodboy reads an unexpected HEAD as a mismatch to resolve, never as intent, and refuses to guess whether you meant a switch or a fork.',
  ];
};

const WRITE_BOUNDARY_LINES: ReadonlyArray<string> = [
  'ALL writes (Write/Edit/Bash file mutations) MUST resolve inside the session directory or a materialized project mount. NEVER write to a project root or any path outside them.',
  'If the request implies editing files outside the session directory and the materialized mounts, stop and ask for explicit confirmation before touching them.',
];

const READ_ONLY_ROLE_LINE =
  'Your role covers inspection and analysis across the listed workspace projects. It does not cover changing project files or requesting a writable mount.';

type GuardTag = 'worktree-scope' | 'session-directory-scope' | 'projects-scope';

type TagParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly isSessionDirScope: boolean;
};

const guardTag = ({ mounts, isSessionDirScope }: TagParams): GuardTag => {
  if (mounts.length !== 1) {
    return 'projects-scope';
  }
  return isSessionDirScope ? 'session-directory-scope' : 'worktree-scope';
};

const availabilityOf = ({ mount }: { readonly mount: SessionProjectMount }): string => {
  if (mount.isAttached === false) {
    return 'detached';
  }
  const diskState = mount.diskState ?? 'present';
  if (diskState === 'missing' || diskState === 'removed') {
    return `attached, directory ${diskState}`;
  }
  return 'attached';
};

const mountInventoryLine = ({
  mount,
  projects,
}: {
  readonly mount: SessionProjectMount;
  readonly projects: ReadonlyArray<Project>;
}): string => {
  const project = projects.find((candidate) => candidate.id === mount.projectId);
  const identity = mount.mountId === undefined ? '' : ` [mount ${mount.mountId}]`;
  const branch = mount.branch === '' ? 'no branch' : `branch ${mount.branch}`;
  return `- ${mount.mountName}${identity} project ${project?.name ?? mount.projectId} ${branch} at ${mount.worktreePath} (${availabilityOf({ mount })})`;
};

type WorkspaceParams = {
  readonly projects: ReadonlyArray<Project>;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

const workspaceLines = ({ projects, mounts }: WorkspaceParams): ReadonlyArray<string> => {
  if (projects.length === 0) {
    return [];
  }
  return [
    'This session belongs to a workspace with these projects:',
    ...projects.map((project) => projectLine({ project, mounts })),
    ...READING_LINES,
  ];
};

type ExecutionLineParams = {
  readonly workingDir: string;
  readonly activeMountId: MountId | null;
};

const executionLine = ({ workingDir, activeMountId }: ExecutionLineParams): string => {
  const bound = activeMountId === null ? '' : ` and is bound to mount ${activeMountId}`;
  return `This process starts in ${workingDir}${bound}. That fixes where it runs for this turn. Activating another mount changes where a later turn starts.`;
};

type ExecutionParams = {
  readonly tag: GuardTag;
  readonly workingDir: string;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projects: ReadonlyArray<Project>;
  readonly activeMountId: MountId | null;
};

const executionLines = ({
  tag,
  workingDir,
  mounts,
  projects,
  activeMountId,
}: ExecutionParams): ReadonlyArray<string> => {
  const bound = executionLine({ workingDir, activeMountId });
  if (tag === 'worktree-scope') {
    return [`You are operating inside an isolated git worktree at: ${workingDir}`, bound];
  }
  if (tag === 'session-directory-scope') {
    return [`You are operating inside this session directory: ${workingDir}`, bound];
  }
  if (mounts.length === 0) {
    return [
      `You are operating from an ephemeral scratch directory at: ${workingDir}`,
      'This session has no materialized project mounts yet. Nothing you put in the scratch directory is kept.',
      bound,
    ];
  }
  return [
    `You are operating inside the active project mount at: ${workingDir}`,
    bound,
    `This session has ${mounts.length} materialized project mounts:`,
    ...mounts.map((mount) => mountInventoryLine({ mount, projects })),
    'Two mounts of the same project are worktrees of one repository and share its history and its remotes, they are not separate clones. Run every git command inside the mount you mean.',
  ];
};

export const buildScopeGuard = ({
  workingDir,
  projects,
  mounts,
  activeMountId = null,
  isBridgeServing,
  isSessionDirScope,
  canWrite,
}: ScopeGuardParams): string => {
  const tag = guardTag({ mounts, isSessionDirScope });
  const boundaryLines = canWrite
    ? [...WRITE_BOUNDARY_LINES, ...MOUNT_RULE_LINES, materializeLine({ isBridgeServing })]
    : [READ_ONLY_ROLE_LINE];
  const mountCommands = canWrite ? mountCommandLines({ isBridgeServing, mounts }) : [];
  return [
    `[${tag}]`,
    ...workspaceLines({ projects, mounts }),
    ...executionLines({ tag, workingDir, mounts, projects, activeMountId }),
    ...boundaryLines,
    ...mountCommands,
    `[/${tag}]`,
  ].join('\n');
};
