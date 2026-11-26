import type { DockGridSpec } from '../dockGridSpec';
import { dockTabOptionsOf } from '../dockTabOptionsOf';
import { SegmentedTabs } from './SegmentedTabs';

type Props = {
  readonly spec: DockGridSpec;
  readonly tabs: ReadonlyArray<string>;
  readonly shown: string;
};

export const DockCellTabs = ({ spec, tabs, shown }: Props) => (
  <div data-dock-cell-tabs="" className="flex shrink-0 items-center px-2 pt-2">
    <SegmentedTabs
      size="xs"
      ariaLabel="Panels"
      value={shown}
      options={dockTabOptionsOf({ spec, tabs })}
      onChange={(key) => spec.onFocus({ key })}
    />
  </div>
);
