import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reportStale } from './check-figure-versions.mjs';
import { parseReshootArgs } from './features-reshoot.mjs';
import { recipeOf, shellSplitOf } from './lib/figures.mjs';
import { includesHeroOf, reshootPlanOf } from './lib/reshootPlan.mjs';
import { newestChangeByGuide } from './lib/staleFigures.mjs';

const MEDIA = 'https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features';

const figures = {
  'features/inbox-list': {
    version: '0.13.1',
    recipe: "--scene 'inbox&brand=1' --window 1280x800 --wait 8000",
  },
  'features/inbox-reply': {
    version: '0.13.1',
    recipe: "--scene 'inbox-reply&brand=1' --click 'Reply to Northwind' --wait 8000",
  },
  'features/board-card': { version: '0.13.1' },
  'readme/readme-hero': { version: '0.13.1', recipe: 'pnpm readme:hero' },
};

const changelog = [
  '# Changelog',
  '',
  '## Goodboy v0.20.0',
  '',
  '#### Replies in the inbox',
  '<!-- gb area=inbox -->',
  '',
  '## Goodboy v0.14.0',
  '',
  '#### Board cards',
  '<!-- gb area=sessions -->',
  '',
  '## Goodboy v0.13.1',
  '',
  '#### Older inbox fix',
  '<!-- gb area=inbox -->',
].join('\n');

const guide = ({ name }) =>
  [
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="${MEDIA}/${name}-dark.webp">`,
    `  <img src="${MEDIA}/${name}-light.webp" alt="A list">`,
    '</picture>',
    '',
    '<sub>Screenshot from Goodboy 0.13.1</sub>',
  ].join('\n');

describe('shellSplitOf', () => {
  it('splits what recipeOf quotes, apostrophes included', () => {
    const argv = ['--scene', 'a&brand=1', '--click', "What's new,Plans", '--hover', '$HOME `x`'];
    assert.deepEqual(shellSplitOf({ value: recipeOf({ argv }) }), argv);
  });

  it('refuses an unclosed quote', () => {
    assert.throws(() => shellSplitOf({ value: "--scene 'open" }), /unclosed quote/);
  });
});

describe('reshootPlanOf', () => {
  it('replays every recipe with its output name and lists figures with no recipe', () => {
    const { steps, skipped } = reshootPlanOf({ figures });
    assert.deepEqual(
      steps.map(({ name }) => name),
      ['inbox-list', 'inbox-reply'],
    );
    assert.deepEqual(steps[1].args.slice(0, 4), [
      '--out',
      'inbox-reply',
      '--scene',
      'inbox-reply&brand=1',
    ]);
    assert.ok(steps[1].args.includes('Reply to Northwind'));
    assert.deepEqual(skipped, ['features/board-card']);
  });

  it('narrows to a guide and one theme', () => {
    const { steps } = reshootPlanOf({ figures, area: 'inbox', theme: 'dark' });
    assert.equal(steps.length, 2);
    assert.deepEqual(steps[0].args.slice(-2), ['--themes', 'dark']);
    assert.equal(reshootPlanOf({ figures, area: 'inb' }).steps.length, 0);
  });

  it('rejects an unknown theme', () => {
    assert.throws(() => reshootPlanOf({ figures, theme: 'sepia' }), /dark or light/);
  });

  it('shoots the hero only on a full or readme run', () => {
    assert.equal(includesHeroOf({ figures }), true);
    assert.equal(includesHeroOf({ figures, area: 'readme' }), true);
    assert.equal(includesHeroOf({ figures, area: 'inbox' }), false);
    assert.equal(includesHeroOf({ figures, theme: 'light' }), false);
  });
});

describe('parseReshootArgs', () => {
  it('reads flags and the dry run switch', () => {
    const options = parseReshootArgs({ argv: ['--area', 'inbox', '--dry-run', '--theme', 'dark'] });
    assert.equal(options.area, 'inbox');
    assert.equal(options.theme, 'dark');
    assert.equal(options.isDryRun, true);
  });

  it('refuses an unknown flag', () => {
    assert.throws(() => parseReshootArgs({ argv: ['--nope', 'x'] }), /usage/);
  });
});

describe('reportStale', () => {
  it('maps the newest changelog area to the guides it touches', () => {
    const newest = newestChangeByGuide({ changelog });
    assert.deepEqual(newest.inbox, { version: '0.20.0', area: 'inbox' });
    assert.deepEqual(newest.board, { version: '0.14.0', area: 'sessions' });
    assert.equal(newest.agents, undefined);
  });

  it('lists a figure older than the newest change of its guide', () => {
    const lines = reportStale({
      figures,
      documents: [
        { path: 'docs/features/inbox.md', markdown: guide({ name: 'inbox-list' }) },
        { path: 'docs/features/agents.md', markdown: guide({ name: 'agents-chat' }) },
      ],
      changelog,
    });
    assert.deepEqual(lines, [
      'features/inbox-list (inbox.md) is 0.13.1, inbox changed in 0.20.0',
      '1 of 4 figures older than their guide',
    ]);
  });

  it('lists nothing when the figure is as new as the change', () => {
    const lines = reportStale({
      figures: { 'features/inbox-list': { version: '0.20.0' } },
      documents: [{ path: 'docs/features/inbox.md', markdown: guide({ name: 'inbox-list' }) }],
      changelog,
    });
    assert.deepEqual(lines, ['0 of 1 figures older than their guide']);
  });
});
