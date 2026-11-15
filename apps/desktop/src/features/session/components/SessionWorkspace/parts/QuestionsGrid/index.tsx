import { Fragment, useCallback, useEffect, useState } from 'react';
import type {
  Agent,
  AgentId,
  MountId,
  OpenQuestion,
  OpenQuestionId,
  SessionId,
} from '@goodboy/types';
import { ListGrid } from '@goodboy/ui';
import { GroupBySwitch } from '../../../../../../shared/components/GroupBySwitch';
import { useNow } from '../../../../../../shared/hooks/useNow';
import type { MountRowView } from '../../../../../../store/slices/project-mounts/mountRowModel';
import type { GroupBy } from '../../../../../../store/slices/session-grouping/state';
import type { AgentKind } from '../../../../agent-kind';
import { questionMetaOf } from '../questionMetaOf';
import type { QuestionBranchGroup, QuestionGroups, QuestionRow } from '../questionsLensModel';
import { QuestionInlineAnswer } from './QuestionInlineAnswer';
import { QuestionsAnswered } from './QuestionsAnswered';
import { QuestionsByBranch, type QuestionBranchRowParams } from './QuestionsByBranch';
import { QuestionsByState } from './QuestionsByState';
import { QuestionsGridRow } from './QuestionsGridRow';
import { QuestionsToolbar } from './QuestionsToolbar';
import { questionRunLine } from './questionRunLine';
import { selectedQuestionRowKeyOf } from './questionRowKeys';
import { QUESTIONS_GRID_COLUMNS } from './questionsGridColumns';
import { useFocusFirstWaiting } from './useFocusFirstWaiting';
import { useQuestionsReveal } from './useQuestionsReveal';
import { useQuestionsView } from './useQuestionsView';

type OpenQuestionParams = {
  readonly questionId: OpenQuestionId;
};

type OpenBranchParams = {
  readonly mountId: MountId;
};

type GroupByParams = {
  readonly groupBy: GroupBy;
};

type DismissedParams = {
  readonly question: OpenQuestion;
};

type Props = {
  readonly sessionId: SessionId;
  readonly groups: QuestionGroups;
  readonly branchGroups: ReadonlyArray<QuestionBranchGroup>;
  readonly mounts: ReadonlyArray<MountRowView>;
  readonly groupBy: GroupBy;
  readonly branchCount: number;
  readonly agents: ReadonlyArray<Agent>;
  readonly kindOverrides: Readonly<Record<AgentId, AgentKind>>;
  readonly selectedId: OpenQuestionId | null;
  readonly onOpen: (params: OpenQuestionParams) => void;
  readonly onDismissed: (params: DismissedParams) => void;
  readonly onOpenBranch: (params: OpenBranchParams) => void;
  readonly canOpenBranch: (params: OpenBranchParams) => boolean;
  readonly onGroupByChange: (params: GroupByParams) => void;
};

type RowParams = {
  readonly row: QuestionRow;
  readonly rowKey: string;
  readonly isSelected: boolean;
  readonly titleSuffix?: QuestionBranchRowParams['titleSuffix'];
};

type BranchesParams = {
  readonly groups: ReadonlyArray<QuestionBranchGroup>;
};

type PickRowParams = {
  readonly rowKey: string;
};

