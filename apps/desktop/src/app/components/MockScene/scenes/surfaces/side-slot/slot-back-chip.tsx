import { SlotBackChipScene } from './SlotBackChipScene';

export const SIDE_SLOT_BACK_CHIP_SCENES = {
  'slot-back-chip': () => <SlotBackChipScene state="plan" />,
  'slot-back-chip-swapped': () => <SlotBackChipScene state="swapped" />,
  'slot-back-chip-narrow': () => <SlotBackChipScene state="narrow" />,
};
