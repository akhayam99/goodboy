import { useState } from 'react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  SessionId,
  StepId,
  WorkflowRunId,
} from '@goodboy/types';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import type { AgentRowWork } from '../../../../../features/session/hooks/useAgentRowWork';
import type { TimelineAgentEntry } from '../../../../../features/session/timeline/buildTimelineGroups';
import type { AgentModels } from '../../../../../features/session/timeline/ranModels';
import { AgentRoleCard } from '../../../../../features/session/components/SessionWorkspace/parts/TimelinePane/AgentRoleCard';

type IdParams = {
  readonly value: string;
};

type EntryParams = {
  readonly agent: Agent;
  readonly kind: TimelineAgentEntry['agentKind'];
  readonly openQuestions: ReadonlyArray<OpenQuestion>;
};

type WorkParams = {
  readonly model: string;
  readonly provider: string;
  readonly effort: 'high' | 'xhigh';
  readonly headline: string;
};

const idOf = <Id extends string>({ value }: IdParams): Id => JSON.parse(JSON.stringify(value));

const SESSION = idOf<SessionId>({ value: 'mock-role-card-session' });
const RUN = idOf<WorkflowRunId>({ value: 'mock-role-card-run' });
const FIVE = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
const ASKED_AGO_MS = 3 * 60_000;

const TRIGGER_CLASSES =
  'inline-flex h-7 items-center justify-center gap-2 rounded-md border border-border-soft px-2 text-meta text-muted-foreground';

const IMPLEMENTER: Agent = {
  id: idOf<AgentId>({ value: 'mock-role-card-implementer' }),
  sessionId: SESSION,
  ordinal: 4,
  name: 'Post one credit per retry in postCredit and applyCredit, keyed on the event id so a replayed webhook is a no-op',
  status: 'running',
  stepId: idOf<StepId>({ value: 'mock-role-card-step-4' }),
  workflowRunId: RUN,
  startedAt: idOf<IsoDateTime>({ value: '2026-10-04T23:40:00Z' }),
};

const REVIEWER: Agent = {
  id: idOf<AgentId>({ value: 'mock-role-card-reviewer' }),
  sessionId: SESSION,
  ordinal: 2,
  name: 'Check the idempotency key survives a retry in ledger-core and in the notify-relay outbox, then say which one to keep',
  status: 'running',
  parentAgentId: IMPLEMENTER.id,
  workflowRunId: RUN,
  startedAt: idOf<IsoDateTime>({ value: '2026-10-04T23:44:00Z' }),
};

const entryOf = ({ agent, kind, openQuestions }: EntryParams): TimelineAgentEntry => ({
  kind: 'agent',
  id: `agent:${agent.id}`,
  at: agent.startedAt ?? null,
  ordinal: agent.ordinal ?? null,
  agent,
  agentKind: kind,
  isMissingArtifact: false,
  stepLabel: '4',
  openQuestions,
  terminalQuestions: [],
  children: [],
  answers: [],
  hasDuration: true,
  chain: null,
});

const workOf = ({ model, provider, effort, headline }: WorkParams): AgentRowWork => ({
  routing: {
    provider,
    model,
    effort,
    isEffortObserved: true,
    planned: { provider, model, effort },
    isPlanned: false,
  },
  time: {
    label: headline,
    detail: '',
    facts: [],
    footnote: null,
    progress: null,
    headline,
    note: null,
    isMuchLonger: false,
  },
});

const ONE_PROVIDER: AgentModels = {
  isPlanned: false,
  models: [
    {
      key: 'anthropic:Sonnet 5.5',
      provider: 'anthropic',
      name: 'Sonnet 5.5',
      effort: 'High',
      effortLevel: 'high',
      effortLevels: FIVE,
      endReason: null,
      endedAtMs: null,
    },
  ],
};

const TWO_PROVIDERS: AgentModels = {
  isPlanned: false,
  models: [
    {
      key: 'anthropic:Sonnet 5.5',
      provider: 'anthropic',
      name: 'Sonnet 5.5',
      effort: 'Medium',
      effortLevel: 'medium',
      effortLevels: FIVE,
      endReason: 'failed',
      endedAtMs: Date.parse('2026-10-04T23:48:00Z'),
    },
    {
      key: 'codex:GPT-6.1 Sol',
      provider: 'codex',
      name: 'GPT-6.1 Sol',
      effort: 'Very high',
      effortLevel: 'xhigh',
      effortLevels: FIVE,
      endReason: 'succeeded',
      endedAtMs: Date.parse('2026-10-04T23:52:00Z'),
    },
  ],
};

export const RoleCardSamples = () => {
  const [askedAt] = useState(() => new Date(Date.now() - ASKED_AGO_MS).toISOString());
  const question: OpenQuestion = {
    id: idOf<OpenQuestionId>({ value: 'mock-role-card-question' }),
    sessionId: SESSION,
    text: 'Keep the key in ledger-core or in the notify-relay outbox?',
    suggestedAnswers: [],
    isBlocking: true,
    userAnswer: null,
    status: 'open',
    createdAt: idOf<IsoDateTime>({ value: askedAt }),
  };
  return (
    <>
      <AgentRoleCard
        entry={entryOf({ agent: IMPLEMENTER, kind: 'implementer', openQuestions: [] })}
        ordinal="4"
        kindWord="Implementer"
        models={ONE_PROVIDER}
        work={workOf({
          model: 'claude-sonnet-5-5',
          provider: 'anthropic',
          effort: 'high',
          headline: '12m',
        })}
        phase="running"
        costUsd={0.31}
        isOpen
      >
        <span data-testid="role-card-one-provider" className={TRIGGER_CLASSES}>
          <AgentKindChip kind="implementer" density="glyph" isDecorative />
          One provider
        </span>
      </AgentRoleCard>
      <AgentRoleCard
        entry={entryOf({ agent: REVIEWER, kind: 'reviewer', openQuestions: [question] })}
        ordinal="4.2"
        kindWord="Reviewer"
        models={TWO_PROVIDERS}
        work={workOf({ model: 'gpt-6.1-sol', provider: 'codex', effort: 'xhigh', headline: '8m' })}
        phase="waiting"
        costUsd={0.06}
        isOpen
      >
        <span data-testid="role-card-two-providers" className={TRIGGER_CLASSES}>
          <AgentKindChip kind="reviewer" density="glyph" isDecorative />
          Two providers
        </span>
      </AgentRoleCard>
    </>
  );
};
