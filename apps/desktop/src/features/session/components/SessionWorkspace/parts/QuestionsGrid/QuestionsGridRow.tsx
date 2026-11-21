import type { ReactNode } from 'react';
import { cn, ListGridRow, StateDot, TruncatedText, type DotState } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useObjectMenuTrigger } from '../../../../../actions/useObjectMenuTrigger';
import { questionRowTitle, type QuestionRow } from '../questionsLensModel';
import { questionAnswerLine } from './questionAnswerLine';

type Props = {
  readonly sessionId: SessionId;
  readonly row: QuestionRow;
  readonly rowKey: string;
  readonly titleSuffix?: ReactNode;
  readonly runLine: string;
  readonly age: string;
  readonly isSelected: boolean;
  readonly actionLabel?: string;
  readonly onOpen: () => void;
};

type QuestionDot = {
  readonly state: DotState;
  readonly label: string;
};

const QUESTION_DOT = {
  waiting: { state: 'needsYou', label: 'Waiting' },
  delegated: { state: 'running', label: 'Delegated' },
  staged: { state: 'idle', label: 'Staged' },
  dismissed: { state: 'stopped', label: 'Dismissed' },
  answered: { state: 'done', label: 'Answered' },
} as const satisfies Record<QuestionRow['kind'], QuestionDot>;

const BLOCKING_DOT: QuestionDot = { state: 'needsYou', label: 'Blocking' };

export const QuestionsGridRow = ({
  sessionId,
  row,
  rowKey,
  titleSuffix,
  runLine,
  age,
  isSelected,
  actionLabel,
  onOpen,
}: Props) => {
  const menu = useObjectMenuTrigger({
    target: {
      kind: 'question',
      sessionId,
      questionId: row.question.id,
      askerId: row.question.createdByAgentId ?? null,
    },
    anchorKey: `question:${rowKey}`,
  });
  const title = questionRowTitle({ row });
  const isSettled = row.kind !== 'waiting' && row.kind !== 'delegated';
  const isBlocking = row.kind === 'waiting' && row.question.isBlocking;
  const dot = isBlocking ? BLOCKING_DOT : QUESTION_DOT[row.kind];
  const detail = [questionAnswerLine({ row }), runLine].filter((part) => part !== '').join(' · ');
  const titleText = (
    <TruncatedText className={cn('min-w-0', isSettled && 'text-muted-foreground')}>
      {title}
    </TruncatedText>
  );
  const detailText =
    detail === '' ? null : (
      <TruncatedText className="min-w-0 text-meta text-muted-foreground">{detail}</TruncatedText>
    );
  const plainCell =
    detailText === null ? (
      titleText
    ) : (
      <span className="flex min-w-0 flex-1 flex-col">
        {titleText}
        {detailText}
      </span>
    );
  const suffixedCell =
    titleSuffix === undefined ? null : (
      <span
        data-question-row-title=""
        className="flex min-w-0 flex-1 cursor-pointer select-none flex-col"
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest('button, a') !== null) {
            return;
          }
          onOpen();
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          {titleText}
          {titleSuffix}
        </span>
        {detailText}
      </span>
    );

  return (
    <ListGridRow
      ariaLabel={detail === '' ? title : `${title}, ${detail}`}
      isSelected={isSelected}
      rowKey={rowKey}
      rowHeight={detail === '' ? 32 : 'stack'}
      onSelect={onOpen}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      overlays={suffixedCell === null ? undefined : [{ column: 'title', node: suffixedCell }]}
      cells={{
        byKey: {
          state: <StateDot state={dot.state} label={dot.label} />,
          title: suffixedCell === null ? plainCell : '',
          action: actionLabel ?? null,
          age,
        },
      }}
    />
  );
};
