import { Fragment, useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { useDestinationCounts } from '../../hooks/useDestinationCounts';
import { lensLabelFor } from '../../lens-labels';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { SIBLING_GROUP_LABEL_CLASS } from './crumbClasses';
import { DestinationRow } from './DestinationRow';
import { lensSwitcherGroups } from './lensSwitcherGroups';

type LensDestinationListProps = {
  readonly sessionId: SessionId;
  readonly activeLens: LensKind | null;
  readonly isBranchless: boolean;
  readonly onSelect: (lens: LensKind | null) => void;
};

export const LensDestinationList = ({
  sessionId,
  activeLens,
  isBranchless,
  onSelect,
}: LensDestinationListProps) => {
  const groups = useMemo(() => lensSwitcherGroups({ isBranchless }), [isBranchless]);
  const counts = useDestinationCounts({ sessionId });

  return (
    <>
      <DestinationRow
        label="Overview"
        icon={CONCEPT_ICONS.timeline}
        shortcut="lens.overview"
        isCurrent={activeLens === null}
        count={null}
        onSelect={() => onSelect(null)}
      />
      {groups.map((group) => (
        <Fragment key={group.label}>
          <span className={SIBLING_GROUP_LABEL_CLASS}>{group.label}</span>
          {group.entries.map((entry) => (
            <DestinationRow
              key={entry.lens}
              label={lensLabelFor({ lens: entry.lens, isBranchless })}
              icon={entry.icon}
              shortcut={entry.shortcut}
              isCurrent={activeLens === entry.lens}
              count={counts[entry.lens] ?? null}
              onSelect={() => onSelect(entry.lens)}
            />
          ))}
        </Fragment>
      ))}
    </>
  );
};
