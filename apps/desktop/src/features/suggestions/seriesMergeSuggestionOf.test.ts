// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type PrSeriesId, type SessionId } from '@goodboy/types';
import type { SeriesPart, SeriesStrip } from '../../store/slices/pr-series/seriesStripsOf';
import { seriesMergeSuggestionOf } from './seriesMergeSuggestionOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });

const partOf = (overrides: Partial<SeriesPart> & Pick<SeriesPart, 'ordinal'>): SeriesPart => ({
  label: String(overrides.ordinal),
  mountId: null,
  state: 'open',
  provider: 'gitlab',
  number: 20 + overrides.ordinal,
  ...overrides,
});

const stripOf = (parts: ReadonlyArray<SeriesPart>): SeriesStrip => ({
  id: brandId<PrSeriesId>({ value: 'series-ledger-rounding' }),
  name: 'ledger-rounding',
  total: 3,
  current: 1,
  parts,
});

describe('seriesMergeSuggestionOf', () => {
  it('offers Merge in order once two parts hold an open request, naming the first', () => {
    const suggestion = seriesMergeSuggestionOf({
      sessionId: SESSION_ID,
      strip: stripOf([partOf({ ordinal: 2 }), partOf({ ordinal: 3 })]),
    });

    expect(suggestion).toMatchObject({
      kind: 'merge-series',
      title: 'Merge ledger-rounding in order',
      detail: '2 parts, part 2 first',
      payload: { labels: ['2', '3'] },
    });
  });

  it('offers nothing for one open part, which the ordinary Merge row already covers', () => {
    expect(
      seriesMergeSuggestionOf({
        sessionId: SESSION_ID,
        strip: stripOf([partOf({ ordinal: 1, state: 'merged' }), partOf({ ordinal: 2 })]),
      }),
    ).toBeNull();
  });

  it('offers nothing while a part has no request yet, or is only planned', () => {
    expect(
      seriesMergeSuggestionOf({
        sessionId: SESSION_ID,
        strip: stripOf([
          partOf({ ordinal: 1, provider: null, number: null }),
          partOf({ ordinal: 2, state: 'planned', provider: null, number: null }),
        ]),
      }),
    ).toBeNull();
  });

  it('is on every host that can merge with a method, GitHub and Bitbucket too', () => {
    for (const provider of ['github', 'bitbucket'] as const) {
      const suggestion = seriesMergeSuggestionOf({
        sessionId: SESSION_ID,
        strip: stripOf([partOf({ ordinal: 1, provider }), partOf({ ordinal: 2, provider })]),
      });

      expect(suggestion?.kind).toBe('merge-series');
    }
  });

  it('changes its fingerprint when a part joins or leaves, so a dismissal does not hide it', () => {
    const two = seriesMergeSuggestionOf({
      sessionId: SESSION_ID,
      strip: stripOf([partOf({ ordinal: 1 }), partOf({ ordinal: 2 })]),
    });
    const three = seriesMergeSuggestionOf({
      sessionId: SESSION_ID,
      strip: stripOf([partOf({ ordinal: 1 }), partOf({ ordinal: 2 }), partOf({ ordinal: 3 })]),
    });

    expect(two?.fingerprint).not.toBe(three?.fingerprint);
  });
});
