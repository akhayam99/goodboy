// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { foregroundLabelOf } from './foregroundLabelOf';

describe('foregroundLabelOf', () => {
  it('keeps a package manager command as typed', () => {
    expect(foregroundLabelOf({ command: 'pnpm test --watch' })).toBe('pnpm test --watch');
  });

  it('shows the script an interpreter runs, not the interpreter path', () => {
    expect(
      foregroundLabelOf({ command: 'node /work/payments-api/node_modules/.bin/vite --port 4310' }),
    ).toBe('vite --port 4310');
  });

  it('drops the script extension so a package manager reads as typed', () => {
    expect(
      foregroundLabelOf({ command: 'node /usr/local/lib/node_modules/pnpm/bin/pnpm.cjs dev' }),
    ).toBe('pnpm dev');
  });

  it('shortens a path to the program and drops a login shell dash', () => {
    expect(foregroundLabelOf({ command: '/usr/bin/ssh harborline-bastion' })).toBe(
      'ssh harborline-bastion',
    );
    expect(foregroundLabelOf({ command: '-zsh' })).toBe('zsh');
  });

  it('keeps a plain node command and cuts a very long one', () => {
    expect(foregroundLabelOf({ command: 'node' })).toBe('node');
    const label = foregroundLabelOf({ command: `pnpm ${'x'.repeat(200)}` });
    expect(label.length).toBe(60);
    expect(label.endsWith('…')).toBe(true);
  });

  it('is empty for an empty command', () => {
    expect(foregroundLabelOf({ command: '   ' })).toBe('');
  });
});
