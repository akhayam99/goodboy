import { formatCombo } from '../../../../shared/keyboard/registry';
import type { ComboConflict } from '../../../../shared/keyboard/overrides/findComboConflict';

type Params = {
  readonly combo: string;
  readonly conflict: ComboConflict;
};

const TAIL = 'Press other keys, or Esc to cancel.';

export const recorderMessage = ({ combo, conflict }: Params): string => {
  const keys = formatCombo(combo);
  switch (conflict.kind) {
    case 'needsModifier':
      return `Hold a modifier key with the key you press. ${TAIL}`;
    case 'reserved':
      return `${keys} belongs to the system or to text fields. ${TAIL}`;
    case 'clash':
      return `${keys} already runs ${conflict.label}. ${TAIL}`;
    default: {
      const unreachable: never = conflict;
      return unreachable;
    }
  }
};
