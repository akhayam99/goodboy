import { useEffect, useMemo, useState } from 'react';
import type { Agent, AgentId, MountId, OpenQuestionId, SessionId } from '@goodboy/types';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import { useRowReturn } from '../../../../shared/hooks/useRowReturn';
import { NAMES } from '../../../../shared/utils/names';
import type { AgentKind } from '../../agent-kind';
import { alsoOnBranchesOf } from '../../branchGroupsOf';
import { openBranchWork } from '../../openBranchWork';
import { openBranchWorkTab } from '../../openBranchWorkTab';
import { useCanOpenBranchWork } from '../../hooks/useCanOpenBranchWork';
import { openQuestion } from '../../openQuestion';
import {
  QuestionsByBranch,
  type QuestionBranchRowParams,
} from '../SessionWorkspace/parts/QuestionsGrid/QuestionsByBranch';
import { QuestionsGridRow } from '../SessionWorkspace/parts/QuestionsGrid/QuestionsGridRow';
import { questionRunLine } from '../SessionWorkspace/parts/QuestionsGrid/questionRunLine';
import {
  questionBranchRowKeyOf,
  selectedQuestionRowKeyOf,
} from '../SessionWorkspace/parts/QuestionsGrid/questionRowKeys';
import { questionMetaOf } from '../SessionWorkspace/parts/questionMetaOf';
import type { QuestionBranchGroup } from '../SessionWorkspace/parts/questionsLensModel';

type Props = {
  readonly sessionId: SessionId;
  readonly group: QuestionBranchGroup;
  readonly mounts: ReadonlyArray<MountRowView>;
  readonly agents: ReadonlyArray<Agent>;
  readonly mountPath: string | null;
};

type ToggleParams = {
  readonly key: string;
};

type MountParams = {
  readonly mountId: MountId;
};

type RevealParams = {
  readonly questionId: OpenQuestionId;
  readonly fromGroupKey: string;
};

const NO_KIND_OVERRIDES: Readonly<Record<AgentId, AgentKind>> = {};

const Icon = CONCEPT_ICONS.questions;

export const BranchWorkQuestions = ({ sessionId, group, mounts, agents, mountPath }: Props) => {
  const now = useNow(30_000);
  const canOpenBranch = useCanOpenBranchWork({ sessionId });
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const kindOverrides = useAppStore((s) => s.agentKindOverride ?? NO_KIND_OVERRIDES);
  const openedId = useAppStore((s) => {
    const drawer = selectOpenDrawer(s);
    return drawer?.kind === 'question' && drawer.sessionId === sessionId
      ? drawer.payload.questionId
      : null;
  });
  const selectedRowKey = selectedQuestionRowKeyOf({
    groups: [group],
    selectedId: openedId,
    pickedRowKey: null,
  });
  const rowIds = useMemo(
    () =>
      [...group.waiting, ...group.answered].map((item) =>
        questionBranchRowKeyOf({ groupKey: group.key, questionId: item.row.question.id }),
      ),
    [group],
  );
  const { remember, returnRowId } = useRowReturn({
    listKey: 'branch-work-questions',
    rowIds,
    rowAttribute: 'data-row-key',
  });
  const isReturnAnswered =
    returnRowId !== null &&
    group.answered.some(
      (item) =>
        questionBranchRowKeyOf({ groupKey: group.key, questionId: item.row.question.id }) ===
        returnRowId,
    );

  useEffect(() => {
    if (isReturnAnswered) {
      setOpenGroups((open) => new Set([...open, group.key]));
    }
  }, [group.key, isReturnAnswered]);

  const toggle = ({ key }: ToggleParams) =>
    setOpenGroups((open) => {
      const next = new Set(open);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      return new Set([...open, key]);
    });

  const openBranch = ({ mountId }: MountParams) => {
    openBranchWorkTab({ sessionId, mountId });
  };

  const reveal = ({ questionId, fromGroupKey }: RevealParams) => {
    const item = [...group.waiting, ...group.answered].find(
      (candidate) => candidate.row.question.id === questionId,
    );
    const next =
      item === undefined
        ? undefined
        : alsoOnBranchesOf({ branches: item.branches, groupKey: fromGroupKey, mounts })[0];
    if (next === undefined) {
      return;
    }
    openBranchWorkTab({ sessionId, mountId: next.mountId });
  };

  const renderRow = ({ item, rowKey, titleSuffix }: QuestionBranchRowParams) => {
    const meta = questionMetaOf({ row: item.row, agents, kindOverrides, now });
    return (
      <QuestionsGridRow
        key={rowKey}
        sessionId={sessionId}
        row={item.row}
        rowKey={rowKey}
        titleSuffix={titleSuffix}
        runLine={questionRunLine({ askerKind: meta.askerKind, runName: meta.runName })}
        age={meta.age}
        isSelected={rowKey === selectedRowKey}
        onOpen={() => {
          remember({ rowId: rowKey });
          openQuestion({
            state: useAppStore.getState(),
            sessionId,
            questionId: item.row.question.id,
          });
        }}
      />
    );
  };

  return (
    <QuestionsByBranch
      groups={[group]}
      mounts={mounts}
      selectedRowKey={selectedRowKey}
      openGroups={openGroups}
      onToggleGroup={toggle}
      onOpenBranch={openBranch}
      canOpenBranch={canOpenBranch}
      onRevealQuestion={reveal}
      renderRow={renderRow}
      heading={{
        label: NAMES.questions,
        mark: <Icon size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />,
        action: (
          <Button
            variant="quiet"
            size="xs"
            onClick={() =>
              openBranchWork({ sessionId, lens: 'questions', groupKey: group.key, mountPath })
            }
          >
            All questions
          </Button>
        ),
      }}
    />
  );
};
