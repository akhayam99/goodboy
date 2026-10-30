import { brandId, type Agent, type AgentId, type IsoDateTime } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { sceneClock } from '../../sceneClock';
import { centralAutoSeedOf } from '../u26/centralAutoSeed';
import { COLUMN_SESSION_ID, seedCentralColumn } from '../u26/centralColumnSeed';

const clock = sceneClock({ anchor: '2026-10-18T10:31:00.000Z' });

type TimeParams = {
  readonly time: string;
};

const finishedAt = ({ time }: TimeParams): IsoDateTime =>
  clock.iso({ at: `2026-10-18T${time}:00.000Z` });

type FinishedParams = {
  readonly key: string;
  readonly kind: string;
  readonly provider: 'anthropic' | 'codex';
  readonly time: string;
  readonly summary: string;
  readonly ordinal: number;
};

const finishedAgentOf = ({
  key,
  kind,
  provider,
  time,
  summary,
  ordinal,
}: FinishedParams): Agent => ({
  id: brandId<AgentId>({ value: `mock-new-since-${key}` }),
  sessionId: COLUMN_SESSION_ID,
  ordinal,
  name: `run-${key}`,
  kind,
  status: 'completed',
  providerOverride: provider,
  outputSummary: summary,
  startedAt: finishedAt({ time }),
  completedAt: finishedAt({ time }),
  lastFinishedAt: finishedAt({ time }),
});

const RAW_AGENTS: ReadonlyArray<Agent> = [
  finishedAgentOf({
    key: 'tester',
    kind: 'tester',
    provider: 'codex',
    time: '09:30',
    ordinal: 60,
    summary: 'cluster 1/2 green: typecheck/lint/knip/oxfmt/vitest ok, no commit',
  }),
  finishedAgentOf({
    key: 'implementer',
    kind: 'implementer',
    provider: 'anthropic',
    time: '08:30',
    ordinal: 61,
    summary: 'commit e83d1a0 verified: vitest green, typecheck fails only from the worktree env',
  }),
  finishedAgentOf({
    key: 'reviewer',
    kind: 'reviewer',
    provider: 'anthropic',
    time: '07:30',
    ordinal: 62,
    summary: 'pr 61 draft: oxfmt/knip/hook tests green; tsc 2 errors in untouched files',
  }),
];

export const seedNewSince = (): void => {
  seedCentralColumn({ kind: 'orchestrated' });
  const auto = centralAutoSeedOf({ variant: 'done' });
  const autoAgents = auto.agents.map((agent): Agent => {
    const base = { ...agent, sessionId: COLUMN_SESSION_ID, ordinal: agent.ordinal + 40 };
    return agent.kind === 'auto'
      ? {
          ...base,
          status: 'completed',
          completedAt: finishedAt({ time: '09:50' }),
          lastFinishedAt: finishedAt({ time: '09:50' }),
          providerOverride: 'anthropic',
        }
      : base;
  });
  useAppStore.setState((state) => {
    const current = state.sessionPhaseRuns[COLUMN_SESSION_ID] ?? [];
    const orchestrated = current.map((agent): Agent =>
      agent.workflowRunId === undefined
        ? agent
        : { ...agent, lastFinishedAt: agent.completedAt ?? finishedAt({ time: '10:20' }) },
    );
    const finishedRuns = (sessionById(state.sessions, COLUMN_SESSION_ID)?.workflowRuns ?? []).map(
      (run) => ({
        ...run,
        orchestrationOutcome: 'done' as const,
        orchestratorSummary:
          'Mapped the payout code, wrote the limit plan and built the limit table.',
      }),
    );
    return {
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [COLUMN_SESSION_ID]: [...orchestrated, ...RAW_AGENTS, ...autoAgents],
      },
      sessions: state.sessions.map((session) =>
        session.id === COLUMN_SESSION_ID ? { ...session, workflowRuns: finishedRuns } : session,
      ),
      orchestratingWorkflowRuns: {},
      autoTreeViews: {
        [COLUMN_SESSION_ID]: [
          { ...auto.view, tree: { ...auto.view.tree, sessionId: COLUMN_SESSION_ID } },
        ],
      },
    };
  });
};
