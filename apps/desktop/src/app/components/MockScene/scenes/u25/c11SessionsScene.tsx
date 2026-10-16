import { useEffect, useState } from 'react';
import type {
  ProjectId,
  SessionGroupKey,
  SessionPageView,
  WorkspaceGitStatus,
} from '@goodboy/types';
import { StageBoard } from '../../../../../features/workspace/components/StageBoard';
import { useAppStore, useSessions } from '../../../../../store';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';

export type SessionsSceneConfig = {
  readonly view: SessionPageView;
  readonly group?: SessionGroupKey;
  readonly isFiltered?: boolean;
  readonly isEmpty?: boolean;
  readonly repos: 'fine' | 'attention';
};

type Props = {
  readonly config: SessionsSceneConfig;
};

type StatusParams = {
  readonly status: WorkspaceGitStatus;
  readonly behind: number;
};

const settledStatus = ({ status, behind }: StatusParams): WorkspaceGitStatus => {
  if (status.state !== 'ready') {
    return status;
  }
  return {
    ...status,
    inProgress: null,
    upstreamDistance: { kind: 'known', ahead: 0, behind },
    workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  };
};

const seedSessions = ({ config }: Props): void => {
  seedBoardScene();
  const state = useAppStore.getState();
  const projectIds = state.projects.map((project) => project.id);
  const statuses: Record<ProjectId, WorkspaceGitStatus> = {};
  for (const id of projectIds) {
    const status = state.projectGitStatus[id];
    if (status === undefined) {
      continue;
    }
    statuses[id] = settledStatus({
      status,
      behind: config.repos === 'attention' && id === projectIds[0] ? 3 : 0,
    });
  }
  useAppStore.setState({
    projectGitStatus: statuses,
    ...(config.isEmpty === true ? { sessions: [], archivedSessions: { [WORKSPACE_ID]: [] } } : {}),
  });
  state.setSessionViewPrefs({
    workspaceId: WORKSPACE_ID,
    patch: { pageView: config.view, group: config.group ?? 'none', isArchivedShown: false },
  });
  state.setSelectedProjectIds({
    workspaceId: WORKSPACE_ID,
    selectedProjectIds: config.isFiltered === true ? projectIds.slice(0, 1) : [],
  });
};

export const SessionsScene = ({ config }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const sessions = useSessions();

  useEffect(() => {
    seedSessions({ config });
    setIsReady(true);
  }, [config]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen bg-background text-foreground">
      <StageBoard workspaceId={WORKSPACE_ID} sessions={sessions} />
    </main>
  );
};
