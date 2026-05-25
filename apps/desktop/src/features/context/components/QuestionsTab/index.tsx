import { useEffect, useCallback } from 'react';
import { HelpCircle, Send, Undo2 } from 'lucide-react';
import { ScrollArea, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { QuestionCard } from './QuestionCard';
import { useOpenQuestions } from './useOpenQuestions';

const COLLAPSE_THRESHOLD = 4;

interface QuestionsTabProps {
  sessionId: SessionId;
  onSubmit: (content: string) => Promise<void>;
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
    submitAnsweredBatch,
    clearJustAnswered,
  } = useOpenQuestions();

  useEffect(() => {
    void loadQuestions(sessionId);
  }, [sessionId, loadQuestions]);

  const handleSubmit = useCallback(async () => {
    await submitAnsweredBatch(sessionId, onSubmit);
  }, [sessionId, onSubmit, submitAnsweredBatch]);

  const answeredCount = questions.filter((q) => {
    const draft = drafts[q.id];
    return (
      (draft?.selectedSuggestions.length ?? 0) > 0 || (draft?.customAnswer.trim().length ?? 0) > 0
    );
  }).length;

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
                answeredCount > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              {answeredCount}/{totalOpen} answered
            </span>
          )}
        </div>
      </div>

      {/* question list */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 pb-2 pr-1">
          {questions.map((q) => {
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
      </ScrollArea>

      {/* sticky footer: undo toast + batch submit */}
      <div className="shrink-0 space-y-1.5 pt-2">
        {pendingUndo && (
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
        )}

        {answeredCount > 0 && (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className={cn(
              'flex w-full items-center justify-center gap-1.5 rounded-md',
              'bg-primary px-3 py-2 text-xs font-medium text-primary-foreground',
              'transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              'disabled:opacity-50',
            )}
          >
            <Send size={12} />
            send {answeredCount} answer{answeredCount !== 1 ? 's' : ''} →
          </button>
        )}
      </div>
    </div>
  );
}
