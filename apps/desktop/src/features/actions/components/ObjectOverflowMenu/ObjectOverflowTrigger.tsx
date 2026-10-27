import type { ReactNode } from 'react';
import {
  AnchoredPopover,
  ICON_SIZE,
  MENU_MAX_WIDTH,
  MenuTriggerButton,
  type MenuTriggerSize,
  useDropdown,
} from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { ActionMenuBehavior, ActionViewing, ObjectTarget } from '../../types';
import type { OnArm } from '../../../../shared/components/HeaderConfirm/armedAction';
import { ObjectOverflowList } from './ObjectOverflowList';

const NO_OMISSIONS: ReadonlyArray<string> = [];

export type ObjectOverflowMenuProps = ObjectOverflowTriggerProps & {
  readonly hideWhenEmpty?: boolean;
  readonly minEntries?: number;
};

export type ObjectOverflowTriggerProps = ActionMenuBehavior & {
  readonly target: ObjectTarget;
  readonly label: string;
  readonly tooltip?: string;
  readonly trigger?: ReactNode;
  readonly triggerClassName?: string;
  readonly size?: MenuTriggerSize;
  readonly align?: 'left' | 'right';
  readonly anchorKey?: string | null;
  readonly omit?: ReadonlyArray<string>;
  readonly viewing?: ActionViewing | null;
  readonly disabled?: boolean;
  readonly onArm?: OnArm;
};

export const ObjectOverflowTrigger = ({
  target,
  label,
  tooltip,
  trigger,
  triggerClassName,
  size = 'compact',
  align = 'right',
  anchorKey = null,
  omit = NO_OMISSIONS,
  disabled = false,
  viewing = null,
  onArm,
  onPreview,
  track,
  isHeld,
}: ObjectOverflowTriggerProps) => {
  const dropdown = useDropdown({
    disabled,
    align: align === 'right' ? 'end' : 'start',
    width: 'min-w-[200px]',
    maxWidth: MENU_MAX_WIDTH,
    expectedHeight: 320,
    expectedWidth: 240,
  });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="shrink-0"
      trigger={
        <MenuTriggerButton
          label={label}
          tooltip={tooltip}
          isOpen={dropdown.open}
          size={size}
          disabled={disabled}
          className={triggerClassName}
          onClick={(event) => {
            event.stopPropagation();
            dropdown.toggle();
          }}
        >
          {trigger ?? (
            <CONCEPT_ICONS.more
              size={size === 'control' ? ICON_SIZE.control : ICON_SIZE.row}
              aria-hidden
            />
          )}
        </MenuTriggerButton>
      }
    >
      <ObjectOverflowList
        target={target}
        label={label}
        anchorKey={anchorKey}
        omit={omit}
        viewing={viewing}
        onClose={dropdown.close}
        onArm={onArm}
        onPreview={onPreview}
        track={track}
        isHeld={isHeld}
      />
    </AnchoredPopover>
  );
};
