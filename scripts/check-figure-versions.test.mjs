import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  collectPictures,
  figureKeyOf,
  findProblems,
  writeCaptions,
} from './check-figure-versions.mjs';
import { appVersionOf, recipeOf, recordFigure, shellQuoteOf } from './lib/figures.mjs';

const MEDIA = 'https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features';

const guide = ({ name, caption }) =>
  [
    '### Tasks',
    '',
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="${MEDIA}/${name}-dark.webp">`,
    `  <img src="${MEDIA}/${name}-light.webp" alt="A list">`,
    '</picture>',
    '',
    ...(caption === undefined ? [] : [caption, '']),
    'Work from one list.',
  ].join('\n');

describe('figureKeyOf', () => {
  it('keys a media figure and the readme hero by their dark file', () => {
    assert.equal(figureKeyOf({ srcset: `${MEDIA}/inbox-list-dark.webp` }), 'features/inbox-list');
    assert.equal(
      figureKeyOf({ srcset: './docs/readme/readme-hero-dark.webp' }),
      'readme/readme-hero',
    );
    assert.equal(figureKeyOf({ srcset: 'https://example.com/shot.webp' }), null);
  });
});

describe('collectPictures', () => {
  it('finds the line right after the picture, skipping blanks', () => {
    const [picture] = collectPictures({
      markdown: guide({ name: 'inbox-list', caption: '<sub>Screenshot from Goodboy 0.13.1</sub>' }),
    });
    assert.equal(picture.key, 'features/inbox-list');
    assert.equal(picture.caption, '<sub>Screenshot from Goodboy 0.13.1</sub>');
  });
});

describe('findProblems', () => {
  const figures = { 'features/inbox-list': { version: '0.13.1' } };
  const check = ({ markdown, known = figures, repoVersion = '0.23.0' }) =>
    findProblems({
      documents: [{ path: 'docs/features/inbox.md', markdown }],
      figures: known,
      repoVersion,
    });

  it('passes when every figure has its version caption', () => {
    const markdown = guide({
      name: 'inbox-list',
      caption: '<sub>Screenshot from Goodboy 0.13.1</sub>',
    });
    assert.deepEqual(check({ markdown }), []);
  });

  it('fails when a figure has no caption', () => {
    const problems = check({ markdown: guide({ name: 'inbox-list' }) });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /caption under features\/inbox-list/);
  });

  it('fails when the caption names another version than the manifest', () => {
    const markdown = guide({
      name: 'inbox-list',
      caption: '<sub>Screenshot from Goodboy 0.14.0</sub>',
    });
    assert.equal(check({ markdown }).length, 1);
  });

  it('fails when a figure has no manifest entry or a bad version', () => {
    const markdown = guide({ name: 'inbox-list' });
    assert.match(check({ markdown, known: {} })[0], /no x\.y\.z version/);
    assert.match(
      check({ markdown, known: { 'features/inbox-list': { version: 'latest' } } })[0],
      /no x\.y\.z version/,
    );
  });

  it('fails when a manifest key is used by no picture', () => {
    const problems = check({
      markdown: 'No pictures here.',
      known: { 'features/gone': { version: '0.13.1' } },
    });
    assert.match(problems[0], /features\/gone is not used/);
  });

  it('fails when a version is above the repo version', () => {
    const markdown = guide({
      name: 'inbox-list',
      caption: '<sub>Screenshot from Goodboy 0.13.1</sub>',
    });
    const problems = check({ markdown, repoVersion: '0.12.9' });
    assert.match(problems[0], /above the repo version/);
  });
});

describe('writeCaptions', () => {
  const figures = { 'features/inbox-list': { version: '0.23.0' } };

  it('inserts a missing caption and replaces a stale one', () => {
    const inserted = writeCaptions({ markdown: guide({ name: 'inbox-list' }), figures });
    assert.deepEqual(
      findProblems({
        documents: [{ path: 'a.md', markdown: inserted }],
        figures,
        repoVersion: '0.23.0',
      }),
      [],
    );
    const stale = guide({
      name: 'inbox-list',
      caption: '<sub>Screenshot from Goodboy 0.13.1</sub>',
    });
    assert.equal(writeCaptions({ markdown: stale, figures }), inserted);
  });

  it('leaves prose that follows a picture alone', () => {
    const inserted = writeCaptions({ markdown: guide({ name: 'inbox-list' }), figures });
    assert.ok(inserted.endsWith('Work from one list.'));
  });
});

describe('recordFigure', () => {
  it('writes sorted keys with the version and optional recipe', () => {
    const directory = mkdtempSync(join(tmpdir(), 'figures-'));
    const path = join(directory, 'figures.json');
    try {
      writeFileSync(path, JSON.stringify({ 'features/b': { version: '0.13.1' } }));
      recordFigure({ key: 'features/a', version: '0.23.0', recipe: '--scene x', path });
      recordFigure({ key: 'features/b', version: '0.23.0', path });
      assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), {
        'features/a': { version: '0.23.0', recipe: '--scene x' },
        'features/b': { version: '0.23.0' },
      });
      assert.ok(readFileSync(path, 'utf8').endsWith('}\n'));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('appVersionOf', () => {
  it('prefers an override and rejects anything but x.y.z', () => {
    assert.equal(appVersionOf({ override: '0.23.0' }), '0.23.0');
    assert.throws(() => appVersionOf({ override: 'next' }));
  });
});

describe('shellQuoteOf', () => {
  it('leaves plain words alone and wraps anything else in single quotes', () => {
    assert.equal(shellQuoteOf({ value: '1280x800' }), '1280x800');
    assert.equal(shellQuoteOf({ value: 'inbox&brand=1' }), "'inbox&brand=1'");
    assert.equal(shellQuoteOf({ value: '' }), "''");
  });

  it('closes, escapes and reopens the quote around an apostrophe', () => {
    assert.equal(shellQuoteOf({ value: "What's new" }), "'What'\\''s new'");
  });
});

describe('recipeOf', () => {
  const wordsOf = ({ recipe }) =>
    execFileSync('sh', ['-c', `printf '%s\\n' ${recipe}`], { encoding: 'utf8' })
      .split('\n')
      .slice(0, -1);

  it('drops the output arguments and keeps the rest in order', () => {
    const recipe = recipeOf({
      argv: [
        '--scene',
        'inbox&brand=1',
        '--out',
        'inbox-list',
        '--wait',
        '8000',
        '--version',
        '0.23.0',
      ],
    });
    assert.equal(recipe, "--scene 'inbox&brand=1' --wait 8000");
  });

  it('reruns in a shell as the same arguments, apostrophes and metacharacters included', () => {
    const kept = [
      '--scene',
      'inbox&brand=1',
      '--click',
      "What's new,Plans",
      '--selector',
      "a[title='x y']",
      '--hover',
      '$HOME `id` "q" \\ end',
    ];
    const recipe = recipeOf({
      argv: [...kept, '--out', 'shot', '--base', 'http://localhost:5230', '--version', '0.23.0'],
    });
    assert.deepEqual(wordsOf({ recipe }), kept);
  });
});
