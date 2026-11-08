import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Agent, AgentId, MountId, OpenQuestionId, SessionId } from '@goodboy/types';
import { ListGrid } from '@goodboy/ui';
import { GroupBySwitch } from '../../../../../../shared/components/GroupBySwitch';
import { useGroupArrival } from '../../../../../../shared/hooks/useGroupArrival';
import { useNow } from '../../../../../../shared/hooks/useNow';
import type { MountRowView } from '../../../../../../store/slices/project-mounts/mountRowModel';
import type { GroupBy } from '../../../../../../store/slices/session-grouping/state';
import type { AgentKind } from '../../../../agent-kind';
import { questionMetaOf } from '../questionMetaOf';
import type { QuestionBranchGroup, QuestionGroups, QuestionRow } from '../questionsLensModel';
import { QuestionsByBranch, type QuestionBranchRowParams } from './QuestionsByBranch';
import { QuestionsByState } from './QuestionsByState';
import { QuestionsGridRow } from './QuestionsGridRow';
import { questionRunLine } from './questionRunLine';
import { questionBranchRowKeyOf, selectedQuestionRowKeyOf } from './questionRowKeys';
import { QUESTIONS_GRID_COLUMNS } from './questionsGridColumns';

type OpenQuestionParams = {
  readonly questionId: OpenQuestionId;
};

type OpenBranchParams = {
  readonly mountId: MountId;
};

type GroupByParams = {
  readonly groupBy: GroupBy;
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

type ArriveParams = {
  readonly groupKey: string;
};

type ToggleParams = {
  readonly key: string;
};

type RevealParams = {
  readonly questionId: OpenQuestionId;
  readonly fromGroupKey: string;
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
  onOpenBranch,
  canOpenBranch,
  onGroupByChange,
}: Props) => {
  const now = useNow(30_000);
  const [isAnsweredShownByUser, setIsAnsweredShownByUser] = useState<boolean | null>(null);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const [pickedRowKey, setPickedRowKey] = useState<string | null>(null);
  const hasFocusedFirst = useRef(false);
  const isBranchView = groupBy === 'branch';
  const firstWaitingId = groups.waiting[0]?.question.id ?? null;
  const firstWaitingKey = useMemo(() => {
    if (!isBranchView) {
      return firstWaitingId;
    }
    const firstGroup = branchGroups.find((group) => group.waiting.length > 0);
    const firstItem = firstGroup?.waiting[0];
    return firstGroup === undefined || firstItem === undefined
      ? null
      : questionBranchRowKeyOf({ groupKey: firstGroup.key, questionId: firstItem.row.question.id });
  }, [isBranchView, firstWaitingId, branchGroups]);
  const isSelectedAnswered = groups.answered.some((row) => row.question.id === selectedId);
  const isAnsweredShown =
    isAnsweredShownByUser ?? (groups.waiting.length > 0 || isSelectedAnswered);
  const selectedRowKey = selectedQuestionRowKeyOf({
    groups: branchGroups,
    selectedId,
    pickedRowKey,
  });

  useEffect(() => {
    setPickedRowKey((picked) =>
      picked === null || (selectedId !== null && picked.endsWith(`/${selectedId}`)) ? picked : null,
    );
  }, [selectedId]);

  const arrivalGroups = useMemo(
    () =>
      branchGroups.map((group) => {
        const first = group.waiting[0] ?? group.answered[0];
        return {
          key: group.key,
          firstRowKey:
            first === undefined
              ? null
              : isBranchView
                ? questionBranchRowKeyOf({
                    groupKey: group.key,
                    questionId: first.row.question.id,
                  })
                : first.row.question.id,
        };
      }),
    [branchGroups, isBranchView],
  );
  const onArrive = useCallback(({ groupKey }: ArriveParams) => {
    setOpenGroups((open) => new Set([...open, groupKey]));
    setIsAnsweredShownByUser(true);
  }, []);
  const { revealRow } = useGroupArrival({
    isActive: true,
    rowAttribute: 'data-row-key',
    groups: arrivalGroups,
    onArrive,
  });

  useEffect(() => {
    if (hasFocusedFirst.current) {
      return;
    }
    hasFocusedFirst.current = true;
    if (firstWaitingKey === null || selectedId !== null) {
      return;
    }
    const first = [...document.querySelectorAll<HTMLElement>('[data-list-grid-row]')].find(
      (element) => element.getAttribute('data-row-key') === firstWaitingKey,
    );
    if (first === undefined) {
      return;
    }
    const active = document.activeElement;
    const layer = first.closest('[data-pane-layer]');
    const isPaneTitle = active instanceof HTMLHeadingElement && layer?.contains(active) === true;
    if (active !== null && active !== document.body && !isPaneTitle) {
      return;
    }
    first.focus();
  }, [firstWaitingKey, selectedId]);

  const toggleGroup = useCallback(({ key }: ToggleParams) => {
    setOpenGroups((open) => {
      const next = new Set(open);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      return new Set([...open, key]);
    });
  }, []);

  const revealQuestion = ({ questionId, fromGroupKey }: RevealParams) => {
    const keys = branchGroups
      .filter((group) =>
        [...group.waiting, ...group.answered].some((item) => item.row.question.id === questionId),
      )
      .map((group) => group.key);
    const groupKey = keys[(keys.indexOf(fromGroupKey) + 1) % keys.length];
    if (groupKey === undefined || groupKey === fromGroupKey) {
      return;
    }
    const rowKey = questionBranchRowKeyOf({ groupKey, questionId });
    setOpenGroups((open) => new Set([...open, groupKey]));
    setPickedRowKey(rowKey);
    revealRow({ rowKey });
  };

  const renderRow = ({ row, rowKey, isSelected, titleSuffix }: RowParams) => {
    const { question } = row;
    const meta = questionMetaOf({ row, agents, kindOverrides, now });
    return (
      <QuestionsGridRow
        key={rowKey}
        sessionId={sessionId}
        row={row}
        rowKey={rowKey}
        titleSuffix={titleSuffix}
        runLine={questionRunLine({ askerKind: meta.askerKind, runName: meta.runName })}
        age={meta.age}
        isSelected={isSelected}
        onOpen={() => {
          setPickedRowKey(rowKey);
          onOpen({ questionId: question.id });
        }}
      />
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {branchCount < 2 ? null : (
        <div className="flex items-center justify-end gap-3">
          <GroupBySwitch value={groupBy} onChange={(next) => onGroupByChange({ groupBy: next })} />
        </div>
      )}
      <ListGrid label="Questions" columns={QUESTIONS_GRID_COLUMNS} isGrouped>
        {isBranchView ? (
          <QuestionsByBranch
            groups={branchGroups}
            mounts={mounts}
            selectedRowKey={selectedRowKey}
            openGroups={openGroups}
            onToggleGroup={toggleGroup}
            onOpenBranch={onOpenBranch}
            canOpenBranch={canOpenBranch}
            onRevealQuestion={revealQuestion}
            renderRow={({ item, rowKey, titleSuffix }) =>
              renderRow({
                row: item.row,
                rowKey,
                titleSuffix,
                isSelected: rowKey === selectedRowKey,
              })
            }
          />
        ) : (
          <QuestionsByState
            groups={groups}
            isAnsweredShown={isAnsweredShown}
            selectedKey={selectedId}
            onToggleAnswered={() => setIsAnsweredShownByUser(!isAnsweredShown)}
            renderRow={renderRow}
          />
        )}
      </ListGrid>
    </div>
  );
};
