import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { collectAnchors, slugOf } from './check-feature-anchors.mjs';

describe('slugOf', () => {
  it('follows the GitHub heading slug rules', () => {
    assert.equal(slugOf({ heading: 'Inbox and your tools' }), 'inbox-and-your-tools');
    assert.equal(
      slugOf({ heading: 'Plans, reports and wireframes' }),
      'plans-reports-and-wireframes',
    );
    assert.equal(slugOf({ heading: 'Keep .goodboy out of git' }), 'keep-goodboy-out-of-git');
    assert.equal(slugOf({ heading: 'Reply ready for #channel' }), 'reply-ready-for-channel');
    assert.equal(slugOf({ heading: 'Slack: what agents can do' }), 'slack-what-agents-can-do');
    assert.equal(slugOf({ heading: 'Provider routing & balance' }), 'provider-routing--balance');
  });
});

describe('collectAnchors', () => {
  it('numbers repeated headings and skips fenced code', () => {
    const anchors = collectAnchors({
      markdown: ['## Artifacts', '### Artifacts', '```', '# Not a heading', '```'].join('\n'),
    });
    assert.deepEqual([...anchors], ['artifacts', 'artifacts-1']);
  });
});
