import { describe, expect, it } from 'vitest';
import { historyStopCause } from './historyStopCause';

describe('historyStopCause', () => {
  it.each([
    ['dirty', 'uncommitted files'],
    ['stuck', 'needs you'],
    ['unverified', 'result differs'],
    ['invalid', 'result differs'],
    ['origin-moved', 'origin moved'],
    ['head-moved', 'branch moved'],
    ['no-provider', 'no provider'],
  ])('shortens %s to one phrase', (reason, cause) => {
    expect(historyStopCause({ reason, message: 'a long engine sentence' })).toBe(cause);
  });

  it('tells a hook from any other failed push', () => {
    expect(historyStopCause({ reason: 'push-failed', message: 'pre-push hook declined' })).toBe(
      'hook stopped the push',
    );
    expect(historyStopCause({ reason: 'push-failed', message: 'remote unreachable' })).toBe(
      'push failed',
    );
    expect(historyStopCause({ reason: 'push-failed', message: undefined })).toBe('push failed');
  });

  it('has nothing to say for a reason it does not know', () => {
    expect(historyStopCause({ reason: undefined, message: undefined })).toBeNull();
    expect(historyStopCause({ reason: 'unheard-of', message: '' })).toBeNull();
  });
});
