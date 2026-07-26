import { SegmentedTabs } from '@goodboy/ui';
import type { SegmentedTabOption } from '@goodboy/ui';

export type StudioTab<T extends string> = SegmentedTabOption<T>;

type Props<T extends string> = {
  readonly ariaLabel: string;
  readonly tabs: ReadonlyArray<StudioTab<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
};

export const StudioTabs = <T extends string>({ ariaLabel, tabs, value, onChange }: Props<T>) => (
  <SegmentedTabs ariaLabel={ariaLabel} options={tabs} value={value} onChange={onChange} size="sm" />
);
