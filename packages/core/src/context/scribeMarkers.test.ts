import { describe, expect, it } from 'vitest';
import { extractScribeText, stripControlMarkers } from './marker-parsing';

describe('extractScribeText', () => {
  it('reads the pull request title, body and changelog entry', () => {
    const text = [
      'Here is the text.',
      '<<pr-title>>',
      'Make ledger postings idempotent across retried batches',
      '<</pr-title>>',
      '<<pr-body>>',
      'Retried settlement batches no longer post twice.',
      '',
      '- Guard the batch with the event id',
      '<</pr-body>>',
      '<<changelog-entry>>',
      '- Retried batches no longer double post',
      '<</changelog-entry>>',
    ].join('\n');

    expect(extractScribeText(text)).toEqual({
      prTitle: 'Make ledger postings idempotent across retried batches',
      prBody:
        'Retried settlement batches no longer post twice.\n\n- Guard the batch with the event id',
      commitMessages: [],
      changelogEntry: '- Retried batches no longer double post',
    });
  });

  it('reads one commit message per sha', () => {
    const text = [
      '<<commit-message for="3a1f9c2">>',
      'Guard the settlement batch',
      '',
      'Duplicate event ids skip the posting.',
      '<</commit-message>>',
    ].join('\n');

    expect(extractScribeText(text).commitMessages).toEqual([
      {
        sha: '3a1f9c2',
        message: 'Guard the settlement batch\n\nDuplicate event ids skip the posting.',
      },
    ]);
  });

  it('keeps only the first line of a title and hides every block from the transcript', () => {
    const text = 'Done.\n<<pr-title>>Title\nextra<</pr-title>>\n<<pr-body>>Body<</pr-body>>';

    expect(extractScribeText(text).prTitle).toBe('Title');
    expect(stripControlMarkers(text)).toBe('Done.');
  });
});
