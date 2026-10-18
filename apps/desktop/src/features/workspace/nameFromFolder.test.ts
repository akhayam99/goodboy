// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { nameFromFolder } from './nameFromFolder';

describe('nameFromFolder', () => {
  it.each([
    ['~/Code/acme-web', 'Acme web'],
    ['/Users/me/Code/Harborline', 'Harborline'],
    ['/Users/me/Code/northwind/ledger_core', 'Ledger core'],
    ['/Users/me/Code/API', 'API'],
    ['/Users/me/.dotfiles', 'Dotfiles'],
    ['/', 'Workspace'],
  ])('names %s as %s', (path, expected) => {
    expect(nameFromFolder({ path })).toBe(expected);
  });

  it('takes the picked folder, never its parent', () => {
    expect(nameFromFolder({ path: '/Users/me/Developer/acme-web/' })).toBe('Acme web');
  });

  it('reads a Windows path and folds repeated separators', () => {
    expect(nameFromFolder({ path: 'C:\\Code\\notify--relay' })).toBe('Notify relay');
  });
});
