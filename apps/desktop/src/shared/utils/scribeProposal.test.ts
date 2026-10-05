import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import type { TranscriptItem } from '../../features/chat/utils/transcript-items';
import { carriesPullRequestText, scribeProposalOf } from './scribeProposal';

const assistant = (key: string, text: string): TranscriptItem => ({
  kind: 'assistant_text',
  key,
  text,
});

const FIRST = [
  '<<pr-title>>',
  'Guard settlement postings',
  '<</pr-title>>',
  '<<pr-body>>',
  'Retried batches no longer post twice.',
  '<</pr-body>>',
  '<<changelog-entry>>',
  '- Retried batches no longer double post',
  '<</changelog-entry>>',
].join('\n');

const kickoff: TranscriptItem = {
  kind: 'user_text',
  key: 'user-0',
  text: 'Write the title and body of a new pull request for fix/ledger-postings into main.',
  at: '2026-10-05T09:00:00.000Z' as IsoDateTime,
};

describe('scribeProposalOf', () => {
  it('reads the title, body and changelog entry the Scribe wrote, and the kickoff it answered', () => {
    const proposal = scribeProposalOf({
      items: [kickoff, assistant('a-1', 'Reading the diff.'), assistant('a-2', FIRST)],
    });

    expect(proposal).toEqual({
      title: 'Guard settlement postings',
      body: 'Retried batches no longer post twice.',
      changelogEntry: '- Retried batches no longer double post',
      latestText: FIRST,
      kickoff: kickoff.kind === 'user_text' ? kickoff.text : null,
    });
  });

  it('is empty for a Scribe that wrote no block', () => {
    expect(
      scribeProposalOf({ items: [kickoff, assistant('a-1', 'I looked at the diff.')] }),
    ).toBeNull();
  });

  it('keeps the proposal when a later answer brings no block', () => {
    const proposal = scribeProposalOf({
      items: [
        assistant('a-1', FIRST),
        assistant('a-2', 'got it - PR text ready, engine creates the draft. standing by.'),
      ],
    });

    expect(proposal?.title).toBe('Guard settlement postings');
    expect(proposal?.latestText).toBe(FIRST);
  });

  it('replaces only what a later answer rewrites', () => {
    const later = '<<pr-body>>\nPostings are keyed by event id.\n<</pr-body>>';
    const proposal = scribeProposalOf({
      items: [assistant('a-1', FIRST), assistant('a-2', later)],
    });

    expect(proposal).toMatchObject({
      title: 'Guard settlement postings',
      body: 'Postings are keyed by event id.',
      changelogEntry: '- Retried batches no longer double post',
      latestText: later,
    });
  });

  it('waits for a block to close before it counts', () => {
    expect(
      scribeProposalOf({ items: [assistant('a-1', '<<pr-title>>Guard settlement postings')] }),
    ).toBeNull();
  });
});

describe('carriesPullRequestText', () => {
  it('tells a message with a block from one without', () => {
    expect(carriesPullRequestText({ text: FIRST })).toBe(true);
    expect(carriesPullRequestText({ text: 'Done.' })).toBe(false);
  });
});
