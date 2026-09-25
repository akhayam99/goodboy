import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Bot } from 'lucide-react';
import { Skeleton } from '@goodboy/ui';
import { LensEmptyState } from '@goodboy/ui';
import type {
  Agent,
  AgentId,
  OpenQuestion,
  OpenQuestionId,
  OpenQuestionSelectMode,
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
import { QuestionClusterHeader } from '../../../../context/components/QuestionsTab/QuestionClusterHeader';
import { QuestionsPaneCard } from './QuestionsPaneCard';
import { ContextLoadFailure } from './ContextPane/ContextLoadFailure';
import {
  buildQuestionClusters,
  type QuestionCluster,
} from '../../../../context/components/QuestionsTab/clusters';
import { resolveStagedFlow } from '../../../../context/components/QuestionsTab/resolveStagedFlow';
import { summarizeStagedAnswers } from '../../../../context/components/QuestionsTab/summarizeStagedAnswers';
import {
  deriveDraftAnswer,
  useOpenQuestions,
} from '../../../../context/components/QuestionsTab/useOpenQuestions';
import type { QuestionDelegateRequest } from '../../../../../store/slices/open-questions/spawnQuestionDelegates';
import {
  partitionDelegatedQuestions,
  QUESTION_DELEGATE_COPY,
} from '../../../../context/questionDelegate';
import { selectOpenQuestions } from '../../SessionOverviewPane/lib';
import { PaneShell } from '../../../../../shared/components/PaneShell';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';
import { FinishedRegister } from '../../../../../shared/components/FinishedRegister';

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
  readonly onToggleSuggestion: (
    questionId: OpenQuestionId,
    suggestion: string,
    mode: OpenQuestionSelectMode,
  ) => void;
  readonly onSetCustomAnswer: (questionId: OpenQuestionId, text: string) => void;
  readonly onToggleCustomField: (questionId: OpenQuestionId) => void;
  readonly onClearJustAnswered: (id: OpenQuestionId) => void;
  readonly onDismiss: (question: OpenQuestion) => void;
  readonly pendingUndoQuestionId: OpenQuestionId | null;
  readonly focusIndex: number | null;
  readonly onFocused: () => void;
  readonly onUndo: (question: OpenQuestion) => void;
  readonly onSubmit: (
    pairs: ReadonlyArray<AnswerPair>,
    requests: ReadonlyArray<QuestionDelegateRequest>,
    ownerAgentId: AgentId | null,
  ) => void;
};

