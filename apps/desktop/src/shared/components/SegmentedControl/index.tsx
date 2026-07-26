import { SegmentedTabs } from '@goodboy/ui';

export type SegmentedOption<T extends string> = Readonly<{
  label: string;
  value: T;
}>;

type Props<T extends string> = {
  readonly ariaLabel: string;
  readonly options: ReadonlyArray<SegmentedOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
};

export const SegmentedControl = <T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: Props<T>) => (
  <SegmentedTabs
    ariaLabel={ariaLabel}
    options={options}
    value={value}
    onChange={onChange}
    size="sm"
    fill
  />
);
