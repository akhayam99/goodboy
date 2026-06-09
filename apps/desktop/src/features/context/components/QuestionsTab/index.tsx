import { useEffect, useCallback, useMemo } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  MessageCircleQuestion,
  Undo2,
} from 'lucide-react';
import { Button, EmptyState, ScrollFade, cn } from '@goodboy/ui';
import type { Agent, AgentId, OpenQuestionId, SessionId, Workflow } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../../store';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { inferAgentKindFromName, type AgentKind } from '../../../../features/session/agent-kind';
import { QuestionCard } from './QuestionCard';
import { buildQuestionClusters, type QuestionCluster } from './clusters';
import { useOpenQuestions } from './useOpenQuestions';

const EMPTY_AGENTS: ReadonlyArray<Agent> = [];
const EMPTY_WORKFLOWS: ReadonlyArray<Workflow> = [];

type Props = {
  sessionId: SessionId;
};

export const QuestionsTab = ({ sessionId }: Props) => {
  const {
    drafts,
    justAnswered,
    pendingUndo,
    toggleSuggestion,
    setCustomAnswer,
    toggleCustomField,
    flashAnswered,
    clearJustAnswered,
    beginUndo,
    clearUndo,
  } = useOpenQuestions();

  const questions = useSessionOpenQuestions(sessionId);
  const loadSessionOpenQuestions = useAppStore((s) => s.loadSessionOpenQuestions);
  const answerOpenQuestions = useAppStore((s) => s.answerOpenQuestions);
  const dismissOpenQuestion = useAppStore((s) => s.dismissOpenQuestion);
  const restoreDismissedOpenQuestion = useAppStore((s) => s.restoreDismissedOpenQuestion);

  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_AGENTS);
  const session = useAppStore((s) => s.sessions.find((x) => x.id === sessionId) ?? null);
  const workspaceTemplates = useAppStore((s) =>
    session ? (s.phaseTemplates[session.workspaceId] ?? EMPTY_WORKFLOWS) : EMPTY_WORKFLOWS,
  );

  useEffect(() => {
    void loadSessionOpenQuestions(sessionId);
  }, [sessionId, loadSessionOpenQuestions]);

  const clusters = useMemo<ReadonlyArray<QuestionCluster>>(
    () => buildQuestionClusters({ questions, agents, workflows: workspaceTemplates }),
    [questions, agents, workspaceTemplates],
  );

  const kindByAgentId = useMemo(() => {
    const map = new Map<AgentId, AgentKind>();
    for (const a of agents) map.set(a.id, inferAgentKindFromName(a.name));
    return map;
  }, [agents]);

  const isAnswered = useCallback(
    (id: OpenQuestionId) => {
      const draft = drafts[id];
      return (
        (draft?.selectedSuggestions.length ?? 0) > 0 || (draft?.customAnswer.trim().length ?? 0) > 0
      );
    },
    [drafts],
  );

  const handleSubmitCluster = useCallback(
    async (cluster: QuestionCluster) => {
      const pairs = cluster.questions
        .map((q) => {
          const draft = drafts[q.id];
          const answer =
            (draft?.customAnswer.trim().length ?? 0) > 0
              ? draft!.customAnswer.trim()
              : (draft?.selectedSuggestions ?? []).join(', ');
          return { id: q.id, text: q.text, answer };
        })
        .filter((p) => p.answer.length > 0);
      if (pairs.length === 0) {
        return;
      }
      flashAnswered(pairs.map((p) => p.id));
      await answerOpenQuestions(sessionId, pairs, cluster.ownerAgentId);
    },
    [sessionId, drafts, flashAnswered, answerOpenQuestions],
  );

  const handleDismiss = useCallback(
    (id: OpenQuestionId) => {
      const target = questions.find((q) => q.id === id);
      if (!target) {
        return;
      }
      void dismissOpenQuestion(sessionId, target);
      beginUndo(target);
    },
    [questions, sessionId, dismissOpenQuestion, beginUndo],
  );

  const handleUndo = useCallback(() => {
    const target = pendingUndo?.question;
    clearUndo();
    if (target) {
      void restoreDismissedOpenQuestion(sessionId, target);
    }
  }, [pendingUndo, clearUndo, restoreDismissedOpenQuestion, sessionId]);

  const totalOpen = questions.length;
  const totalAnswered = useMemo(
    () => questions.filter((q) => isAnswered(q.id)).length,
    [questions, isAnswered],
  );

  if (totalOpen === 0 && !pendingUndo) {
    return (
      <div className="flex h-full items-center justify-center py-8">
        <EmptyState
          icon={CheckCircle2}
          title="no open questions"
          description="when an agent needs a decision, it lands here as a tappable card."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-0">
      <div className="shrink-0 px-1 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion size={13} aria-hidden className="text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">open questions</span>
          </div>
          <span className="text-2xs font-medium tabular-nums text-muted-foreground">
            {totalAnswered}/{totalOpen} answered
          </span>
        </div>
        {totalOpen > 0 && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-[width,background-color] duration-300 ease-out',
                totalAnswered === totalOpen ? 'bg-success/70' : 'bg-primary/70',
              )}
              style={{ width: `${(totalAnswered / totalOpen) * 100}%` }}
            />
          </div>
        )}
      </div>

      <ScrollFade className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 pb-2 pr-0.5">
          {clusters.map((cluster) => {
            const answeredCount = cluster.questions.filter((q) => isAnswered(q.id)).length;
            const total = cluster.questions.length;
            const complete = answeredCount > 0 && answeredCount === total;
            const kind: AgentKind = cluster.ownerAgentId
              ? (kindByAgentId.get(cluster.ownerAgentId) ?? 'generic')
              : 'generic';
            const ownerLabel = cluster.ownerAgentName ?? 'unassigned';
            const submitTargetLabel = cluster.ownerAgentName ?? 'current chat';

            return (
              <div
                key={cluster.ownerAgentId ?? '__orphan__'}
                className={cn(
                  'flex flex-col gap-2.5 rounded-xl border border-border-soft bg-subtle p-2.5 shadow-sm transition-[box-shadow,border-color] duration-200 motion-safe:animate-fade-in',
                  complete && 'ring-1 ring-border',
                )}
              >
                <header className="flex items-center justify-between gap-2.5 px-0.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <AgentAvatar kind={kind} size="md" className="shrink-0" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {ownerLabel}
                      </span>
                      {cluster.creatorAgentName ? (
                        <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                          <ArrowDownRight size={9} aria-hidden />
                          via {cluster.creatorAgentName}
                        </span>
                      ) : (
                        <span className="text-2xs text-muted-foreground">
                          {complete ? 'ready to send' : 'awaiting your answer'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium tabular-nums transition-colors',
                      complete ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {complete && <CheckCircle2 size={10} aria-hidden />}
                    {answeredCount}/{total}
                  </span>
                </header>

                <div className="flex flex-col gap-2">
                  {cluster.questions.map((q) => {
                    const draft = drafts[q.id];
                    return (
                      <QuestionCard
                        key={q.id}
                        question={q}
                        selectedSuggestions={draft?.selectedSuggestions ?? []}
                        customAnswer={draft?.customAnswer ?? ''}
                        showCustomField={draft?.showCustomField ?? false}
                        justAnswered={justAnswered.includes(q.id)}
                        onToggleSuggestion={toggleSuggestion}
                        onSetCustomAnswer={setCustomAnswer}
                        onToggleCustomField={toggleCustomField}
                        onDismiss={handleDismiss}
                        onClearJustAnswered={clearJustAnswered}
                      />
                    );
                  })}
                </div>

                {answeredCount > 0 && (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => void handleSubmitCluster(cluster)}
                    className="group w-full"
                  >
                    <span>
                      send {answeredCount} answer{answeredCount !== 1 ? 's' : ''} to{' '}
                      {submitTargetLabel}
                    </span>
                    <ArrowRight
                      size={13}
                      aria-hidden
                      className="motion-safe:transition-transform group-hover:translate-x-0.5"
                    />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </ScrollFade>

      {pendingUndo && (
        <div className="shrink-0 pt-2">
          <div className="flex items-center justify-between rounded-lg border border-border-soft bg-elevated px-3 py-2 shadow-sm motion-safe:animate-fade-in">
            <span className="text-xs text-muted-foreground">question dismissed</span>
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Undo2 size={11} />
              undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
