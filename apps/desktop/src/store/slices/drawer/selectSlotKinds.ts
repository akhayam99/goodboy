import type { AppState } from '../../types';
import type { DrawerKind } from './drawerKinds';
import { selectOpenDrawer } from './selectOpenDrawer';
import { selectSlotBack } from './selectSlotBack';

export type SlotKinds = {
  readonly top: DrawerKind | null;
  readonly back: DrawerKind | null;
};

type Params = Pick<AppState, 'drawer' | 'drawerBack' | 'currentSessionId'>;

export const selectSlotKinds = ({ drawer, drawerBack, currentSessionId }: Params): SlotKinds => ({
  top: selectOpenDrawer({ drawer, currentSessionId })?.kind ?? null,
  back: selectSlotBack({ drawer, drawerBack, currentSessionId })?.kind ?? null,
});
