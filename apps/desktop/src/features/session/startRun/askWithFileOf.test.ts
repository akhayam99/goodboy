// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { askWithFileOf } from './askWithFileOf';

describe('askWithFileOf', () => {
  it('keeps the user ask first and appends the file attachment block after it', () => {
    expect(
      askWithFileOf({
        ask: 'Summarize what this file says.',
        relPath: 'docs/report.md',
        absolutePath: '/work/ledger-core/docs/report.md',
      }),
    ).toBe(
      [
        'Summarize what this file says.',
        '',
        '**Attached** (this message) read each path with your Read tool before relying on it:',
        '- docs/report.md (/work/ledger-core/docs/report.md)',
      ].join('\n'),
    );
  });

  it('trims the ask before composing the kickoff', () => {
    expect(
      askWithFileOf({
        ask: '  Extract the key risks.  ',
        relPath: 'data/risks.csv',
        absolutePath: '/work/notify-relay/data/risks.csv',
      }),
    ).toContain('Extract the key risks.');
  });

  it('names the folder of the project the file was browsed in', () => {
    const prompt = askWithFileOf({
      ask: 'What changed?',
      relPath: 'README.md',
      absolutePath: '/work/notify-relay/README.md',
    });
    expect(prompt).toContain('/work/notify-relay/README.md');
    expect(prompt).not.toContain('/work/ledger-core');
  });
});
