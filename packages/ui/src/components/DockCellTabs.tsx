import type { DockGridSpec } from '../dockGridSpec';
import { SegmentedTabs } from './SegmentedTabs';
import { StatusDot } from './StatusDot';

type Props = {
  readonly spec: DockGridSpec;
  readonly tabs: ReadonlyArray<string>;
  readonly shown: string;
};

export const DockCellTabs = ({ spec, tabs, shown }: Props) => {
  const cells = new Map(spec.columns.flat().map((cell) => [cell.key, cell] as const));
  return (
    <div data-dock-cell-tabs="" className="flex shrink-0 items-center px-2 pt-2">
      <SegmentedTabs
        size="xs"
        ariaLabel="Panels"
        value={shown}
        options={tabs.map((key) => ({
          value: key,
          label: cells.get(key)?.label ?? key,
          ...(cells.get(key)?.hasActivity === true &&
            key !== shown && {
              badge: <StatusDot tone="warning" size="sm" ariaLabel="Has activity" />,
            }),
        }))}
        onChange={(key) => spec.onFocus({ key })}
      />
    </div>
  );
};
