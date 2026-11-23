import { describe, expect, it } from 'vitest';
import { commandRunOf } from './commandRunOf';
import { promptTextOf } from './promptTextOf';

const CWD = '/Users/dev/harborline/payments-api';

describe('the safety rule of a suggested command', () => {
  it('runs a discovered script with no outside arguments on the click', () => {
    expect(
      commandRunOf({ source: 'script', scriptId: 'pnpm:install', scriptName: 'install' }),
    ).toBe('run');
  });

  it.each(['db:migrate', 'seed', 'deploy', 'clean'])(
    'types the destructive script %s into the prompt',
    (scriptName) => {
      expect(commandRunOf({ source: 'script', scriptId: `pnpm:${scriptName}`, scriptName })).toBe(
        'type',
      );
    },
  );

  it('types a script it did not discover', () => {
    expect(commandRunOf({ source: 'script', scriptId: null, scriptName: 'install' })).toBe('type');
  });

  it('types a test filter read from the log of a check', () => {
    expect(commandRunOf({ source: 'check-log', scriptId: null, scriptName: null })).toBe('type');
  });

  it('types a command an agent ran', () => {
    expect(commandRunOf({ source: 'agent', scriptId: 'pnpm:test', scriptName: 'test' })).toBe(
      'type',
    );
  });
});

describe('the text typed into the prompt', () => {
  it('waits for Enter: no return at the end, even when the source had one', () => {
    const text = promptTextOf({
      text: "pnpm test -- 'rounds totals'\r\n",
      cwd: CWD,
    });

    expect(text).toBe(`cd ${CWD} && pnpm test -- 'rounds totals'`);
  });

  it('drops control characters a log could carry', () => {
    const text = promptTextOf({ text: 'pnpm test\u0003\u001B', cwd: CWD });

    expect(text).toBe(`cd ${CWD} && pnpm test`);
  });

  it('pastes a command of several lines as one block that still waits for Enter', () => {
    const text = promptTextOf({ text: 'pnpm build\npnpm test', cwd: CWD });

    expect(text).toBe(`cd ${CWD} && \u001B[200~pnpm build\npnpm test\u001B[201~`);
    expect(text.endsWith('\r')).toBe(false);
  });

  it('always names the folder, since a cd in the shell may have moved it', () => {
    const text = promptTextOf({ text: 'pnpm db:migrate', cwd: `${CWD}/packages/db` });

    expect(text).toBe(`cd ${CWD}/packages/db && pnpm db:migrate`);
  });
});
