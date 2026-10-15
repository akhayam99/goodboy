import { describe, expect, it } from 'vitest';
import { attributeChanges, type MountSnapshot } from './attribution';

const snapshot = (
  entries: Readonly<Record<string, string>>,
  overrides: Partial<MountSnapshot> = {},
): MountSnapshot => ({
  head: 'abc123',
  entries: Object.entries(entries).map(([path, hash]) => ({ path, hash })),
  isPartial: false,
  ...overrides,
});

describe('attributing changed files to one attempt', () => {
  it('lists what a writer changed during its attempt and not what was already dirty', () => {
    const outcome = attributeChanges({
      baseline: snapshot({ 'src/old.ts': 'h1', 'src/edited.ts': 'h2' }),
      result: snapshot({ 'src/old.ts': 'h1', 'src/edited.ts': 'h3', 'src/new.ts': 'h4' }),
      isWriter: true,
    });

    expect(outcome.changedFiles).toEqual([
      { path: 'src/edited.ts', ownership: 'attempt' },
      { path: 'src/new.ts', ownership: 'attempt' },
      { path: 'src/old.ts', ownership: 'preexisting' },
    ]);
    expect(outcome.hasReadOnlyViolation).toBe(false);
    expect(outcome.isComplete).toBe(true);
  });

  it('does not credit the second writer with the files of the first', () => {
    const afterFirst = snapshot({ 'src/first.ts': 'h1' });
    const afterSecond = snapshot({ 'src/first.ts': 'h1', 'src/second.ts': 'h2' });

    const outcome = attributeChanges({ baseline: afterFirst, result: afterSecond, isWriter: true });

    expect(outcome.changedFiles).toEqual([
      { path: 'src/second.ts', ownership: 'attempt' },
      { path: 'src/first.ts', ownership: 'preexisting' },
    ]);
  });

  it('counts a file that went back to clean as changed by the attempt', () => {
    const outcome = attributeChanges({
      baseline: snapshot({ 'src/a.ts': 'h1' }),
      result: snapshot({}),
      isWriter: true,
    });

    expect(outcome.changedFiles).toEqual([{ path: 'src/a.ts', ownership: 'attempt' }]);
  });

  it('reports a change made during a read-only attempt as unattributed and a violation', () => {
    const outcome = attributeChanges({
      baseline: snapshot({}),
      result: snapshot({ 'src/sneaky.ts': 'h9' }),
      isWriter: false,
    });

    expect(outcome.changedFiles).toEqual([{ path: 'src/sneaky.ts', ownership: 'unattributed' }]);
    expect(outcome.hasReadOnlyViolation).toBe(true);
  });

  it('is incomplete without both snapshots or when either was cut short', () => {
    expect(attributeChanges({ baseline: null, result: snapshot({}), isWriter: true })).toEqual({
      changedFiles: [],
      hasReadOnlyViolation: false,
      isComplete: false,
    });
    expect(
      attributeChanges({
        baseline: snapshot({}),
        result: snapshot({}, { isPartial: true }),
        isWriter: true,
      }).isComplete,
    ).toBe(false);
  });

  it('caps each class of the list', () => {
    const many = Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`f${index}`, 'h']));
    const outcome = attributeChanges({
      baseline: snapshot({}),
      result: snapshot(many),
      isWriter: true,
    });

    expect(outcome.changedFiles).toHaveLength(50);
  });
});
