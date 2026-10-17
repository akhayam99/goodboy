import { ListGridRow, StateDot } from '@goodboy/ui';
import { questionParts } from '../../../../../context/components/QuestionsTab/questionParts';
import { AGENT_KIND_META, type AgentKind } from '../../../../agent-kind';
import type { QuestionRow } from '../questionsLensModel';
import { questionAnswerLine } from './questionAnswerLine';

type Props = {
  readonly row: QuestionRow;
  readonly askerKind: AgentKind | null;
  readonly age: string;
  readonly isSelected: boolean;
  readonly onOpen: () => void;
};

const BLOCKING = 'Blocking';

export const QuestionsGridRow = ({ row, askerKind, age, isSelected, onOpen }: Props) => {
  const title = questionParts({ text: row.question.text }).title;
  const isSettled = row.kind !== 'waiting' && row.kind !== 'delegated';
  const isBlocking = row.kind === 'waiting' && row.question.isBlocking;
  const answer = questionAnswerLine({ row });

  return (
    <ListGridRow
      ariaLabel={answer === '' ? title : `${title}, ${answer}`}
      isSelected={isSelected}
      rowKey={row.question.id}
      onSelect={onOpen}
      cells={[
        isBlocking ? <StateDot state="needsYou" label={BLOCKING} /> : null,
        isSettled ? <span className="min-w-0 truncate text-muted-foreground">{title}</span> : title,
        answer,
        askerKind === null ? '' : AGENT_KIND_META[askerKind].noun,
        age,
      ]}
    />
  );
};
