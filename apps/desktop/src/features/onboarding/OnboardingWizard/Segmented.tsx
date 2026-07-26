import type { LucideIcon } from 'lucide-react';
import { SegmentedTabs } from '@goodboy/ui';

export type SegmentedOption<T extends string> = {
  readonly value: T;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly color?: string;
  readonly disabled?: boolean;
  readonly badge?: string;
  readonly connected?: boolean;
};

type Props<T extends string> = {
  readonly options: ReadonlyArray<SegmentedOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
};

export const Segmented = <T extends string>({ options, value, onChange, ariaLabel }: Props<T>) => {
  return (
    <SegmentedTabs
      ariaLabel={ariaLabel}
      options={options.map((option) => ({
        value: option.value,
        label: option.label,
        icon: option.icon,
        accent: option.color,
        disabled: option.disabled,
        badge: option.connected === true ? '✓' : option.badge,
      }))}
      value={value}
      onChange={onChange}
      fill
    />
  );
};
