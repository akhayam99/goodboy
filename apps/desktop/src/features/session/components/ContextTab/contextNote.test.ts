import { describe, expect, it } from 'vitest';
import { contextNoteOf } from './contextNote';

describe('contextNoteOf', () => {
  it('says nothing while the context is quiet', () => {
    expect(contextNoteOf({ status: 'idle', hasChange: false })).toBeNull();
  });

  it('names a decision change since the last look', () => {
    expect(contextNoteOf({ status: 'idle', hasChange: true })).toBe(
      'Decisions changed since you last looked',
    );
  });

  it('says the summary is being written, and that a failed one can be retried', () => {
    expect(contextNoteOf({ status: 'running', hasChange: true })).toBe('Updating context');
    expect(contextNoteOf({ status: 'error', hasChange: false })).toBe(
      "Couldn't update the context. Open to retry.",
    );
  });
});
