import { useCallback, useEffect, useMemo } from 'react';
import { ArrowRight, Bot, CircleCheck } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type {
  Agent,
  AgentId,
  OpenQuestion,
  OpenQuestionId,
  Session,
  SessionId,
} from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionAnsweredQuestions,
  useSessionOpenQuestions,
} from '../../../../../store';
import { AnsweredCard } from '../../../../chat/components/ChatView/OpenQuestionInlineCard';
import { QuestionCard } from '../../../../context/components/QuestionsTab/QuestionCard';
import {
  buildQuestionClusters,
  type QuestionCluster,
} from '../../../../context/components/QuestionsTab/clusters';
import {
  deriveDraftAnswer,
  useOpenQuestions,
} from '../../../../context/components/QuestionsTab/useOpenQuestions';
import { selectOpenQuestions } from '../../SessionOverviewPane/lib';
import { PaneShell } from './PaneShell';

type AnswerPair = { id: OpenQuestionId; text: string; answer: string };

type QuestionsPaneProps = {
  readonly session: Session;
};

type ClusterSectionProps = {
  readonly cluster: QuestionCluster;
  readonly drafts: ReturnType<typeof useOpenQuestions.getState>['drafts'];
  readonly justAnswered: ReadonlyArray<OpenQuestionId>;
  readonly onToggleSuggestion: (questionId: OpenQuestionId, suggestion: string) => void;
  readonly onSetCustomAnswer: (questionId: OpenQuestionId, text: string) => void;
  readonly onToggleCustomField: (questionId: OpenQuestionId) => void;
  readonly onClearJustAnswered: (id: OpenQuestionId) => void;
  readonly onDismiss: (question: OpenQuestion) => void;
  readonly onSubmit: (pairs: ReadonlyArray<AnswerPair>, ownerAgentId: AgentId | null) => void;
};

const ClusterSection = ({
  cluster,
  drafts,
  justAnswered,
  onToggleSuggestion,
  onSetCustomAnswer,
  onToggleCustomField,
  onClearJustAnswered,
  onDismiss,
  onSubmit,
}: ClusterSectionProps) => {
  const pendingPairs = cluster.questions
    .map((q) => ({ id: q.id, text: q.text, answer: deriveDraftAnswer(drafts[q.id]) }))
    .filter((pair) => pair.answer.length > 0);

  return (
    <div className="flex flex-col gap-2">
      {cluster.ownerAgentName !== null ? (
        <div className="flex items-center gap-1.5 px-0.5 text-2xs font-medium">
          <Bot size={12} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="truncate text-foreground/80">{cluster.ownerAgentName}</span>
          {cluster.creatorAgentName !== null ? (
            <span className="truncate text-muted-foreground">via {cluster.creatorAgentName}</span>
          ) : null}
        </div>
      ) : null}
      {cluster.questions.map((q) => (
        <QuestionCard
          key={q.id}
          question={q}
          selectedSuggestions={drafts[q.id]?.selectedSuggestions ?? []}
          customAnswer={drafts[q.id]?.customAnswer ?? ''}
          showCustomField={drafts[q.id]?.showCustomField ?? false}
          justAnswered={justAnswered.includes(q.id)}
          onToggleSuggestion={onToggleSuggestion}
          onSetCustomAnswer={onSetCustomAnswer}
          onToggleCustomField={onToggleCustomField}
          onDismiss={() => onDismiss(q)}
          onClearJustAnswered={onClearJustAnswered}
        />
      ))}
      {pendingPairs.length > 0 ? (
        <button
          type="button"
          onClick={() => onSubmit(pendingPairs, cluster.ownerAgentId)}
          className={cn(
            'group flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold',
            'bg-primary text-primary-foreground shadow-sm motion-safe:transition-all duration-150',
            'hover:brightness-105 active:scale-[0.99]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          )}
        >
          <span>
            {pendingPairs.length > 1 ? `send ${pendingPairs.length} answers` : 'send answer'}
          </span>
          <ArrowRight
            size={13}
            aria-hidden
            className="motion-safe:transition-transform group-hover:translate-x-0.5"
          />
        </button>
      ) : null}
    </div>
  );
};

type AnsweredCluster = {
  readonly agentId: AgentId | null;
  readonly agentName: string | null;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly newestAt: string;
};

const buildAnsweredClusters = (
  answered: ReadonlyArray<OpenQuestion>,
  agentById: ReadonlyMap<AgentId, Agent>,
): ReadonlyArray<AnsweredCluster> => {
  type Bucket = {
    agentId: AgentId | null;
    agentName: string | null;
    questions: OpenQuestion[];
    newestAt: string;
  };
  const buckets = new Map<string, Bucket>();
  const order: string[] = [];

  for (const q of answered) {
    const agentId = q.createdByAgentId ?? null;
    const key = agentId ?? '__none__';
    const agent = agentId ? (agentById.get(agentId) ?? null) : null;
    const qTime = q.answeredAt ?? q.createdAt;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        agentId,
        agentName: agent?.name ?? null,
        questions: [],
        newestAt: qTime,
      };
      buckets.set(key, bucket);
      order.push(key);
    }
    bucket.questions.push(q);
    if (qTime > bucket.newestAt) {
      bucket.newestAt = qTime;
    }
  }

  return [...order]
    .map((key) => buckets.get(key)!)
    .sort((a, b) => (b.newestAt > a.newestAt ? 1 : b.newestAt < a.newestAt ? -1 : 0));
};

type AnsweredClusterHeaderProps = {
  readonly agentId: AgentId | null;
  readonly agentName: string | null;
  readonly newestAt: string;
  readonly sessionId: SessionId;
};

