// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { FileDiff } from '@goodboy/types';
import { nextUnviewedPath, stepPath } from './fileOrder';
import type { ViewedState } from './reviewedFiles';

const fileAt = (path: string): FileDiff => ({
  path,
  status: 'modified',
  additions: 1,
  deletions: 0,
  binary: false,
  hunks: [],
});

const ORDER = ['a', 'b', 'c', 'd'];

describe('stepPath', () => {
  const any = () => true;

  it('walks forward and backward', () => {
    expect(stepPath({ order: ORDER, from: 'b', delta: 1, accepts: any })).toBe('c');
    expect(stepPath({ order: ORDER, from: 'b', delta: -1, accepts: any })).toBe('a');
  });

  it('skips the paths it does not accept', () => {
    const accepts = (path: string) => path !== 'c';
    expect(stepPath({ order: ORDER, from: 'b', delta: 1, accepts })).toBe('d');
  });

  it('starts at the first accepted path from nowhere', () => {
    expect(stepPath({ order: ORDER, from: null, delta: 1, accepts: any })).toBe('a');
    expect(stepPath({ order: ORDER, from: null, delta: -1, accepts: any })).toBe('a');
  });

  it('steps from a path that is hidden', () => {
    const accepts = (path: string) => path !== 'b';
    expect(stepPath({ order: ORDER, from: 'b', delta: 1, accepts })).toBe('c');
    expect(stepPath({ order: ORDER, from: 'b', delta: -1, accepts })).toBe('a');
  });

  it('stops at the ends', () => {
    expect(stepPath({ order: ORDER, from: 'd', delta: 1, accepts: any })).toBeNull();
    expect(stepPath({ order: ORDER, from: 'a', delta: -1, accepts: any })).toBeNull();
  });
});

describe('nextUnviewedPath', () => {
  const files = ORDER.map(fileAt);
  const stateOf =
    (viewed: ReadonlyArray<string>) =>
    (file: FileDiff): ViewedState =>
      viewed.includes(file.path) ? 'viewed' : 'none';

  it('finds the next unviewed file after the current one', () => {
    expect(nextUnviewedPath({ files, from: 'a', stateOf: stateOf(['b']), wrap: true })).toBe('c');
  });

  it('counts a changed-since-viewed file as unviewed', () => {
    const stale = (file: FileDiff): ViewedState => (file.path === 'b' ? 'stale' : 'viewed');
    expect(nextUnviewedPath({ files, from: 'a', stateOf: stale, wrap: true })).toBe('b');
  });

  it('wraps to the top only when asked', () => {
    const viewed = stateOf(['b', 'c', 'd']);
    expect(
      nextUnviewedPath({ files, from: 'd', stateOf: stateOf(['a', 'b', 'c']), wrap: true }),
    ).toBeNull();
    expect(nextUnviewedPath({ files, from: 'c', stateOf: stateOf(['d', 'b']), wrap: true })).toBe(
      'a',
    );
    expect(
      nextUnviewedPath({ files, from: 'c', stateOf: stateOf(['d', 'b']), wrap: false }),
    ).toBeNull();
    expect(nextUnviewedPath({ files, from: 'a', stateOf: viewed, wrap: true })).toBeNull();
  });

  it('starts at the top from nowhere', () => {
    expect(nextUnviewedPath({ files, from: null, stateOf: stateOf(['a']), wrap: false })).toBe('b');
  });
});
