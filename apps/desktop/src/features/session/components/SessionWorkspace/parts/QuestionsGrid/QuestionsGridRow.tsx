import type { ReactNode } from 'react';
import { cn, ListGridRow, StateDot, TruncatedText } from '@goodboy/ui';
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
  readonly onOpen: () => void;
};

const BLOCKING = 'Blocking';

export const QuestionsGridRow = ({
  sessionId,
  row,
  rowKey,
  titleSuffix,
  runLine,
  age,
  isSelected,
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
          state: isBlocking ? <StateDot state="needsYou" label={BLOCKING} /> : null,
          title: suffixedCell === null ? plainCell : '',
          age,
        },
      }}
    />
  );
};
