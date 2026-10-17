import type { Agent, AgentId, OpenQuestionId } from '@goodboy/types';
import { ListGrid, ListGridGroup } from '@goodboy/ui';
import { useNow } from '../../../../../../shared/hooks/useNow';
import { formatAge } from '../../../../../../shared/utils/time/formatAge';
import { classifyAgent, type AgentKind } from '../../../../agent-kind';
import type { QuestionGroups, QuestionRow } from '../questionsLensModel';
import { QuestionsGridRow } from './QuestionsGridRow';
import { QUESTIONS_GRID_COLUMNS } from './questionsGridColumns';

type OpenQuestionParams = {
  readonly questionId: OpenQuestionId;
};

type Props = {
  readonly groups: QuestionGroups;
  readonly agents: ReadonlyArray<Agent>;
  readonly kindOverrides: Readonly<Record<AgentId, AgentKind>>;
  readonly selectedId: OpenQuestionId | null;
  readonly onOpen: (params: OpenQuestionParams) => void;
};

type RowParams = {
  readonly row: QuestionRow;
};

export const QuestionsGrid = ({ groups, agents, kindOverrides, selectedId, onOpen }: Props) => {
  const now = useNow(30_000);

  const renderRow = ({ row }: RowParams) => {
    const { question } = row;
    const askerId = question.createdByAgentId ?? null;
    const asker = askerId === null ? null : (agents.find((agent) => agent.id === askerId) ?? null);
    const askedOrAnsweredAt =
      row.kind === 'answered' ? (question.answeredAt ?? question.createdAt) : question.createdAt;
    return (
      <QuestionsGridRow
        key={question.id}
        row={row}
        askerKind={
          asker === null
            ? null
            : classifyAgent({ agent: asker, override: kindOverrides[asker.id] ?? null })
        }
        age={formatAge({ from: askedOrAnsweredAt, now })}
        isSelected={question.id === selectedId}
        onOpen={() => onOpen({ questionId: question.id })}
      />
    );
  };

  return (
    <ListGrid label="Questions" columns={QUESTIONS_GRID_COLUMNS} isGrouped>
      {groups.waiting.length > 0 ? (
        <ListGridGroup headingLevel={2} label="Waiting on you" count={groups.waiting.length}>
          {groups.waiting.map((row) => renderRow({ row }))}
        </ListGridGroup>
      ) : null}
      {groups.answered.length > 0 ? (
        <ListGridGroup headingLevel={2} label="Answered" count={groups.answered.length}>
          {groups.answered.map((row) => renderRow({ row }))}
        </ListGridGroup>
      ) : null}
    </ListGrid>
  );
};
