import { useMemo, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { LensKind } from '../../../../store';
import { lensLabelFor } from '../../lens-labels';
import type { DestinationCounts } from '../../hooks/useDestinationCounts';
import { resolveLensSurface } from '../../lens-surface';
import { SIBLING_GROUP_LABEL_CLASS } from './crumbClasses';
import { DestinationRow } from './DestinationRow';
import { SwitcherCrumb } from './SwitcherCrumb';
import { lensSwitcherGroups } from './lensSwitcherGroups';

type LensSwitcherCrumbProps = {
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly accessory?: ReactNode;
  readonly activeLens: LensKind | null;
  readonly isBranchless: boolean;
  readonly counts: DestinationCounts;
  readonly onNavigate?: () => void;
  readonly onSelect: (lens: LensKind) => void;
};

export const LensSwitcherCrumb = ({
  label,
  icon,
  accessory,
  activeLens,
  isBranchless,
  counts,
  onNavigate,
  onSelect,
}: LensSwitcherCrumbProps) => {
  const groups = useMemo(() => lensSwitcherGroups({ isBranchless }), [isBranchless]);
  const currentSurface = resolveLensSurface({ lens: activeLens });

  return (
    <SwitcherCrumb
      label={label}
      menuLabel="Switch page"
      icon={icon}
      accessory={accessory}
      onNavigate={onNavigate}
    >
      {({ close }) => (
        <>
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <span className={SIBLING_GROUP_LABEL_CLASS}>{group.label}</span>
              {group.entries.map((entry) => (
                <DestinationRow
                  key={entry.lens}
                  entry={entry}
                  label={lensLabelFor({ lens: entry.lens, isBranchless })}
                  isCurrent={currentSurface === resolveLensSurface({ lens: entry.lens })}
                  count={counts[entry.lens] ?? null}
                  onSelect={(lens) => {
                    close();
                    onSelect(lens);
                  }}
                />
              ))}
            </div>
          ))}
        </>
      )}
    </SwitcherCrumb>
  );
};
