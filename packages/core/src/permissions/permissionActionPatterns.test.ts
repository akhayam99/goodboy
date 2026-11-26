import { describe, expect, it } from 'vitest';
import {
  actionNounOf,
  commandPrefix,
  isFilePathTool,
  oncePatternText,
  prefixRuleFor,
  toolClassOf,
} from './permissionActionPatterns';

describe('commandPrefix', () => {
  it('keeps the runner and its subcommand', () => {
    expect(commandPrefix({ command: 'pnpm test --filter ledger-core' })).toBe('pnpm test');
    expect(commandPrefix({ command: 'git push origin main' })).toBe('git push');
  });

  it('falls back to the first token for a bare command', () => {
    expect(commandPrefix({ command: 'ls -la' })).toBe('ls');
  });

  it('cuts at the first chain operator', () => {
    expect(commandPrefix({ command: 'pnpm test && rm -rf dist' })).toBe('pnpm test');
    expect(commandPrefix({ command: 'git status; git push' })).toBe('git status');
  });

  it('does not treat a flag as the subcommand', () => {
    expect(commandPrefix({ command: 'git -C repo status' })).toBe('git');
  });
});

describe('oncePatternText', () => {
  it('scopes a Read to its file, in the rule form of an absolute path', () => {
    expect(
      oncePatternText({ toolName: 'Read', input: { file_path: '/notify-relay/README.md' } }),
    ).toBe('Read(//notify-relay/README.md)');
    expect(oncePatternText({ toolName: 'Read', input: { file_path: 'docs/notes.md' } })).toBe(
      'Read(docs/notes.md)',
    );
  });

  it('renders the exact bash command', () => {
    expect(
      oncePatternText({ toolName: 'Bash', input: { command: 'pnpm test --filter ledger-core' } }),
    ).toBe('Bash(pnpm test --filter ledger-core)');
  });

  it('renders the exact file path for an edit tool', () => {
    expect(oncePatternText({ toolName: 'Edit', input: { file_path: '/repo/src/refund.ts' } })).toBe(
      'Edit(/repo/src/refund.ts)',
    );
  });

  it('turns a Grep or Glob into a scoped read of the directory it searches', () => {
    expect(
      oncePatternText({
        toolName: 'Grep',
        input: { pattern: 'refund', path: '/ledger-core/apps/billing' },
      }),
    ).toBe('Read(//ledger-core/apps/billing/**)');
    expect(
      oncePatternText({
        toolName: 'Glob',
        input: { pattern: '*.ts', path: '/ledger-core/apps/billing/' },
      }),
    ).toBe('Read(//ledger-core/apps/billing/**)');
  });

  it('scopes a Grep aimed at one file to its folder', () => {
    expect(
      oncePatternText({
        toolName: 'Grep',
        input: { pattern: 'x', path: '/ledger-core/.env.local' },
      }),
    ).toBe('Read(//ledger-core/**)');
  });

  it('keeps the bare tool name for a Grep with no absolute path', () => {
    expect(oncePatternText({ toolName: 'Grep', input: { pattern: 'x' } })).toBe('Grep');
    expect(oncePatternText({ toolName: 'Grep', input: { pattern: 'x', path: 'src' } })).toBe(
      'Grep',
    );
    expect(oncePatternText({ toolName: 'Glob', input: { pattern: 'x', path: '/' } })).toBe('Glob');
  });

  it('falls back to the bare tool name when the field is missing', () => {
    expect(oncePatternText({ toolName: 'Bash', input: {} })).toBe('Bash');
    expect(oncePatternText({ toolName: 'Read', input: {} })).toBe('Read');
  });
});

describe('prefixRuleFor', () => {
  it('builds a command-prefix pattern for Bash, not a blanket allow', () => {
    const rule = prefixRuleFor({
      toolName: 'Bash',
      input: { command: 'pnpm test --filter ledger-core' },
    });
    expect(rule.pattern).toEqual({ tool: 'Bash', argsMatcher: 'pnpm test *' });
    expect(rule.label).toBe('Always allow "pnpm test"');
    expect(rule.subject).toBe('"pnpm test"');
  });

  it('builds a bare-tool pattern for a file edit', () => {
    const rule = prefixRuleFor({ toolName: 'Edit', input: { file_path: '/repo/src/refund.ts' } });
    expect(rule.pattern).toEqual({ tool: 'Edit' });
    expect(rule.label).toBe('Always allow edits');
    expect(rule.subject).toBe('edits');
  });
});

