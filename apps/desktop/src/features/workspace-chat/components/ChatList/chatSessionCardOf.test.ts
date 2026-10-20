// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import type { ChatSessionMarker } from '../../hooks/useChatSessionMarker';
import { chatSessionCardOf } from './chatSessionCardOf';

const entryOf = ({ index }: { readonly index: number }) => ({
  sessionId: brandId<SessionId>({ value: `session-${index}` }),
  title: `Retry keys ${index}`,
  stage: 'building' as const,
  stageLabel: 'Building',
});

const markerOf = ({ count }: { readonly count: number }): ChatSessionMarker => ({
  count,
  tone: 'info',
  isPulsing: false,
  entries: Array.from({ length: count }, (_, index) => entryOf({ index })),
});

describe('chatSessionCardOf', () => {
  it('lists a row per session with its stage, never a joined line', () => {
    const card = chatSessionCardOf({ marker: markerOf({ count: 2 }) });

    expect(card.title).toBe('2 sessions');
    expect(card.facts).toEqual([
      { label: 'Retry keys 0', value: 'Building' },
      { label: 'Retry keys 1', value: 'Building' },
    ]);
    expect(JSON.stringify(card)).not.toContain(' · ');
  });

  it('names the one session of a single link', () => {
    const card = chatSessionCardOf({ marker: markerOf({ count: 1 }) });

    expect(card.title).toBe('1 session');
    expect(card.facts).toHaveLength(1);
  });

  it('cuts a long list at six rows and says how many are left', () => {
    const card = chatSessionCardOf({ marker: markerOf({ count: 9 }) });

    expect(card.facts).toHaveLength(5);
    expect(card.footnote).toBe('and 4 more');
  });
});
