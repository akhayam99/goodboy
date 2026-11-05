import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { releaseDescription } from '../src/prerender/releaseDescription.ts';
import { releaseTitle } from '../src/prerender/releaseTitle.ts';
import { runCheckSeo } from './lib/miniDist.mjs';

describe('releaseTitle', () => {
  it('names the version and the theme of the summary', () => {
    assert.equal(
      releaseTitle({ version: '0.31.9', summary: 'The branch page says each thing once.' }),
      'Goodboy 0.31.9: The branch page says each thing once',
    );
  });

  it('keeps the first sentence of a long summary', () => {
    assert.equal(
      releaseTitle({
        version: '1.0.0',
        summary: 'Runs resume after a restart. Reports stay on disk.',
      }),
      'Goodboy 1.0.0: Runs resume after a restart',
    );
  });

  it('cuts at a whole word inside 70 characters', () => {
    const title = releaseTitle({
      version: '0.31.0',
      summary:
        'One Needs you card, a Sessions page that is the Board, tabs on the branch page, a shorter setup and a quicker app.',
    });
    assert.equal(title, 'Goodboy 0.31.0: One Needs you card, a Sessions page that is the Board');
  });
});

describe('releaseTitle range', () => {
  it('pads a short summary into the title range', () => {
    assert.equal(
      releaseTitle({ version: '0.40.1', summary: 'Fix startup.' }),
      'Goodboy 0.40.1: Fix startup | Release notes and what changed',
    );
  });

  it('holds 30 to 70 characters for any summary', () => {
    ['', ' ', '.', 'Fix.', 'Bug fixes.', 'x'.repeat(300), 'A. B. C.'].forEach((summary) => {
      ['0.1.2', '10.20.30'].forEach((version) => {
        const { length } = releaseTitle({ version, summary });
        assert.ok(length >= 30 && length <= 70, `${version} ${JSON.stringify(summary)}: ${length}`);
      });
    });
  });
});

describe('releaseDescription range', () => {
  it('holds 70 to 160 characters for any summary and names the version', () => {
    ['', 'Fix.', 'x '.repeat(200), 'Agents resume after a restart.'].forEach((summary) => {
      ['0.1.2', '10.20.30'].forEach((version) => {
        const text = releaseDescription({ version, date: '2026-11-05', summary, notes: '' });
        assert.ok(
          text.length >= 70 && text.length <= 160,
          `${JSON.stringify(summary)}: ${text.length}`,
        );
        assert.ok(text.includes(version));
      });
    });
  });

  it('differs between two patch releases with the same summary', () => {
    const input = { date: '2026-11-05', summary: 'Fix startup.', notes: '- Same entry.' };
    assert.notEqual(
      releaseDescription({ ...input, version: '0.40.1' }),
      releaseDescription({ ...input, version: '0.40.2' }),
    );
  });
});

describe('generated release page', () => {
  it('exits 0 on a short summary, even with --strict', () => {
    const date = '2026-11-05';
    const release = (version) => ({
      path: `/changelog/${version}`,
      title: releaseTitle({ version, summary: 'Fix startup.' }),
      description: releaseDescription({ version, date, summary: 'Fix startup.', notes: '' }),
      date,
    });
    const home = {
      path: '/',
      title: 'Acme: a tool for running agents on one task',
      description:
        'Acme runs several coding agents on one task, with a git worktree per branch and a review step.',
    };
    const result = runCheckSeo({
      pages: [home, release('0.40.1'), release('0.40.2')],
      args: ['--strict'],
    });
    assert.equal(result.status, 0, result.output);
  });
});

describe('releaseDescription', () => {
  const base = { version: '0.31.9', date: '2026-11-01' };

  it('keeps a summary that is long enough', () => {
    const summary =
      'Agents pick up where they were after a restart or an update, every form ends on one action row, and an open question shows once.';
    assert.equal(
      releaseDescription({ ...base, summary, notes: '- Another change.' }),
      `Goodboy 0.31.9: ${summary}`,
    );
  });

  it('adds the first note entries to a short summary, without repeating it', () => {
    const summary = 'A run shows what it is doing.';
    const notes = [
      '### Improved',
      '',
      '#### The working row',
      '',
      'While a run picks its next step, the **moving row** sits after the last `step`.',
      '',
      '- A plan with a badly closed block no longer nests every decision. ',
      `- ${summary}`,
    ].join('\n');
    assert.equal(
      releaseDescription({ ...base, summary, notes }),
      `Goodboy 0.31.9: ${summary} While a run picks its next step, the moving row sits after the last step.`,
    );
  });

  it('names the release when there is nothing to add', () => {
    assert.equal(
      releaseDescription({
        ...base,
        summary: 'Every screen names a model the same way.',
        notes: '',
      }),
      'Goodboy 0.31.9: Every screen names a model the same way. Release notes for Goodboy 0.31.9, published 2026-11-01, with every change in it.',
    );
  });
});
