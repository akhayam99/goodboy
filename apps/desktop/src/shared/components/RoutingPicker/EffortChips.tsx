import type { EffortAxis, EffortLevel } from '@goodboy/types';
import { EFFORT_LABEL } from '../../../features/chat/utils/chat-constants';
import { PickerChip } from './PickerChip';

type Props = {
  readonly axis: EffortAxis;
  readonly value: EffortLevel;
  readonly canEdit: boolean;
  readonly onPick: (level: EffortLevel) => void;
};

export const EffortChips = ({ axis, value, canEdit, onPick }: Props) => (
  <div
    role="group"
    aria-label={axis.label}
    className="flex flex-wrap justify-center gap-1 rounded-lg bg-background/40 p-1"
  >
    {axis.levels.map(({ level, available }) => (
      <PickerChip
        key={level}
        label={EFFORT_LABEL[level]}
        active={value === level}
        disabled={canEdit === false || available === false}
        title={
          available === false
            ? `${EFFORT_LABEL[level]} is unavailable for this model with the current toggles`
            : canEdit === false
              ? 'Tuning is fixed in this context'
              : undefined
        }
        onSelect={() => onPick(level)}
      />
    ))}
  </div>
);
