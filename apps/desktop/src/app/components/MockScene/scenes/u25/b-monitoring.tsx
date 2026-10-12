import { useEffect, useState } from 'react';
import { MonitoringStudio } from '../../../../../features/monitoring/components/MonitoringStudio';
import { useAppStore } from '../../../../../store';
import { useSceneClicks } from '../audit/useSceneClicks';
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
import {
  BUSY_LEARNED,
  BUSY_LEDGER,
  BUSY_SCANNED,
  BUSY_SETTINGS,
  BUSY_SNAPSHOT,
} from './bMonitoringSeed';

type Variant = 'busy' | 'expanded';

type Props = {
  readonly variant: Variant;
};

const NOOP = () => undefined;

const CLICK_MS = 300;

const BUTTON_CLICKS: Readonly<Record<Variant, ReadonlyArray<string>>> = {
  busy: [],
  expanded: [
    'Show 9 ports of com.docker.backend',
    'Show 2 ports of tilt',
    '5 free: :5001',
    'Listening on this Mac',
  ],
};

type AnswerParams = {
  readonly command: string;
  readonly payload: unknown;
};

const answerOf = ({ command, payload }: AnswerParams) => {
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

const BusyMonitoringScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installSceneDatabase({
      settings: BUSY_SETTINGS,
      fallback: (command, payload) => answerOf({ command, payload }),
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
      monitorLearned: BUSY_LEARNED,
    });
    useAppStore.getState().openStudio({ studio: { kind: 'monitoring' } });
    setIsReady(true);
  }, [variant]);

  useSceneClicks({
    isReady,
    labels: BUTTON_CLICKS[variant],
    selector: 'button',
    match: 'prefix',
    intervalMs: CLICK_MS,
  });

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

export const U25_B_MONITORING_SCENES = {
  'b-monitoring-busy': () => <BusyMonitoringScene variant="busy" />,
  'b-monitoring-expanded': () => <BusyMonitoringScene variant="expanded" />,
};
