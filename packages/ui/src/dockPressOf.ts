import type { DockDropZone, DockRect } from './dockDropZonesOf';
import type { DockGroups } from './dockLayoutAfterMove';
import type { DockMoveUnit } from './dockMoveTarget';

export type DockPress = {
  readonly key: string;
  readonly unit: DockMoveUnit;
  readonly pointerId: number | null;
  readonly startX: number;
  readonly startY: number;
  readonly isActive: boolean;
  readonly zones: ReadonlyArray<DockDropZone>;
  readonly names: Readonly<Record<string, string>>;
  readonly dock: DockRect | null;
  readonly title: string;
  readonly isKeyboard: boolean;
};

type GridParams = {
  readonly grid: HTMLElement;
};

export const dockPaneElementsOf = ({ grid }: GridParams): ReadonlyArray<HTMLElement> =>
  Array.from(grid.querySelectorAll<HTMLElement>('[data-dock-pane]'));

const panelNamesOf = ({ grid }: GridParams): Readonly<Record<string, string>> =>
  Object.fromEntries(
    [
      ...dockPaneElementsOf({ grid }).map(
        (element) =>
          [
            element.dataset.dockPane ?? '',
            element.querySelector('section')?.getAttribute('aria-label') ?? '',
          ] as const,
      ),
      ...Array.from(grid.querySelectorAll<HTMLElement>('[data-dock-tab]')).map(
        (tab) => [tab.dataset.dockTab ?? '', tab.textContent ?? ''] as const,
      ),
    ].filter(([name, label]) => name !== '' && label !== ''),
  );

type PressParams = GridParams & {
  readonly key: string;
  readonly unit: DockMoveUnit;
  readonly groups: DockGroups;
  readonly pointerId: number | null;
  readonly x: number;
  readonly y: number;
  readonly isKeyboard: boolean;
};

export const dockPressOf = ({
  grid,
  key,
  unit,
  groups,
  pointerId,
  x,
  y,
  isKeyboard,
}: PressParams): DockPress => {
  const lead = Object.keys(groups).find((candidate) => groups[candidate]?.includes(key) === true);
  const group = lead === undefined ? [] : (groups[lead] ?? []);
  const names = panelNamesOf({ grid });
  return {
    key,
    unit,
    pointerId,
    startX: x,
    startY: y,
    isActive: false,
    zones: [],
    names,
    dock: null,
    title: unit === 'cell' && group.length > 1 ? `${group.length} panels` : (names[key] ?? key),
    isKeyboard,
  };
};
