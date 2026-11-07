import { cn, ListGridRow, StateDot, TruncatedText } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useObjectMenuTrigger } from '../../../../../actions/useObjectMenuTrigger';
import { questionRowTitle, type QuestionRow } from '../questionsLensModel';
import { questionAnswerLine } from './questionAnswerLine';

type Props = {
  readonly sessionId: SessionId;
  readonly row: QuestionRow;
  readonly runLine: string;
  readonly age: string;
  readonly isSelected: boolean;
  readonly onOpen: () => void;
};

const BLOCKING = 'Blocking';

export const QuestionsGridRow = ({ sessionId, row, runLine, age, isSelected, onOpen }: Props) => {
  const menu = useObjectMenuTrigger({
    target: {
      kind: 'question',
      sessionId,
      questionId: row.question.id,
      askerId: row.question.createdByAgentId ?? null,
    },
    anchorKey: `question:${row.question.id}`,
  });
  const title = questionRowTitle({ row });
  const isSettled = row.kind !== 'waiting' && row.kind !== 'delegated';
  const isBlocking = row.kind === 'waiting' && row.question.isBlocking;
  const detail = [questionAnswerLine({ row }), runLine].filter((part) => part !== '').join(' · ');
  const titleCell = (
    <TruncatedText className={cn('min-w-0', isSettled && 'text-muted-foreground')}>
      {title}
    </TruncatedText>
  );

  return (
    <ListGridRow
      ariaLabel={detail === '' ? title : `${title}, ${detail}`}
      isSelected={isSelected}
      rowKey={row.question.id}
      rowHeight={detail === '' ? 32 : 'stack'}
      onSelect={onOpen}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      cells={[
        isBlocking ? <StateDot state="needsYou" label={BLOCKING} /> : null,
        detail === '' ? (
          titleCell
        ) : (
          <span className="flex min-w-0 flex-1 flex-col">
            {titleCell}
            <TruncatedText className="min-w-0 text-meta text-muted-foreground">
              {detail}
            </TruncatedText>
          </span>
        ),
        age,
      ]}
    />
  );
};
