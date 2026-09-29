import { format } from 'node:util';

const MAX_KEY_LENGTH = 160;

export type ConsoleBaselineEntry = { file: string; message: string };

export type ConsoleBaseline = { entries: ReadonlyArray<ConsoleBaselineEntry> };

export const toConsoleKey = (args: ReadonlyArray<unknown>): string => {
  const firstLine =
    format(...args)
      .split('\n')
      .find((line) => line.trim() !== '') ?? '';
  return firstLine.replace(/\d+/g, '#').trim().slice(0, MAX_KEY_LENGTH);
};

export const toEntryId = ({ file, message }: ConsoleBaselineEntry): string =>
  `${file}\u0000${message}`;
