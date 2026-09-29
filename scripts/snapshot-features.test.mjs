import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSnapshot,
  normalizeVersion,
  parseFeatures,
  parseRelease,
} from './snapshot-features.mjs';

const FEATURES = `# Goodboy features

- [The board](#the-board)

## The board

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/readme/s01-board-dark.webp">
  <img src="./docs/readme/s01-board-light.webp" alt="">
</picture>

### Stage board

See every task by stage. Cards move **on their own** as work changes.

### Session card

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/s10-projects-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/s10-projects-light.webp" alt="">
</picture>

Read a task at a glance.

<details>
<summary><h2>Keyboard and terminal</h2></summary>

### Explore

Browse the session folder.

</details>

## Also there

| Feature       | What it does for you                   |
| ------------- | -------------------------------------- |
| Resolve again | Rereads a comment and tries **again**  |
`;

const CHANGELOG = `# Changelog

## Goodboy v0.2.0

Pick up where you left off.

### New

#### Session card
<!-- gb area=sessions -->

Cards show the pull request. And the cost.

### Improved

#### Stage board
<!-- gb area=board -->

Faster.

## Goodboy v0.1.0

First release.

### Fixed

- Something. <!-- gb area=app -->
`;

describe('normalizeVersion', () => {
  it('accepts a version with or without the v prefix', () => {
    assert.equal(normalizeVersion('v0.11.1'), '0.11.1');
    assert.equal(normalizeVersion('0.11.1'), '0.11.1');
  });

  it('rejects anything that is not a plain version', () => {
    assert.throws(() => normalizeVersion('0.11'));
    assert.throws(() => normalizeVersion(undefined));
  });
});

describe('parseFeatures', () => {
  const groups = parseFeatures({ markdown: FEATURES });

  it('reads groups, features, one-line copy and image ids', () => {
    assert.deepEqual(
      groups.map((group) => group.title),
      ['The board', 'Keyboard and terminal', 'Also there'],
    );
    assert.equal(groups[0].image, 's01-board');
    assert.deepEqual(groups[0].features, [
      { id: 'stage-board', title: 'Stage board', copy: 'See every task by stage.', image: null },
      {
        id: 'session-card',
        title: 'Session card',
        copy: 'Read a task at a glance.',
        image: 's10-projects',
      },
    ]);
  });

  it('reads groups folded under details and table rows', () => {
    assert.equal(groups[1].features[0].title, 'Explore');
    assert.deepEqual(groups[2].features, [
      {
        id: 'resolve-again',
        title: 'Resolve again',
        copy: 'Rereads a comment and tries again',
        image: null,
      },
    ]);
  });
});

describe('parseRelease', () => {
  it('reads the summary and only the New items of that version', () => {
    assert.deepEqual(parseRelease({ changelog: CHANGELOG, version: '0.2.0' }), {
      summary: 'Pick up where you left off.',
      items: [{ title: 'Session card', area: 'sessions', copy: 'Cards show the pull request.' }],
    });
  });

  it('returns no items for a version without New', () => {
    assert.deepEqual(parseRelease({ changelog: CHANGELOG, version: '0.1.0' }).items, []);
  });

  it('fails when the version has no entry', () => {
    assert.throws(
      () => parseRelease({ changelog: CHANGELOG, version: '9.9.9' }),
      /no "## Goodboy v9.9.9"/,
    );
  });
});

describe('buildSnapshot', () => {
  it('flags the features that are new in the version', () => {
    const snapshot = buildSnapshot({
      version: '0.2.0',
      featuresMarkdown: FEATURES,
      changelog: CHANGELOG,
    });
    assert.equal(snapshot.version, '0.2.0');
    assert.equal(snapshot.new.length, 1);
    const flags = snapshot.groups[0].features.map((feature) => [feature.title, feature.isNew]);
    assert.deepEqual(flags, [
      ['Stage board', false],
      ['Session card', true],
    ]);
  });
});
