import type { Project, SessionProjectMount } from '@goodboy/types';

type GuardParams = {
  readonly containerDir: string;
  readonly projects: ReadonlyArray<Project>;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly isBridgeServing: boolean;
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

export const buildWorkspaceScopeGuard = ({
  containerDir,
  projects,
  mounts,
  isBridgeServing,
}: GuardParams): string => {
  const materializeHint = isBridgeServing
    ? 'To write into a project, materialize it first: run `"$GOODBOY_BIN" query project materialize <name> --reason "<why you need it>"`. It mounts the project under this session directory and prints the mount path and branch.'
    : 'To write into a project, it must be materialized first. Ask the user to add it to this session with the + project control.';
  return [
    '[workspace-scope]',
    `You are operating inside this session directory: ${containerDir}`,
    'This session belongs to a workspace with these projects:',
    ...projects.map((project) => projectLine({ project, mounts })),
    'You may READ the project root paths listed above.',
    'ALL writes (Write/Edit/Bash file mutations) MUST resolve inside the session directory or a materialized project mount. NEVER write to a project root or any path outside them.',
    materializeHint,
    'Run git commands inside the relevant project mount, never at the session directory root.',
    '[/workspace-scope]',
  ].join('\n');
};
