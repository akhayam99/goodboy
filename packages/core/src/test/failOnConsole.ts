import { afterAll, afterEach } from 'vitest';

const CONSOLE_GUARD_MARKER = Symbol.for('goodboy.consoleGuard');

type Channel = 'error' | 'warn';

const CHANNELS: ReadonlyArray<Channel> = ['error', 'warn'];

const unexpected: string[] = [];

CHANNELS.forEach((channel) => {
  const wrapper = (...args: ReadonlyArray<unknown>) => {
    unexpected.push(`console.${channel}: ${args.map(String).join(' ').split('\n')[0] ?? ''}`);
  };
  Object.defineProperty(wrapper, CONSOLE_GUARD_MARKER, { value: true });
  console[channel] = wrapper;
});

type FlushParams = { where: string };

const flush = ({ where }: FlushParams): void => {
  const found = [...unexpected];
  unexpected.length = 0;
  if (found.length > 0) {
    throw new Error(`unexpected console output ${where}:\n${found.join('\n')}`);
  }
};

afterEach(() => {
  flush({ where: 'in this test' });
});

afterAll(() => {
  flush({ where: 'outside a test (beforeAll, afterAll or a timer that outlived its test)' });
});
