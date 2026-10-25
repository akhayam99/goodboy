import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { listDocs, run } from './check-doc-budget.mjs';
import {
  baselineOf,
  growthLines,
  isCodeReference,
  measureMarkdown,
  paragraphsOf,
  sentencesOf,
  wordsOf,
} from './lib/docBudget.mjs';

const words = ({ count }) => Array.from({ length: count }, () => 'Word').join(' ');

describe('isCodeReference', () => {
  it('flags identifiers, source paths and event names', () => {
    for (const token of [
      'liveGroupsOf',
      'NextGroup',
      'PRIOR_TURNS_BUDGET_TOKENS',
      'worktree_folder_facts',
      'apps/desktop/src/features/history/rebaseJob.ts',
      'central/pmReading.test.tsx',
      'agent.stop',
      'goodboy:attention',
      'pushBranch({ mode: "lease" })',
      'RebaseStopPanel.tsx',
    ]) {
      assert.equal(isCodeReference({ token }), true, token);
    }
  });

  it('leaves what a reader types or sees alone', () => {
    for (const token of [
      'node_modules',
      'AppImage',
      'package.json',
      '.env.local',
      'git rebase --continue',
      'pnpm test finished after 42s',
      'Rebasing · 3 of 7 · 1 conflict',
      '#318',
      'src/billing/rounding.ts:42:13',
      '~/.goodboy',
    ]) {
      assert.equal(isCodeReference({ token }), false, token);
    }
  });
});

describe('measureMarkdown', () => {
  it('counts an identifier outside Under the hood and none inside it', () => {
    const markdown = [
      '# Harborline',
      '',
      'Open the **Branches** card, drawn by `branchStoryOf`.',
      '',
      '## Under the hood',
      '',
      '- Branches card: `branchStoryOf` orders the rows.',
    ].join('\n');
    assert.equal(measureMarkdown({ markdown })['code-reference'], 1);
  });

  it('counts a sentence over 30 words and a paragraph over 120', () => {
    const sentence = `${words({ count: 31 })}.`;
    assert.equal(measureMarkdown({ markdown: sentence })['long-sentence'], 1);
    assert.equal(measureMarkdown({ markdown: `${words({ count: 30 })}.` })['long-sentence'], 0);
    const paragraph = Array.from({ length: 13 }, () => `${words({ count: 10 })}.`).join(' ');
    const counts = measureMarkdown({ markdown: paragraph });
    assert.equal(counts['long-paragraph'], 1);
    assert.equal(counts['long-sentence'], 0);
  });

  it('reads each list item and each table cell as its own paragraph', () => {
    const list = [`- ${words({ count: 100 })}.`, `- ${words({ count: 100 })}.`].join('\n');
    assert.equal(measureMarkdown({ markdown: list })['long-paragraph'], 0);
    const table = [
      '| Feature | What it does |',
      '| --- | --- |',
      `| Checks | ${words({ count: 130 })}. |`,
    ];
    assert.equal(measureMarkdown({ markdown: table.join('\n') })['long-paragraph'], 1);
  });

  it('counts a picture description over 25 words', () => {
    const img = (count) => `<img src="x.webp" alt="${words({ count })}">`;
    assert.equal(measureMarkdown({ markdown: img(26) })['long-alt'], 1);
    assert.equal(measureMarkdown({ markdown: img(25) })['long-alt'], 0);
  });

  it('counts Experimental and Windows wherever they appear', () => {
    const counts = measureMarkdown({ markdown: 'Auto agents are Experimental on Windows.' });
    assert.equal(counts.experimental, 1);
    assert.equal(counts.windows, 1);
  });

  it('counts a screen the app retired, by the words that named it', () => {
    const markdown = [
      'The rail lists Overview, Runs, Orchestrated, Agents with a Deprecated marker.',
      'Auto agents sit next to Agents.',
      'Pick Orchestrated or Preset on the New session page.',
    ].join('\n');
    assert.equal(measureMarkdown({ markdown })['retired-screen'], 3);
  });

  it('counts a settings path and a key written another way', () => {
    const markdown = [
      '**Settings > App > Updates** shows the version.',
      'Open Settings, General, then Notifications. Press Cmd+Z.',
      'The page in Settings under Providers and models.',
      '**Settings › App › Storage** and **⌘Z** are the right form.',
    ].join('\n');
    assert.equal(measureMarkdown({ markdown })['path-form'], 4);
  });

  it('skips fenced code', () => {
    const markdown = ['```bash', 'pnpm install `liveGroupsOf`', '```'].join('\n');
    assert.equal(measureMarkdown({ markdown })['code-reference'], 0);
  });
});

