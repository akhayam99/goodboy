type Params = {
  readonly text: string;
};

const ESCAPE = String.fromCharCode(0x1b);
const TIMESTAMP = '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z';
const ANSI = new RegExp(`(?:${ESCAPE}|\\u009b|\\ufffd|\\u241b)\\[[0-9;?]*[ -/]*[@-~]`, 'g');
const STRAY_ESCAPE = new RegExp(`[${ESCAPE}\\u009b\\u241b]`, 'g');
const TAB_PREFIX = new RegExp(`^[^\\t]*\\t([^\\t]*)\\t${TIMESTAMP}\\ufeff? ?`);
const SPACE_PREFIX = new RegExp(`^.*?\\s(UNKNOWN STEP)\\s+${TIMESTAMP}\\ufeff? ?`);
const UNKNOWN_STEP = 'UNKNOWN STEP';

export const cleanLogText = ({ text }: Params): string => {
  let step = '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(ANSI, '')
    .replace(STRAY_ESCAPE, '')
    .split('\n')
    .flatMap((line) => {
      const match = TAB_PREFIX.exec(line) ?? SPACE_PREFIX.exec(line);
      if (match === null) {
        return [line];
      }
      const next = match[1] ?? '';
      const rest = line.slice(match[0].length);
      if (next === step || next === UNKNOWN_STEP || next === '') {
        return [rest];
      }
      step = next;
      return [`== ${next}`, rest];
    })
    .join('\n');
};
