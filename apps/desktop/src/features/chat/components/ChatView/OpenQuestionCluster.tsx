import { useCallback, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Agent, AgentId, OpenQuestion, SessionId, Workflow } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { QuestionClusterHeader } from '../../../context/components/QuestionsTab/QuestionClusterHeader';
import { buildQuestionClusters } from '../../../context/components/QuestionsTab/clusters';
import {
  deriveDraftAnswer,
  useOpenQuestions,
} from '../../../context/components/QuestionsTab/useOpenQuestions';
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
  const answerOpenQuestions = useAppStore((s) => s.answerOpenQuestions);
  const agents = useAppStore((s) => s.sessionPhaseRuns?.[sessionId] ?? NO_AGENTS);
  const workflows = useAppStore((s) => s.sessionWorkflows?.[sessionId] ?? NO_WORKFLOWS);

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

  const pendingPairs = openQuestions
    .map((q) => ({ id: q.id, text: q.text, answer: deriveDraftAnswer(drafts[q.id]) }))
    .filter((pair) => pair.answer.length > 0);
  const targetAgentId = questions[0]?.createdByAgentId ?? null;

  const handleSubmit = useCallback(async () => {
    if (pendingPairs.length === 0) {
      return;
    }
    flashAnswered(pendingPairs.map((pair) => pair.id));
    await answerOpenQuestions(sessionId, pendingPairs, targetAgentId);
  }, [pendingPairs, flashAnswered, answerOpenQuestions, sessionId, targetAgentId]);

  return (
    <div className="flex flex-col gap-2">
      {settled.map((q) => (
        <OpenQuestionInlineCard key={q.id} question={q} sessionId={sessionId} />
      ))}
      {clusters.map((cluster) => {
        const ownerAgent =
          cluster.ownerAgentId != null ? (agentById.get(cluster.ownerAgentId) ?? null) : null;
        const showsOwner = cluster.ownerAgentId != null && cluster.ownerAgentId !== viewerAgentId;
        return (
          <div key={cluster.ownerAgentId ?? '__orphan__'} className="flex flex-col gap-2">
            {showsOwner && (
              <QuestionClusterHeader
                sessionId={sessionId}
                ownerAgent={ownerAgent}
                ownerAgentName={cluster.ownerAgentName}
                creatorAgentName={cluster.creatorAgentName}
              />
            )}
            {cluster.questions.map((q) => (
              <OpenQuestionInlineCard key={q.id} question={q} sessionId={sessionId} />
            ))}
          </div>
        );
      })}
      {pendingPairs.length > 0 && (
        <button
          type="button"
          onClick={() => void handleSubmit()}
          className={cn(
            'group flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold',
            'bg-primary text-primary-foreground shadow-sm transition-all duration-150',
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
            className="transition-transform group-hover:translate-x-0.5"
          />
        </button>
      )}
    </div>
  );
};
