import { currentPlatform } from '../platform';

type ReplayParams = {
  readonly combo: string;
};

type CodeParams = {
  readonly code: string;
};

const KEY_OF_CODE: Readonly<Record<string, string>> = {
  Comma: ',',
  Period: '.',
  Slash: '/',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backquote: '`',
};

const keyOfCode = ({ code }: CodeParams): string => {
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

export const replayCombo = ({ combo }: ReplayParams): void => {
  const parts = combo.split('+');
  const code = parts[parts.length - 1] ?? '';
  const isMac = currentPlatform() === 'darwin';
  const hasCommand = parts.includes('cmd');
  const event = new KeyboardEvent('keydown', {
    code,
    key: keyOfCode({ code }),
    metaKey: isMac && hasCommand,
    ctrlKey: parts.includes('ctrl') || (!isMac && hasCommand),
    shiftKey: parts.includes('shift'),
    altKey: parts.includes('alt'),
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
};
