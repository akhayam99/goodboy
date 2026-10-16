import { Check } from 'lucide-react';
import { cn, InteractiveRow, StatusDot, tintClasses, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import { questionParts } from '../../../../context/components/QuestionsTab/questionParts';
import type { AgentKind } from '../../../agent-kind';
import type { QuestionRow } from './questionsLensModel';

type Props = {
  readonly row: QuestionRow;
  readonly isSelected: boolean;
  readonly askerKind: AgentKind | null;
  readonly age: string;
  readonly onSelect: () => void;
  readonly onUndo: (() => void) | null;
};

const doneTint = tintClasses('success');

const answeredLine = ({ row }: { readonly row: QuestionRow }): string => {
  const answer = (row.question.userAnswer ?? '').replace(/\s+/g, ' ').trim();
  if (row.question.answerSource === 'agent') {
    return `Agent: ${answer}`;
  }
  return `You: ${answer}`;
};

export const QuestionQueueRow = ({ row, isSelected, askerKind, age, onSelect, onUndo }: Props) => {
  const title = questionParts({ text: row.question.text }).title;
  const isSettled = row.kind !== 'waiting' && row.kind !== 'delegated';

  return (
    <InteractiveRow
      label={title}
      isSelected={isSelected}
      onOpen={onSelect}
      dataAttributes={{ 'data-question-row': row.question.id }}
      className="grid min-w-0 grid-cols-[1.125rem_minmax(0,1fr)_0.5rem] items-start gap-x-2 px-3 py-2"
    >
      <span className="flex h-5 items-center">
        {isSettled ? (
          <Check size={ICON_SIZE.row} aria-hidden className={cn('shrink-0', doneTint.text)} />
        ) : (
          <AgentKindChip kind={askerKind ?? 'generic'} density="glyph" />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            'line-clamp-2 min-w-0 break-words text-body',
            isSettled ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {title}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-meta text-faint-foreground">
          {row.kind === 'waiting' && <span className="min-w-0 truncate">{age}</span>}
          {row.kind === 'delegated' && <span className="truncate">An agent is answering</span>}
          {(row.kind === 'staged' || row.kind === 'dismissed') && (
            <>
              <span className={cn('shrink-0', doneTint.text)}>
                {row.kind === 'staged' ? 'Answered' : 'Dismissed'}
              </span>
              {onUndo !== null && (
                <>
                  <span aria-hidden>·</span>
                  <button
                    type="button"
                    onClick={onUndo}
                    className="rounded-sm text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    Undo
                  </button>
                </>
              )}
            </>
          )}
          {row.kind === 'answered' && (
            <span className="min-w-0 truncate">{answeredLine({ row })}</span>
          )}
        </span>
      </span>
      <span data-question-blocking-cell="" className="flex h-5 items-center justify-center">
        {row.kind === 'waiting' && row.question.isBlocking ? (
          <Tooltip content="Blocking">
            <span role="img" aria-label="Blocking" className="inline-flex">
              <StatusDot tone="warning" size="sm" />
            </span>
          </Tooltip>
        ) : null}
      </span>
    </InteractiveRow>
  );
};
