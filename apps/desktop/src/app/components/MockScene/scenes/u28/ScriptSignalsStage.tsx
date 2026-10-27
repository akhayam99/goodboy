import { useEffect, useState } from 'react';
import {
  brandId,
  type MountId,
  type ProjectId,
  type Session,
  type SessionId,
  type SessionProjectMount,
  type WorkspaceId,
} from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { dispatchWindowEvent } from '../../../../../shared/lib/dispatchWindowEvent';
import { ScriptEndToastBridge } from '../../../../../features/scripts/components/ScriptEndToastBridge';
import { SessionTools } from '../../../../../features/session/components/SessionTools';
import type { ScriptRunRecord } from '../../../../../features/scripts/scripts';
import type { TerminalTabId } from '../../../../../shared/types/terminal';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-22T11:20:00.000Z' });

const NOW = clock.iso({ at: '2026-10-22T11:20:00.000Z' });
const EARLIER = clock.iso({ at: '2026-10-22T10:40:00.000Z' });

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'mock-script-signals-workspace' });
const SESSION_ID = brandId<SessionId>({ value: 'mock-script-signals-session-settlement' });
const OTHER_SESSION_ID = brandId<SessionId>({ value: 'mock-script-signals-session-refunds' });
const PROJECT_ID = brandId<ProjectId>({ value: 'mock-script-signals-project-ledger' });
const MOUNT_ID = brandId<MountId>({ value: 'mock-script-signals-mount-ledger' });
const TERMINAL_ID = brandId<TerminalTabId>({ value: 'mock-script-signals-terminal' });
const DRIFT_KEY = 'mock-script-signals-drift';

type SessionSeed = {
  readonly id: SessionId;
  readonly goal: string;
};

const sessionOf = ({ id, goal }: SessionSeed): Session => ({
  id,
  workspaceId: WORKSPACE_ID,
  goal,
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: EARLIER,
  updatedAt: NOW,
});

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'ledger-core',
  worktreePath: '/mock/harborline/ledger-core-settlement',
  lastWorktreePath: null,
  repoRoot: '/mock/harborline/ledger-core',
  branch: 'nw/fix-settlement-replay',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const DRIFT_RUN: ScriptRunRecord = {
  status: 'error',
  result: { stdout: 'FAIL postings/rounding.test.ts\nExit 1', stderr: '', exitCode: 1 },
  runId: 'mock-script-signals-run-drift',
  startedAt: clock.ms({ at: '2026-10-22T11:05:00.000Z' }),
  completedAt: clock.ms({ at: '2026-10-22T11:05:12.000Z' }),
  name: 'Check posting drift',
  mountId: MOUNT_ID,
};

export const ScriptSignalsStage = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    useAppStore.setState({
      sessions: [
        sessionOf({ id: SESSION_ID, goal: 'Fix the settlement replay' }),
        sessionOf({ id: OTHER_SESSION_ID, goal: 'Refund webhook retries' }),
      ],
      currentSessionId: SESSION_ID,
      sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
      scriptRuns: { [SESSION_ID]: { [DRIFT_KEY]: DRIFT_RUN } },
      scriptRunsSeen: {},
      terminalFinishes: {
        [SESSION_ID]: {
          terminalId: TERMINAL_ID,
          title: 'zsh',
          command: 'pnpm test',
          durationMs: 42_000,
        },
      },
      sessionDecisions: { [SESSION_ID]: [] },
    });
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = window.setTimeout(() => {
      useAppStore.setState({ currentSessionId: OTHER_SESSION_ID });
      dispatchWindowEvent({
        name: 'goodboy:script-ended',
        detail: { sessionId: SESSION_ID, scriptKey: DRIFT_KEY, runId: DRIFT_RUN.runId },
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <ToastProvider>
      <ScriptEndToastBridge />
      <main className="flex min-h-screen justify-end bg-background text-foreground">
        <SessionTools sessionId={SESSION_ID} />
      </main>
    </ToastProvider>
  );
};
