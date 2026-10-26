// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { permissionSubjectOf } from './permissionSubjectOf';

describe('permissionSubjectOf', () => {
  it('is the command of a Bash call', () => {
    expect(
      permissionSubjectOf({ toolName: 'Bash', input: { command: ' pnpm test --filter api ' } }),
    ).toBe('pnpm test --filter api');
  });

  it('is the file path of an edit', () => {
    expect(
      permissionSubjectOf({ toolName: 'Edit', input: { file_path: '/repo/src/refund.ts' } }),
    ).toBe('/repo/src/refund.ts');
  });

  it('is empty when the input names nothing', () => {
    expect(permissionSubjectOf({ toolName: 'Bash', input: {} })).toBeNull();
    expect(permissionSubjectOf({ toolName: 'WebFetch', input: null })).toBeNull();
  });

  it('cuts a long command so the card stays one line', () => {
    const subject = permissionSubjectOf({
      toolName: 'Bash',
      input: { command: `echo ${'x'.repeat(200)}` },
    });

    expect(subject).toHaveLength(80);
    expect(subject?.endsWith('…')).toBe(true);
  });
});
