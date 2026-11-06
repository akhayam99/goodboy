import type { ReactNode } from 'react';
import type { SessionId } from '@goodboy/types';
import { ListGridGroup, FOCUS_RING, cn } from '@goodboy/ui';
import { VISIBLE_FINISHED_COUNT } from '../../../../finishedRunsCap';
import type { RunGroup } from '../../../../runGroupsOf';
import type { SessionRun } from '../../../../sessionRunsOf';
import { ContinueAllAction } from './ContinueAllAction';
import { RunBranchChip } from './RunBranchChip';
import { StopAllAction } from './StopAllAction';

export type StateRowParams = {
  readonly run: SessionRun;
  readonly rowKey: string;
  readonly titleSuffix: ReactNode;
};

type Props = {
  readonly sessionId: SessionId;
  readonly groups: ReadonlyArray<RunGroup>;
  readonly isEarlierShown: boolean;
  readonly isArchivedShown: boolean;
  readonly onToggleEarlier: () => void;
  readonly onToggleArchived: () => void;
  readonly renderRow: (params: StateRowParams) => ReactNode;
};

const FOLD_BUTTON = cn(
  'inline-flex h-6 shrink-0 items-center rounded-md px-2 text-ui text-muted-foreground hover:bg-hover hover:text-foreground',
  FOCUS_RING,
);

export const RunsByState = ({
  sessionId,
  groups,
  isEarlierShown,
  isArchivedShown,
  onToggleEarlier,
  onToggleArchived,
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
              {group.key === 'running' ? <StopAllAction sessionId={sessionId} /> : null}
              {group.key === 'idle' ? (
                <ContinueAllAction sessionId={sessionId} runs={group.runs} />
              ) : null}
              {group.key === 'finished' && earlierCount > 0 ? (
                <button
                  type="button"
                  className={FOLD_BUTTON}
                  aria-expanded={isEarlierShown}
                  onClick={onToggleEarlier}
                >
                  {isEarlierShown ? 'Show fewer' : 'Show all'}
                </button>
              ) : null}
              {group.key === 'archived' ? (
                <button
                  type="button"
                  className={FOLD_BUTTON}
                  aria-expanded={isArchivedShown}
                  onClick={onToggleArchived}
                >
                  {isArchivedShown ? 'Hide' : 'Show'}
                </button>
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
                  titleSuffix: <RunBranchChip branches={run.branches} />,
                }),
              )}
        </ListGridGroup>
      );
    })}
  </>
);
