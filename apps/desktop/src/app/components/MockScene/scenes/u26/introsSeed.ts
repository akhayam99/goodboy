import type { Agent, AgentId } from '@goodboy/types';
import { useAppStore, type LensKind } from '../../../../../store';
import type { SESSION_PAGE_INTRO } from '../../../../../features/session/sessionPageIntro';
import { sceneClock } from '../../sceneClock';
import { C09_SESSION_ID, seedC09 } from '../u25/c09OrchestratedSeed';

export type IntroPage = keyof typeof SESSION_PAGE_INTRO;

const LENS_OF: Readonly<Record<IntroPage, LensKind>> = {
  runs: 'workflows',
};

const clock = sceneClock({ anchor: '2026-10-16T15:12:00.000Z' });

const idOf = <T>(value: string): T => JSON.parse(JSON.stringify(value));

const IMPLEMENTER_ID = idOf<AgentId>('mock-u26-intros-implementer');
const REVIEWER_ID = idOf<AgentId>('mock-u26-intros-reviewer');
const AUTO_ID = idOf<AgentId>('mock-u26-intros-auto');

type AgentParams = {
  readonly id: AgentId;
  readonly ordinal: number;
  readonly name: string;
  readonly kind: string;
  readonly status: Agent['status'];
  readonly startedAt: string;
  readonly completedAt?: string;
};

const standaloneOf = ({
  id,
  ordinal,
  name,
  kind,
  status,
  startedAt,
  completedAt,
}: AgentParams): Agent => ({
  id,
  sessionId: C09_SESSION_ID,
  ordinal,
  name,
  kind,
  status,
  providerOverride: 'anthropic',
  modelOverride: 'claude-sonnet-5-5',
  effort: 'high',
  startedAt: clock.iso({ at: startedAt }),
  ...(completedAt === undefined ? {} : { completedAt: clock.iso({ at: completedAt }) }),
});

const STANDALONE: ReadonlyArray<Agent> = [
  standaloneOf({
    id: IMPLEMENTER_ID,
    ordinal: 20,
    name: 'Add the retry header to notify-relay',
    kind: 'implementer',
    status: 'running',
    startedAt: '2026-10-16T15:04:00.000Z',
  }),
  standaloneOf({
    id: REVIEWER_ID,
    ordinal: 21,
    name: 'Review the ledger-core export batching',
    kind: 'reviewer',
    status: 'completed',
    startedAt: '2026-10-16T14:40:00.000Z',
    completedAt: '2026-10-16T14:52:00.000Z',
  }),
  standaloneOf({
    id: AUTO_ID,
    ordinal: 22,
    name: 'Why does payments-api retry a settled webhook?',
    kind: 'auto',
    status: 'completed',
    startedAt: '2026-10-16T14:20:00.000Z',
    completedAt: '2026-10-16T14:31:00.000Z',
  }),
];

type SeedParams = {
  readonly page: IntroPage;
  readonly isEmpty: boolean;
};

export const seedIntros = ({ page, isEmpty }: SeedParams): void => {
  const session = seedC09({ state: 'done', page: isEmpty ? 'empty' : 'list' });
  const lens = LENS_OF[page];
  useAppStore.setState((current) => ({
    sessions: isEmpty ? [{ ...session, workflowRuns: [] }] : current.sessions,
    sessionWorkflows: isEmpty ? { [C09_SESSION_ID]: [] } : current.sessionWorkflows,
    sessionPhaseRuns: {
      [C09_SESSION_ID]: isEmpty
        ? []
        : [...(current.sessionPhaseRuns[C09_SESSION_ID] ?? []), ...STANDALONE],
    },
    agentKindOverride: { ...current.agentKindOverride, [AUTO_ID]: 'auto' },
    agentProviderOverride: { ...current.agentProviderOverride, [AUTO_ID]: 'anthropic' },
    agentModelOverride: { ...current.agentModelOverride, [AUTO_ID]: 'opus-5.5' },
    sessionTelemetry: isEmpty ? { [C09_SESSION_ID]: [] } : current.sessionTelemetry,
    activeLens: { [C09_SESSION_ID]: lens },
    focusedWorkflowRunId: { [C09_SESSION_ID]: null },
    loadAutoTrees: async () => undefined,
  }));
};
