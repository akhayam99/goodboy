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

  it.each([
    ['cd ledger-core\npnpm test', 'Running pnpm test'],
    ['cd ledger-core;\n\nexport A=1\ncargo test -p ledger-core', 'Running cargo test'],
    ['/bin/zsh -lc ls', 'Running ls'],
    ["/bin/zsh -lc 'pnpm test'", 'Running pnpm test'],
    ['bash -c "cd payments-api && pnpm lint"', 'Running pnpm lint'],
    ["/bin/zsh -lc 'cd app; echo done'", 'Running echo'],
    ['pnpm --filter payments-api test', 'Running pnpm test'],
    ['pnpm -F payments-api run build', 'Running pnpm run build'],
    ['pnpm --filter=payments-api test retry', 'Running pnpm test retry'],
    ['echo SECRET_VALUE | gh auth login --with-token', 'Running echo'],
    ['curl -H token123 https://example.test', 'Running curl'],
    ['node ./scripts/Build.js SECRET_VALUE', 'Running node'],
    ['pnpm test "a && b"', 'Running pnpm test'],
  ])('%s reads %s', (command, phrase) => {
    expect(
      workingPhraseOf({ tool: tool({ name: 'Bash', command, path: null }), project: null }),
    ).toBe(phrase);
  });

  it('never prints a quoted secret of an unrecognized program', () => {
    const phrase = workingPhraseOf({
      tool: tool({ name: 'Bash', command: "export T='abc' && gh auth login 'abc'", path: null }),
      project: null,
    });
    expect(phrase).toBe('Running gh');
    expect(phrase).not.toContain('abc');
  });

  it('says it works, never that no tool ran, when tool calls cannot be seen', () => {
    expect(
      workingPhraseOf({ tool: null, project: null, hasToolCall: false, canSeeTools: false }),
    ).toBe('Working');
  });

  it('names a tool with no details as a tool', () => {
    expect(
      workingPhraseOf({ tool: tool({ name: 'tool', command: null, path: null }), project: null }),
    ).toBe('Using a tool');
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
