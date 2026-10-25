import { isValidCombo } from './isValidCombo';

export type RecordedCombo =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'unsupported' }
  | { readonly kind: 'combo'; readonly combo: string };

type Params = {
  readonly event: KeyboardEvent;
  readonly isMac: boolean;
};

const MODIFIER_KEY = /^(Meta|Control|Alt|Shift)(Left|Right)$/;

export const comboFromEvent = ({ event, isMac }: Params): RecordedCombo => {
  if (MODIFIER_KEY.test(event.code) || event.code === '') {
    return { kind: 'waiting' };
  }
  if (!isMac && event.metaKey) {
    return { kind: 'unsupported' };
  }
  const modifiers = [
    ...(isMac && event.metaKey ? ['cmd'] : []),
    ...(event.ctrlKey ? [isMac ? 'ctrl' : 'cmd'] : []),
    ...(event.altKey ? ['alt'] : []),
    ...(event.shiftKey ? ['shift'] : []),
  ];
  const combo = [...modifiers, event.code].join('+');
  return isValidCombo({ combo }) ? { kind: 'combo', combo } : { kind: 'unsupported' };
};
