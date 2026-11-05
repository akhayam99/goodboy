// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime } from '@goodboy/types';
import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import type { TranscriptRow } from '../../utils/cluster-operations';
import { claimedRepliesOf } from './claimedRepliesOf';

const SECOND = 1_000;
const T0 = Date.UTC(2026, 10, 5, 10, 0, 0);

const at = (seconds: number): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(T0 + seconds * SECOND).toISOString() });

const user = (key: string, text: string, seconds: number): TranscriptRow => ({
  kind: 'item',
  key,
  item: { kind: 'user_text', key, text, at: at(seconds) },
});

const isApproval = ({ text }: { readonly text: string }): boolean =>
  text.startsWith('Approved plan');

const card = (key: string, seconds: number | null): TranscriptInsertion => ({
  key,
  beforeMs: seconds === null ? null : T0 + seconds * SECOND,
  claimsReply: isApproval,
  node: key,
});

describe('claimedRepliesOf', () => {
  it('gives a reply to the first cluster that settles after it', () => {
    const claims = claimedRepliesOf({
      rows: [user('u1', 'goal', 0), user('u2', 'Approved plan v1.', 20)],
      insertions: [card('planner', 10), card('building', 60)],
    });

    expect([...claims.claimedKeys]).toEqual(['u2']);
    expect(claims.repliesByInsertion.get('building')?.map((reply) => reply.text)).toEqual([
      'Approved plan v1.',
    ]);
    expect(claims.repliesByInsertion.has('planner')).toBe(false);
  });

  it('leaves a free message in the transcript', () => {
    const claims = claimedRepliesOf({
      rows: [user('u1', 'also add a test', 20)],
      insertions: [card('building', 60)],
    });

    expect(claims.claimedKeys.size).toBe(0);
    expect(claims.repliesByInsertion.size).toBe(0);
  });

  it('gives a reply to the open cluster at the end when no settled one follows', () => {
    const claims = claimedRepliesOf({
      rows: [user('u2', 'Approved plan v2.', 20)],
      insertions: [card('open', null), card('planner', 10)],
    });

    expect([...claims.claimedKeys]).toEqual(['u2']);
    expect(claims.repliesByInsertion.has('open')).toBe(true);
  });

  it('claims nothing when no cluster asks for replies', () => {
    const claims = claimedRepliesOf({
      rows: [user('u2', 'Approved plan v1.', 20)],
      insertions: [{ key: 'plain', beforeMs: T0 + 60 * SECOND, node: 'plain' }],
    });

    expect(claims.claimedKeys.size).toBe(0);
  });
});
