import { describe, expect, it } from 'vitest';
import { workingPhraseOf, type LastTool } from './workingPhraseOf';

const tool = ({ name, command, path }: LastTool): LastTool => ({ name, command, path });

describe('workingPhraseOf', () => {
  it.each([
    [
      tool({ name: 'Bash', command: '/usr/local/bin/pnpm install', path: null }),
      'payments-api',
      'Running pnpm install in payments-api',
    ],
    [
      tool({ name: 'Bash', command: 'NODE_ENV=test vitest run', path: null }),
      null,
      'Running vitest run',
    ],
    [
      tool({ name: 'Read', command: null, path: 'src/ledger/export.ts' }),
      null,
      'Reading export.ts',
    ],
    [
      tool({ name: 'Edit', command: null, path: 'src/ledger/export.ts' }),
      null,
      'Editing export.ts',
    ],
    [tool({ name: 'Grep', command: null, path: null }), null, 'Searching the code'],
    [tool({ name: 'WebSearch', command: null, path: null }), null, 'Searching the web'],
    [tool({ name: 'TodoWrite', command: null, path: null }), null, 'Using TodoWrite'],
  ])('%o in %s reads %s', (last, project, phrase) => {
    expect(workingPhraseOf({ tool: last, project })).toBe(phrase);
  });

  it('keeps up to two script words and skips setup steps in a chain', () => {
    expect(
      workingPhraseOf({
        tool: tool({ name: 'Bash', command: 'cd app && pnpm test retry --watch', path: null }),
        project: null,
      }),
    ).toBe('Running pnpm test retry');
  });

  it('says no tool call yet when the agent has not run a tool', () => {
    expect(workingPhraseOf({ tool: null, project: 'payments-api', hasToolCall: false })).toBe(
      'No tool call yet',
    );
  });

  it('says the model writes when no tool ran yet, never the command text', () => {
    expect(workingPhraseOf({ tool: null, project: 'payments-api' })).toBe('Writing the answer');
  });
});
