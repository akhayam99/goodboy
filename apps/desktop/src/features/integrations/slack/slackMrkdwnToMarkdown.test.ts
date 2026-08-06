import { describe, expect, it } from 'vitest';
import { slackMrkdwnToMarkdown } from './slackMrkdwnToMarkdown';

const USERS = new Map([['U024BE7LH', 'ada']]);
const CHANNELS = new Map([['C024BE7LR', 'eng-alerts']]);

describe('slackMrkdwnToMarkdown', () => {
  it('turns slack link, mention and channel syntax into markdown', () => {
    const out = slackMrkdwnToMarkdown({
      text: 'see <https://goodboy.dev/docs|the docs> <@U024BE7LH> in <#C024BE7LR|eng-alerts>',
      userNames: USERS,
      channelNames: CHANNELS,
    });

    expect(out).toBe('see [the docs](https://goodboy.dev/docs) @ada in #eng-alerts');
  });

  it('converts single-delimiter bold and strike to their markdown pairs', () => {
    expect(slackMrkdwnToMarkdown({ text: '*ship it* and ~not this~ but _keep this_' })).toBe(
      '**ship it** and ~~not this~~ but _keep this_',
    );
  });

  it('leaves code spans and fences untouched while unescaping entities around them', () => {
    const out = slackMrkdwnToMarkdown({
      text: 'run `a *b* c` then ```<x|y>``` on a &amp;&amp; b',
    });

    expect(out).toBe('run `a *b* c` then ```<x|y>``` on a && b');
  });

  it('unescapes after parsing so an escaped angle bracket never becomes link syntax', () => {
    expect(slackMrkdwnToMarkdown({ text: '&lt;https://evil.test|click&gt;' })).toBe(
      '<https://evil.test|click>',
    );
  });

  it('falls back to the raw id when a mention has no known user', () => {
    expect(slackMrkdwnToMarkdown({ text: 'ping <@U999NOPE>' })).toBe('ping @U999NOPE');
  });
});
