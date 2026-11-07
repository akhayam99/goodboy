import { useEffect, useState } from 'react';
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

const MONITORING_BRANCH = SESSION_MOUNTS[SESSION_ID]?.[0]?.branch ?? null;

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
      sessionMounts: SESSION_MOUNTS,
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
      .openStudio({ studio: { kind: 'monitoring', branch: MONITORING_BRANCH } });
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
