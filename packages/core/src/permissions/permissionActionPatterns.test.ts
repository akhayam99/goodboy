import { describe, expect, it } from 'vitest';
import {
  commandPrefix,
  isFilePathTool,
  oncePatternText,
  prefixRuleFor,
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

  it('falls back to the bare tool name when the field is missing', () => {
    expect(oncePatternText({ toolName: 'Bash', input: {} })).toBe('Bash');
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
  });

  it('builds a bare-tool pattern for a file edit', () => {
    const rule = prefixRuleFor({ toolName: 'Edit', input: { file_path: '/repo/src/refund.ts' } });
    expect(rule.pattern).toEqual({ tool: 'Edit' });
    expect(rule.label).toBe('Always allow edits');
  });
});

describe('isFilePathTool', () => {
  it('recognizes the file-editing tools', () => {
    expect(isFilePathTool({ toolName: 'Edit' })).toBe(true);
    expect(isFilePathTool({ toolName: 'Write' })).toBe(true);
    expect(isFilePathTool({ toolName: 'Bash' })).toBe(false);
  });
});
