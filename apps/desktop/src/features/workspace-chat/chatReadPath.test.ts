import { describe, expect, it } from 'vitest';
import type { ParseContext } from '@goodboy/core';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import { parseProviderLine } from '../chat/parseProviderLine';
import { chatReadPaths } from './chatReadPath';

const WORKING_DIR = '/code/harborline';

const ctx: ParseContext = {
  runId: 'run-consent' as ProviderRunId,
  now: () => '2026-09-28T10:00:00.000Z' as IsoDateTime,
};

type CommandParams = {
  readonly command: string;
};

const codexReads = ({ command }: CommandParams): ReadonlyArray<string> =>
  parseProviderLine({
    provider: 'codex',
    line: JSON.stringify({
      type: 'item.started',
      item: { id: 'item_0', type: 'command_execution', command, status: 'in_progress' },
    }),
    ctx,
  }).flatMap((event) => chatReadPaths({ event, workingDir: WORKING_DIR }));

describe('chatReadPaths', () => {
  it('counts the file a Claude Read tool opens, relative to the workspace', () => {
    const events = parseProviderLine({
      provider: 'anthropic',
      line: JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 't1',
              name: 'Read',
              input: { file_path: '/code/harborline/payments-api/src/api/consent.ts' },
            },
          ],
        },
      }),
      ctx,
    });

    expect(events.flatMap((event) => chatReadPaths({ event, workingDir: WORKING_DIR }))).toEqual([
      'payments-api/src/api/consent.ts',
    ]);
  });

  it.each([
    [
      "/bin/zsh -lc 'cat payments-api/src/questionnaire/steps.ts'",
      ['payments-api/src/questionnaire/steps.ts'],
    ],
    [
      '/bin/zsh -lc "sed -n \'1,120p\' payments-api/src/questionnaire/ConsentStep.tsx"',
      ['payments-api/src/questionnaire/ConsentStep.tsx'],
    ],
    ["bash -lc 'head -n 40 ./ledger-core/README.md'", ['ledger-core/README.md']],
    ["bash -lc 'tail -20 notify-relay/src/retry.ts'", ['notify-relay/src/retry.ts']],
    [
      "/bin/zsh -lc 'nl -ba /code/harborline/payments-api/src/api/consent.ts'",
      ['payments-api/src/api/consent.ts'],
    ],
    [
      '/bin/zsh -lc "rg -n \'consent\' payments-api/src/api/consent.ts payments-api/src"',
      ['payments-api/src/api/consent.ts'],
    ],
    [
      "/bin/zsh -lc 'grep -n policy payments-api/src/api/consent.ts'",
      ['payments-api/src/api/consent.ts'],
    ],
    ["/bin/zsh -lc 'ls -la payments-api/package.json'", ['payments-api/package.json']],
    [
      "/bin/zsh -lc 'cat payments-api/a.ts && sed -n 1,40p payments-api/b.ts | head -5'",
      ['payments-api/a.ts', 'payments-api/b.ts'],
    ],
  ])('counts the files a codex shell read opens: %s', (command, expected) => {
    expect(codexReads({ command })).toEqual(expected);
  });

  it.each([
    "/bin/zsh -lc 'rg -n consent payments-api/src'",
    "/bin/zsh -lc 'ls payments-api'",
    "/bin/zsh -lc 'git status'",
    "/bin/zsh -lc 'sed s/a/b/ payments-api/a.ts'",
  ])('counts nothing for a shell command that reads no single file: %s', (command) => {
    expect(codexReads({ command })).toEqual([]);
  });
});
