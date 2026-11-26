import type { DockGridSpec } from './dockGridSpec';
import type { DockTabOption } from './dockTabsContext';

type Params = {
  readonly spec: DockGridSpec;
  readonly tabs: ReadonlyArray<string>;
};

export const dockTabOptionsOf = ({ spec, tabs }: Params): ReadonlyArray<DockTabOption> => {
  const labelOf = new Map(spec.columns.flat().map((cell) => [cell.key, cell.label ?? cell.key]));
  return tabs.map((key) => ({ value: key, label: labelOf.get(key) ?? key }));
};
