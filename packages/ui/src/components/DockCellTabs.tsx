import type { DockGridSpec } from '../dockGridSpec';
import { SegmentedTabs } from './SegmentedTabs';

type Props = {
  readonly spec: DockGridSpec;
  readonly tabs: ReadonlyArray<string>;
  readonly shown: string;
};

export const DockCellTabs = ({ spec, tabs, shown }: Props) => {
  const labelOf = new Map(spec.columns.flat().map((cell) => [cell.key, cell.label ?? cell.key]));
  return (
    <div data-dock-cell-tabs="" className="flex shrink-0 items-center px-2 pt-2">
      <SegmentedTabs
        size="xs"
        ariaLabel="Panels"
        value={shown}
        options={tabs.map((key) => ({ value: key, label: labelOf.get(key) ?? key }))}
        onChange={(key) => spec.onFocus({ key })}
      />
    </div>
  );
};
