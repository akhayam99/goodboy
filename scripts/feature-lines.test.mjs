import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  areaBulletsOf,
  bulletTitleOf,
  cardProblemsOf,
  firstSentenceOf,
  indexProblemsOf,
  lineFor,
  rewriteCards,
  rewriteIndex,
} from './lib/featureLines.mjs';

const words = ({ count }) => Array.from({ length: count }, () => 'word').join(' ');

const BODY = [
  '# Workflows',
  '',
  '### Limit',
  '',
  'Cap what a run can spend, and choose **Pause workflows** or `Warn only`. A paused run offers **Raise limit**.',
  '',
  '### Saved steps',
  '',
  '<picture>',
  '</picture>',
  '',
  'Reuse steps across workflows. The built-in steps are read-only.',
  '',
  '### Bare list',
  '',
  '- one',
  '- two',
  '',
  '### Long one',
  '',
  `${words({ count: 26 })}.`,
].join('\n');

const INDEX = [
  '# Goodboy features',
  '',
  'Intro.',
  '',
  '<a id="limit"></a>',
  '',
  '## Workflows',
  '',
  'Lead line.',
  '',
  '- Limit',
  '- Saved steps',
  '',
  '[More on workflows](docs/features/workflows.md)',
  '',
  '<a id="also-there"></a>',
  '',
].join('\n');

const docs = new Map([['workflows', BODY]]);

describe('bulletTitleOf', () => {
  it('reads the title of a bold line and the whole text of a bare bullet', () => {
    assert.equal(bulletTitleOf({ bullet: '**Limit**: Cap what a run can spend.' }), 'Limit');
    assert.equal(bulletTitleOf({ bullet: 'Limit' }), 'Limit');
  });
});

describe('firstSentenceOf', () => {
  it('takes the first sentence as plain text', () => {
    assert.equal(
      firstSentenceOf({ body: BODY, title: 'Limit' }),
      'Cap what a run can spend, and choose Pause workflows or Warn only.',
    );
  });

  it('skips a picture and reads the first prose line', () => {
    assert.equal(
      firstSentenceOf({ body: BODY, title: 'Saved steps' }),
      'Reuse steps across workflows.',
    );
  });

  it('gives nothing for a list or a missing heading', () => {
    assert.equal(firstSentenceOf({ body: BODY, title: 'Bare list' }), null);
    assert.equal(firstSentenceOf({ body: BODY, title: 'Nowhere' }), null);
  });
});

describe('the index', () => {
  it('reads the bullets of an area with its page', () => {
    assert.deepEqual(
      areaBulletsOf({ index: INDEX }).map(({ slug, bullets }) => [slug, bullets]),
      [['workflows', ['Limit', 'Saved steps']]],
    );
  });

  it('reports a line that differs from the first sentence of its item', () => {
    assert.deepEqual(indexProblemsOf({ index: INDEX, docs }), [
      'FEATURES.md Limit: the line differs from the first sentence of its item',
      'FEATURES.md Saved steps: the line differs from the first sentence of its item',
    ]);
  });

  it('writes the lines, and then reports nothing', () => {
    const written = rewriteIndex({ index: INDEX, docs });
    assert.match(
      written,
      /- \*\*Limit\*\*: Cap what a run can spend, and choose Pause workflows or Warn only\.\n- \*\*Saved steps\*\*: Reuse steps across workflows\.\n/,
    );
    assert.deepEqual(indexProblemsOf({ index: written, docs }), []);
    assert.equal(rewriteIndex({ index: written, docs }), written);
  });

  it('flags a first sentence over 25 words and an item without prose', () => {
    const index = INDEX.replace('- Saved steps', '- Long one\n- Bare list');
    const problems = indexProblemsOf({ index, docs });
    assert.ok(problems.some((line) => line.includes('Long one: the first sentence has 26 words')));
    assert.ok(problems.some((line) => line.includes('Bare list: the item has no first sentence')));
  });

  it('allows exactly 25 words', () => {
    const body = `### Edge\n\n${words({ count: 25 })}.`;
    const index = INDEX.replace('- Limit\n- Saved steps', '- Edge');
    const problems = indexProblemsOf({ index, docs: new Map([['workflows', body]]) });
    assert.ok(problems.every((line) => !line.includes('25 is the limit')));
  });

  it('builds the line the way the index shows it', () => {
    assert.equal(lineFor({ title: 'Limit', sentence: 'Cap it.' }), '**Limit**: Cap it.');
  });
});

describe('the site cards', () => {
  const raw = `{
  "clusters": [
    {
      "items": [
        {
          "title": "Limit",
          "text": "Hand text with \\"quotes\\" and more.",
          "main": true
        },
        {
          "title": "Saved steps",
          "text": "Kept as written.",
          "also": "steps"
        }
      ]
    }
  ]
}
`;
  const data = JSON.parse(raw);

  it('reports a main card whose text differs from the first sentence', () => {
    assert.deepEqual(cardProblemsOf({ data, docs }), [
      'site card Limit: the text differs from the first sentence of its item',
    ]);
  });

  it('writes the main card text and leaves the other items alone', () => {
    const written = rewriteCards({ raw, data, docs });
    const parsed = JSON.parse(written);
    assert.equal(
      parsed.clusters[0].items[0].text,
      'Cap what a run can spend, and choose Pause workflows or Warn only.',
    );
    assert.equal(parsed.clusters[0].items[1].text, 'Kept as written.');
    assert.deepEqual(cardProblemsOf({ data: parsed, docs }), []);
    assert.equal(written.split('\n').length, raw.split('\n').length);
  });
});
