import type { Project, ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';
import { projectById } from '../../store/slices/projects/projectIndex';
import { folderName } from '../../store/slices/terminal/terminalOwner';
import type { TerminalTarget } from './terminalTargets';

export type PickerRow = {
  readonly key: string;
  readonly kind: 'workspace' | 'mount';
  readonly target: TerminalTarget;
  readonly projectId: ProjectId | null;
  readonly projectName: string;
  readonly branch: string | null;
  readonly path: string;
  readonly folder: string | null;
};

export type PickerCluster = {
  readonly key: string;
  readonly sessionId: SessionId | null;
  readonly title: string;
  readonly rows: ReadonlyArray<PickerRow>;
};

type PickerSession = {
  readonly id: SessionId;
  readonly title: string;
};

type ClustersParams = {
  readonly folder: string | null;
  readonly sessions: ReadonlyArray<PickerSession>;
  readonly mountsBySession: Readonly<Record<string, ReadonlyArray<SessionProjectMount>>>;
  readonly projects: ReadonlyArray<Pick<Project, 'id' | 'name'>>;
};

const WORKSPACE_FOLDER_TITLE = 'Workspace folder';

export const pickerClusters = ({
  folder,
  sessions,
  mountsBySession,
  projects,
}: ClustersParams): ReadonlyArray<PickerCluster> => {
  const clusters: PickerCluster[] = [];
  if (folder !== null) {
    clusters.push({
      key: 'workspace',
      sessionId: null,
      title: WORKSPACE_FOLDER_TITLE,
      rows: [
        {
          key: 'workspace',
          kind: 'workspace',
          target: {
            key: 'workspace',
            label: WORKSPACE_FOLDER_TITLE,
            kind: 'workspace',
            path: folder,
          },
          projectId: null,
          projectName: folderName({ path: folder }) ?? WORKSPACE_FOLDER_TITLE,
          branch: null,
          path: folder,
          folder: folderName({ path: folder }),
        },
      ],
    });
  }
  for (const session of sessions) {
    const attached = (mountsBySession[session.id] ?? []).filter(
      (mount) => mount.isAttached && mount.diskState === 'present',
    );
    if (attached.length === 0) {
      continue;
    }
    clusters.push({
      key: session.id,
      sessionId: session.id,
      title: session.title,
      rows: attached.map((mount) => {
        const name = projectById(projects, mount.projectId)?.name ?? mount.mountName;
        return {
          key: `mount:${mount.mountId}`,
          kind: 'mount',
          target: {
            key: `mount:${mount.mountId}`,
            label: `${name} · ${mount.branch}`,
            kind: 'session',
            sessionId: session.id,
            group: session.title,
            path: mount.worktreePath,
          },
          projectId: mount.projectId,
          projectName: name,
          branch: mount.branch,
          path: mount.worktreePath,
          folder: folderName({ path: mount.worktreePath }),
        };
      }),
    });
  }
  return clusters;
};
