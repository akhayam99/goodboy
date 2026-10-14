import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import { analyzedCheckNameOf } from './analyzedCheckNameOf';

const runId: ProviderRunId = JSON.parse(JSON.stringify('run-1'));
const at: IsoDateTime = TEST_NOW;

const kickoffOf = (text: string): TurnEvent => ({ kind: 'user_text', runId, text, at });

describe('analyzedCheckNameOf', () => {
  it('reads the check name from the kickoff line', () => {
    const events = [kickoffOf('Pull request #318\nCheck: lint\nlog')];
    expect(analyzedCheckNameOf({ events })).toBe('lint');
  });

  it('returns null without a kickoff or a check line', () => {
    expect(analyzedCheckNameOf({ events: [] })).toBeNull();
    expect(analyzedCheckNameOf({ events: [kickoffOf('nothing here')] })).toBeNull();
  });
});
