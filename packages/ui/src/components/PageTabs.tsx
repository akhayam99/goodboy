import { SegmentedTabs, type SegmentedTabOption } from './SegmentedTabs';

export type PageTabOption<T extends string = string> = Pick<
  SegmentedTabOption<T>,
  'value' | 'label' | 'badge' | 'tooltip' | 'disabled'
>;

type Props<T extends string = string> = {
  readonly options: ReadonlyArray<PageTabOption<T>>;
  readonly value: T | null;
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
};

export const PageTabs = <T extends string>({ options, value, onChange, ariaLabel }: Props<T>) => (
  <SegmentedTabs
    variant="underline"
    ariaLabel={ariaLabel}
    options={options}
    value={value}
    onChange={onChange}
  />
);
