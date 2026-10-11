import { useEffect, useState } from 'react';
import { MonitoringStudio } from '../../../../../features/monitoring/components/MonitoringStudio';
import { useAppStore } from '../../../../../store';
import { useSceneClicks } from '../audit/useSceneClicks';
import { PageSheet } from '../PageSheet';
import { mockSceneIpc } from '../mockSceneIpc';
import {
  EMPTY_SNAPSHOT,
  LEDGER,
  NO_SCANNED,
  PROJECTS,
  SCANNED,
  SESSIONS,
  SESSION_ID,
  SESSION_MOUNTS,
  SNAPSHOT,
  WORKSPACE,
  WORKSPACE_ID,
} from './monitoringSeed';

type Variant = 'ports' | 'alsolistening' | 'empty' | 'failed';

type Props = {
  readonly variant: Variant;
};

const NOOP = () => undefined;

const CLICK_MS = 300;

const answerOf =
  ({ variant }: Props) =>
  (command: string, payload: unknown) => {
    if (command === 'monitor_snapshot') {
      if (variant === 'failed') {
        throw new Error('ps exited with status 1');
      }
      return variant === 'empty' ? EMPTY_SNAPSHOT : SNAPSHOT;
    }
    if (command === 'process_ledger_list') {
      return variant === 'empty' ? [] : LEDGER;
    }
    if (command === 'monitor_watched_ports') {
      const root =
        typeof payload === 'object' && payload !== null && 'projectRoot' in payload
          ? String(payload.projectRoot)
          : '';
      const project = PROJECTS.find((item) => item.rootPath === root);
      const scanned = variant === 'empty' ? NO_SCANNED : SCANNED;
      return project === undefined ? [] : (scanned[project.id] ?? []);
    }
    return null;
  };

const MonitoringScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    mockSceneIpc(answerOf({ variant }));
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
      monitorWatched: {},
      monitorLearned: {},
    });
    useAppStore.getState().openStudio({ studio: { kind: 'monitoring' } });
    setIsReady(true);
  }, [variant]);

  useSceneClicks({
    isReady,
    labels: variant === 'alsolistening' ? ['Also listening'] : [],
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

export const U24_MONITORING_SCENES = {
  'monitoring-ports': () => <MonitoringScene variant="ports" />,
  'monitoring-alsolistening': () => <MonitoringScene variant="alsolistening" />,
  'monitoring-empty': () => <MonitoringScene variant="empty" />,
  'monitoring-failed': () => <MonitoringScene variant="failed" />,
};
