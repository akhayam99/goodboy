import { describe, expect, it } from 'vitest';
import { restoreDraftOnFailedSend } from './restoreDraftOnFailedSend';

describe('restoreDraftOnFailedSend', () => {
  it('gives the sent text back when the field is empty', () => {
    expect(restoreDraftOnFailedSend({ sent: 'why is Harborline red?', current: '' })).toBe(
      'why is Harborline red?',
    );
  });

  it('gives the sent text back when the field only holds blanks', () => {
    expect(restoreDraftOnFailedSend({ sent: 'first', current: ' \n ' })).toBe('first');
  });

  it('keeps what was typed while the send was pending', () => {
    expect(restoreDraftOnFailedSend({ sent: 'first', current: 'a better one' })).toBe(
      'a better one',
    );
  });
});
