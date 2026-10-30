import { ListGridRow, StateDot, TruncatedText } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useObjectMenuTrigger } from '../../../../../actions/useObjectMenuTrigger';
import { AGENT_KIND_META, type AgentKind } from '../../../../agent-kind';
import { questionRowTitle, type QuestionRow } from '../questionsLensModel';
import { questionAnswerLine } from './questionAnswerLine';

type Props = {
  readonly sessionId: SessionId;
  readonly row: QuestionRow;
  readonly askerKind: AgentKind | null;
  readonly age: string;
  readonly isSelected: boolean;
  readonly onOpen: () => void;
};

const BLOCKING = 'Blocking';

export const QuestionsGridRow = ({ sessionId, row, askerKind, age, isSelected, onOpen }: Props) => {
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
  const answer = questionAnswerLine({ row });

  return (
    <ListGridRow
      ariaLabel={answer === '' ? title : `${title}, ${answer}`}
      isSelected={isSelected}
      rowKey={row.question.id}
      onSelect={onOpen}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      cells={[
        isBlocking ? <StateDot state="needsYou" label={BLOCKING} /> : null,
        isSettled ? (
          <TruncatedText className="min-w-0 text-muted-foreground">{title}</TruncatedText>
        ) : (
          title
        ),
        answer,
        askerKind === null ? '' : AGENT_KIND_META[askerKind].noun,
        age,
      ]}
    />
  );
};
