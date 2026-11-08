import type { DrawerKind } from './drawerKinds';
import { selectOpenDrawer } from './selectOpenDrawer';
import { selectSlotBack } from './selectSlotBack';

export type SlotKinds = {
  readonly top: DrawerKind | null;
  readonly back: DrawerKind | null;
};

type Params = Parameters<typeof selectSlotBack>[0];

export const selectSlotKinds = ({ ...state }: Params): SlotKinds => ({
  top: selectOpenDrawer(state)?.kind ?? null,
  back: selectSlotBack(state)?.kind ?? null,
});
