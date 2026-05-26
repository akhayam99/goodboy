import { useEffect, useCallback, useMemo } from 'react';
import { HelpCircle, Send, Undo2, ArrowDownRight } from 'lucide-react';
import { ScrollArea, cn } from '@goodboy/ui';
import type { Agent, AgentId, OpenQuestionId, SessionId, Workflow } from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { QuestionCard } from './QuestionCard';
import { buildQuestionClusters, type QuestionCluster } from './clusters';
import { useOpenQuestions } from './useOpenQuestions';

const COLLAPSE_THRESHOLD = 4;
const EMPTY_AGENTS: ReadonlyArray<Agent> = [];
const EMPTY_WORKFLOWS: ReadonlyArray<Workflow> = [];

interface QuestionsTabProps {
  sessionId: SessionId;
  // Routes the cluster's batched answer back to its owner. Implementations
  // should send to `targetAgentId` when non-null, falling back to the
  // currently-selected chat for the orphan cluster.
  onSubmit: (content: string, targetAgentId: AgentId | null) => Promise<void>;
}

export function QuestionsTab({ sessionId, onSubmit }: QuestionsTabProps) {
  const {
    questions,
    drafts,
    justAnswered,
    pendingUndo,
    loadQuestions,
    toggleSuggestion,
    setCustomAnswer,
    toggleCustomField,
    dismissQuestion,
    undoDismiss,
    submitClusterAnswers,
    clearJustAnswered,
  } = useOpenQuestions();

  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_AGENTS);
  const session = useAppStore((s) => s.sessions.find((x) => x.id === sessionId) ?? null);
  const workspaceTemplates = useAppStore((s) =>
    session ? (s.phaseTemplates[session.workspaceId] ?? EMPTY_WORKFLOWS) : EMPTY_WORKFLOWS,
  );

  useEffect(() => {
    void loadQuestions(sessionId);
  }, [sessionId, loadQuestions]);

  const clusters = useMemo<ReadonlyArray<QuestionCluster>>(
    () => buildQuestionClusters({ questions, agents, workflows: workspaceTemplates }),
    [questions, agents, workspaceTemplates],
  );

  const handleSubmitCluster = useCallback(
    async (cluster: QuestionCluster) => {
      const ids = cluster.questions.map((q) => q.id);
      await submitClusterAnswers(sessionId, ids, cluster.ownerAgentId, onSubmit);
    },
    [sessionId, onSubmit, submitClusterAnswers],
  );

  const totalOpen = questions.length;
  const collapsed = totalOpen >= COLLAPSE_THRESHOLD;

  if (totalOpen === 0 && !pendingUndo) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
        <HelpCircle size={20} className="opacity-40" />
        <p className="text-xs">no open questions</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-0">
      {/* header */}
      <div className="flex shrink-0 items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">open questions</span>
          {totalOpen > 0 && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums',
                'bg-muted text-muted-foreground',
              )}
            >
              {totalOpen}
            </span>
          )}
        </div>
      </div>

      {/* clustered question list */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 pb-2 pr-1">
          {clusters.map((cluster) => {
            const answeredCount = cluster.questions.filter((q) => {
              const draft = drafts[q.id];
              return (
                (draft?.selectedSuggestions.length ?? 0) > 0 ||
                (draft?.customAnswer.trim().length ?? 0) > 0
              );
            }).length;

            const ownerLabel = cluster.ownerAgentName ?? 'unassigned';
            const submitTargetLabel = cluster.ownerAgentName ?? 'current chat';

            return (
              <div
                key={cluster.ownerAgentId ?? '__orphan__'}
                className="flex flex-col gap-2 rounded-md border border-border/30 bg-muted/20 p-2"
              >
                <header className="flex items-center justify-between px-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      will be sent to
                    </span>
                    <span className="text-xs font-medium text-foreground">{ownerLabel}</span>
                    {cluster.creatorAgentName ? (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                        <ArrowDownRight size={9} aria-hidden />
                        originally raised by {cluster.creatorAgentName}
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums',
                      answeredCount > 0 && answeredCount === cluster.questions.length
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {answeredCount}/{cluster.questions.length}
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
                        collapsed={collapsed}
                        onToggleSuggestion={toggleSuggestion}
                        onSetCustomAnswer={setCustomAnswer}
                        onToggleCustomField={toggleCustomField}
                        onDismiss={dismissQuestion}
                        onClearJustAnswered={clearJustAnswered}
                      />
                    );
                  })}
                </div>
                {answeredCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleSubmitCluster(cluster)}
                    className={cn(
                      'flex w-full items-center justify-center gap-1.5 rounded-md',
                      'bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground',
                      'transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      'disabled:opacity-50',
                    )}
                  >
                    <Send size={12} />
                    send {answeredCount} answer{answeredCount !== 1 ? 's' : ''} →{' '}
                    {submitTargetLabel}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* sticky footer: undo toast */}
      {pendingUndo && (
        <div className="shrink-0 pt-2">
          <div
            className={cn(
              'flex items-center justify-between rounded-md border border-border/30 bg-muted/50 px-2.5 py-1.5',
            )}
          >
            <span className="text-xs text-muted-foreground">question dismissed</span>
            <button
              type="button"
              onClick={() => void undoDismiss()}
              className="flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none"
            >
              <Undo2 size={11} />
              undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Re-exported so callers that prop-type their onSubmit can stay clean.
export type { OpenQuestionId };
