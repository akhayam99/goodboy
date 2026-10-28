import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { parseJsonLine, resetCopilotParseState, type ParseContext } from './parser';

const RUN_ID = brandId<ProviderRunId>({ value: 'run_recorded' });
const AT = brandId<IsoDateTime>({ value: '2026-10-28T00:00:00.000Z' });
const CTX: ParseContext = { runId: RUN_ID, now: () => AT };

type NameParams = {
  readonly name: string;
};

const replay = ({ name }: NameParams): ReadonlyArray<TurnEvent> => {
  resetCopilotParseState({ runId: RUN_ID });
  const lines = readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8').split('\n');
  return lines.flatMap((line) => parseJsonLine({ line, ctx: CTX }));
};

type KindParams<K extends TurnEvent['kind']> = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly kind: K;
};

const ofKind = <K extends TurnEvent['kind']>({
  events,
  kind,
}: KindParams<K>): ReadonlyArray<Extract<TurnEvent, { kind: K }>> =>
  events.filter((event): event is Extract<TurnEvent, { kind: K }> => event.kind === kind);

describe('recorded copilot 1.0.105 read-only turn', () => {
  const events = replay({ name: 'readonly-turn.jsonl' });

  it('streams the final reply as text and drops the repeated message', () => {
    const text = ofKind({ events, kind: 'assistant_text' })
      .map((event) => event.delta)
      .join('');
    expect(text).toBe("README's first line: `# Acme notes`. The file was not created.");
  });

  it('maps both tool calls to a start and an end', () => {
    const starts = ofKind({ events, kind: 'tool_call_start' });
    expect(starts.map((event) => event.toolName)).toEqual(['view', 'create']);
    const view = ofKind({ events, kind: 'tool_call_end' }).find(
      (event) => event.toolUseId === 'call-view',
    );
    expect(view).toMatchObject({ output: '# Acme notes\n', isError: false });
  });

  it('shows the denied write as a tool error with the denial message', () => {
    const denied = ofKind({ events, kind: 'tool_call_end' }).find(
      (event) => event.toolUseId === 'call-create',
    );
    expect(denied).toMatchObject({
      isError: true,
      output: 'Permission to run this tool was denied due to the following rules: `write`',
    });
    expect(ofKind({ events, kind: 'file_edit' })).toEqual([]);
  });

  it('emits the session id and the usage from the checkpoint and the result', () => {
    expect(ofKind({ events, kind: 'provider_session_init' })).toEqual([
      {
        kind: 'provider_session_init',
        runId: RUN_ID,
        providerSessionId: 'session-ledger-core-1',
        at: AT,
      },
    ]);
    expect(ofKind({ events, kind: 'usage' })).toEqual([
      {
        kind: 'usage',
        runId: RUN_ID,
        usage: {
          inputTokens: 23,
          outputTokens: 497,
          cachedInputTokens: 32582,
          cacheCreationInputTokens: 17841,
          premiumRequests: 0.33,
          sessionPremiumRequests: 0.33,
          nanoAiu: 2806745000,
          sessionNanoAiu: 2806745000,
          estimatedCostUsd: 0,
        },
        at: AT,
      },
    ]);
  });

  it('keeps no unknown payload from the housekeeping events', () => {
    expect(ofKind({ events, kind: 'unknown_payload' })).toEqual([]);
  });
});

describe('recorded copilot 1.0.105 resumed turn', () => {
  it('reports the session totals and the same session id', () => {
    const events = replay({ name: 'resumed-turn.jsonl' });
    expect(ofKind({ events, kind: 'provider_session_init' })[0]?.providerSessionId).toBe(
      'session-ledger-core-1',
    );
    const usage = ofKind({ events, kind: 'usage' })[0]?.usage;
    expect(usage?.sessionPremiumRequests).toBe(0.66);
    expect(usage?.sessionNanoAiu).toBe(5600000000);
  });
});

describe('recorded copilot 1.0.105 unknown model', () => {
  it('emits nothing on stdout, the message is on stderr', () => {
    expect(replay({ name: 'unknown-model.jsonl' })).toEqual([]);
    const stderr = readFileSync(
      new URL('./fixtures/unknown-model.stderr.txt', import.meta.url),
      'utf8',
    );
    expect(stderr.trim()).toBe('Error: Model "gpt-5-mini" from --model flag is not available.');
  });
});
