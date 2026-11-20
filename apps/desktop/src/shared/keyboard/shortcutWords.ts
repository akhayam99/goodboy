import { currentPlatform } from '../platform';
import { codeGlyph } from './codeGlyph';
import { KEY_LABEL, SHORTCUTS, platformCombo, type ShortcutId } from './registry';

const MAC_MODIFIER_WORD: Record<string, string> = {
  cmd: 'Command',
  shift: 'Shift',
  alt: 'Option',
  ctrl: 'Control',
};

type Params = {
  readonly id: ShortcutId;
};

export const shortcutWords = ({ id }: Params): string => {
  const isMac = currentPlatform() === 'darwin';
  return platformCombo({ entry: SHORTCUTS[id] })
    .split('+')
    .map((part, index, parts) =>
      index === parts.length - 1
        ? codeGlyph({ code: part, glyphs: KEY_LABEL })
        : ((isMac ? MAC_MODIFIER_WORD[part] : KEY_LABEL[part]) ?? part),
    )
    .join(' ');
};
