import { createElement } from 'react';
import { StatusDot } from './components/StatusDot';
import type { DockGridSpec } from './dockGridSpec';
import type { DockTabOption } from './dockTabsContext';

type Params = {
  readonly spec: DockGridSpec;
  readonly tabs: ReadonlyArray<string>;
  readonly shown?: string;
};

export const dockTabOptionsOf = ({ spec, tabs, shown }: Params): ReadonlyArray<DockTabOption> => {
  const cells = new Map(spec.columns.flat().map((cell) => [cell.key, cell] as const));
  return tabs.map((key) => {
    const cell = cells.get(key);
    const option = { value: key, label: cell?.label ?? key };
    return cell?.hasActivity === true && key !== shown
      ? {
          ...option,
          badge: createElement(StatusDot, {
            tone: 'warning',
            size: 'sm',
            ariaLabel: 'Has activity',
          }),
        }
      : option;
  });
};
