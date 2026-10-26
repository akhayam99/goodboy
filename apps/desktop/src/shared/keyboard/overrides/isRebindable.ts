import { entryById } from './entryById';
import { hasChordModifier } from './hasChordModifier';
import { MENU_BOUND_IDS } from './menuBoundIds';
import { normalizeCombo } from './normalizeCombo';
import { RESERVED_COMBOS } from './reservedCombos';

const FIXED_IDS: ReadonlyArray<string> = [
  'composer.send',
  'composer.newLine',
  'composer.submit',
  'overlay.close',
  'menu.open',
];

const RESERVED = new Set(RESERVED_COMBOS.map((combo) => normalizeCombo({ combo })));

type Params = {
  readonly id: string;
};

export const isRebindable = ({ id }: Params): boolean => {
  const entry = entryById.get(id);
  return (
    entry !== undefined &&
    !FIXED_IDS.includes(id) &&
    !MENU_BOUND_IDS.includes(id) &&
    entry.family === undefined &&
    hasChordModifier({ combo: entry.combo }) &&
    !RESERVED.has(normalizeCombo({ combo: entry.combo }))
  );
};
