import { appendFileSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, beforeAll, beforeEach, expect, vi } from 'vitest';
import { toConsoleKey, toEntryId, type ConsoleBaseline } from './consoleKey';

const ROOT = join(import.meta.dirname, '..', '..');
const REPORT_PATH = process.env['GOODBOY_CONSOLE_REPORT'];

const readBaseline = (): ReadonlySet<string> => {
  const parsed: ConsoleBaseline = JSON.parse(
    readFileSync(join(import.meta.dirname, 'console-baseline.json'), 'utf8'),
  );
  return new Set(parsed.entries.map(toEntryId));
};

const BASELINE = readBaseline();

const testFile = (): string =>
  relative(ROOT, expect.getState().testPath ?? '')
    .split('\\')
    .join('/');

type Channel = 'error' | 'warn';

const CHANNELS: ReadonlyArray<Channel> = ['error', 'warn'];

const unexpected: string[] = [];
const installed = new Map<
  Channel,
  { original: typeof console.error; wrapper: typeof console.error }
>();

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

beforeAll(() => {
  if (REPORT_PATH !== undefined) {
    appendFileSync(REPORT_PATH, `${JSON.stringify({ file: testFile(), ran: true })}\n`);
  }
});

beforeEach(() => {
  unexpected.length = 0;
  CHANNELS.forEach((channel) => {
    const original = console[channel];
    if (vi.isMockFunction(original)) {
      return;
    }
    const wrapper = (...args: ReadonlyArray<unknown>) => record({ channel, args });
    installed.set(channel, { original, wrapper });
    console[channel] = wrapper;
  });
});

afterEach(() => {
  installed.forEach(({ original, wrapper }, channel) => {
    if (console[channel] === wrapper) {
      console[channel] = original;
    }
  });
  installed.clear();
  const found = [...unexpected];
  unexpected.length = 0;
  if (found.length > 0) {
    throw new Error(
      `unexpected console output in this test (fix the cause; a baseline entry is a last resort, see docs/testing.md):\n${found.join('\n')}`,
    );
  }
});
