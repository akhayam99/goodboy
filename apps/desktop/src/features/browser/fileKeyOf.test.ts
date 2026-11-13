// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fileKeyOf } from './fileKeyOf';

const HOME = '/home/harborline';

describe('fileKeyOf', () => {
  it('gives a file address and its path the same key', () => {
    expect(fileKeyOf({ path: 'file:///work/harborline/plan.html', home: HOME })).toBe(
      fileKeyOf({ path: '/work/harborline/plan.html', home: HOME }),
    );
    expect(fileKeyOf({ path: 'file:///work/harborline/plan%20v2.html', home: HOME })).toBe(
      '/work/harborline/plan v2.html',
    );
  });

  it('expands a home path to the path the tab stores', () => {
    expect(fileKeyOf({ path: '~/acme/plan.html', home: HOME })).toBe(
      fileKeyOf({ path: 'file:///home/harborline/acme/plan.html', home: HOME }),
    );
    expect(fileKeyOf({ path: '~/acme/plan.html', home: null })).toBe('~/acme/plan.html');
  });

  it('gives a drive path and its file address the same key', () => {
    const stored = fileKeyOf({ path: 'file:///C:/work/northwind/plan.html', home: null });
    expect(stored).toBe('C:/work/northwind/plan.html');
    expect(fileKeyOf({ path: 'c:\\work\\northwind\\plan.html', home: null })).toBe(stored);
    expect(fileKeyOf({ path: '~/plan.html', home: 'C:\\Users\\acme' })).toBe(
      'C:/Users/acme/plan.html',
    );
  });
});
