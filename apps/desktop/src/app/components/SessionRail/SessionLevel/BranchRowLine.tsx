import { FactCard, SelectableRow, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { BranchRowFacts } from '../../../../features/branch/branchRowFactsOf';
import { pullRequestStateToneOf } from '../../../../features/branch/pullRequestStateToneOf';
import { TRAIL_PILL_INSET } from '../../../../shared/components/trailingSlot';
import { BranchRowChip } from './BranchRowChip';
import type { BranchRowChip as BranchRowChipView } from './branchRowChipOf';
import { branchRowCardOf } from './branchRowCardOf';

type Props = {
  readonly facts: BranchRowFacts;
  readonly chip: BranchRowChipView | null;
  readonly ariaLabel: string;
  readonly reason: string | null;
  readonly isShown: boolean;
  readonly isExpanded: boolean | undefined;
  readonly onSelect: (() => void) | undefined;
};

export const BranchRowLine = ({
  facts,
  chip,
  ariaLabel,
  reason,
  isShown,
  isExpanded,
  onSelect,
}: Props) => {
  const mark = pullRequestStateToneOf({ state: facts.state });
  const StateIcon = mark.icon;
  return (
    <FactCard side="right" card={branchRowCardOf({ facts, chip, reason })}>
      <div className="flex min-w-0 flex-1">
        <SelectableRow
          selected={isShown}
          ariaCurrent={isShown ? 'page' : undefined}
          ariaLabel={ariaLabel}
          {...(isExpanded !== undefined && { isExpanded })}
          {...(onSelect !== undefined && { onClick: onSelect })}
          className={cn('h-7 min-w-0 flex-1 items-center gap-2 pl-1 text-ui', TRAIL_PILL_INSET)}
        >
          <StateIcon
            size={ICON_SIZE.row}
            aria-hidden
            data-pr-state={facts.state}
            data-pr-tone={mark.tone}
            className={cn('shrink-0', mark.iconClass)}
          />
          <span
            data-worktree-branch=""
            data-title-kind={facts.isBranchTitle ? 'branch' : 'request'}
            className={cn(
              'min-w-0 flex-1 truncate text-left',
              facts.isBranchTitle && 'text-code',
              facts.isFinished && 'text-muted-foreground',
            )}
          >
            {facts.title}
          </span>
          {chip === null ? null : <BranchRowChip chip={chip} />}
        </SelectableRow>
      </div>
    </FactCard>
  );
};
