import { describe, expect, it } from 'vitest';
import { terminalActivityOf } from './terminalActivityOf';

const COMMANDS: ReadonlyMap<string, string> = new Map([
  ['t-dev', 'pnpm dev'],
  ['t-test', 'false'],
]);

describe('terminalActivityOf', () => {
  it('shows the running command first', () => {
    expect(
      terminalActivityOf({
        tabIds: ['t-test', 't-dev'],
        busyIds: new Set(['t-dev']),
        exits: new Map([['t-test', { code: 1, command: 'pnpm test' }]]),
        commands: COMMANDS,
      }),
    ).toEqual({ tone: 'running', text: 'pnpm dev' });
  });

  it('says a command failed with its exit code before one that passed', () => {
    expect(
      terminalActivityOf({
        tabIds: ['t-lint', 't-test'],
        busyIds: new Set(),
        exits: new Map([
          ['t-lint', { code: 0, command: 'pnpm lint' }],
          ['t-test', { code: 1, command: 'pnpm test' }],
        ]),
        commands: COMMANDS,
      }),
    ).toEqual({ tone: 'failed', text: 'pnpm test failed, exit 1' });
  });

  it('names the command the shell ran, never a guess from the keys typed', () => {
    expect(
      terminalActivityOf({
        tabIds: ['t-test'],
        busyIds: new Set(),
        exits: new Map([['t-test', { code: 0, command: 'true' }]]),
        commands: COMMANDS,
      }),
    ).toEqual({ tone: 'passed', text: 'true passed' });
  });

  it('shows the status alone when the shell reported no command', () => {
    expect(
      terminalActivityOf({
        tabIds: ['t-test'],
        busyIds: new Set(),
        exits: new Map([['t-test', { code: 0, command: null }]]),
        commands: COMMANDS,
      }),
    ).toEqual({ tone: 'passed', text: 'Passed' });
    expect(
      terminalActivityOf({
        tabIds: ['t-test'],
        busyIds: new Set(),
        exits: new Map([['t-test', { code: 2, command: null }]]),
        commands: COMMANDS,
      }),
    ).toEqual({ tone: 'failed', text: 'Failed, exit 2' });
  });

  it('has nothing to say for an idle shell without an exit status', () => {
    expect(
      terminalActivityOf({
        tabIds: ['t-idle'],
        busyIds: new Set(),
        exits: new Map(),
        commands: COMMANDS,
      }),
    ).toBeNull();
  });
});
