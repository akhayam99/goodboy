import { describe, expect, it, vi } from 'vitest';
import { parsePolishedGoal, polishWorkflowGoal } from './polish';
import type { GoalPolishDeps } from './polish';

describe('parsePolishedGoal', () => {
  it('extracts the marker block body', () => {
    const text = 'sure:\n<<goal>>\nRefactor the auth module.\n<</goal>>\ndone';
    expect(parsePolishedGoal(text)).toBe('Refactor the auth module.');
  });

  it('uses the last non-empty marker block', () => {
    const text = '<<goal>>first<</goal>>\n<<goal>>second<</goal>>';
    expect(parsePolishedGoal(text)).toBe('second');
  });

  it('falls back to plain text when no marker is present', () => {
    expect(parsePolishedGoal('  Just the goal.  ')).toBe('Just the goal.');
  });

  it('returns null for an unclosed marker', () => {
    expect(parsePolishedGoal('<<goal>>never closed')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parsePolishedGoal('   ')).toBeNull();
  });
});

describe('polishWorkflowGoal', () => {
  const deps = (stdout: string, exitCode = 0): GoalPolishDeps => ({
    providerId: 'anthropic',
    model: 'sonnet-4.6',
    invokeFn: vi.fn().mockResolvedValue({ stdout, stderr: '', exitCode }),
  });

  it('returns null without invoking for an empty goal', async () => {
    const d = deps('');
    expect(await polishWorkflowGoal(d, '   ')).toBeNull();
    expect(d.invokeFn).not.toHaveBeenCalled();
  });

  it('parses the anthropic result envelope', async () => {
    const stdout = JSON.stringify({ result: '<<goal>>Polished goal.<</goal>>' });
    const d = deps(stdout);
    expect(await polishWorkflowGoal(d, 'rough goal')).toBe('Polished goal.');
    expect(d.invokeFn).toHaveBeenCalledWith(
      'summarize_session',
      expect.objectContaining({ args: expect.objectContaining({ model: 'claude-sonnet-4-6' }) }),
    );
  });

  it('returns null on non-zero exit code', async () => {
    expect(await polishWorkflowGoal(deps('whatever', 1), 'rough goal')).toBeNull();
  });
});
