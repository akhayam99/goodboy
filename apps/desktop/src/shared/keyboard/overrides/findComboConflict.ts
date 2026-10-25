import { entryById } from './entryById';
import { hasChordModifier } from './hasChordModifier';
import { normalizeCombo } from './normalizeCombo';
import { offMacOf } from './offMacOf';
import { RESERVED_COMBOS } from './reservedCombos';
import { scopesOverlap } from './scopesOverlap';

export type ComboConflict =
  | { readonly kind: 'needsModifier' }
  | { readonly kind: 'reserved' }
  | { readonly kind: 'clash'; readonly otherId: string; readonly label: string };

type Params = {
  readonly id: string;
  readonly combo: string;
  readonly overrides: Readonly<Record<string, string>>;
};

const RESERVED = new Set(RESERVED_COMBOS.map((combo) => normalizeCombo({ combo })));

export const findComboConflict = ({ id, combo, overrides }: Params): ComboConflict | null => {
  if (!hasChordModifier({ combo })) {
    return { kind: 'needsModifier' };
  }
  const onMac = normalizeCombo({ combo });
  if (RESERVED.has(onMac)) {
    return { kind: 'reserved' };
  }
  const offMac = normalizeCombo({ combo: offMacOf({ combo }) });
  const mine = entryById.get(id);
  for (const [otherId, other] of entryById) {
    if (otherId === id || (mine !== undefined && !scopesOverlap({ first: mine, second: other }))) {
      continue;
    }
    const override = overrides[otherId];
    const otherOnMac = normalizeCombo({ combo: override ?? other.combo });
    const otherOffMac = normalizeCombo({
      combo: override ?? other.offMacCombo ?? offMacOf({ combo: other.combo }),
    });
    if (onMac === otherOnMac || offMac === otherOffMac) {
      return { kind: 'clash', otherId, label: other.label };
    }
  }
  return null;
};
