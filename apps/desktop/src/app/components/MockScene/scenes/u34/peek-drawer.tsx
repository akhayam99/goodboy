import { DiffPeekScene } from '../u24/DiffPeekScene';
import { PeekDrawerScene } from './PeekDrawerScene';

export const U34_PEEK_DRAWER_SCENES = {
  'u34-peek-drawer-changed': () => <PeekDrawerScene variant="changed" />,
  'u34-peek-drawer-unchanged': () => <PeekDrawerScene variant="unchanged" />,
  'u34-peek-popover-order': () => <DiffPeekScene state="order" />,
};
