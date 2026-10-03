import type { VerbosityLevel } from '@goodboy/types';
import { cn, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { VERBOSITY_LABEL, VERBOSITY_LEVELS, VERBOSITY_DOT } from '../../../settings/verbosity';

type Props = {
  value: VerbosityLevel;
  onChange: (level: VerbosityLevel) => void;
  disabled: boolean;
};

const VERBOSITY_OPTIONS: ReadonlyArray<SegmentedTabOption<VerbosityLevel>> = VERBOSITY_LEVELS.map(
  (level) => ({
    value: level,
    label: VERBOSITY_LABEL[level],
    glyph: <span className={cn('size-1.5 rounded-full', VERBOSITY_DOT[level])} />,
  }),
);

const DISABLED_OPTIONS: ReadonlyArray<SegmentedTabOption<VerbosityLevel>> = VERBOSITY_OPTIONS.map(
  (option) => ({ ...option, disabled: true }),
);

export const VerbositySelect = ({ value, onChange, disabled }: Props) => (
  <SegmentedTabs
    ariaLabel="Reply verbosity"
    size="sm"
    value={value}
    options={disabled ? DISABLED_OPTIONS : VERBOSITY_OPTIONS}
    onChange={onChange}
  />
);
