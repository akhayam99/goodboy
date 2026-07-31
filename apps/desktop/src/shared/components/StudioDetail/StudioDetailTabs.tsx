import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';

type Props<T extends string> = {
  readonly options: ReadonlyArray<SegmentedTabOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
};

export const StudioDetailTabs = <T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: Props<T>) => {
  if (options.length < 2) {
    return null;
  }

  return (
    <SegmentedTabs
      ariaLabel={ariaLabel}
      options={options}
      value={value}
      onChange={onChange}
      size="sm"
    />
  );
};
