import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { LensDestinationList } from './LensDestinationList';
import { SwitcherCrumb } from './SwitcherCrumb';

type LensSwitcherCrumbProps = {
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly accessory?: ReactNode;
  readonly sessionId: SessionId;
  readonly activeLens: LensKind | null;
  readonly isBranchless: boolean;
  readonly onNavigate?: () => void;
  readonly onSelect: (lens: LensKind | null) => void;
};

export const LensSwitcherCrumb = ({
  label,
  icon,
  accessory,
  sessionId,
  activeLens,
  isBranchless,
  onNavigate,
  onSelect,
}: LensSwitcherCrumbProps) => (
  <SwitcherCrumb
    label={label}
    menuLabel="Switch page"
    icon={icon}
    accessory={accessory}
    menuHeight={420}
    menuHeightClass="max-h-[26rem]"
    onNavigate={onNavigate}
  >
    {({ close }) => (
      <LensDestinationList
        sessionId={sessionId}
        activeLens={activeLens}
        isBranchless={isBranchless}
        onSelect={(lens) => {
          close();
          onSelect(lens);
        }}
      />
    )}
  </SwitcherCrumb>
);