describe('text helpers', () => {
  it('splits sentences after a full stop and keeps decimals together', () => {
    assert.deepEqual(sentencesOf({ text: 'Push 2 commits. Version 0.27.1 ships. Done!' }), [
      'Push 2 commits.',
      'Version 0.27.1 ships.',
      'Done!',
    ]);
  });

  it('counts words with a letter or a digit', () => {
    assert.equal(wordsOf({ text: 'Rebasing · 3 of 7 ok' }), 5);
  });

  it('puts the Under the hood paragraphs apart', () => {
    const { paragraphs } = paragraphsOf({
      markdown: 'Intro.\n\n## Under the hood\n\n- `liveGroupsOf` orders rows.',
    });
    assert.deepEqual(
      paragraphs.map(({ isHood }) => isHood),
      [false, true],
    );
  });
});

describe('baseline', () => {
  it('reports only what grew and never a count that fell', () => {
    const measured = {
      'docs/features/board.md': { 'long-sentence': 3, 'code-reference': 1 },
      'docs/features/inbox.md': { 'long-sentence': 1 },
    };
    const baseline = {
      'long-sentence': { 'docs/features/board.md': 3, 'docs/features/inbox.md': 2 },
    };
    assert.deepEqual(growthLines({ measured, baseline }), [
      '  - code-reference docs/features/board.md: 1 (baseline 0), move the identifier or path to the "Under the hood" section at the end',
    ]);
  });

  it('writes only positive counts, sorted by file', () => {
    const measured = {
      'docs/features/storage.md': { 'long-sentence': 1, windows: 0 },
      'docs/features/board.md': { 'long-sentence': 2, windows: 0 },
    };
    assert.deepEqual(baselineOf({ measured }), {
      'long-sentence': { 'docs/features/board.md': 2, 'docs/features/storage.md': 1 },
    });
  });
});

describe('run', () => {
  const withRoot = ({ body, check }) => {
    const root = mkdtempSync(join(tmpdir(), 'doc-budget-'));
    try {
      mkdirSync(join(root, 'docs/features'), { recursive: true });
      writeFileSync(join(root, 'README.md'), 'Harborline keeps three repos.\n');
      writeFileSync(join(root, 'docs/features/board.md'), body);
      check({ root, baselinePath: join(root, 'baseline.json') });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };

  it('fails when the baseline is missing and writes none without --update', () => {
    withRoot({
      body: `${words({ count: 31 })}.\n`,
      check: ({ root, baselinePath }) => {
        const result = run({ args: [], root, baselinePath });
        assert.equal(result.ok, false);
        assert.match(result.lines[0], /doc-budget\.baseline\.json is missing/);
        assert.equal(existsSync(baselinePath), false);
      },
    });
  });

  it('writes the first baseline with --update, then passes, then fails on growth', () => {
    withRoot({
      body: `${words({ count: 31 })}.\n`,
      check: ({ root, baselinePath }) => {
        assert.deepEqual(run({ args: ['--update'], root, baselinePath }).lines, [
          'doc budget baseline written',
        ]);
        assert.equal(run({ args: [], root, baselinePath }).ok, true);
        writeFileSync(
          join(root, 'docs/features/board.md'),
          `${words({ count: 31 })}. ${words({ count: 32 })}.\n`,
        );
        const grown = run({ args: [], root, baselinePath });
        assert.equal(grown.ok, false);
        assert.match(grown.lines[0], /long-sentence docs\/features\/board\.md: 2 \(baseline 1\)/);
      },
    });
  });

  it('lowers the baseline with --update and refuses to raise it', () => {
    withRoot({
      body: `${words({ count: 31 })}. ${words({ count: 32 })}.\n`,
      check: ({ root, baselinePath }) => {
        run({ args: ['--update'], root, baselinePath });
        writeFileSync(join(root, 'docs/features/board.md'), `${words({ count: 31 })}.\n`);
        assert.equal(run({ args: ['--update'], root, baselinePath }).ok, true);
        assert.deepEqual(JSON.parse(readFileSync(baselinePath, 'utf8')), {
          'long-sentence': { 'docs/features/board.md': 1 },
        });
        writeFileSync(
          join(root, 'docs/features/board.md'),
          `${words({ count: 31 })}. ${words({ count: 32 })}.\n`,
        );
        assert.equal(run({ args: ['--update'], root, baselinePath }).ok, false);
      },
    });
  });

  it('lists the first session page and every walkthrough when they exist', () => {
    withRoot({
      body: 'Harborline.\n',
      check: ({ root }) => {
        mkdirSync(join(root, 'docs/walkthroughs'), { recursive: true });
        writeFileSync(join(root, 'docs/first-session.md'), 'Harborline.\n');
        writeFileSync(join(root, 'docs/walkthroughs/fix.md'), 'Harborline.\n');
        assert.deepEqual(listDocs({ root }), [
          'README.md',
          'docs/first-session.md',
          'docs/features/board.md',
          'docs/walkthroughs/fix.md',
        ]);
      },
    });
  });

  it('lists the README first, then every feature page', () => {
    withRoot({
      body: 'Harborline.\n',
      check: ({ root }) => {
        assert.deepEqual(listDocs({ root }), ['README.md', 'docs/features/board.md']);
      },
    });
  });
});
