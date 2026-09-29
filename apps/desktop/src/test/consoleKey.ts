import { format } from 'node:util';

const MAX_KEY_LENGTH = 160;
const MAX_FORMATTED_KEY_LENGTH = 240;
const FORMAT_SPECIFIER = /%[sdifjoOc]/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const STATUS_WORD =
  /^ (?:too many requests|unauthorized|forbidden|not found|bad request|conflict|gone|bad gateway|service unavailable|gateway timeout|internal server error|unprocessable)/i;

export const CONSOLE_GUARD_MARKER = Symbol.for('goodboy.consoleGuard');

export type ConsoleBaselineEntry = { file: string; message: string };

export type ConsoleBaseline = { entries: ReadonlyArray<ConsoleBaselineEntry> };

const collapseDigits = (line: string): string =>
  line.replace(/\d+/g, (digits, offset: number) => {
    const isStatusCode =
      digits.length === 3 &&
      offset > 0 &&
      line[offset - 1] === ' ' &&
      STATUS_WORD.test(line.slice(offset + digits.length));
    return isStatusCode ? digits : '#';
  });

export const toConsoleKey = (args: ReadonlyArray<unknown>): string => {
  const [first] = args;
  const isFormatted = typeof first === 'string' && FORMAT_SPECIFIER.test(first);
  const lines = format(...args)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const kept = isFormatted ? lines.slice(0, 2).join(' | ') : (lines[0] ?? '');
  return collapseDigits(kept.replace(UUID, '#')).slice(
    0,
    isFormatted ? MAX_FORMATTED_KEY_LENGTH : MAX_KEY_LENGTH,
  );
};

export const toEntryId = ({ file, message }: ConsoleBaselineEntry): string =>
  `${file}\u0000${message}`;