export const QuestionsGrid = ({
  sessionId,
  groups,
  branchGroups,
  mounts,
  groupBy,
  branchCount,
  agents,
  kindOverrides,
  selectedId,
  onOpen,
  onDismissed,
  onOpenBranch,
  canOpenBranch,
  onGroupByChange,
}: Props) => {
  const now = useNow(30_000);
  const [isAnsweredShownByUser, setIsAnsweredShownByUser] = useState<boolean | null>(null);
  const [inlineKey, setInlineKey] = useState<string | null>(null);
  const [pickedRowKey, setPickedRowKey] = useState<string | null>(null);
  const view = useQuestionsView({ groups, branchGroups });
  const isBranchView = groupBy === 'branch';
  const hasWaiting = groups.waiting.length > 0;
  const isSelectedAnswered = groups.answered.some((row) => row.question.id === selectedId);
  const isAnsweredShown = isAnsweredShownByUser ?? isSelectedAnswered;
  const selectedRowKey = selectedQuestionRowKeyOf({
    groups: branchGroups,
    selectedId,
    pickedRowKey,
  });
  useFocusFirstWaiting({ groups, branchGroups, isBranchView, selectedId });

  useEffect(() => {
    setPickedRowKey((picked) =>
      picked === null || (selectedId !== null && picked.endsWith(`/${selectedId}`)) ? picked : null,
    );
  }, [selectedId]);

  const showAnswered = useCallback(() => setIsAnsweredShownByUser(true), []);
  const pickRow = useCallback(({ rowKey }: PickRowParams) => setPickedRowKey(rowKey), []);
  const { openGroups, toggleGroup, revealQuestion } = useQuestionsReveal({
    branchGroups,
    isBranchView,
    onPickRow: pickRow,
    onArrived: showAnswered,
  });

  const renderRow = ({ row, rowKey, isSelected, titleSuffix }: RowParams) => {
    const { question } = row;
    const meta = questionMetaOf({ row, agents, kindOverrides, now });
    const isAnswerable = row.kind === 'waiting';
    const isInline = isAnswerable && inlineKey === rowKey;
    return (
      <Fragment key={rowKey}>
        <QuestionsGridRow
          sessionId={sessionId}
          row={row}
          rowKey={rowKey}
          titleSuffix={titleSuffix}
          runLine={questionRunLine({ askerKind: meta.askerKind, runName: meta.runName })}
          age={meta.age}
          isSelected={isSelected}
          actionLabel={isAnswerable ? (isInline ? 'Close' : 'Answer') : undefined}
          onOpen={() => {
            if (isAnswerable) {
              setInlineKey(isInline ? null : rowKey);
              return;
            }
            setPickedRowKey(rowKey);
            onOpen({ questionId: question.id });
          }}
        />
        {isInline ? (
          <QuestionInlineAnswer
            sessionId={sessionId}
            question={question}
            onDismissed={onDismissed}
            onDone={() => setInlineKey(null)}
          />
        ) : null}
      </Fragment>
    );
  };

  const renderBranches = ({ groups: shown }: BranchesParams) => (
    <QuestionsByBranch
      groups={shown}
      mounts={mounts}
      selectedRowKey={selectedRowKey}
      openGroups={openGroups}
      onToggleGroup={toggleGroup}
      onOpenBranch={onOpenBranch}
      canOpenBranch={canOpenBranch}
      onRevealQuestion={revealQuestion}
      renderRow={({ item, rowKey, titleSuffix }) =>
        renderRow({ row: item.row, rowKey, titleSuffix, isSelected: rowKey === selectedRowKey })
      }
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {hasWaiting || branchCount >= 2 ? (
        <QuestionsToolbar
          chips={view.chips}
          activeChipId={view.activeChipId}
          hasWaiting={hasWaiting}
          onPick={view.pickChip}
          trailing={
            branchCount < 2 ? null : (
              <GroupBySwitch
                value={groupBy}
                onChange={(next) => onGroupByChange({ groupBy: next })}
              />
            )
          }
        />
      ) : null}
      {hasWaiting ? null : (
        <p role="status" className="text-row text-muted-foreground">
          {`Nothing waits for you. ${groups.answered.length} answered.`}
        </p>
      )}
      {hasWaiting ? (
        <ListGrid label="Questions" columns={QUESTIONS_GRID_COLUMNS} isGrouped>
          {isBranchView ? (
            renderBranches({ groups: view.openBranchGroups })
          ) : (
            <QuestionsByState rows={view.openRows} selectedKey={selectedId} renderRow={renderRow} />
          )}
        </ListGrid>
      ) : null}
      {groups.answered.length === 0 ? null : (
        <QuestionsAnswered
          count={groups.answered.length}
          isShown={isAnsweredShown}
          search={view.search}
          onToggle={() => setIsAnsweredShownByUser(!isAnsweredShown)}
          onSearch={view.setSearch}
          rows={
            isBranchView
              ? null
              : view.answeredRows.map((row) =>
                  renderRow({
                    row,
                    rowKey: row.question.id,
                    isSelected: row.question.id === selectedId,
                  }),
                )
          }
          branches={isBranchView ? renderBranches({ groups: view.answeredBranchGroups }) : null}
        />
      )}
    </div>
  );
};
