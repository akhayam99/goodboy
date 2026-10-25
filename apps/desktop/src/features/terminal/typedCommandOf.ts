const PASTE_START = '\u001B[200~';

const PASTE_END = '\u001B[201~';

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

type Params = {
  readonly text: string;
};

export const typedCommandOf = ({ text }: Params): string => {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARACTERS, '')
    .replace(/\s+$/, '')
    .split('\n');
  if (lines.length === 1) {
    return lines[0] ?? '';
  }
  return `${PASTE_START}${lines.join('\n')}${PASTE_END}`;
};
