import { fireEvent } from '@testing-library/react';
import { currentPlatform } from '../../shared/platform';
import { SHORTCUTS, platformCombo, type ShortcutId } from '../../shared/keyboard/registry';

const KEY_OF_CODE: Readonly<Record<string, string>> = {
  Enter: 'Enter',
  Slash: '/',
  Comma: ',',
  Period: '.',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backspace: 'Backspace',
  Space: ' ',
  F10: 'F10',
  ArrowDown: 'ArrowDown',
  ArrowUp: 'ArrowUp',
};

const keyOfCode = (code: string): string => {
  const named = KEY_OF_CODE[code];
  if (named !== undefined) {
    return named;
  }
  if (code.startsWith('Key')) {
    return code.slice(3).toLowerCase();
  }
  if (code.startsWith('Digit')) {
    return code.slice(5);
  }
  return code;
};

type PressParams = {
  readonly code: string;
  readonly key?: string;
  readonly meta?: boolean;
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly alt?: boolean;
  readonly target?: Element | Window | Document;
};

export const pressKey = ({
  code,
  key,
  meta = false,
  ctrl = false,
  shift = false,
  alt = false,
  target,
}: PressParams): KeyboardEvent => {
  const init: KeyboardEventInit = {
    code,
    key: key ?? keyOfCode(code),
    metaKey: meta,
    ctrlKey: ctrl,
    shiftKey: shift,
    altKey: alt,
    bubbles: true,
    cancelable: true,
  };
  const event = new KeyboardEvent('keydown', init);
  Object.defineProperty(event, 'getModifierState', { value: () => false });
  const focused = document.activeElement;
  fireEvent(target ?? (focused !== null ? focused : document.body), event);
  return event;
};

type PressShortcutParams = {
  readonly id: ShortcutId;
  readonly target?: Element | Window | Document;
};

export const pressShortcut = ({ id, target }: PressShortcutParams): KeyboardEvent => {
  const combo = platformCombo({ entry: SHORTCUTS[id] });
  const parts = combo.split('+');
  const onMac = currentPlatform() === 'darwin';
  const wantsMod = parts.includes('cmd');
  return pressKey({
    code: parts[parts.length - 1] ?? '',
    meta: onMac && wantsMod,
    ctrl: parts.includes('ctrl') || (!onMac && wantsMod),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    ...(target !== undefined && { target }),
  });
};
