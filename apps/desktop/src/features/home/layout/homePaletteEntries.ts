import { EyeOff, Plus } from '@goodboy/ui/icons';
import type { PaletteEntry } from '../../palette/types';
import { dispatchWindowEvent } from '../../../shared/lib/dispatchWindowEvent';
import { HOME_WIDGETS } from '../grid/homeWidgets';
import type { HomeLayout } from './layoutTypes';
import { trayWidgetsOf } from './trayWidgetsOf';

type Params = {
  readonly entries: HomeLayout;
};

export const homePaletteEntries = ({ entries }: Params): ReadonlyArray<PaletteEntry> => [
  ...entries.map(({ id }): PaletteEntry => ({
    key: `home:hide:${id}`,
    label: `Hide widget: ${HOME_WIDGETS[id].title}`,
    secondary: ['home card remove'],
    kind: 'action',
    group: 'action',
    icon: EyeOff,
    run: () =>
      dispatchWindowEvent({ name: 'goodboy:home-widget-verb', detail: { verb: 'hide', id } }),
  })),
  ...trayWidgetsOf({ entries }).map((id): PaletteEntry => ({
    key: `home:show:${id}`,
    label: `Show widget: ${HOME_WIDGETS[id].title}`,
    secondary: ['home card add'],
    kind: 'action',
    group: 'action',
    icon: Plus,
    run: () =>
      dispatchWindowEvent({ name: 'goodboy:home-widget-verb', detail: { verb: 'show', id } }),
  })),
];
