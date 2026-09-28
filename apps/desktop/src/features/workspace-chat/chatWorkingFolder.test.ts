import { describe, expect, it } from 'vitest';
import { chatWorkingFolder } from './chatWorkingFolder';

describe('chatWorkingFolder', () => {
  it('runs in the folder that holds every project', () => {
    expect(
      chatWorkingFolder({
        roots: [
          '/Users/mara/code/harborline/payments-api',
          '/Users/mara/code/harborline/ledger-core/',
          '/Users/mara/code/harborline/notify-relay',
        ],
      }),
    ).toEqual({ workingDir: '/Users/mara/code/harborline', readRoots: [] });
  });

  it('never widens to the home folder, it reads the other projects as extra roots', () => {
    expect(
      chatWorkingFolder({
        roots: ['/Users/mara/code/payments-api', '/Users/mara/work/ledger-core'],
      }),
    ).toEqual({
      workingDir: '/Users/mara/code/payments-api',
      readRoots: ['/Users/mara/work/ledger-core'],
    });
  });

  it('uses the only project folder as is', () => {
    expect(chatWorkingFolder({ roots: ['/Users/mara/code/storefront-web'] })).toEqual({
      workingDir: '/Users/mara/code/storefront-web',
      readRoots: [],
    });
  });

  it('has no folder for a workspace without projects', () => {
    expect(chatWorkingFolder({ roots: [] })).toBeNull();
    expect(chatWorkingFolder({ roots: ['  '] })).toBeNull();
  });
});
