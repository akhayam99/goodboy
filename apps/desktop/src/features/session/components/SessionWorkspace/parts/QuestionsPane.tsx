import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Check } from 'lucide-react';
import { CountToggle, Skeleton } from '@goodboy/ui';
import { LensEmptyState } from '../../../../../shared/components/LensEmptyState';
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
import { formatRelativeAge } from '../../../../../shared/utils/relativeDate';
import { AnsweredCard } from '../../../../chat/components/ChatView/AnsweredCard';
import { AnswerSubmitButton } from '../../../../context/components/QuestionsTab/AnswerSubmitButton';
import { DismissedQuestionUndo } from '../../../../context/components/QuestionsTab/DismissedQuestionUndo';
import { QuestionCard } from '../../../../context/components/QuestionsTab/QuestionCard';
import { QuestionClusterHeader } from '../../../../context/components/QuestionsTab/QuestionClusterHeader';
import {
  buildQuestionClusters,
  type QuestionCluster,
} from '../../../../context/components/QuestionsTab/clusters';
import {
  deriveDraftAnswer,
  useOpenQuestions,
} from '../../../../context/components/QuestionsTab/useOpenQuestions';
import { selectOpenQuestions } from '../../SessionOverviewPane/lib';
import { PaneShell } from '../../../../../shared/components/PaneShell';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';

type AnswerPair = { id: OpenQuestionId; text: string; answer: string };

type QuestionsPaneProps = {
  readonly session: Session;
};

type ClusterSectionProps = {
  readonly cluster: QuestionCluster;
  readonly sessionId: SessionId;
  readonly ownerAgent: Agent | null;
  readonly drafts: ReturnType<typeof useOpenQuestions.getState>['drafts'];
  readonly justAnswered: ReadonlyArray<OpenQuestionId>;
  readonly onToggleSuggestion: (questionId: OpenQuestionId, suggestion: string) => void;
  readonly onSetCustomAnswer: (questionId: OpenQuestionId, text: string) => void;
  readonly onToggleCustomField: (questionId: OpenQuestionId) => void;
  readonly onClearJustAnswered: (id: OpenQuestionId) => void;
  readonly onDismiss: (question: OpenQuestion) => void;
  readonly pendingUndoQuestionId: OpenQuestionId | null;
  readonly onUndo: (question: OpenQuestion) => void;
  readonly onSubmit: (pairs: ReadonlyArray<AnswerPair>, ownerAgentId: AgentId | null) => void;
};

