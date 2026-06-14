import { useMemo } from 'react';
import { ArrowUpRight, HelpCircle } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Agent, OpenQuestion, SessionId, Workflow } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../../store';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { inferAgentKindFromName } from '../../../../features/session/agent-kind';
import { buildQuestionClusters, type QuestionCluster } from '../QuestionsTab/clusters';

const EMPTY_AGENTS: ReadonlyArray<Agent> = [];
const EMPTY_WORKFLOWS: ReadonlyArray<Workflow> = [];

interface Props {
  sessionId: SessionId;
}

const pickScrollQuestion = (cluster: QuestionCluster): OpenQuestion | null => {
  const withOrdinal = cluster.questions.find((q) => q.turnOrdinal != null);
  return withOrdinal ?? cluster.questions[0] ?? null;
};

export function OpenQuestionsStrip({ sessionId }: Props) {
  const questions = useSessionOpenQuestions(sessionId);
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_AGENTS);
  const session = useAppStore((s) => s.sessions.find((x) => x.id === sessionId) ?? null);
  const workspaceTemplates = useAppStore((s) =>
    session ? (s.phaseTemplates[session.workspaceId] ?? EMPTY_WORKFLOWS) : EMPTY_WORKFLOWS,
  );
  const currentAgentId = useAppStore((s) => s.selectedAgentId[sessionId] ?? null);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const requestOpenQuestionScroll = useAppStore((s) => s.requestOpenQuestionScroll);

  const clusters = useMemo(
    () => buildQuestionClusters({ questions, agents, workflows: workspaceTemplates }),
    [questions, agents, workspaceTemplates],
  );

  if (questions.length === 0 || clusters.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-t border-border-soft/40 bg-warning/5 px-3 py-2.5">
      <span className="flex items-center gap-1.5 px-0.5 text-2xs font-semibold uppercase tracking-[0.08em] text-warning">
        <HelpCircle size={11} aria-hidden />
        {questions.length} open question{questions.length === 1 ? '' : 's'}
      </span>
      <div className="flex flex-col gap-1">
        {clusters.map((cluster) => {
          const target = pickScrollQuestion(cluster);
          if (!target) return null;
          const agentId = cluster.ownerAgentId ?? currentAgentId;
          const kind = cluster.ownerAgentName
            ? inferAgentKindFromName(cluster.ownerAgentName)
            : 'generic';
          const label = cluster.ownerAgentName ?? 'unassigned';

          const onJump = () => {
            if (agentId) {
              void selectAgent(sessionId, agentId);
              requestOpenQuestionScroll({ agentId, questionId: target.id });
            }
          };

          return (
            <button
              key={cluster.ownerAgentId ?? '__orphan__'}
              type="button"
              onClick={onJump}
              disabled={!agentId}
              title={`jump to ${label}'s open questions`}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ring-1 ring-warning/20 transition-colors hover:bg-warning/10 disabled:cursor-default disabled:opacity-60"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <AgentAvatar kind={kind} size="sm" className="shrink-0" />
                <span className="truncate font-medium text-foreground">{label}</span>
                <span className="inline-flex min-w-[1rem] items-center justify-center rounded-full bg-warning/20 px-1 text-[9px] font-medium text-warning">
                  {cluster.questions.length}
                </span>
              </span>
              <ArrowUpRight size={12} aria-hidden className="shrink-0 text-warning/70" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
