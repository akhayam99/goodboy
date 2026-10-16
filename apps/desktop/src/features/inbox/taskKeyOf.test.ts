import { describe, expect, it } from 'vitest';
import { taskKeyOf } from './taskKeyOf';

describe('taskKeyOf', () => {
  it('keeps a tracker key whole', () => {
    expect(taskKeyOf({ record: { provider: 'linear', identifier: 'HBL-412' } })).toBe('HBL-412');
    expect(taskKeyOf({ record: { provider: 'github', identifier: '#500' } })).toBe('#500');
  });

  it('shows the distinguishing tail of a Sentry short id', () => {
    expect(taskKeyOf({ record: { provider: 'sentry', identifier: 'PAYMENTS-API-7000' } })).toBe(
      '7000',
    );
  });

  it('leaves the key empty for a Slack thread, which has no short key', () => {
    expect(taskKeyOf({ record: { provider: 'slack', identifier: '#payments-ops' } })).toBe('');
  });
});
