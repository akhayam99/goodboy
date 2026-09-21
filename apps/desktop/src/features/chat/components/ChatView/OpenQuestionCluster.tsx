import { useCallback, useMemo, useState } from 'react';
import type { Agent, AgentId, OpenQuestion, SessionId, Workflow } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { AnswerSubmitButton } from '../../../context/components/QuestionsTab/AnswerSubmitButton';
import { QuestionClusterHeader } from '../../../context/components/QuestionsTab/QuestionClusterHeader';
import { buildQuestionClusters } from '../../../context/components/QuestionsTab/clusters';
import { resolveStagedFlow } from '../../../context/components/QuestionsTab/resolveStagedFlow';
import { summarizeStagedAnswers } from '../../../context/components/QuestionsTab/summarizeStagedAnswers';
import {
  deriveDraftAnswer,
  useOpenQuestions,
} from '../../../context/components/QuestionsTab/useOpenQuestions';
import type { QuestionDelegateRequest } from '../../../../store/slices/open-questions/spawnQuestionDelegates';
import { QUESTION_DELEGATE_COPY } from '../../../context/questionDelegate';
import { OpenQuestionInlineCard } from './OpenQuestionInlineCard';

const NO_AGENTS: ReadonlyArray<Agent> = [];
const NO_WORKFLOWS: ReadonlyArray<Workflow> = [];

type Props = {
  questions: ReadonlyArray<OpenQuestion>;
  sessionId: SessionId;
  viewerAgentId?: AgentId | null;
};

export const OpenQuestionCluster = ({ questions, sessionId, viewerAgentId = null }: Props) => {
  const drafts = useOpenQuestions((s) => s.drafts);
  const flashAnswered = useOpenQuestions((s) => s.flashAnswered);
  const clearDraft = useOpenQuestions((s) => s.clearDraft);
  const answerOpenQuestions = useAppStore((s) => s.answerOpenQuestions);
  const spawnQuestionDelegates = useAppStore((s) => s.spawnQuestionDelegates);
  const agents = useAppStore((s) => s.sessionPhaseRuns?.[sessionId] ?? NO_AGENTS);
  const workflows = useAppStore((s) => s.sessionWorkflows?.[sessionId] ?? NO_WORKFLOWS);
  const [stepIndex, setStepIndex] = useState(0);

  const { openQuestions, settled } = useMemo(
    () => ({
      openQuestions: questions.filter((q) => q.status === 'open'),
      settled: questions.filter((q) => q.status !== 'open'),
    }),
    [questions],
  );
  const clusters = useMemo(
    () => buildQuestionClusters({ questions: openQuestions, agents, workflows }),
    [openQuestions, agents, workflows],
  );
  const agentById = useMemo(() => {
    const map = new Map<AgentId, Agent>();
    for (const agent of agents) {
      map.set(agent.id, agent);
    }
    return map;
  }, [agents]);

  const staged = useMemo(
    () =>
      clusters.flatMap((cluster) => cluster.questions.map((question) => ({ cluster, question }))),
    [clusters],
  );

  const flow = resolveStagedFlow({ total: staged.length, index: stepIndex });
  const current = staged[flow.index] ?? null;

  const answerablePairs = staged.map(({ question }) => ({
    id: question.id,
    text: question.text,
    answer: deriveDraftAnswer(drafts[question.id]),
  }));
  const pendingPairs = answerablePairs.filter((pair) => pair.answer.length > 0);
  const delegateRequests = staged.flatMap(
    ({ question }): ReadonlyArray<QuestionDelegateRequest> => {
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
    },
  );
  const stagedCount = pendingPairs.length + delegateRequests.length;
  const delegatedIds = new Set(delegateRequests.map((request) => request.question.id));
  const recapEntries = answerablePairs.map((pair) => ({
    text: pair.text,
    answer: delegatedIds.has(pair.id) ? QUESTION_DELEGATE_COPY.recap : pair.answer,
  }));
  const targetAgentId = questions[0]?.createdByAgentId ?? null;

  const handleSubmit = useCallback(async () => {
    if (stagedCount === 0) {
      return;
    }
    setStepIndex(0);
    flashAnswered(pendingPairs.map((pair) => pair.id));
    if (delegateRequests.length > 0) {
      const outcomes = await spawnQuestionDelegates({ sessionId, requests: delegateRequests });
      for (const outcome of outcomes) {
        if (outcome.kind === 'spawned' || outcome.kind === 'already-running') {
          clearDraft(outcome.questionId);
        }
      }
    }
    await answerOpenQuestions(sessionId, pendingPairs, targetAgentId);
  }, [
    stagedCount,
    pendingPairs,
    delegateRequests,
    flashAnswered,
    clearDraft,
    spawnQuestionDelegates,
    answerOpenQuestions,
    sessionId,
    targetAgentId,
  ]);

  const handleForward = useCallback(() => {
    if (flow.action === 'send') {
      void handleSubmit();
      return;
    }
    setStepIndex(flow.index + 1);
  }, [flow.action, flow.index, handleSubmit]);

  const handleBack = useCallback(() => {
    setStepIndex(flow.index - 1);
  }, [flow.index]);

  const ownerAgent =
    current?.cluster.ownerAgentId != null
      ? (agentById.get(current.cluster.ownerAgentId) ?? null)
      : null;
  const showsOwner =
    current !== null &&
    current.cluster.ownerAgentId != null &&
    current.cluster.ownerAgentId !== viewerAgentId;
  const headerName = showsOwner ? current.cluster.ownerAgentName : null;
  const creatorName =
    current?.question.createdByAgentId != null
      ? (agentById.get(current.question.createdByAgentId)?.name ?? null)
      : null;
  const creatorIsViewer =
    current?.question.createdByAgentId != null &&
    current.question.createdByAgentId === viewerAgentId;
  const askedByName = creatorIsViewer || creatorName === headerName ? null : creatorName;
  const showsFooter = flow.showsStepper || stagedCount > 0;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {settled.map((q) => (
        <OpenQuestionInlineCard key={q.id} question={q} sessionId={sessionId} />
      ))}
      {current !== null && (
        <div className="flex min-w-0 flex-col gap-2">
          {showsOwner && (
            <QuestionClusterHeader
              sessionId={sessionId}
              ownerAgent={ownerAgent}
              ownerAgentName={current.cluster.ownerAgentName}
              creatorAgentName={current.cluster.creatorAgentName}
            />
          )}
          <OpenQuestionInlineCard
            key={current.question.id}
            question={current.question}
            sessionId={sessionId}
            askedByName={askedByName}
          />
        </div>
      )}
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
