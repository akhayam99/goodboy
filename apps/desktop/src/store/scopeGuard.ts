import type { Project, SessionProjectMount } from '@goodboy/types';

type ScopeGuardParams = {
  readonly containerDir: string;
  readonly workingDir: string;
  readonly projects: ReadonlyArray<Project>;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly isBridgeServing: boolean;
  readonly isSessionDirScope: boolean;
  readonly canWrite: boolean;
};

type ProjectLineParams = {
  readonly project: Project;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

const projectLine = ({ project, mounts }: ProjectLineParams): string => {
  const mount = mounts.find((candidate) => candidate.projectId === project.id);
  const identity = `- ${project.name} (${project.kind}) root: ${project.rootPath}`;
  if (mount === undefined) {
    return `${identity} | NOT materialized: read-only until you materialize it`;
  }
  const branch = mount.branch === '' ? 'no branch' : `branch ${mount.branch}`;
  return `${identity} | materialized at ${mount.worktreePath} (${branch})`;
};

type MaterializeLineParams = {
  readonly isBridgeServing: boolean;
};

const materializeLine = ({ isBridgeServing }: MaterializeLineParams): string => {
  const marker =
    'To write into a project marked NOT materialized, emit on its own line: <<materialize: <project name> | <why you need it>>> and the mount is ready from your next turn.';
  if (!isBridgeServing) {
    return marker;
  }
  return `${marker} For an immediate mount, run \`"$GOODBOY_BIN" query project materialize <name> --reason "<why you need it>"\`; it prints the mount path and branch.`;
};

const SCOUTING_LINE =
  'No project is materialized yet: scouting and read-only analysis run from here against the project roots. Do not create branches, worktrees, or clones for read-only work. Materialize a project only when you need to write into it.';

const WRITE_BOUNDARY_LINE =
  'ALL writes (Write/Edit/Bash file mutations) MUST resolve inside the session directory or a materialized project mount. NEVER write to a project root or any path outside them.';

const STRICT_DIR_LINES: ReadonlyArray<string> = [
  'ALL file operations (Read/Write/Edit/Bash file paths) MUST resolve inside this directory.',
  'NEVER write to absolute paths that exit this directory.',
  'Prefer paths relative to your current working directory. If a request implies editing files outside this directory, stop and ask for explicit confirmation before touching them.',
];

const STRICT_WORKTREE_LINES: ReadonlyArray<string> = [
  'ALL file operations (Read/Write/Edit/Bash file paths) MUST resolve inside this worktree.',
  'NEVER write to absolute paths that exit this directory, especially not to the parent project checkout.',
  'Prefer paths relative to your current working directory. If a user request implies editing files outside the worktree, stop and ask for explicit confirmation before touching them.',
];

type GuardTag = 'workspace-scope' | 'worktree-scope' | 'session-directory-scope' | 'projects-scope';

type TagParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projects: ReadonlyArray<Project>;
  readonly isSessionDirScope: boolean;
};

const guardTag = ({ mounts, projects, isSessionDirScope }: TagParams): GuardTag => {
  if (mounts.length > 1) {
    return 'projects-scope';
  }
  if (mounts.length === 1) {
    return isSessionDirScope ? 'session-directory-scope' : 'worktree-scope';
  }
  return projects.length === 0 ? 'worktree-scope' : 'workspace-scope';
};

type HeadParams = {
  readonly tag: GuardTag;
  readonly containerDir: string;
  readonly workingDir: string;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

const headLines = ({
  tag,
  containerDir,
  workingDir,
  mounts,
}: HeadParams): ReadonlyArray<string> => {
  if (tag === 'workspace-scope') {
    return [`You are operating inside this session directory: ${containerDir}`];
  }
  if (tag === 'worktree-scope') {
    return [`You are operating inside an isolated git worktree at: ${workingDir}`];
  }
  if (tag === 'session-directory-scope') {
    return [`You are operating inside this session directory: ${workingDir}`];
  }
  return [
    `You are operating across ${mounts.length} materialized project mounts from this session folder: ${workingDir}`,
    ...mounts.map(
      (mount) =>
        `- ${mount.mountName} at ${mount.worktreePath}${mount.branch === '' ? '' : ` (branch ${mount.branch})`}`,
    ),
    'Each mount is a separate git repository on its own branch. Run git commands inside the relevant mount, never at the session folder root.',
  ];
};

type StrictParams = {
  readonly tag: GuardTag;
};

const strictBoundaryLines = ({ tag }: StrictParams): ReadonlyArray<string> => {
  if (tag === 'worktree-scope') {
    return STRICT_WORKTREE_LINES;
  }
  if (tag === 'projects-scope') {
    return [
      'ALL file operations MUST resolve inside one of these mounts. Do NOT create files at the session folder root or outside the mounts.',
    ];
  }
  return STRICT_DIR_LINES;
};

export const buildScopeGuard = ({
  containerDir,
  workingDir,
  projects,
  mounts,
  isBridgeServing,
  isSessionDirScope,
  canWrite,
}: ScopeGuardParams): string => {
  const unmounted = projects.filter(
    (project) => !mounts.some((mount) => mount.projectId === project.id),
  );
  const tag = guardTag({ mounts, projects, isSessionDirScope });
  const mountedLines =
    tag === 'projects-scope'
      ? []
      : projects
          .filter((project) => mounts.some((mount) => mount.projectId === project.id))
          .map((project) => projectLine({ project, mounts }));
  const teachingLines =
    unmounted.length > 0
      ? [
          'This session belongs to a workspace with these projects:',
          ...projects.map((project) => projectLine({ project, mounts })),
          'You may READ the project root paths listed above.',
          WRITE_BOUNDARY_LINE,
          ...(mounts.length === 0 ? [SCOUTING_LINE] : []),
          ...(canWrite ? [materializeLine({ isBridgeServing })] : []),
        ]
      : [...mountedLines, ...strictBoundaryLines({ tag })];
  return [
    `[${tag}]`,
    ...headLines({ tag, containerDir, workingDir, mounts }),
    ...teachingLines,
    `[/${tag}]`,
  ].join('\n');
};
