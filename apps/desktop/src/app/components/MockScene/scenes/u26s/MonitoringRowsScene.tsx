import { useEffect, useState } from 'react';
import type { LedgerRow, MonitorSnapshot, WatchedPort } from '@goodboy/core';
import { MonitoringStudio } from '../../../../../features/monitoring/components/MonitoringStudio';
import { useAppStore } from '../../../../../store';
import { useSceneClicks } from '../audit/useSceneClicks';
import { PageSheet } from '../PageSheet';
import { installSceneDatabase } from '../sceneDatabase';
import {
  EMPTY_SNAPSHOT,
  PROJECTS,
  SESSIONS,
  SESSION_ID,
  SESSION_MOUNTS,
  WORKSPACE,
  WORKSPACE_ID,
} from '../u24/monitoringSeed';
import { BUSY_LEARNED, BUSY_LEDGER, BUSY_SCANNED, BUSY_SNAPSHOT } from '../u25/bMonitoringSeed';

type Variant = 'rows' | 'hover' | 'menu' | 'confirm' | 'empty';

type Props = {
  readonly variant: Variant;
};

const NOOP = () => undefined;

const CLICK_MS = 300;

const DOCKER_PID = 31740;

const SNAPSHOT: MonitorSnapshot = {
  ...BUSY_SNAPSHOT,
  listeners: BUSY_SNAPSHOT.listeners.filter((listener) => listener.pid !== DOCKER_PID),
  processes: BUSY_SNAPSHOT.processes.filter((process) => process.pid !== DOCKER_PID),
};

const FREE_PORTS = [5001, 5002, 5003, 7001, 7002];

const SCANNED: Readonly<Record<string, ReadonlyArray<WatchedPort>>> = Object.fromEntries(
  Object.entries(BUSY_SCANNED).map(([projectId, ports]) => [
    projectId,
    ports.filter((port) => port.port === 5005 || FREE_PORTS.includes(port.port)),
  ]),
);

const LEDGER: ReadonlyArray<LedgerRow> = BUSY_LEDGER;

const SETTINGS: Readonly<Record<string, string>> = {
  'monitor.pinnedPorts': JSON.stringify([
    { port: 3000, description: 'Ledger web' },
    { port: 9000, description: 'Mock API' },
  ]),
  'monitor.hiddenPorts': JSON.stringify([]),
};

const HOVER_ROW = '5005';

const HOVER_STYLE = `[data-port-row="${HOVER_ROW}"] { background-image: linear-gradient(var(--color-overlay-hover), var(--color-overlay-hover)); }
[data-port-row="${HOVER_ROW}"] .row-actions { opacity: 1; }`;

type AnswerParams = {
  readonly variant: Variant;
  readonly command: string;
  readonly payload: unknown;
};

const answerOf = ({ variant, command, payload }: AnswerParams) => {
  const isEmpty = variant === 'empty';
  if (command === 'monitor_snapshot') {
    return isEmpty ? EMPTY_SNAPSHOT : SNAPSHOT;
  }
  if (command === 'process_ledger_list') {
    return isEmpty ? [] : LEDGER;
  }
  if (command === 'monitor_watched_ports') {
    const root =
      typeof payload === 'object' && payload !== null && 'projectRoot' in payload
        ? String(payload.projectRoot)
        : '';
    const project = PROJECTS.find((item) => item.rootPath === root);
    return project === undefined || isEmpty ? [] : (SCANNED[project.id] ?? []);
  }
  return null;
};

const CLICKS: Readonly<Record<Variant, ReadonlyArray<string>>> = {
  rows: [],
  hover: [],
  menu: ['Actions for :4001'],
  confirm: ['Stop vite'],
  empty: [],
};

const MonitoringRowsScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installSceneDatabase({
      settings: variant === 'empty' ? {} : SETTINGS,
      fallback: ({ command, payload }) => answerOf({ variant, command, payload }),
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
      monitorLearned: variant === 'empty' ? {} : BUSY_LEARNED,
      monitorStopping: {},
    });
    useAppStore.getState().openStudio({ studio: { kind: 'monitoring' } });
    setIsReady(true);
  }, [variant]);

  useSceneClicks({
    isReady,
    labels: CLICKS[variant],
    selector: 'button',
    match: 'prefix',
    intervalMs: CLICK_MS,
  });

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      {variant === 'hover' ? <style>{HOVER_STYLE}</style> : null}
      <PageSheet>
        <MonitoringStudio onClose={NOOP} />
      </PageSheet>
    </main>
  );
};

export const U26S_MONITORING_SCENES = {
  'u26s-monitoring-rows': () => <MonitoringRowsScene variant="rows" />,
  'u26s-monitoring-hover': () => <MonitoringRowsScene variant="hover" />,
  'u26s-monitoring-menu': () => <MonitoringRowsScene variant="menu" />,
  'u26s-monitoring-confirm': () => <MonitoringRowsScene variant="confirm" />,
  'u26s-monitoring-empty': () => <MonitoringRowsScene variant="empty" />,
};