const AnsweredClusterHeader = ({
  agentId,
  agentName,
  newestAt,
  sessionId,
}: AnsweredClusterHeaderProps) => {
  const selectAgent = useAppStore((s) => s.selectAgent);

  const diffMs = Date.now() - new Date(newestAt).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const timeLabel =
    mins < 1
      ? 'just now'
      : mins < 60
        ? `${mins}m ago`
        : mins < 1440
          ? `${Math.floor(mins / 60)}h ago`
          : `${Math.floor(mins / 1440)}d ago`;

  return (
    <div className="flex items-center justify-between gap-2 px-0.5">
      {agentId !== null && agentName !== null ? (
        <button
          type="button"
          onClick={() => void selectAgent(sessionId, agentId)}
          className="flex min-w-0 items-center gap-1.5 text-2xs font-medium hover:opacity-70 motion-safe:transition-opacity"
        >
          <Bot size={12} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="truncate text-foreground/80">{agentName}</span>
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5 text-2xs font-medium">
          <Bot size={12} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="truncate text-foreground/80">unknown agent</span>
        </div>
      )}
      <span className="shrink-0 text-2xs text-muted-foreground">{timeLabel}</span>
    </div>
  );
};

type AnsweredHistoryProps = {
  readonly clusters: ReadonlyArray<AnsweredCluster>;
  readonly sessionId: SessionId;
};

const AnsweredHistory = ({ clusters, sessionId }: AnsweredHistoryProps) => {
  if (clusters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border-soft" />
        <span className="text-2xs text-muted-foreground">answered</span>
        <div className="h-px flex-1 bg-border-soft" />
      </div>
      {clusters.map((cluster) => (
        <div key={cluster.agentId ?? '__none__'} className="flex flex-col gap-2">
          <AnsweredClusterHeader
            agentId={cluster.agentId}
            agentName={cluster.agentName}
            newestAt={cluster.newestAt}
            sessionId={sessionId}
          />
          {cluster.questions.map((q) => (
            <AnsweredCard key={q.id} question={q} />
          ))}
        </div>
      ))}
    </div>
  );
};

export const QuestionsPane = ({ session }: QuestionsPaneProps) => {
  const sessionId = session.id as SessionId;
  const open = selectOpenQuestions(useSessionOpenQuestions(sessionId));
  const answered = useSessionAnsweredQuestions(sessionId);
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const workflows = useAppStore((s) => s.phaseTemplates[session.workspaceId] ?? EMPTY_ARRAY);
  const loadSessionAnsweredQuestions = useAppStore((s) => s.loadSessionAnsweredQuestions);
  const drafts = useOpenQuestions((s) => s.drafts);
  const justAnswered = useOpenQuestions((s) => s.justAnswered);
  const toggleSuggestion = useOpenQuestions((s) => s.toggleSuggestion);
  const setCustomAnswer = useOpenQuestions((s) => s.setCustomAnswer);
  const toggleCustomField = useOpenQuestions((s) => s.toggleCustomField);
  const clearJustAnswered = useOpenQuestions((s) => s.clearJustAnswered);
  const flashAnswered = useOpenQuestions((s) => s.flashAnswered);
  const answerOpenQuestions = useAppStore((s) => s.answerOpenQuestions);
  const dismissOpenQuestion = useAppStore((s) => s.dismissOpenQuestion);

  useEffect(() => {
    void loadSessionAnsweredQuestions(sessionId);
  }, [sessionId, loadSessionAnsweredQuestions]);

  const clusters = useMemo(
    () => buildQuestionClusters({ questions: open, agents, workflows }),
    [open, agents, workflows],
  );

  const agentById = useMemo(() => {
    const map = new Map<AgentId, Agent>();
    for (const a of agents) {
      map.set(a.id, a);
    }
    return map;
  }, [agents]);

  const answeredClusters = useMemo(
    () => buildAnsweredClusters(answered, agentById),
    [answered, agentById],
  );

  const handleSubmit = useCallback(
    async (pairs: ReadonlyArray<AnswerPair>, ownerAgentId: AgentId | null) => {
      if (pairs.length === 0) {
        return;
      }
      flashAnswered(pairs.map((pair) => pair.id));
      await answerOpenQuestions(sessionId, pairs, ownerAgentId);
    },
    [flashAnswered, answerOpenQuestions, sessionId],
  );

  if (open.length === 0) {
    return (
      <PaneShell title="Questions" description="Decisions agents need from you to keep going.">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-soft bg-elevated/40 px-6 py-8 text-center">
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-md bg-success/10"
            >
              <CircleCheck size={24} aria-hidden className="text-success" />
            </span>
            <p className="text-sm font-medium text-foreground">No open questions</p>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              When an agent needs a decision, it shows up here.
            </p>
          </div>
          <AnsweredHistory clusters={answeredClusters} sessionId={sessionId} />
        </div>
      </PaneShell>
    );
  }

  return (
    <PaneShell
      title="Questions"
      description={`${open.length} open ${open.length === 1 ? 'question' : 'questions'} waiting on you.`}
    >
      <div className="flex flex-col gap-4">
        {clusters.map((cluster) => (
          <ClusterSection
            key={cluster.ownerAgentId ?? '__orphan__'}
            cluster={cluster}
            drafts={drafts}
            justAnswered={justAnswered}
            onToggleSuggestion={toggleSuggestion}
            onSetCustomAnswer={setCustomAnswer}
            onToggleCustomField={toggleCustomField}
            onClearJustAnswered={clearJustAnswered}
            onDismiss={(q) => void dismissOpenQuestion(sessionId, q)}
            onSubmit={(pairs, ownerAgentId) => void handleSubmit(pairs, ownerAgentId)}
          />
        ))}
        <AnsweredHistory clusters={answeredClusters} sessionId={sessionId} />
      </div>
    </PaneShell>
  );
};
