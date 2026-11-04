import { ICON_SIZE, SelectableRow, StatusDot, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { switchBranchMount } from '../../../features/branch/switchBranchMount';
import { railBranchFactsOf } from './railBranchFactsOf';
import { railBranchLabelOf } from './railBranchLabelOf';
import type { RailBranchEntry } from './railBranchesSplitOf';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: RailBranchEntry;
};

export const RailBranchRow = ({ sessionId, entry }: Props) => {
  const { row, state, isShown } = entry;
  const facts = railBranchFactsOf({ row });
  const path = facts.path;
  const Icon = facts.mark.icon;
  const detail = [facts.stateWord, state.reason].filter(
    (part): part is string => part !== null && part !== '',
  );
  return (
    <SelectableRow
      selected={isShown}
      ariaCurrent={isShown ? 'page' : undefined}
      ariaLabel={railBranchLabelOf({ facts, reason: state.reason })}
      testId={`rail-branch-${row.mountId}`}
      className="min-h-7 items-center gap-2 px-2 text-meta"
      onClick={() => {
        if (isShown || path === null) {
          return;
        }
        void switchBranchMount({
          sessionId,
          mountId: row.mountId,
          worktreePath: path,
          mode: 'push',
        });
      }}
    >
      <Icon size={ICON_SIZE.row} aria-hidden className={cn('shrink-0', facts.mark.iconClass)} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-row text-foreground">{`${row.projectName}, ${row.branch}`}</span>
        {detail.length === 0 ? null : (
          <span className="truncate text-faint-foreground">{detail.join(', ')}</span>
        )}
      </span>
      {state.tone === null ? null : <StatusDot tone={state.tone} size="sm" />}
    </SelectableRow>
  );
};
