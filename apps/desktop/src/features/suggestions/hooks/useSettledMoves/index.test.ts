// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import type { NextStepSignals } from '../../nextStepSignals';
import type { NextMove } from '../../types';
import { useSettledMoves } from '.';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });

const move: NextMove = {
  id: 'run-failing-test:mount-ledger-core',
  kind: 'next-script',
  priority: 46,
  band: 2,
  title: 'Run db:migrate',
  detail: 'A migration changed in the last turn',
  sessionId: SESSION,
  targetKey: 'script:mount-ledger-core',
  fingerprint: 'next-script:mount-ledger-core:migrations:1',
  payload: {
    mountId: MOUNT,
    scriptId: 'script-db-migrate',
    scriptName: 'db:migrate',
    turnAtMs: 0,
    rule: 'migrations',
    command: {
      text: 'pnpm run db:migrate',
      cwd: '/work/ledger-core',
      mode: 'type',
      scriptId: null,
    },
  },
  reason: 'A migration changed in the last turn',
  evidence: [],
  place: { tool: 'terminal', mountId: MOUNT, agentId: null },
  completesWhen: {
    kind: 'script-succeeds',
    scriptId: 'script-db-migrate',
    scriptName: 'db:migrate',
    sinceMs: 0,
  },
  group: 'advance',
  read: null,
};

const signals = (isDone: boolean): NextStepSignals => ({
  sessionId: SESSION,
  workflowRuns: [],
  plans: [],
  consumedPlanIds: new Set(),
  openQuestionCount: 0,
  hasPullRequest: false,
  eligibleThreadCount: 0,
  mountEvents: [],
  projects: [],
  scriptRuns: isDone
    ? [
        {
          scriptId: 'script-db-migrate',
          mountId: MOUNT,
          name: 'db:migrate',
          isOk: true,
          completedAt: Date.now(),
        },
      ]
    : [],
});

describe('useSettledMoves', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a quiet line for two seconds after a move is done, then lets it go', () => {
    const { result, rerender } = renderHook(
      (props: { moves: ReadonlyArray<NextMove>; signals: NextStepSignals }) =>
        useSettledMoves(props),
      { initialProps: { moves: [move], signals: signals(false) } },
    );
    expect(result.current).toEqual([]);

    rerender({ moves: [], signals: signals(true) });
    expect(result.current.map((row) => row.text)).toEqual(['db:migrate finished']);

    act(() => {
      vi.advanceTimersByTime(1_900);
    });
    expect(result.current).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toEqual([]);
  });
});
