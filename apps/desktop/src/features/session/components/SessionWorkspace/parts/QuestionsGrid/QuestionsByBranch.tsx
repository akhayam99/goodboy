import type { ReactNode } from 'react';
import type { MountId, OpenQuestionId } from '@goodboy/types';
import { Button, ListGridGroup } from '@goodboy/ui';
import type { MountRowView } from '../../../../../../store/slices/project-mounts/mountRowModel';
import { alsoOnBranchesOf } from '../../../../branchGroupsOf';
import { branchHeadLabelOf, branchHeadMarkOf } from '../../../../branchHeadOf';
import { RunAlsoOnChip } from '../RunsGrid/RunAlsoOnChip';
import type { QuestionBranchGroup, QuestionBranchRow } from '../questionsLensModel';
import { questionBranchRowKeyOf, questionGroupSummaryOf } from './questionRowKeys';

type OpenBranchParams = {
  readonly mountId: MountId;
};

type ToggleParams = {
  readonly key: string;
};

type RevealParams = {
  readonly questionId: OpenQuestionId;
  readonly fromGroupKey: string;
};

export type QuestionBranchRowParams = {
  readonly item: QuestionBranchRow;
  readonly rowKey: string;
  readonly titleSuffix: ReactNode;
};

type Props = {
  readonly groups: ReadonlyArray<QuestionBranchGroup>;
  readonly mounts: ReadonlyArray<MountRowView>;
  readonly selectedRowKey: string | null;
  readonly openGroups: ReadonlySet<string>;
  readonly onToggleGroup: (params: ToggleParams) => void;
  readonly onOpenBranch: (params: OpenBranchParams) => void;
  readonly onRevealQuestion: (params: RevealParams) => void;
  readonly renderRow: (params: QuestionBranchRowParams) => ReactNode;
};

const NO_BRANCH_NOTE = 'asked before any branch existed';

type ChipParams = {
  readonly item: QuestionBranchRow;
  readonly groupKey: string;
  readonly mounts: ReadonlyArray<MountRowView>;
  readonly onReveal: (params: RevealParams) => void;
};

const alsoOnChipOf = ({ item, groupKey, mounts, onReveal }: ChipParams): ReactNode => {
  const branches = alsoOnBranchesOf({ branches: item.branches, groupKey, mounts });
  if (branches.length === 0) {
    return undefined;
  }
  return (
    <RunAlsoOnChip
      branches={branches}
      onReveal={() => onReveal({ questionId: item.row.question.id, fromGroupKey: groupKey })}
    />
  );
};

export const QuestionsByBranch = ({
  groups,
  mounts,
  selectedRowKey,
  openGroups,
  onToggleGroup,
  onOpenBranch,
  onRevealQuestion,
  renderRow,
}: Props) => (
  <>
    {groups.map((group) => {
      const { head } = group;
      const isFoldable = group.waiting.length > 0 && group.answered.length > 0;
      const isSelectedAnswered = group.answered.some(
        (item) =>
          questionBranchRowKeyOf({ groupKey: group.key, questionId: item.row.question.id }) ===
          selectedRowKey,
      );
      const isFolded = isFoldable && !openGroups.has(group.key) && !isSelectedAnswered;
      const shown = [...group.waiting, ...(isFolded ? [] : group.answered)];
      const mark = branchHeadMarkOf({ head });
      const summary = questionGroupSummaryOf({
        waiting: group.waiting.length,
        answered: group.answered.length,
        fact: head.kind === 'branch' ? head.fact : null,
      });
      return (
        <ListGridGroup
          key={group.key}
          headingLevel={2}
          label={branchHeadLabelOf({ head })}
          mark={mark === null ? undefined : <span>{mark}</span>}
          count={group.waiting.length + group.answered.length}
          fold={
            isFoldable
              ? {
                  label: isFolded ? `${group.answered.length} answered` : 'Hide answered',
                  onToggle: () => onToggleGroup({ key: group.key }),
                }
              : undefined
          }
          action={
            <>
              {head.kind === 'none' ? <span>{NO_BRANCH_NOTE}</span> : null}
              {summary === '' ? null : <span>{summary}</span>}
              {head.kind === 'branch' ? (
                <Button
                  variant="quiet"
                  size="xs"
                  onClick={() => onOpenBranch({ mountId: head.branch.mountId })}
                >
                  Open branch
                </Button>
              ) : null}
            </>
          }
        >
          {shown.map((item) =>
            renderRow({
              item,
              rowKey: questionBranchRowKeyOf({
                groupKey: group.key,
                questionId: item.row.question.id,
              }),
              titleSuffix: alsoOnChipOf({
                item,
                groupKey: group.key,
                mounts,
                onReveal: onRevealQuestion,
              }),
            }),
          )}
        </ListGridGroup>
      );
    })}
  </>
);
