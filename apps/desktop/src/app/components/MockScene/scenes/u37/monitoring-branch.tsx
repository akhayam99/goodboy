import { useEffect, useState } from 'react';
import type { SessionProjectMount } from '@goodboy/types';
import { MonitoringStudio } from '../../../../../features/monitoring/components/MonitoringStudio';
import { useAppStore } from '../../../../../store';
import { PageSheet } from '../PageSheet';
import { installSceneDatabase } from '../sceneDatabase';
import {
  PROJECTS,
  SESSIONS,
  SESSION_ID,
  SESSION_MOUNTS,
  WORKSPACE,
  WORKSPACE_ID,
} from '../u24/monitoringSeed';
import { answerOf } from '../u25/ports';
import { PORTS_LEARNED, PORTS_SETTINGS } from '../u25/portsSeed';

const NOOP = () => undefined;

const FIRST_MOUNT = SESSION_MOUNTS[SESSION_ID]?.[0] ?? null;

const MONITORING_TARGET =
  FIRST_MOUNT === null || FIRST_MOUNT.projectId === null
    ? null
    : { workspaceId: WORKSPACE_ID, projectId: FIRST_MOUNT.projectId, branch: FIRST_MOUNT.branch };

const PROJECT_MOUNTS: Readonly<Record<string, ReadonlyArray<SessionProjectMount>>> =
  Object.fromEntries(
    Object.entries(SESSION_MOUNTS).map(([sessionId, mounts]) => [
      sessionId,
      mounts.flatMap((mount) =>
        mount.projectId === null || mount.worktreePath === null
          ? []
          : [
              {
                mountId: mount.id,
                sessionId: mount.sessionId,
                projectId: mount.projectId,
                mountName: mount.mountName ?? '',
                worktreePath: mount.worktreePath,
                lastWorktreePath: mount.lastWorktreePath,
                repoRoot: mount.repoRoot,
                branch: mount.branch,
                baseBranch: mount.baseBranch,
                parallelIndex: mount.parallelIndex,
                isAttached: mount.isAttached,
                diskState: mount.diskState,
                revision: mount.revision,
              },
            ],
      ),
    ]),
  );

const MonitoringBranchScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installSceneDatabase({
      settings: PORTS_SETTINGS,
      fallback: ({ command, payload }) => answerOf({ command, payload }),
    });
    useAppStore.setState({
      workspaces: [WORKSPACE],
      currentWorkspaceId: WORKSPACE_ID,
      projects: [...PROJECTS],
      sessions: [...SESSIONS],
      currentSessionId: SESSION_ID,
      sessionMounts: {},
      sessionProjectMounts: PROJECT_MOUNTS,
      monitorSnapshot: null,
      monitorLedger: [],
      monitorError: null,
      monitorScanned: {},
      monitorPinned: [],
      monitorHidden: [],
      monitorLearned: PORTS_LEARNED,
    });
    useAppStore
      .getState()
      .openStudio({ studio: { kind: 'monitoring', target: MONITORING_TARGET } });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <PageSheet>
        <MonitoringStudio onClose={NOOP} />
      </PageSheet>
    </main>
  );
};

export const U37_MONITORING_BRANCH_SCENES = {
  'u37-monitoring-branch': () => <MonitoringBranchScene />,
};
