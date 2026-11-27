import { deskStackOf } from './deskStackOf';
import { isPairedSlot } from './isPairedSlot';
import type { OpenDrawer } from './state';

type Params = {
  readonly top: OpenDrawer | null;
  readonly back: OpenDrawer | null;
};

export const heldBack = ({ top, back }: Params): OpenDrawer | null => {
  if (top === null || back === null) {
    return back;
  }
  return isPairedSlot({ top, back }) || deskStackOf({ top, back }) !== null ? back : null;
};
