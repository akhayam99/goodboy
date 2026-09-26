import type { VerbosityLevel } from '@goodboy/types';
import { cn, Listbox, type ListboxOption } from '@goodboy/ui';
import { VERBOSITY_LABEL, VERBOSITY_LEVELS, VERBOSITY_DOT } from '../../../settings/verbosity';

type Props = {
  value: VerbosityLevel;
  onChange: (level: VerbosityLevel) => void;
  disabled: boolean;
};

const VERBOSITY_OPTIONS: ReadonlyArray<ListboxOption<VerbosityLevel>> = VERBOSITY_LEVELS.map(
  (level) => ({
    value: level,
    label: VERBOSITY_LABEL[level],
    leading: <span className={cn('size-1.5 rounded-full', VERBOSITY_DOT[level])} />,
  }),
);

export const VerbositySelect = ({ value, onChange, disabled }: Props) => (
  <Listbox
    ariaLabel="Reply verbosity"
    size="sm"
    isBlock
    value={value}
    options={VERBOSITY_OPTIONS}
    onChange={onChange}
    disabled={disabled}
  />
);
