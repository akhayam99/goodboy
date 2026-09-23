import { describe, expect, it } from 'vitest';
import type { IsoDateTime, OrchestratorHint } from '@goodboy/types';
import { serializeOrchestratorHintLog, toOrchestratorHintLog } from './orchestrator-hint-log';

const HINT: OrchestratorHint = {
  id: 'hint-1',
  text: 'run a reviewer before the PR',
  isPinned: false,
  createdAt: '2026-09-23T10:00:00.000Z' as IsoDateTime,
  consumedAt: '2026-09-23T10:02:00.000Z' as IsoDateTime,
  consumedAtStep: 4,
};

describe('orchestrator hint log', () => {
  it('round-trips the hints it serializes', () => {
    const value = serializeOrchestratorHintLog({ hints: [HINT] });
    expect(toOrchestratorHintLog({ value })).toEqual([HINT]);
  });

  it('stores an empty log as null', () => {
    expect(serializeOrchestratorHintLog({ hints: [] })).toBeNull();
  });

  it('drops malformed entries and keeps the valid ones', () => {
    const value = JSON.stringify([
      HINT,
      { id: 'hint-2', text: '   ', isPinned: true, createdAt: HINT.createdAt },
      { id: 'hint-3', text: 'no timestamp', isPinned: true },
      'not an object',
    ]);
    expect(toOrchestratorHintLog({ value })).toEqual([HINT]);
  });

  it('reads garbage as an empty log', () => {
    expect(toOrchestratorHintLog({ value: '{not json' })).toEqual([]);
    expect(toOrchestratorHintLog({ value: null })).toEqual([]);
  });
});
