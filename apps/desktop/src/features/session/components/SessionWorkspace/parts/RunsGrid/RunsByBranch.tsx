import type { ReactNode } from 'react';
import type { MountId } from '@goodboy/types';
import { Button, ListGridGroup, ListGridRow } from '@goodboy/ui';
import type { MountRowView } from '../../../../../../store/slices/project-mounts/mountRowModel';
import { branchGroupSummaryOf } from '../../../../branchGroupSummaryOf';
import {
  alsoOnOf,
  branchGroupShownCountOf,
  type BranchGroup,
  type BranchGroupHead,
} from '../../../../branchGroupsOf';
import { branchHeadLabelOf, branchHeadMarkOf } from '../../../../branchHeadOf';
import type { SessionRun } from '../../../../sessionRunsOf';
import type { WorkBranch } from '../../../../workBranchesOf';
import { AlsoOnChip } from '../../../../../../shared/components/AlsoOnChip';
import { RunBranchChip } from './RunBranchChip';
import { archivedFoldKeyOf, branchGroupRunsOf } from './branchGroupRunsOf';

export type BranchRowParams = {
  readonly run: SessionRun;
  readonly rowKey: string;
  readonly titleSuffix: ReactNode;
};

type OpenParams = {
  readonly mountId: MountId;
};

type ToggleParams = {
  readonly key: string;
};

type RevealParams = {
  readonly run: SessionRun;
  readonly fromGroupKey: string;
};

type Props = {
  readonly groups: ReadonlyArray<BranchGroup>;
  readonly mounts: ReadonlyArray<MountRowView>;
  readonly openGroups: ReadonlySet<string>;
  readonly onToggleGroup: (params: ToggleParams) => void;
  readonly onOpenBranch: (params: OpenParams) => void;
  readonly onRevealRun: (params: RevealParams) => void;
  readonly renderRow: (params: BranchRowParams) => ReactNode;
};

type PartParams = {
  readonly run: SessionRun;
  readonly head: BranchGroupHead;
};

const partBranchesOf = ({ run, head }: PartParams): ReadonlyArray<WorkBranch> => {
  if (head.kind !== 'series') {
    return [];
  }
  const touched = run.branches.filter((branch) =>
    head.parts.some((part) => part.mountId === branch.mountId),
  );
  return touched.length === 1 ? touched : [];
};

type GroupParams = {
  readonly group: BranchGroup;
};

const groupFactOf = ({ group }: GroupParams): string | null =>
  group.head.kind === 'branch' ? group.head.fact : null;

export const RunsByBranch = ({
  groups,
  mounts,
  openGroups,
  onToggleGroup,
  onOpenBranch,
  onRevealRun,
  renderRow,
}: Props) => (
  <>
    {groups.map((group) => {
      const { active, finished, archived } = branchGroupRunsOf({ runs: group.runs });
      const isFoldable = active.length > 0 && finished.length > 0;
      const isFolded = isFoldable && !openGroups.has(group.key);
      const archivedKey = archivedFoldKeyOf({ groupKey: group.key });
      const isArchivedShown = openGroups.has(archivedKey);
      const shown = [
        ...active,
        ...(isFolded ? [] : finished),
        ...(isArchivedShown ? archived : []),
      ];
      const mark = branchHeadMarkOf({ head: group.head });
      const summary = branchGroupSummaryOf({ counts: group.counts, fact: groupFactOf({ group }) });
      const head = group.head;
      return (
        <ListGridGroup
          key={group.key}
          headingLevel={2}
          label={branchHeadLabelOf({ head: group.head })}
          mark={mark === null ? undefined : <span>{mark}</span>}
          count={branchGroupShownCountOf({ group })}
          fold={
            isFoldable
              ? {
                  label: isFolded ? `${finished.length} finished` : 'Hide finished',
                  onToggle: () => onToggleGroup({ key: group.key }),
                }
              : undefined
          }
          action={
            <>
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
              {archived.length === 0 ? null : (
                <Button
                  variant="quiet"
                  size="xs"
                  aria-expanded={isArchivedShown}
                  onClick={() => onToggleGroup({ key: archivedKey })}
                >
                  {isArchivedShown ? 'Hide archived' : `${archived.length} archived`}
                </Button>
              )}
            </>
          }
          lead={
            head.kind === 'series'
              ? head.parts.map((part) => (
                  <ListGridRow
                    key={part.mountId}
                    ariaLabel={`Open branch ${part.branch}`}
                    onSelect={() => onOpenBranch({ mountId: part.mountId })}
                    cells={['', '', part.branch, '', '', part.fact ?? '', '', '', '', '']}
                  />
                ))
              : undefined
          }
        >
          {shown.map((run) =>
            renderRow({
              run,
              rowKey: `${group.key}/${run.id}`,
              titleSuffix: (
                <>
                  <RunBranchChip
                    branches={partBranchesOf({ run, head })}
                    onOpenBranch={onOpenBranch}
                  />
                  <AlsoOnChip
                    branches={alsoOnOf({ run, groupKey: group.key, mounts })}
                    onReveal={() => onRevealRun({ run, fromGroupKey: group.key })}
                  />
                </>
              ),
            }),
          )}
        </ListGridGroup>
      );
    })}
  </>
);
