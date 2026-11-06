import { useEffect, useRef, useState } from 'react';
import type { Agent, AgentId, OpenQuestionId, SessionId } from '@goodboy/types';
import { ListGrid, ListGridGroup } from '@goodboy/ui';
import { useNow } from '../../../../../../shared/hooks/useNow';
import { NAMES } from '../../../../../../shared/utils/names';
import type { AgentKind } from '../../../../agent-kind';
import { questionMetaOf } from '../questionMetaOf';
import type { QuestionGroups, QuestionRow } from '../questionsLensModel';
import { QuestionsGridRow } from './QuestionsGridRow';
import { questionRunLine } from './questionRunLine';
import { QUESTIONS_GRID_COLUMNS } from './questionsGridColumns';

type OpenQuestionParams = {
  readonly questionId: OpenQuestionId;
};

type Props = {
  readonly sessionId: SessionId;
  readonly groups: QuestionGroups;
  readonly agents: ReadonlyArray<Agent>;
  readonly kindOverrides: Readonly<Record<AgentId, AgentKind>>;
  readonly selectedId: OpenQuestionId | null;
  readonly onOpen: (params: OpenQuestionParams) => void;
};

type RowParams = {
  readonly row: QuestionRow;
};

export const QuestionsGrid = ({
  sessionId,
  groups,
  agents,
  kindOverrides,
  selectedId,
  onOpen,
}: Props) => {
  const now = useNow(30_000);
  const [isAnsweredShownByUser, setIsAnsweredShownByUser] = useState<boolean | null>(null);
  const hasFocusedFirst = useRef(false);
  const firstWaitingId = groups.waiting[0]?.question.id ?? null;
  const isSelectedAnswered = groups.answered.some((row) => row.question.id === selectedId);
  const isAnsweredShown =
    isAnsweredShownByUser ?? (groups.waiting.length > 0 || isSelectedAnswered);

  useEffect(() => {
    if (hasFocusedFirst.current || firstWaitingId === null || selectedId !== null) {
      return;
    }
    const active = document.activeElement;
    if (active !== null && active !== document.body) {
      return;
    }
    const first = [...document.querySelectorAll<HTMLElement>('[data-list-grid-row]')].find(
      (element) => element.getAttribute('data-row-key') === firstWaitingId,
    );
    if (first === undefined) {
      return;
    }
    hasFocusedFirst.current = true;
    first.focus();
  }, [firstWaitingId, selectedId]);

  const renderRow = ({ row }: RowParams) => {
    const { question } = row;
    const meta = questionMetaOf({ row, agents, kindOverrides, now });
    return (
      <QuestionsGridRow
        key={question.id}
        sessionId={sessionId}
        row={row}
        runLine={questionRunLine({ askerKind: meta.askerKind, runName: meta.runName })}
        age={meta.age}
        isSelected={question.id === selectedId}
        onOpen={() => onOpen({ questionId: question.id })}
      />
    );
  };

  return (
    <ListGrid label="Questions" columns={QUESTIONS_GRID_COLUMNS} isGrouped>
      {groups.waiting.length > 0 ? (
        <ListGridGroup headingLevel={2} label={NAMES.needsYou} count={groups.waiting.length}>
          {groups.waiting.map((row) => renderRow({ row }))}
        </ListGridGroup>
      ) : null}
      {groups.answered.length > 0 ? (
        <ListGridGroup
          headingLevel={2}
          label="Answered"
          count={groups.answered.length}
          fold={{
            label: isAnsweredShown ? 'Hide' : 'Show',
            onToggle: () => setIsAnsweredShownByUser(!isAnsweredShown),
          }}
        >
          {isAnsweredShown ? groups.answered.map((row) => renderRow({ row })) : null}
        </ListGridGroup>
      ) : null}
    </ListGrid>
  );
};
