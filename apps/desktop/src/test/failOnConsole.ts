import { appendFileSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { CONSOLE_GUARD_MARKER, toConsoleKey, toEntryId, type ConsoleBaseline } from './consoleKey';

const ROOT = join(import.meta.dirname, '..', '..');
const IS_UPDATING = process.env['GOODBOY_UPDATE_CONSOLE_BASELINE'] === '1';
const RAW_REPORT_PATH = process.env['GOODBOY_CONSOLE_REPORT'];

if (RAW_REPORT_PATH !== undefined && !IS_UPDATING) {
  throw new Error(
    'GOODBOY_CONSOLE_REPORT is set without GOODBOY_UPDATE_CONSOLE_BASELINE=1. Unset it: the console guard would be off.',
  );
}

const REPORT_PATH = IS_UPDATING ? RAW_REPORT_PATH : undefined;

const readBaseline = (): ReadonlySet<string> => {
  const parsed: ConsoleBaseline = JSON.parse(
    readFileSync(join(import.meta.dirname, 'console-baseline.json'), 'utf8'),
  );
  return new Set(parsed.entries.map(toEntryId));
};

const BASELINE = readBaseline();

type Channel = 'error' | 'warn';

const CHANNELS: ReadonlyArray<Channel> = ['error', 'warn'];

let currentFile = '';

const testFile = (): string => {
  const testPath = expect.getState().testPath;
  if (testPath !== undefined) {
    currentFile = relative(ROOT, testPath).split('\\').join('/');
  }
  return currentFile;
};

const unexpected: string[] = [];

const record = ({ channel, args }: { channel: Channel; args: ReadonlyArray<unknown> }): void => {
  const file = testFile();
  const key = toConsoleKey(args);
  if (REPORT_PATH !== undefined) {
    appendFileSync(REPORT_PATH, `${JSON.stringify({ file, message: key })}\n`);
    return;
  }
  if (BASELINE.has(toEntryId({ file, message: key }))) {
    return;
  }
  unexpected.push(`console.${channel}: ${key}`);
};

CHANNELS.forEach((channel) => {
  const wrapper = (...args: ReadonlyArray<unknown>) => record({ channel, args });
  Object.defineProperty(wrapper, CONSOLE_GUARD_MARKER, { value: true });
  console[channel] = wrapper;
});

const flush = (where: string): void => {
  const found = [...unexpected];
  unexpected.length = 0;
  if (found.length > 0) {
    throw new Error(
      `unexpected console output ${where} (fix the cause; a baseline entry is a last resort, see docs/testing.md):\n${found.join('\n')}`,
    );
  }
};

beforeAll(() => {
  if (REPORT_PATH !== undefined) {
    appendFileSync(REPORT_PATH, `${JSON.stringify({ file: testFile(), ran: true })}\n`);
  }
});

afterEach(() => {
  flush('in this test');
});

afterAll(() => {
  flush('outside a test (beforeAll, afterAll or a timer that outlived its test)');
});
