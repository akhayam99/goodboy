import { useEffect, useState } from 'react';
import type { IsoDateTime, ProviderRunId, Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';
import { AppFrame } from './AppFrame';
import { seedFrameChromeStubs } from './frameSeed';
import { sceneParam } from './sceneParams';

const GOALS = [
  'Stop notify-relay from retrying settlement webhooks forever when payments-api returns a 409',
  'Fix the half-cent rounding drift in ledger-core postings for multi-currency batches',
  'Add per-tenant rate limiting to the public payments-api',
  'Draft the first-run onboarding checklist',
  'Rewrite the billing-api retry queue to deduplicate by idempotency key',
  'Surface stuck deliveries in the Harborline web-console',
  'Reconcile the nightly settlement export against the Acme ledger',
  'Migrate web-console to the new design tokens',
  'Split the ledger reconciliation rewrite into reviewable parts',
  'Harden webhook signature verification and replay handling',
  'Add monthly ledger exports for finance',
  'Investigate the flaky payments-api integration suite on CI',
];

const SESSION_COUNT = 36;

type AgoParams = {
  readonly ms: number;
};

const isoAgo = ({ ms }: AgoParams): IsoDateTime =>
  new Date(Date.now() - ms).toISOString() as IsoDateTime;

type IndexParams = {
  readonly index: number;
};

const sessionState = ({ index }: IndexParams): Session['state'] => {
  if (index % 5 === 0) {
    return {
      kind: 'running',
      runId: `mock-states-board-run-${index}` as ProviderRunId,
      startedAt: isoAgo({ ms: index * 60_000 }),
    };
  }
  if (index % 7 === 0) {
    return { kind: 'ended', endedAt: isoAgo({ ms: index * 3_600_000 }) };
  }
  return { kind: 'idle', lastActivityAt: isoAgo({ ms: index * 1_800_000 }) };
};

const goalAt = ({ index }: IndexParams): string => {
  const goal = GOALS[index % GOALS.length] ?? 'Task';
  if (index < GOALS.length) {
    return goal;
  }
  return `${goal} (part ${Math.floor(index / GOALS.length) + 1})`;
};

type ManyParams = {
  readonly base: Session;
};

const manySessions = ({ base }: ManyParams): ReadonlyArray<Session> =>
  Array.from({ length: SESSION_COUNT }, (_, index) => ({
    ...base,
    id: `mock-states-board-session-${index}` as SessionId,
    goal: goalAt({ index }),
    state: sessionState({ index }),
    workflowRuns: [],
    contextSlots: [],
    createdAt: isoAgo({ ms: index * 3_600_000 }),
    updatedAt: isoAgo({ ms: index * 1_800_000 }),
  }));

type ModeParams = {
  readonly mode: string;
};

const seedBoardMode = ({ mode }: ModeParams): void => {
  const state = useAppStore.getState();
  const base = state.sessions[0];
  useAppStore.setState({
    projectGitStatus:
      mode === 'blocked'
        ? Object.fromEntries(
            Object.entries(state.projectGitStatus).map(([key, value]) => [
              key,
              { ...value, state: 'missing' },
            ]),
          )
        : state.projectGitStatus,
    sessions: mode === 'many' && base !== undefined ? manySessions({ base }) : [],
    currentSessionId: null,
    archivedSessions: { [WORKSPACE_ID]: [] },
    loadArchivedSessions: async () => undefined,
  });
};

export const BoardStatesScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedBoardScene();
    seedFrameChromeStubs();
    seedBoardMode({ mode: sceneParam({ key: 'mode' }) ?? 'many' });
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="board" isRailCollapsed={false} />;
};
