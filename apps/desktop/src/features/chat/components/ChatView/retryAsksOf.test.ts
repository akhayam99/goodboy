// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { retryAsksOf } from './retryAsksOf';

const AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });
const ASK_RUN = brandId<ProviderRunId>({ value: 'run-ask' });
const FAILED_RUN = brandId<ProviderRunId>({ value: 'run-failed' });

const ask: TurnEvent = {
  kind: 'permission_request',
  runId: ASK_RUN,
  toolUseId: 'tool-migrate',
  toolName: 'Bash',
  input: { command: 'pnpm db:migrate' },
  at: AT,
};
const denied: TurnEvent = {
  kind: 'permission_decision',
  runId: ASK_RUN,
  toolUseId: 'tool-migrate',
  decision: 'deny',
  reason: 'Do a dry run first',
  ruleId: null,
  decidedBy: 'user',
  at: AT,
};
const sent: TurnEvent = {
  kind: 'user_text',
  runId: FAILED_RUN,
  text: 'Do a dry run first',
  at: AT,
};

describe('retryAsksOf', () => {
  it('reads the answers the failed turn carried', () => {
    const { denied: open, held } = retryAsksOf({
      events: [ask, denied, sent],
      runId: FAILED_RUN,
    });

    expect(open).toEqual([]);
    expect(held).toEqual([
      expect.objectContaining({
        toolUseId: 'tool-migrate',
        decision: 'deny',
        reason: 'Do a dry run first',
      }),
    ]);
  });

  it('adds an answer given after the failed message', () => {
    const later: TurnEvent = { ...ask, runId: FAILED_RUN, toolUseId: 'tool-seed' };
    const allowed: TurnEvent = {
      kind: 'permission_decision',
      runId: FAILED_RUN,
      toolUseId: 'tool-seed',
      decision: 'allow',
      scope: 'once',
      ruleId: null,
      decidedBy: 'user',
      at: AT,
    };

    const { held } = retryAsksOf({
      events: [ask, denied, sent, later, allowed],
      runId: FAILED_RUN,
    });

    expect(held.map((answer) => answer.toolUseId)).toEqual(['tool-migrate', 'tool-seed']);
  });

  it('finds nothing for a run with no message of its own', () => {
    expect(retryAsksOf({ events: [ask, denied, sent], runId: ASK_RUN }).held).toEqual([]);
  });
});
