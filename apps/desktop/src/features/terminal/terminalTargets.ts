import type { SessionId, SessionProjectMount, Project } from '@goodboy/types';
import { projectById } from '../../store/slices/projects/projectIndex';
import { folderName, trimTrailingSeparators } from '../../store/slices/terminal/terminalOwner';

export type TerminalTarget =
  | {
      readonly key: string;
      readonly label: string;
      readonly kind: 'workspace';
      readonly group?: string;
      readonly path: string;
    }
  | {
      readonly key: string;
      readonly label: string;
      readonly kind: 'session';
      readonly sessionId: SessionId;
      readonly group?: string;
      readonly path: string;
    };

type TargetsParams = {
  readonly folder: string | null;
  readonly sessionId: SessionId | null;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projects: ReadonlyArray<Pick<Project, 'id' | 'name' | 'rootPath'>>;
  readonly selectedMountPath: string | null;
};

type MenuSession = {
  readonly id: SessionId;
  readonly title: string;
};

type MenuTargetsParams = {
  readonly folder: string | null;
  readonly sessions: ReadonlyArray<MenuSession>;
  readonly mountsBySession: Readonly<Record<string, ReadonlyArray<SessionProjectMount>>>;
  readonly projects: ReadonlyArray<Pick<Project, 'id' | 'name' | 'rootPath'>>;
};

type CwdParams = {
  readonly cwd: string | null;
  readonly folder: string | null;
  readonly home: string | null;
};

const WORKSPACE_FOLDER_LABEL = 'Workspace folder';
const MAIN_CHECKOUT_LABEL = 'Main checkout';

export const terminalTargets = ({
  folder,
  sessionId,
  mounts,
  projects,
  selectedMountPath,
}: TargetsParams): ReadonlyArray<TerminalTarget> => {
  const targets: TerminalTarget[] = [];
  if (folder !== null) {
    targets.push({
      key: 'workspace',
      label: WORKSPACE_FOLDER_LABEL,
      kind: 'workspace',
      path: folder,
    });
  }
  if (sessionId === null) {
    return targets;
  }
  const attached = mounts.filter((mount) => mount.isAttached && mount.diskState === 'present');
  for (const mount of attached) {
    const name = projectById(projects, mount.projectId)?.name ?? mount.mountName;
    targets.push({
      key: `mount:${mount.mountId}`,
      label: `${name} · ${mount.branch}`,
      kind: 'session',
      sessionId,
      path: mount.worktreePath,
    });
  }
  const selected =
    attached.find((mount) => mount.worktreePath === selectedMountPath) ?? attached[0] ?? null;
  const main = selected === null ? undefined : selected.repoRoot;
  if (main !== undefined && main !== '' && !attached.some((mount) => mount.worktreePath === main)) {
    targets.push({
      key: 'main',
      label: MAIN_CHECKOUT_LABEL,
      kind: 'session',
      sessionId,
      path: main,
    });
  }
  return targets;
};

export const terminalMenuTargets = ({
  folder,
  sessions,
  mountsBySession,
  projects,
}: MenuTargetsParams): ReadonlyArray<TerminalTarget> => {
  const targets: TerminalTarget[] = [];
  if (folder !== null) {
    targets.push({
      key: 'workspace',
      label: WORKSPACE_FOLDER_LABEL,
      kind: 'workspace',
      path: folder,
    });
  }
  for (const session of sessions) {
    const attached = (mountsBySession[session.id] ?? []).filter(
      (mount) => mount.isAttached && mount.diskState === 'present',
    );
    for (const mount of attached) {
      const name = projectById(projects, mount.projectId)?.name ?? mount.mountName;
      targets.push({
        key: `mount:${mount.mountId}`,
        label: `${name} · ${mount.branch}`,
        kind: 'session',
        sessionId: session.id,
        group: session.title,
        path: mount.worktreePath,
      });
    }
  }
  return targets;
};

export const displayCwd = ({ cwd, folder, home }: CwdParams): string => {
  if (cwd === null || cwd === '') {
    return '';
  }
  const path = trimTrailingSeparators({ path: cwd });
  if (folder !== null) {
    const base = trimTrailingSeparators({ path: folder });
    if (path === base) {
      return folderName({ path }) ?? path;
    }
    if (path.startsWith(`${base}/`)) {
      return path.slice(base.length + 1);
    }
  }
  if (home !== null) {
    const root = trimTrailingSeparators({ path: home });
    if (path === root) {
      return '~';
    }
    if (path.startsWith(`${root}/`)) {
      return `~${path.slice(root.length)}`;
    }
  }
  return path;
};
