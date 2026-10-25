import { useEffect, useState } from 'react';
import type { LedgerRow, MonitorProcess, MonitorSnapshot } from '@goodboy/core';
import { MonitoringStudio } from '../../../../../features/monitoring/components/MonitoringStudio';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { useSceneClicks } from '../audit/useSceneClicks';
import { mockSceneIpc } from '../mockSceneIpc';
import {
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

type Variant = 'leftovers' | 'stopconfirm' | 'forcestop';

type Props = {
  readonly variant: Variant;
};

const NOOP = () => undefined;
const CLICK_MS = 300;
const HOUR = 3_600_000;
const TAKEN_AT = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' }).ms({
  at: '2026-10-10T09:12:00.000Z',
});
const REFUNDS_SESSION = SESSIONS[1];
const AUDIT_SESSION = SESSIONS[2];
const REFUNDS_TREE = '/mock/worktrees/hl-refund-rounding/payments-api';
const AUDIT_TREE = '/mock/worktrees/hl-audit-trail/payments-api';

type LeftoverProcessParams = {
  readonly pid: number;
  readonly name: string;
  readonly cwd: string;
  readonly ageMs: number;
};

const leftoverProcess = ({ pid, name, cwd, ageMs }: LeftoverProcessParams): MonitorProcess => ({
  pid,
  ppid: 1,
  pgid: pid - 1,
  name,
  cwd,
  startedAt: TAKEN_AT - ageMs,
  cpuPercent: 0,
  rssBytes: 180 * 1024 * 1024,
  uid: 501,
  argsMasked: name,
});

const LEFTOVER_PROCESSES: ReadonlyArray<MonitorProcess> = [
  leftoverProcess({ pid: 6101, name: 'next-server', cwd: REFUNDS_TREE, ageMs: 9 * HOUR }),
  leftoverProcess({ pid: 6201, name: 'esbuild', cwd: AUDIT_TREE, ageMs: 5 * HOUR }),
];

const LEFTOVER_LEDGER: ReadonlyArray<LedgerRow> = [
  {
    spawnId: 'mock-u24-spawn-left-next',
    kind: 'turn',
    pid: 6100,
    pgid: 6100,
    sessionId: REFUNDS_SESSION?.id ?? null,
    mountPath: REFUNDS_TREE,
    cwd: REFUNDS_TREE,
    startedAt: TAKEN_AT - 9 * HOUR,
  },
  {
    spawnId: 'mock-u24-spawn-left-esbuild',
    kind: 'script',
    pid: 6200,
    pgid: 6200,
    sessionId: AUDIT_SESSION?.id ?? null,
    mountPath: AUDIT_TREE,
    cwd: AUDIT_TREE,
    startedAt: TAKEN_AT - 5 * HOUR,
  },
];

const LEFTOVER_SNAPSHOT: MonitorSnapshot = {
  ...SNAPSHOT,
  processes: [...SNAPSHOT.processes, ...LEFTOVER_PROCESSES],
};

const answerOf =
  ({ variant }: Props) =>
  (command: string, payload: unknown) => {
    if (command === 'monitor_snapshot') {
      return variant === 'leftovers' ? LEFTOVER_SNAPSHOT : SNAPSHOT;
    }
    if (command === 'process_ledger_list') {
      return variant === 'leftovers' ? [...LEDGER, ...LEFTOVER_LEDGER] : LEDGER;
    }
    if (command === 'monitor_stop') {
      return { outcome: 'still-running', reason: 'The process did not exit in time.' };
    }
    if (command === 'monitor_watched_ports') {
      const root =
        typeof payload === 'object' && payload !== null && 'projectRoot' in payload
          ? String(payload.projectRoot)
          : '';
      const project = PROJECTS.find((item) => item.rootPath === root);
      return project === undefined ? [] : (SCANNED[project.id] ?? NO_SCANNED[project.id] ?? []);
    }
    return null;
  };

const CLICKS: Readonly<Record<Variant, ReadonlyArray<string>>> = {
  leftovers: [],
  stopconfirm: ['Stop node'],
  forcestop: ['Stop node'],
};

const CONFIRM_CLICKS: Readonly<Record<Variant, ReadonlyArray<string>>> = {
  leftovers: [],
  stopconfirm: [],
  forcestop: ['Stop'],
};

const MonitoringStopScene = ({ variant }: Props) => {
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
      monitorPinned: [],
      monitorHidden: [],
      monitorLearned: {},
      monitorStopping: {},
      monitorSweptCount: variant === 'leftovers' ? 3 : 0,
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
  useSceneClicks({
    isReady,
    labels: CONFIRM_CLICKS[variant],
    selector: '[data-confirm-action]',
    match: 'prefix',
    intervalMs: CLICK_MS * 4,
  });

  if (!isReady) {
    return null;
  }
  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <MonitoringStudio onClose={NOOP} />
    </main>
  );
};

export const U24_MONITORING_STOP_SCENES = {
  'monitoring-leftovers': () => <MonitoringStopScene variant="leftovers" />,
  'monitoring-stopconfirm': () => <MonitoringStopScene variant="stopconfirm" />,
  'monitoring-forcestop': () => <MonitoringStopScene variant="forcestop" />,
};
