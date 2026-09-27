import { describe, expect, it } from 'vitest';
import { extractHistoryReport, stripControlMarkers } from './marker-parsing';

describe('extractHistoryReport', () => {
  it('reads every finished step, the final head and marks skipped steps', () => {
    const text = [
      'Merged the two edits in postings.ts.',
      '<<history-step from="5b3e91f" to="9aa01c2">>',
      '<<history-step from="7c2d8a1" to="none">>',
      '<<history-done head="9aa01c2">>',
    ].join('\n');

    expect(extractHistoryReport(text)).toEqual({
      steps: [
        { from: '5b3e91f', to: '9aa01c2' },
        { from: '7c2d8a1', to: null },
      ],
      doneHead: '9aa01c2',
      stuck: null,
    });
  });

  it('reads a stuck report with its files and reason', () => {
    const text =
      '<<history-stuck from="5b3e91f" files="src/ledger/postings.ts, src/ledger/batch.ts" reason="both change the retry key">>';

    expect(extractHistoryReport(text).stuck).toEqual({
      from: '5b3e91f',
      files: ['src/ledger/postings.ts', 'src/ledger/batch.ts'],
      reason: 'both change the retry key',
    });
  });

  it('returns an empty report when the agent wrote no markers', () => {
    expect(extractHistoryReport('I could not finish.')).toEqual({
      steps: [],
      doneHead: null,
      stuck: null,
    });
  });

  it('hides the markers from the transcript text', () => {
    expect(
      stripControlMarkers('Done.\n<<history-step from="a" to="b">>\n<<history-done head="b">>'),
    ).toBe('Done.');
  });
});
