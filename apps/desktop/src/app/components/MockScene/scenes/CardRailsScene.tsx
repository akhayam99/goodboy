import { useEffect, type ReactNode } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { AgentId, IsoDateTime, OpenQuestion, ProviderRunId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../../../features/chat/utils/transcript-items';
import { AnsweredCard } from '../../../../features/chat/components/ChatView/AnsweredCard';
import { AuthRequiredCallout } from '../../../../features/chat/components/AuthRequiredCallout';
import { FileEditBlock } from '../../../../features/chat/components/TranscriptCards/FileEditBlock';
import { NudgeCard } from '../../../../features/chat/components/NudgeCard';
import { UsageRow } from '../../../../features/chat/components/TranscriptCards/UsageRow';
import { UserText } from '../../../../features/chat/components/TranscriptCards/UserText';
import { PermissionDecisionCard } from '../../../../features/permissions/components/PermissionDecisionCard';
import { PermissionRequestCard } from '../../../../features/permissions/components/PermissionRequestCard';
import { QuestionCard } from '../../../../features/context/components/QuestionsTab/QuestionCard';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

const NOW = '2026-09-22T09:12:00.000Z' as IsoDateTime;
const noop = () => undefined;

const OPEN_QUESTION = {
  id: 'oq-1',
  sessionId: 'sess-1' as SessionId,
  text: 'The cache now keeps the failed lookup for the whole session. What should happen when the provider is down?',
  suggestedAnswers: ['cache only a resolved lookup', 'cache every reply', 'fail the call instead'],
  recommendedAnswer: 'cache only a resolved lookup',
  userAnswer: null,
  status: 'open',
  isBlocking: true,
  answerSource: null,
  createdByAgentId: 'agent-1' as AgentId,
  ownedByStepOrdinal: 2,
  selectMode: 'one',
  createdAt: NOW,
} as unknown as OpenQuestion;

const ANSWERED_QUESTION = {
  ...OPEN_QUESTION,
  id: 'oq-2',
  status: 'answered',
  isBlocking: false,
  answerSource: 'agent',
  userAnswer:
    'Cache only a resolved lookup. A failed one returns the default and is not written, so the next mount retries.',
  answeredAt: NOW,
} as unknown as OpenQuestion;

const PERMISSION_REQUEST = {
  kind: 'permission_request',
  key: 'perm-req-1',
  toolUseId: 'tu-1',
  toolName: 'Bash',
  runId: 'run-1' as ProviderRunId,
  input: { command: 'pnpm test --filter @goodboy/core' },
  at: NOW,
} as Extract<TranscriptItem, { kind: 'permission_request' }>;

const PERMISSION_DECISION = {
  kind: 'permission_decision',
  key: 'perm-dec-1',
  toolUseId: 'tu-1',
  toolName: 'Bash',
  runId: 'run-1' as ProviderRunId,
  decision: 'allow',
  scope: 'session',
  ruleId: null,
  decidedBy: 'user',
  at: NOW,
} as Extract<TranscriptItem, { kind: 'permission_decision' }>;

const questionProps = {
  selectedSuggestions: ['cache only a resolved lookup'],
  customAnswer: '',
  showCustomField: false,
  justAnswered: false,
  onToggleSuggestion: noop,
  onSetCustomAnswer: noop,
  onToggleCustomField: noop,
  onDismiss: noop,
  onClearJustAnswered: noop,
  delegateState: 'available' as const,
  delegateHints: '',
  delegateRouting: {
    provider: 'anthropic' as const,
    model: 'claude-opus-5',
    effort: 'high' as const,
  },
  connectedProviders: ['anthropic' as const],
  onChooseDelegate: noop,
  onCancelDelegate: noop,
  onDelegateHints: noop,
  onDelegateRouting: noop,
};

type RowProps = {
  readonly label: string;
  readonly children: ReactNode;
};

const Row = ({ label, children }: RowProps) => (
  <section className="flex flex-col gap-2">
    <span className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</span>
    {children}
  </section>
);

export const CardRailsScene = () => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const toggle = window.document.querySelector<HTMLButtonElement>('[aria-expanded="false"]');
      toggle?.click();
    }, 200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="h-screen overflow-auto bg-background text-foreground">
      <div className={cn(PANE_RHYTHM.column, PANE_RHYTHM.measure.chat, PANE_RHYTHM.body, 'gap-6')}>
        <Row label="question, blocking">
          <QuestionCard {...questionProps} question={OPEN_QUESTION} askedByName="implementer" />
        </Row>
        <Row label="question, answered by an agent">
          <AnsweredCard question={ANSWERED_QUESTION} answeredByName="answer: the cache question" />
        </Row>
        <Row label="approval">
          <PermissionRequestCard
            item={PERMISSION_REQUEST}
            sessionId={'sess-1' as SessionId}
            agentId={'agent-1' as AgentId}
          />
        </Row>
        <Row label="approval, decided">
          <PermissionDecisionCard
            item={PERMISSION_DECISION}
            sessionId={'sess-1' as SessionId}
            agentId={'agent-1' as AgentId}
          />
        </Row>
        <Row label="nudge">
          <NudgeCard
            severity="warning"
            icon={<CONCEPT_ICONS.autorun size={ICON_SIZE.control} aria-hidden />}
            title="This step has been running for eleven minutes"
            body="The implementer has not written anything since the rebase."
            primary={{ label: 'Open the agent', onClick: noop }}
            secondary={{ label: 'Stop it', onClick: noop }}
            onDismiss={noop}
            ariaLabel="Nudge"
          />
        </Row>
        <Row label="provider signed out">
          <AuthRequiredCallout
            providerId="anthropic"
            identity="dana@example.invalid"
            onRefresh={noop}
          />
        </Row>
        <Row label="file touched">
          <FileEditBlock path="packages/core/src/summarizer/step-output.ts" editType="modify" />
        </Row>
        <Row label="usage">
          <UsageRow
            usage={{
              inputTokens: 24,
              outputTokens: 16200,
              cachedInputTokens: 558300,
              estimatedCostUsd: 1.26,
            }}
          />
        </Row>
        <Row label="your message">
          <UserText
            text="Ship the rail treatment everywhere, no tinted card fills."
            at={NOW}
            provider="anthropic"
            model="claude-opus-5"
          />
        </Row>
      </div>
    </main>
  );
};
