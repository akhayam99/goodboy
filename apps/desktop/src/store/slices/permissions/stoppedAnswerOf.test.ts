// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { stoppedAnswerOf } from './stoppedAnswerOf';

const AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });
const RUN = brandId<ProviderRunId>({ value: 'run-ask' });

type EventParams = {
  readonly toolUseId: string;
  readonly scope?: 'workspace' | 'once';
};

const askOf = ({ toolUseId }: EventParams): TurnEvent => ({
  kind: 'permission_request',
  runId: RUN,
  toolUseId,
  toolName: 'Bash',
  input: { command: 'pnpm test --filter ledger-core' },
  at: AT,
});

const allowOf = ({ toolUseId, scope = 'workspace' }: EventParams): TurnEvent => ({
  kind: 'permission_decision',
  runId: RUN,
  toolUseId,
  decision: 'allow',
  scope,
  ruleId: null,
  decidedBy: 'user',
  at: AT,
});

describe('stoppedAnswerOf', () => {
  it('names the rule answer that nothing resumed', () => {
    expect(
      stoppedAnswerOf({
        events: [askOf({ toolUseId: 'one' }), allowOf({ toolUseId: 'one' })],
        turnKind: 'blocked',
      }),
    ).toEqual({ toolUseId: 'one', toolName: 'Bash' });
  });

  it('holds while another ask of the batch is open', () => {
    expect(
      stoppedAnswerOf({
        events: [
          askOf({ toolUseId: 'one' }),
          askOf({ toolUseId: 'two' }),
          allowOf({ toolUseId: 'one' }),
        ],
        turnKind: 'blocked',
      }),
    ).toBeNull();
  });

  it('holds once the turn runs again', () => {
    expect(
      stoppedAnswerOf({
        events: [askOf({ toolUseId: 'one' }), allowOf({ toolUseId: 'one' })],
        turnKind: 'running',
      }),
    ).toBeNull();
  });

  it('holds on a once answer', () => {
    expect(
      stoppedAnswerOf({
        events: [askOf({ toolUseId: 'one' }), allowOf({ toolUseId: 'one', scope: 'once' })],
        turnKind: 'blocked',
      }),
    ).toBeNull();
  });
});
