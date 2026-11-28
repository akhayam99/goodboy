import { useEffect, useState } from 'react';
import { MonitoringDrawer } from '../../../../../../features/monitoring/components/MonitoringStudio/MonitoringDrawer';
import { useAppStore } from '../../../../../../store';
import { installSceneDatabase } from '../../sceneDatabase';
import {
  PROJECTS,
  SESSIONS,
  SESSION_ID as MONITOR_SESSION_ID,
  SESSION_MOUNTS,
  WORKSPACE,
  WORKSPACE_ID,
} from '../../u24/monitoringSeed';
import {
  BUSY_LEARNED,
  BUSY_LEDGER,
  BUSY_SCANNED,
  BUSY_SETTINGS,
  BUSY_SNAPSHOT,
} from '../../u25/bMonitoringSeed';

const NOOP = () => undefined;

type AnswerParams = {
  readonly command: string;
  readonly payload: unknown;
};

const monitorAnswerOf = ({ command, payload }: AnswerParams): unknown => {
  if (command === 'monitor_snapshot') {
    return BUSY_SNAPSHOT;
  }
  if (command === 'process_ledger_list') {
    return BUSY_LEDGER;
  }
  if (command === 'monitor_watched_ports') {
    const root =
      typeof payload === 'object' && payload !== null && 'projectRoot' in payload
        ? String(payload.projectRoot)
        : '';
    const project = PROJECTS.find((item) => item.rootPath === root);
    return project === undefined ? [] : (BUSY_SCANNED[project.id] ?? []);
  }
  return null;
};

export const MonitorFrameScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installSceneDatabase({
      settings: BUSY_SETTINGS,
      fallback: ({ command, payload }) => monitorAnswerOf({ command, payload }),
    });
    useAppStore.setState({
      workspaces: [WORKSPACE],
      currentWorkspaceId: WORKSPACE_ID,
      projects: [...PROJECTS],
      sessions: [...SESSIONS],
      currentSessionId: MONITOR_SESSION_ID,
      sessionMounts: SESSION_MOUNTS,
      monitorSnapshot: null,
      monitorLedger: [],
      monitorError: null,
      monitorScanned: {},
      monitorPinned: [],
      monitorHidden: [],
      monitorLearned: BUSY_LEARNED,
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }
  return (
    <main className="flex h-screen justify-end overflow-hidden bg-background p-2 text-foreground">
      <div className="flex h-full w-[440px] min-w-0 flex-col overflow-hidden rounded-frame border border-frame-edge bg-drawer">
        <MonitoringDrawer onClose={NOOP} />
      </div>
    </main>
  );
};