const ClusterSection = ({
  cluster,
  sessionId,
  ownerAgent,
  drafts,
  justAnswered,
  onToggleSuggestion,
  onSetCustomAnswer,
  onToggleCustomField,
  onClearJustAnswered,
  onDismiss,
  pendingUndoQuestionId,
  onUndo,
  onSubmit,
}: ClusterSectionProps) => {
  const pendingPairs = cluster.questions
    .filter((question) => question.id !== pendingUndoQuestionId)
    .map((q) => ({ id: q.id, text: q.text, answer: deriveDraftAnswer(drafts[q.id]) }))
    .filter((pair) => pair.answer.length > 0);

  return (
    <div className="flex flex-col gap-2">
      {(cluster.ownerAgentName !== null || ownerAgent !== null) && (
        <QuestionClusterHeader
          sessionId={sessionId}
          ownerAgent={ownerAgent}
          ownerAgentName={cluster.ownerAgentName}
          creatorAgentName={cluster.creatorAgentName}
        />
      )}
      {cluster.questions.map((q) =>
        q.id === pendingUndoQuestionId ? (
          <DismissedQuestionUndo key={q.id} onUndo={() => onUndo(q)} />
        ) : (
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
        ),
      )}
      {pendingPairs.length > 0 ? (
        <AnswerSubmitButton
          answerCount={pendingPairs.length}
          onClick={() => onSubmit(pendingPairs, cluster.ownerAgentId)}
        />
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
      <span className="shrink-0 text-2xs text-muted-foreground">
        {formatRelativeAge({ fromIso: newestAt })}
      </span>
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
  const loadSessionOpenQuestions = useAppStore((s) => s.loadSessionOpenQuestions);
  const loadSessionAnsweredQuestions = useAppStore((s) => s.loadSessionAnsweredQuestions);
  const openLoaded = useAppStore((s) => s.sessionOpenQuestions[sessionId] !== undefined);
  const answeredLoaded = useAppStore((s) => s.sessionAnsweredQuestions[sessionId] !== undefined);
  const drafts = useOpenQuestions((s) => s.drafts);
  const justAnswered = useOpenQuestions((s) => s.justAnswered);
  const toggleSuggestion = useOpenQuestions((s) => s.toggleSuggestion);
  const setCustomAnswer = useOpenQuestions((s) => s.setCustomAnswer);
  const toggleCustomField = useOpenQuestions((s) => s.toggleCustomField);
  const clearJustAnswered = useOpenQuestions((s) => s.clearJustAnswered);
  const flashAnswered = useOpenQuestions((s) => s.flashAnswered);
  const pendingUndo = useOpenQuestions((s) => s.pendingUndo);
  const beginUndo = useOpenQuestions((s) => s.beginUndo);
  const clearUndo = useOpenQuestions((s) => s.clearUndo);
  const answerOpenQuestions = useAppStore((s) => s.answerOpenQuestions);
  const dismissOpenQuestion = useAppStore((s) => s.dismissOpenQuestion);
  const restoreDismissedOpenQuestion = useAppStore((s) => s.restoreDismissedOpenQuestion);
  const [showAnswered, setShowAnswered] = useState(false);

  useEffect(() => {
    void loadSessionOpenQuestions(sessionId);
    void loadSessionAnsweredQuestions(sessionId);
  }, [sessionId, loadSessionOpenQuestions, loadSessionAnsweredQuestions]);

  const pendingUndoQuestion =
    pendingUndo?.question.sessionId === sessionId ? pendingUndo.question : null;
  const displayedOpen = useMemo(() => {
    if (
      pendingUndoQuestion === null ||
      open.some((question) => question.id === pendingUndoQuestion.id)
    ) {
      return open;
    }
    return [...open, pendingUndoQuestion].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [open, pendingUndoQuestion]);

  const clusters = useMemo(
    () => buildQuestionClusters({ questions: displayedOpen, agents, workflows }),
    [displayedOpen, agents, workflows],
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

  const handleDismiss = useCallback(
    async (question: OpenQuestion) => {
      await dismissOpenQuestion(sessionId, question);
      beginUndo(question);
    },
    [beginUndo, dismissOpenQuestion, sessionId],
  );

  const handleUndo = useCallback(
    async (question: OpenQuestion) => {
      await restoreDismissedOpenQuestion(sessionId, question);
      clearUndo();
    },
    [clearUndo, restoreDismissedOpenQuestion, sessionId],
  );

  if (!openLoaded || !answeredLoaded) {
    return (
      <PaneShell title="Questions" description="Decisions agents need from you to keep going.">
        <div className="flex flex-col gap-2" role="status" aria-label="Loading questions">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-md border border-border-soft p-3">
              <Skeleton className="h-3 w-40 rounded" />
              <Skeleton className="h-3 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      </PaneShell>
    );
  }

  if (open.length === 0 && answeredClusters.length === 0 && pendingUndoQuestion === null) {
    return (
      <PaneShell title="Questions" description="Decisions agents need from you to keep going.">
        <LensEmptyState
          tone={CONCEPT_TONE.questions}
          icon={CONCEPT_ICONS.questions}
          title="No open questions"
          description="When an agent needs a decision, it shows up here."
        />
      </PaneShell>
    );
  }

  if (open.length === 0 && pendingUndoQuestion === null) {
    return (
      <PaneShell title="Questions" description="Decisions agents need from you to keep going.">
        {showAnswered ? null : (
          <LensEmptyState
            tone={CONCEPT_TONE.questions}
            icon={CONCEPT_ICONS.questions}
            title="Nothing needs you right now"
            description={`Every question on this session is answered. Reveal the ${answered.length} answered ${answered.length === 1 ? 'one' : 'ones'} to reread them.`}
          />
        )}
        <div className="flex justify-center">
          <CountToggle
            label="Answered"
            itemsLabel="questions"
            count={answered.length}
            isShown={showAnswered}
            icon={Check}
            onChange={setShowAnswered}
          />
        </div>
        {showAnswered ? (
          <AnsweredHistory clusters={answeredClusters} sessionId={sessionId} />
        ) : null}
      </PaneShell>
    );
  }

  return (
    <PaneShell
      title="Questions"
      description={
        open.length > 0
          ? `${open.length} open ${open.length === 1 ? 'question' : 'questions'} waiting on you.`
          : 'Decisions agents need from you to keep going.'
      }
    >
      <div className="flex flex-col gap-4">
        {clusters.map((cluster) => (
          <ClusterSection
            key={cluster.ownerAgentId ?? '__orphan__'}
            cluster={cluster}
            sessionId={sessionId}
            ownerAgent={cluster.ownerAgentId ? (agentById.get(cluster.ownerAgentId) ?? null) : null}
            drafts={drafts}
            justAnswered={justAnswered}
            onToggleSuggestion={toggleSuggestion}
            onSetCustomAnswer={setCustomAnswer}
            onToggleCustomField={toggleCustomField}
            onClearJustAnswered={clearJustAnswered}
            onDismiss={(question) => void handleDismiss(question)}
            pendingUndoQuestionId={pendingUndoQuestion?.id ?? null}
            onUndo={(question) => void handleUndo(question)}
            onSubmit={(pairs, ownerAgentId) => void handleSubmit(pairs, ownerAgentId)}
          />
        ))}
        <div className="flex justify-center">
          <CountToggle
            label="Answered"
            itemsLabel="questions"
            count={answered.length}
            isShown={showAnswered}
            icon={Check}
            onChange={setShowAnswered}
          />
        </div>
        {showAnswered ? (
          <AnsweredHistory clusters={answeredClusters} sessionId={sessionId} />
        ) : null}
      </div>
    </PaneShell>
  );
};
