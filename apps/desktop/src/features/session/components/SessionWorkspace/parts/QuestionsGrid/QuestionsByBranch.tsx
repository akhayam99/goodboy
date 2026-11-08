import type { ReactNode } from 'react';
import type { MountId, OpenQuestionId } from '@goodboy/types';
import { Button, ListGridGroup } from '@goodboy/ui';
import type { MountRowView } from '../../../../../../store/slices/project-mounts/mountRowModel';
import { alsoOnBranchesOf } from '../../../../branchGroupsOf';
import { branchHeadLabelOf, branchHeadMarkOf } from '../../../../branchHeadOf';
import { AlsoOnChip } from '../../../../../../shared/components/AlsoOnChip';
import type { BranchWorkHeading } from '../../../../branchWorkHeading';
import type { QuestionBranchGroup, QuestionBranchRow } from '../questionsLensModel';
import {
  questionBranchRowKeyOf,
  questionGroupCountOf,
  questionGroupSummaryOf,
} from './questionRowKeys';

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
  readonly canOpenBranch: (params: OpenBranchParams) => boolean;
  readonly onRevealQuestion: (params: RevealParams) => void;
  readonly renderRow: (params: QuestionBranchRowParams) => ReactNode;
  readonly heading?: BranchWorkHeading;
};

const NO_BRANCH_NOTE = 'asked before any branch existed';

type ChipParams = {
  readonly item: QuestionBranchRow;
  readonly groupKey: string;
  readonly mounts: ReadonlyArray<MountRowView>;
  readonly onReveal: (params: RevealParams) => void;
  readonly canReveal: (params: OpenBranchParams) => boolean;
};

const alsoOnChipOf = ({ item, groupKey, mounts, onReveal, canReveal }: ChipParams): ReactNode => {
  const branches = alsoOnBranchesOf({ branches: item.branches, groupKey, mounts });
  const [first] = branches;
  if (first === undefined || !canReveal({ mountId: first.mountId })) {
    return undefined;
  }
  return (
    <AlsoOnChip
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
  canOpenBranch,
  onRevealQuestion,
  renderRow,
  heading,
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
        fact: heading === undefined && head.kind === 'branch' ? head.fact : null,
      });
      return (
        <ListGridGroup
          key={group.key}
          headingLevel={2}
          label={heading?.label ?? branchHeadLabelOf({ head })}
          mark={heading?.mark ?? (mark === null ? undefined : <span>{mark}</span>)}
          count={questionGroupCountOf({ group })}
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
              {heading === undefined && head.kind === 'none' ? <span>{NO_BRANCH_NOTE}</span> : null}
              {summary === '' ? null : <span>{summary}</span>}
              {heading !== undefined ? heading.action : null}
              {heading === undefined &&
              head.kind === 'branch' &&
              canOpenBranch({ mountId: head.branch.mountId }) ? (
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
                canReveal: ({ mountId }) => heading === undefined || canOpenBranch({ mountId }),
              }),
            }),
          )}
        </ListGridGroup>
      );
    })}
  </>
);
