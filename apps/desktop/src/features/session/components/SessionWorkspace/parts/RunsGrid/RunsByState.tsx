import type { ReactNode } from 'react';
import type { MountId } from '@goodboy/types';
import { Button, ListGridGroup } from '@goodboy/ui';
import { VISIBLE_FINISHED_COUNT } from '../../../../finishedRunsCap';
import type { RunGroup } from '../../../../runGroupsOf';
import type { SessionRun } from '../../../../sessionRunsOf';
import { RunBranchChip } from './RunBranchChip';

export type StateRowParams = {
  readonly run: SessionRun;
  readonly rowKey: string;
  readonly titleSuffix: ReactNode;
};

type OpenParams = {
  readonly mountId: MountId;
};

type Props = {
  readonly groups: ReadonlyArray<RunGroup>;
  readonly isEarlierShown: boolean;
  readonly isArchivedShown: boolean;
  readonly onToggleEarlier: () => void;
  readonly onToggleArchived: () => void;
  readonly onOpenBranch: (params: OpenParams) => void;
  readonly canOpenBranch: (params: OpenParams) => boolean;
  readonly renderRow: (params: StateRowParams) => ReactNode;
};

export const RunsByState = ({
  groups,
  isEarlierShown,
  isArchivedShown,
  onToggleEarlier,
  onToggleArchived,
  onOpenBranch,
  canOpenBranch,
  renderRow,
}: Props) => (
  <>
    {groups.map((group) => {
      const earlierCount = Math.max(0, group.runs.length - VISIBLE_FINISHED_COUNT);
      const rows =
        group.key === 'finished' && !isEarlierShown
          ? group.runs.slice(0, VISIBLE_FINISHED_COUNT)
          : group.runs;
      return (
        <ListGridGroup
          key={group.key}
          headingLevel={2}
          label={group.label}
          count={group.runs.length}
          action={
            <>
              {group.key === 'finished' && earlierCount > 0 ? (
                <Button
                  variant="quiet"
                  size="xs"
                  aria-expanded={isEarlierShown}
                  onClick={onToggleEarlier}
                >
                  {isEarlierShown ? 'Show fewer' : 'Show all'}
                </Button>
              ) : null}
              {group.key === 'archived' ? (
                <Button
                  variant="quiet"
                  size="xs"
                  aria-expanded={isArchivedShown}
                  onClick={onToggleArchived}
                >
                  {isArchivedShown ? 'Hide' : 'Show'}
                </Button>
              ) : null}
            </>
          }
        >
          {group.key === 'archived' && !isArchivedShown
            ? null
            : rows.map((run) =>
                renderRow({
                  run,
                  rowKey: run.id,
                  titleSuffix: (
                    <RunBranchChip
                      branches={run.branches}
                      onOpenBranch={onOpenBranch}
                      canOpenBranch={canOpenBranch}
                    />
                  ),
                }),
              )}
        </ListGridGroup>
      );
    })}
  </>
);
