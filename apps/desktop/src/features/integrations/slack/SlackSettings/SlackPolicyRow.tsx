import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';

type Props<T extends string> = {
  readonly label: string;
  readonly value: T;
  readonly options: ReadonlyArray<SegmentedTabOption<T>>;
  readonly onChange: (value: T) => void;
};

export const SlackPolicyRow = <T extends string>({ label, value, options, onChange }: Props<T>) => (
  <div className="flex min-w-0 items-center justify-between gap-3">
    <span className="text-label text-foreground">{label}</span>
    <SegmentedTabs
      ariaLabel={label}
      options={options}
      value={value}
      onChange={onChange}
      size="sm"
    />
  </div>
);
