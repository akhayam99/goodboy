import { Check } from 'lucide-react';
import { Chip, cn, InteractiveRow, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import { questionParts } from '../../../../context/components/QuestionsTab/questionParts';
import type { AgentKind } from '../../../agent-kind';
import type { QuestionRow } from './questionsLensModel';

type Props = {
  readonly row: QuestionRow;
  readonly isSelected: boolean;
  readonly askerName: string | null;
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

export const QuestionQueueRow = ({
  row,
  isSelected,
  askerName,
  askerKind,
  age,
  onSelect,
  onUndo,
}: Props) => {
  const title = questionParts({ text: row.question.text }).title;
  const isSettled = row.kind !== 'waiting' && row.kind !== 'delegated';

  return (
    <InteractiveRow
      label={title}
      isSelected={isSelected}
      onOpen={onSelect}
      dataAttributes={{ 'data-question-row': row.question.id }}
      className="flex min-w-0 items-start gap-3 px-3 py-2"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'min-w-0 truncate text-body',
            isSettled ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {title}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-meta text-faint-foreground">
          {isSettled ? (
            <Check size={ICON_SIZE.row} aria-hidden className={cn('shrink-0', doneTint.text)} />
          ) : (
            <AgentKindChip kind={askerKind ?? 'generic'} />
          )}
          {row.kind === 'waiting' && (
            <>
              <span className="min-w-0 truncate">
                {askerName ?? 'An agent'} · {age}
              </span>
              {row.question.isBlocking && (
                <Chip tone="warning" label="Blocking" shape="badge" bordered={false} />
              )}
            </>
          )}
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
    </InteractiveRow>
  );
};
