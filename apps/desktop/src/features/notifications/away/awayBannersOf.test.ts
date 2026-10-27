import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { awayBannersOf, type BannerCandidate } from './awayBannersOf';

const candidate = (name: string): BannerCandidate => ({
  key: `${name}:open-question`,
  sessionId: brandId<SessionId>({ value: name }),
  reason: 'open-question',
  title: `Session ${name}`,
  body: '1 question for you',
});

const NONE: ReadonlySet<string> = new Set();

describe('the banners a transition produces', () => {
  it('makes one banner per session that was not waiting before', () => {
    const banners = awayBannersOf({
      previousKeys: new Set(['a:open-question']),
      candidates: [candidate('a'), candidate('b')],
      recentCount: 0,
      workspaceName: 'Harborline',
    });

    expect(banners).toEqual([
      {
        sessionId: 'b',
        reason: 'open-question',
        title: 'Session b',
        body: '1 question for you',
        keys: ['b:open-question'],
      },
    ]);
  });

  it('makes nothing when every candidate was waiting before', () => {
    const banners = awayBannersOf({
      previousKeys: new Set(['a:open-question']),
      candidates: [candidate('a')],
      recentCount: 0,
      workspaceName: 'Harborline',
    });

    expect(banners).toEqual([]);
  });

  it('groups three arrivals at once into one banner naming the workspace', () => {
    const banners = awayBannersOf({
      previousKeys: NONE,
      candidates: [candidate('a'), candidate('b'), candidate('c')],
      recentCount: 0,
      workspaceName: 'Harborline',
    });

    expect(banners).toEqual([
      {
        sessionId: null,
        reason: null,
        title: 'Harborline',
        body: '3 sessions need you',
        keys: ['a:open-question', 'b:open-question', 'c:open-question'],
      },
    ]);
  });

  it('groups a third arrival with the two that came in the last 30 seconds', () => {
    const banners = awayBannersOf({
      previousKeys: NONE,
      candidates: [candidate('c')],
      recentCount: 2,
      workspaceName: 'Harborline',
    });

    expect(banners).toMatchObject([{ sessionId: null, body: '3 sessions need you' }]);
  });
});
