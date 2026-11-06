// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type ProviderRunId,
  type TurnEvent,
  type TurnState,
} from '@goodboy/types';
import { openPermissionAsksOf } from './openPermissionAsksOf';

const AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });
const RUN = brandId<ProviderRunId>({ value: 'run-1' });
const BLOCKED: TurnState = { kind: 'blocked', runId: RUN, blockedAt: AT };

const ask = (toolUseId: string): TurnEvent => ({
  kind: 'permission_request',
  runId: RUN,
  toolUseId,
  toolName: 'Bash',
  input: { command: 'rm -rf node_modules' },
  at: AT,
});

const ids = (events: ReadonlyArray<TurnEvent>, turnState: TurnState | null = BLOCKED) =>
  openPermissionAsksOf({ events, turnState }).map((item) => item.toolUseId);

describe('openPermissionAsksOf', () => {
  it('keeps an ask the tool ended before it, as a real denial does', () => {
    const ended: TurnEvent = {
      kind: 'tool_call_end',
      runId: RUN,
      toolUseId: 'a',
      output: 'requires approval',
      isError: true,
      at: AT,
    };

    expect(ids([ended, ask('a')])).toEqual(['a']);
  });

  it('closes an ask once it is decided', () => {
    const decided: TurnEvent = {
      kind: 'permission_decision',
      runId: RUN,
      toolUseId: 'a',
      decision: 'allow',
      ruleId: null,
      decidedBy: 'user',
      at: AT,
    };

    expect(ids([ask('a'), decided, ask('b')])).toEqual(['b']);
  });

  it('lets an ask lapse when a new message starts', () => {
    const message: TurnEvent = { kind: 'user_text', runId: RUN, text: 'Go on', at: AT };

    expect(ids([ask('a'), message])).toEqual([]);
  });

  it('asks only while the turn is held, so a stopped turn offers no late Allow', () => {
    expect(ids([ask('a')], { kind: 'idle', lastActivityAt: AT })).toEqual([]);
    expect(ids([ask('a')], null)).toEqual([]);
  });
});