describe('prefixRuleFor read tools', () => {
  it('stores a Grep rule as a read of its folder, in words that say reads', () => {
    const rule = prefixRuleFor({
      toolName: 'Grep',
      input: { pattern: 'refund', path: '/work/ledger-core/apps/billing' },
    });
    expect(rule.pattern).toEqual({
      tool: 'Read',
      argsMatcher: '//work/ledger-core/apps/billing/**',
    });
    expect(rule.sessionPattern).toEqual(rule.pattern);
    expect(rule.subject).toBe('reads in apps/billing');
    expect(rule.label).toBe('Always allow reads in apps/billing');
    expect(rule.sessionLabel).toBe('Allow reads in apps/billing in this session');
  });

  it('reads the folder of a Read file path', () => {
    const rule = prefixRuleFor({
      toolName: 'Read',
      input: { file_path: '/work/notify-relay/docs/README.md' },
    });
    expect(rule.pattern).toEqual({ tool: 'Read', argsMatcher: '//work/notify-relay/docs/**' });
    expect(rule.label).toBe('Always allow reads in notify-relay/docs');
  });

  it('keeps a bare read rule when no absolute path is asked', () => {
    const rule = prefixRuleFor({ toolName: 'Glob', input: { pattern: '*.ts' } });
    expect(rule.pattern).toEqual({ tool: 'Glob' });
    expect(rule.label).toBe('Always allow reads');
    expect(rule.sessionLabel).toBe('Allow reads in this session');
  });
});

describe('copy per tool class', () => {
  it('says commands only for a shell command and edits only for an edit tool', () => {
    const shell = prefixRuleFor({ toolName: 'Bash', input: { command: 'ls -la' } });
    expect(shell.sessionLabel).toBe('Allow all commands in this session');
    const edit = prefixRuleFor({ toolName: 'Write', input: { file_path: '/repo/a.ts' } });
    expect(edit.label).toBe('Always allow edits');
    expect(edit.sessionLabel).toBe('Allow all edits in this session');
    const fetch = prefixRuleFor({ toolName: 'WebFetch', input: { url: 'https://acme.test' } });
    expect(fetch.label).toBe('Always allow WebFetch');
    expect(fetch.subject).toBe('WebFetch');
    expect(fetch.sessionLabel).toBe('Allow WebFetch in this session');
    for (const rule of [fetch, prefixRuleFor({ toolName: 'Grep', input: {} })]) {
      expect(rule.label).not.toMatch(/edits|commands/);
      expect(rule.sessionLabel).not.toMatch(/edits|commands/);
    }
  });

  it('names the class of each tool and the noun of its once grant', () => {
    expect(toolClassOf({ toolName: 'Bash' })).toBe('shell');
    expect(toolClassOf({ toolName: 'MultiEdit' })).toBe('edit');
    expect(toolClassOf({ toolName: 'Grep' })).toBe('read');
    expect(toolClassOf({ toolName: 'WebSearch' })).toBe('other');
    expect(actionNounOf({ toolName: 'Bash' })).toBe('command');
    expect(actionNounOf({ toolName: 'Edit' })).toBe('edit');
    expect(actionNounOf({ toolName: 'Glob' })).toBe('read');
    expect(actionNounOf({ toolName: 'WebFetch' })).toBe('call');
  });
});

describe('isFilePathTool', () => {
  it('recognizes the file-editing tools', () => {
    expect(isFilePathTool({ toolName: 'Edit' })).toBe(true);
    expect(isFilePathTool({ toolName: 'Write' })).toBe(true);
    expect(isFilePathTool({ toolName: 'Bash' })).toBe(false);
  });
});