const delegateRequestsFor = ({
  questions,
  drafts,
}: {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly drafts: ReturnType<typeof useOpenQuestions.getState>['drafts'];
}): ReadonlyArray<QuestionDelegateRequest> =>
  questions.flatMap((question): ReadonlyArray<QuestionDelegateRequest> => {
    const intent = drafts[question.id]?.answerIntent;
    if (intent?.kind !== 'agent') {
      return [];
    }
    return [
      {
        question,
        hints: intent.hints,
        provider: intent.routing.provider,
        model: intent.routing.model,
        effort: intent.routing.effort,
      },
    ];
  });

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
  focusIndex,
  onFocused,
  onUndo,
  onSubmit,
}: ClusterSectionProps) => {
  const [stepIndex, setStepIndex] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusIndex == null) {
      return;
    }
    setStepIndex(focusIndex);
    sectionRef.current?.scrollIntoView?.({ block: 'nearest' });
    onFocused();
  }, [focusIndex, onFocused]);

  const answerableQuestions = cluster.questions.filter(
    (question) => question.id !== pendingUndoQuestionId,
  );
  const answerablePairs = answerableQuestions.map((q) => ({
    id: q.id,
    text: q.text,
    answer: deriveDraftAnswer(drafts[q.id]),
  }));
  const pendingPairs = answerablePairs.filter((pair) => pair.answer.length > 0);
  const delegateRequests = delegateRequestsFor({ questions: answerableQuestions, drafts });
  const stagedCount = pendingPairs.length + delegateRequests.length;
  const delegatedIds = new Set(delegateRequests.map((request) => request.question.id));
  const recapEntries = answerablePairs.map((pair) => ({
    text: pair.text,
    answer: delegatedIds.has(pair.id) ? QUESTION_DELEGATE_COPY.recap : pair.answer,
  }));

  const flow = resolveStagedFlow({ total: cluster.questions.length, index: stepIndex });
  const current = cluster.questions[flow.index] ?? null;

  const handleForward = () => {
    if (flow.action === 'send') {
      setStepIndex(0);
      onSubmit(pendingPairs, delegateRequests, cluster.ownerAgentId);
      return;
    }
    setStepIndex(flow.index + 1);
  };

  const handleBack = () => {
    setStepIndex(flow.index - 1);
  };

  const showsFooter = flow.showsStepper || stagedCount > 0;

  return (
    <div ref={sectionRef} className="flex flex-col gap-2">
      {(cluster.ownerAgentName !== null || ownerAgent !== null) && (
        <QuestionClusterHeader
          sessionId={sessionId}
          ownerAgent={ownerAgent}
          ownerAgentName={cluster.ownerAgentName}
          creatorAgentName={cluster.creatorAgentName}
        />
      )}
      {current !== null &&
        (current.id === pendingUndoQuestionId ? (
          <DismissedQuestionUndo key={current.id} onUndo={() => onUndo(current)} />
        ) : (
          <QuestionsPaneCard
            key={current.id}
            question={current}
            sessionId={sessionId}
            selectedSuggestions={drafts[current.id]?.selectedSuggestions ?? []}
            customAnswer={drafts[current.id]?.customAnswer ?? ''}
            showCustomField={drafts[current.id]?.showCustomField ?? false}
            justAnswered={justAnswered.includes(current.id)}
            onToggleSuggestion={onToggleSuggestion}
            onSetCustomAnswer={onSetCustomAnswer}
            onToggleCustomField={onToggleCustomField}
            onDismiss={() => onDismiss(current)}
            onClearJustAnswered={onClearJustAnswered}
          />
        ))}
      {showsFooter && (
        <AnswerSubmitButton
          answerCount={stagedCount}
          totalCount={answerablePairs.length}
          action={flow.action}
          stepIndex={flow.index}
          stepCount={flow.total}
          canGoBack={flow.canGoBack}
          onBack={handleBack}
          onClick={handleForward}
          disabled={flow.action === 'send' && stagedCount === 0}
          recap={
            flow.action === 'send' && flow.showsStepper
              ? summarizeStagedAnswers({ entries: recapEntries })
              : ''
          }
        />
      )}
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
          <Bot size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="truncate text-foreground">{agentName}</span>
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5 text-2xs font-medium">
          <Bot size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="truncate text-foreground">unknown agent</span>
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
  const loadError = useAppStore((s) => s.sessionQuestionsLoadError[sessionId]);
  const drafts = useOpenQuestions((s) => s.drafts);
  const justAnswered = useOpenQuestions((s) => s.justAnswered);
  const toggleSuggestion = useOpenQuestions((s) => s.toggleSuggestion);
  const setCustomAnswer = useOpenQuestions((s) => s.setCustomAnswer);
  const toggleCustomField = useOpenQuestions((s) => s.toggleCustomField);
  const clearJustAnswered = useOpenQuestions((s) => s.clearJustAnswered);
  const flashAnswered = useOpenQuestions((s) => s.flashAnswered);
  const clearDraft = useOpenQuestions((s) => s.clearDraft);
  const spawnQuestionDelegates = useAppStore((s) => s.spawnQuestionDelegates);
  const pendingUndo = useOpenQuestions((s) => s.pendingUndo);
  const beginUndo = useOpenQuestions((s) => s.beginUndo);
  const clearUndo = useOpenQuestions((s) => s.clearUndo);
  const answerOpenQuestions = useAppStore((s) => s.answerOpenQuestions);
  const dismissOpenQuestion = useAppStore((s) => s.dismissOpenQuestion);
  const restoreDismissedOpenQuestion = useAppStore((s) => s.restoreDismissedOpenQuestion);
  const focusedQuestionId = useOpenQuestions((s) => s.focusedQuestionId);
  const clearFocusedQuestion = useOpenQuestions((s) => s.clearFocusedQuestion);

  const loadQuestions = useCallback(() => {
    void loadSessionOpenQuestions(sessionId);
    void loadSessionAnsweredQuestions(sessionId);
  }, [sessionId, loadSessionOpenQuestions, loadSessionAnsweredQuestions]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

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

  const { waiting, answerable } = useMemo(
    () => partitionDelegatedQuestions({ questions: displayedOpen, agents }),
    [displayedOpen, agents],
  );
  const clusters = useMemo(
    () => buildQuestionClusters({ questions: answerable, agents, workflows }),
    [answerable, agents, workflows],
  );

  const focusedClusterIndex = useMemo(() => {
    if (focusedQuestionId == null) {
      return null;
    }
    for (const cluster of clusters) {
      const index = cluster.questions.findIndex((question) => question.id === focusedQuestionId);
      if (index !== -1) {
        return { ownerAgentId: cluster.ownerAgentId, index };
      }
    }
    return null;
  }, [clusters, focusedQuestionId]);

  useEffect(() => {
    if (focusedQuestionId == null || !openLoaded || focusedClusterIndex != null) {
      return;
    }
    clearFocusedQuestion();
  }, [clearFocusedQuestion, focusedClusterIndex, focusedQuestionId, openLoaded]);

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
    async (
      pairs: ReadonlyArray<AnswerPair>,
      requests: ReadonlyArray<QuestionDelegateRequest>,
      ownerAgentId: AgentId | null,
    ) => {
      if (pairs.length === 0 && requests.length === 0) {
        return;
      }
      flashAnswered(pairs.map((pair) => pair.id));
      if (requests.length > 0) {
        const outcomes = await spawnQuestionDelegates({ sessionId, requests });
        for (const outcome of outcomes) {
          if (outcome.kind === 'spawned' || outcome.kind === 'already-running') {
            clearDraft(outcome.questionId);
          }
        }
      }
      await answerOpenQuestions(sessionId, pairs, ownerAgentId);
    },
    [flashAnswered, clearDraft, spawnQuestionDelegates, answerOpenQuestions, sessionId],
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

  if ((!openLoaded || !answeredLoaded) && loadError !== undefined) {
    return (
      <PaneShell title="Questions">
        <ContextLoadFailure title="Questions" onRetry={loadQuestions} />
      </PaneShell>
    );
  }

  if (!openLoaded || !answeredLoaded) {
    return (
      <PaneShell title="Questions">
        <div className="flex flex-col gap-2" role="status" aria-label="Loading questions">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-md border border-border-soft p-3">
              <Skeleton className="h-3 w-40 rounded-sm" />
              <Skeleton className="h-3 w-3/4 rounded-sm" />
              <Skeleton className="h-3 w-1/2 rounded-sm" />
            </div>
          ))}
        </div>
      </PaneShell>
    );
  }

  if (open.length === 0 && answeredClusters.length === 0 && pendingUndoQuestion === null) {
    return (
      <PaneShell title="Questions">
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
      <PaneShell title="Questions">
        <LensEmptyState
          tone={CONCEPT_TONE.questions}
          icon={CONCEPT_ICONS.questions}
          title="Nothing needs you right now"
          description="Every question on this session is answered. Answered questions remain below for reference."
        />
        <FinishedRegister
          label="Answered"
          count={answered.length}
          visible={<AnsweredHistory clusters={answeredClusters} sessionId={sessionId} />}
        />
      </PaneShell>
    );
  }

  return (
    <PaneShell
      title="Questions"
      meta={answerable.length > 0 ? `${answerable.length} open` : undefined}
    >
      <div className="flex flex-col gap-4">
        {waiting.length > 0 && (
          <div className="flex flex-col gap-2">
            {waiting.map((question) => (
              <QuestionsPaneCard
                key={question.id}
                question={question}
                sessionId={sessionId}
                selectedSuggestions={EMPTY_ARRAY}
                customAnswer=""
                showCustomField={false}
                justAnswered={false}
                onToggleSuggestion={toggleSuggestion}
                onSetCustomAnswer={setCustomAnswer}
                onToggleCustomField={toggleCustomField}
                onDismiss={() => void handleDismiss(question)}
                onClearJustAnswered={clearJustAnswered}
              />
            ))}
          </div>
        )}
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
            focusIndex={
              focusedClusterIndex != null &&
              focusedClusterIndex.ownerAgentId === cluster.ownerAgentId
                ? focusedClusterIndex.index
                : null
            }
            onFocused={clearFocusedQuestion}
            onUndo={(question) => void handleUndo(question)}
            onSubmit={(pairs, requests, ownerAgentId) =>
              void handleSubmit(pairs, requests, ownerAgentId)
            }
          />
        ))}
        <FinishedRegister
          label="Answered"
          count={answered.length}
          visible={<AnsweredHistory clusters={answeredClusters} sessionId={sessionId} />}
        />
      </div>
    </PaneShell>
  );
};
