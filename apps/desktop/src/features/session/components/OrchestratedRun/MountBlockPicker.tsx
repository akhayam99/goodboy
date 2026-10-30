import { AnchoredPopover, Button, SelectableRow, useDropdown } from '@goodboy/ui';
import type { MountId } from '@goodboy/types';
import type { MountChoice } from '../../../../store/slices/workflows/runMount/selectMountBlockedStep';
import { RUN_STEP_PIN_COPY } from '../../../workflows/runStepPinCopy';

type Props = {
  readonly choices: ReadonlyArray<MountChoice>;
  readonly isDisabled: boolean;
  readonly onPick: (mountId: MountId) => void;
};

type PickParams = {
  readonly mountId: MountId;
};

export const MountBlockPicker = ({ choices, isDisabled, onPick }: Props) => {
  const dropdown = useDropdown({ align: 'start', width: 'min-w-50', expectedHeight: 220 });
  const pick = ({ mountId }: PickParams): void => {
    dropdown.close();
    onPick(mountId);
  };
  return (
    <AnchoredPopover
      dropdown={dropdown}
      trigger={
        <Button
          size="sm"
          variant="quiet"
          disabled={isDisabled}
          aria-haspopup="listbox"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
        >
          {RUN_STEP_PIN_COPY.pick}
        </Button>
      }
    >
      <div
        role="listbox"
        aria-label={RUN_STEP_PIN_COPY.pickLabel}
        className="flex flex-col gap-0.5 p-1"
      >
        {choices.map((choice) => (
          <SelectableRow
            key={choice.mountId}
            role="option"
            selected={false}
            ariaSelected={false}
            onClick={() => pick({ mountId: choice.mountId })}
          >
            <span className="truncate">{choice.branch}</span>
          </SelectableRow>
        ))}
      </div>
    </AnchoredPopover>
  );
};
