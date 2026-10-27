import type { FolderGitProbe, ProjectId } from '@goodboy/types';
import { getProjectValue, updateProjectKind } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { folderGitProbe } from '../../../shared/lib/folderGit';
import { worktreeWriterStatus } from '../../../features/worktree/worktree';
import { nowIso } from '../project-mounts/nowIso';
import { projectById } from '../projects/projectIndex';
import { parseFolderGitChoice } from './parseFolderGitChoice';
import { folderGitDecision } from './folderGitDecision';
import type { FolderGitChoice } from './state';
import { storeFolderGitChoice } from './storeFolderGitChoice';
import { storeFolderGitNotice } from './storeFolderGitNotice';
import { storeProjectKind } from './storeProjectKind';
import type { FolderSignalsDeps, ProbeFolderGitParams } from './types';

type ProbeRead = {
  readonly probe: FolderGitProbe;
  readonly choice: FolderGitChoice | null;
  readonly isWriting: boolean;
};

type ReadParams = {
  readonly path: string;
  readonly projectId: ProjectId;
};

const readProbe = async ({ path, projectId }: ReadParams): Promise<ProbeRead> => {
  const probe = await folderGitProbe({ path });
  const choice = parseFolderGitChoice({
    raw: await getProjectValue({ db: tauriDatabase, projectId, key: 'folder.git' }),
  });
  if (probe.state !== 'tracked') {
    return { probe, choice, isWriting: false };
  }
  const lease = await worktreeWriterStatus({ path });
  return { probe, choice, isWriting: lease.holder !== null && !lease.hasExited };
};

export const probeFolderGit = ({ set, get, latest }: FolderSignalsDeps) => {
  return async ({ projectId }: ProbeFolderGitParams): Promise<FolderGitProbe | null> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined || project.disconnectedAt != null) {
      return null;
    }
    const box: { value: ProbeRead | null } = { value: null };
    const outcome = await latest.run({
      key: `git:${projectId}`,
      request: () => readProbe({ path: project.rootPath, projectId }),
      apply: (value) => {
        box.value = value;
        set((state) => ({ folderGit: { ...state.folderGit, [projectId]: value.probe } }));
        storeFolderGitChoice({ set, projectId, choice: value.choice });
      },
    });
    if (outcome === 'stale' || box.value === null) {
      return null;
    }
    const { probe, choice, isWriting } = box.value;
    const current = projectById(get().projects, projectId);
    if (current === undefined || current.rootPath !== project.rootPath) {
      return probe;
    }
    const decision = folderGitDecision({
      kind: current.kind,
      purpose: get().folderPurpose[projectId] ?? null,
      probe,
      choice,
      isWriting,
      hasNotice: get().folderGitNotice[projectId] !== undefined,
    });
    const foundAt = nowIso({});
    if (decision === 'ask-above' && probe.rootPath !== null) {
      storeFolderGitNotice({
        set,
        projectId,
        notice: { kind: 'above', foundAt, rootPath: probe.rootPath },
      });
      return probe;
    }
    if (decision === 'ask') {
      storeFolderGitNotice({
        set,
        projectId,
        notice: { kind: 'ask', foundAt, commitCount: probe.commitCount, branch: probe.branch },
      });
      return probe;
    }
    if (decision !== 'switch') {
      return probe;
    }
    const rootPath = probe.rootPath ?? current.rootPath;
    await updateProjectKind({ db: tauriDatabase, id: projectId, kind: 'repo', rootPath });
    storeProjectKind({ set, projectId, kind: 'repo', rootPath });
    storeFolderGitNotice({
      set,
      projectId,
      notice: { kind: 'switched', foundAt, commitCount: probe.commitCount, branch: probe.branch },
    });
    return probe;
  };
};
