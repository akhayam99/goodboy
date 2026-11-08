import { useEffect, useState } from 'react';
import type { LedgerRow, MonitorProcess, MonitorSnapshot } from '@goodboy/core/monitoring';
import type { Session, SessionProjectMount } from '@goodboy/types';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { sceneClock } from '../../sceneClock';
import { SESSION_ID, seedActivityRunScene } from '../activityRunSeed';
import { mockSceneIpc } from '../mockSceneIpc';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });
const TAKEN_AT = clock.ms({ at: '2026-10-10T09:12:00.000Z' });
const MINUTE = 60_000;
const DEV_PID = 4100;
const API_PID = 4310;

type Variant = 'running' | 'idle';

type Props = {
  readonly variant: Variant;
};

type ProcessParams = {
  readonly pid: number;
  readonly name: string;
  readonly args: string;
  readonly cwd: string;
  readonly ageMinutes: number;
};

const processOf = ({ pid, name, args, cwd, ageMinutes }: ProcessParams): MonitorProcess => ({
  pid,
  ppid: 1,
  pgid: pid,
  name,
  cwd,
  startedAt: TAKEN_AT - ageMinutes * MINUTE,
  cpuPercent: 0.6,
  rssBytes: 160 * 1024 * 1024,
  uid: 501,
  argsMasked: args,
});

type SeedParams = {
  readonly mount: SessionProjectMount;
};

type Seed = {
  readonly snapshot: MonitorSnapshot;
  readonly ledger: ReadonlyArray<LedgerRow>;
};

const runningSeedOf = ({ mount }: SeedParams): Seed => {
  const cwd = mount.worktreePath;
  return {
    snapshot: {
      listeners: [
        { port: 5173, address: '127.0.0.1', protocol: 'tcp', pid: DEV_PID },
        { port: 4310, address: '127.0.0.1', protocol: 'tcp', pid: API_PID },
      ],
      processes: [
        processOf({ pid: DEV_PID, name: 'vite', args: 'vite --port 5173', cwd, ageMinutes: 42 }),
        processOf({ pid: API_PID, name: 'node', args: 'node server.js', cwd, ageMinutes: 9 }),
      ],
      takenAt: TAKEN_AT,
      isPlatformSupported: true,
    },
    ledger: [
      {
        spawnId: 'mock-u37-spawn-terminal',
        kind: 'terminal',
        pid: DEV_PID,
        pgid: DEV_PID,
        sessionId: SESSION_ID,
        mountPath: cwd,
        cwd,
        startedAt: TAKEN_AT - 42 * MINUTE,
        mountId: mount.mountId,
        branch: mount.branch,
      },
      {
        spawnId: 'mock-u37-spawn-agent',
        kind: 'turn',
        pid: API_PID,
        pgid: API_PID,
        sessionId: SESSION_ID,
        mountPath: cwd,
        cwd,
        startedAt: TAKEN_AT - 9 * MINUTE,
        mountId: mount.mountId,
        branch: mount.branch,
      },
    ],
  };
};

const IDLE_SEED: Seed = {
  snapshot: { listeners: [], processes: [], takenAt: TAKEN_AT, isPlatformSupported: true },
  ledger: [],
};

const RunningHereScene = ({ variant }: Props) => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    seedActivityRunScene();
    const state = useAppStore.getState();
    const mounts = state.sessionProjectMounts[SESSION_ID] ?? [];
    const activeId = state.sessionActiveMount[SESSION_ID];
    const mount = mounts.find((item) => item.mountId === activeId) ?? mounts[0];
    if (mount === undefined) {
      throw new Error('The running here scene needs a seeded branch.');
    }
    const seed = variant === 'running' ? runningSeedOf({ mount }) : IDLE_SEED;
    mockSceneIpc((command) => {
      if (command === 'monitor_snapshot') {
        return seed.snapshot;
      }
      if (command === 'process_ledger_list') {
        return seed.ledger;
      }
      return null;
    });
    useAppStore.setState({ monitorSnapshot: seed.snapshot, monitorLedger: seed.ledger });
    setSession(sessionById(state.sessions, SESSION_ID) ?? null);
  }, [variant]);

  if (session === null) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <WorktreeSceneColumn>
        <BranchPage session={session} workingDir={null} />
      </WorktreeSceneColumn>
    </main>
  );
};

export const U37_RUNNING_HERE_SCENES = {
  'u37-running-here': () => <RunningHereScene variant="running" />,
  'u37-running-here-idle': () => <RunningHereScene variant="idle" />,
};
