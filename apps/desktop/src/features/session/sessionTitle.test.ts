import { describe, expect, it } from 'vitest';
import type { Session } from '@goodboy/types';
import { sessionTitle } from './sessionTitle';

const sessionWith = (goal: unknown): Session => ({ goal }) as Session;

describe('sessionTitle', () => {
  it('keeps a title the session already carries', () => {
    expect(sessionTitle({ session: sessionWith('Refactor auth') })).toBe('Refactor auth');
  });

  it('falls back for an empty title', () => {
    expect(sessionTitle({ session: sessionWith('') })).toBe('Untitled session');
  });

  it('falls back for a whitespace-only title', () => {
    expect(sessionTitle({ session: sessionWith('   ') })).toBe('Untitled session');
  });

  it('falls back for a missing title', () => {
    expect(sessionTitle({ session: sessionWith(undefined) })).toBe('Untitled session');
  });

  it('falls back for a missing session', () => {
    expect(sessionTitle({ session: null })).toBe('Untitled session');
  });
});
