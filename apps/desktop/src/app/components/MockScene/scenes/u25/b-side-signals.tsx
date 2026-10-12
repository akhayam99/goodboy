import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import type { LedgerRow, MonitorSnapshot, PinnedPort } from '@goodboy/core';
import { useAppStore } from '../../../../../store';
import type { TerminalTab, TerminalTabId } from '../../../../../shared/types/terminal';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { sceneClock } from '../../sceneClock';
import { SidebarNavColumnScene } from '../u23/SidebarNavColumnScene';

const clock = sceneClock({ anchor: '2026-10-12T09:00:00.000Z' });
const NOW = clock.ms({ at: '2026-10-12T09:00:00.000Z' });
const MINUTE = 60_000;
const WORKSPACE_KEY = brandedId<WorkspaceId>({ value: 'mock-b-side-signals-workspace' });

const SNAPSHOT: MonitorSnapshot = {
  listeners: [
    { port: 4300, address: '127.0.0.1', protocol: 'tcp', pid: 4300 },
    { port: 5005, address: '127.0.0.1', protocol: 'tcp', pid: 5005 },
    { port: 9000, address: '127.0.0.1', protocol: 'tcp', pid: 9000 },
  ],
  processes: [4300, 5005, 9000].map((pid) => ({
    pid,
    ppid: 1,
    pgid: pid,
    name: 'node',
    cwd: null,
    startedAt: NOW - 12 * MINUTE,
    cpuPercent: 0.4,
    rssBytes: 120 * 1024 * 1024,
    uid: 501,
    argsMasked: 'node server.js',
  })),
  takenAt: NOW,
  isPlatformSupported: true,
};

const LEDGER: ReadonlyArray<LedgerRow> = [
  {
    spawnId: 'mock-b-side-signals-dev',
    kind: 'script',
    pid: 4300,
    pgid: 4300,
    sessionId: null,
    mountPath: null,
    cwd: null,
    startedAt: NOW - 12 * MINUTE,
  },
];

const PINNED: ReadonlyArray<PinnedPort> = [
  { port: 5005, description: 'Payments web' },
  { port: 9000, description: 'Mock API' },
];

type TabParams = {
  readonly id: string;
  readonly title: string;
};

const tabOf = ({ id, title }: TabParams): TerminalTab => ({
  id: brandedId<TerminalTabId>({ value: id }),
  owner: { kind: 'workspace', workspaceId: WORKSPACE_KEY },
  title,
  cwd: null,
  status: 'running',
  createdAt: NOW - 5 * MINUTE,
});

type Props = {
  readonly isBusy: boolean;
};

const SideSignalsScene = ({ isBusy }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    useAppStore.setState({
      terminalTabs: isBusy
        ? {
            [WORKSPACE_KEY]: [
              tabOf({ id: 'dev', title: 'dev' }),
              tabOf({ id: 'api', title: 'api' }),
            ],
          }
        : {},
      monitorSnapshot: isBusy ? SNAPSHOT : null,
      monitorLedger: isBusy ? LEDGER : [],
      monitorPinned: isBusy ? PINNED : [],
      monitorHidden: [],
      monitorScanned: {},
      monitorLearned: {},
    });
    setIsReady(true);
  }, [isBusy]);
  if (!isReady) {
    return null;
  }
  return <SidebarNavColumnScene config={{}} />;
};

export const U25_B_SIDE_SIGNALS_SCENES = {
  'side-signals-running': () => <SideSignalsScene isBusy />,
  'side-signals-idle': () => <SideSignalsScene isBusy={false} />,
};
