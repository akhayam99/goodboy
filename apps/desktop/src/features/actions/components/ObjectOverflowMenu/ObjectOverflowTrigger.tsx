import type { ReactNode } from 'react';
import { AnchoredPopover, MenuTriggerButton, useDropdown, type MenuTriggerSize } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ActionViewing, ObjectTarget } from '../../types';
import type { OnArm } from '../../../../shared/components/HeaderConfirm/armedAction';
import { ObjectOverflowList } from './ObjectOverflowList';

const NO_OMISSIONS: ReadonlyArray<string> = [];

export type ObjectOverflowMenuProps = ObjectOverflowTriggerProps & {
  readonly hideWhenEmpty?: boolean;
};

export type ObjectOverflowTriggerProps = {
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
}: ObjectOverflowTriggerProps) => {
  const dropdown = useDropdown({
    disabled,
    align: align === 'right' ? 'end' : 'start',
    width: 'min-w-[200px] max-w-sm',
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
      />
    </AnchoredPopover>
  );
};
