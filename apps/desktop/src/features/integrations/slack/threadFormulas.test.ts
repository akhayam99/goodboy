import { describe, expect, it } from 'vitest';
import {
  parseSlackThreadExternalId,
  slackThreadBranchSlug,
  slackThreadExternalId,
  slackThreadIdentifier,
  slackThreadTitle,
} from './threadFormulas';

const LONG = 'the billing webhook fails on retry and nobody noticed';

describe('slack thread formulas', () => {
  it('truncates the title to 32 characters with an ellipsis', () => {
    expect(slackThreadTitle({ text: LONG })).toBe('the billing webhook fails on ret…');
    expect(slackThreadTitle({ text: 'short one\nsecond line' })).toBe('short one');
  });

  it('scopes the identifier to the thread, not the channel', () => {
    const first = slackThreadIdentifier({ channelName: 'eng-alerts', text: LONG });
    const second = slackThreadIdentifier({ channelName: 'eng-alerts', text: 'deploy is stuck' });

    expect(first).toBe('#eng-alerts › the billing webhook fails on ret…');
    expect(second).not.toBe(first);
  });

  it('falls back to the channel when the root message has no text', () => {
    expect(slackThreadIdentifier({ channelName: 'eng-alerts', text: '' })).toBe('#eng-alerts');
  });

  it('round-trips the external id', () => {
    const externalId = slackThreadExternalId({
      channelId: 'C024BE7LR',
      threadTs: '1723456789.123456',
    });

    expect(externalId).toBe('C024BE7LR:1723456789.123456');
    expect(parseSlackThreadExternalId({ externalId })).toEqual({
      channelId: 'C024BE7LR',
      threadTs: '1723456789.123456',
    });
  });

  it('rejects an external id that carries no thread timestamp', () => {
    expect(parseSlackThreadExternalId({ externalId: 'C024BE7LR' })).toBeNull();
    expect(parseSlackThreadExternalId({ externalId: 'C024BE7LR:' })).toBeNull();
  });

  it('slugs the branch from the untruncated first line', () => {
    expect(slackThreadBranchSlug({ text: LONG })).toBe(
      'the-billing-webhook-fails-on-retry-and-nobody-no',
    );
  });
});
