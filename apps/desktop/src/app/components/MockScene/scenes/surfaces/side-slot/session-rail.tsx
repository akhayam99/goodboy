import { SlotBackChipScene } from './SlotBackChipScene';

export const SIDE_SLOT_RAIL_SCENES = {
  'session-rail-waiting': () => <SlotBackChipScene state="plan" hasRail />,
  'session-rail-pressed': () => <SlotBackChipScene state="swapped" hasRail />,
};
