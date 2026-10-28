vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);

type Listener = (event: { readonly payload: Envelope }) => void;

type Envelope = {
  readonly runId: string;
  readonly seq?: number;
} & (
  | { readonly type: 'line'; readonly line: string }
  | { readonly type: 'end'; readonly exit_code: number | null; readonly stderr: string }
  | {
      readonly type: 'reaped';
      readonly stopped: ReadonlyArray<{
        readonly pid: number;
        readonly name: string;
        readonly port: number | null;
      }>;
    }
);

const { listeners } = vi.hoisted(() => ({ listeners: new Array<Listener>() }));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (_event: string, callback: Listener) => {
    listeners.push(callback);
    return () => undefined;
  }),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { resetStorySpies, storySpies, stubStoryInvoke } from '../../store/storyHarness';
import { runTurn } from './turn';
import { TURN_END_MS } from './turnEndGrace';

const RUN_ID = brandId<ProviderRunId>({ value: 'run-harborline-scout' });

const initLine = (sessionId: string): string =>
  JSON.stringify({ type: 'system', subtype: 'init', session_id: sessionId });

const textLine = (text: string): string =>
  JSON.stringify({
    type: 'assistant',
    message: { id: `msg-${text.length}`, content: [{ type: 'text', text }] },
  });

const resultLine = (outputTokens: number): string =>
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    usage: { input_tokens: outputTokens === 0 ? 0 : 54, output_tokens: outputTokens },
  });

const emit = (envelope: Envelope): void => {
  for (const listener of listeners) {
    listener({ payload: envelope });
  }
};

const emitLine = (line: string): void => emit({ runId: RUN_ID, type: 'line', line });

const emitEnd = (): void => emit({ runId: RUN_ID, type: 'end', exit_code: 0, stderr: '' });

const startTurn = () => {
  const seen: TurnEvent[] = [];
  const outcome: { isFinished: boolean; error: unknown } = { isFinished: false, error: null };
  const finished = (async () => {
    try {
      for await (const event of runTurn({
        runId: RUN_ID,
        provider: 'anthropic',
        model: 'claude-sonnet-5-5',
        workingDir: '/tmp/harborline',
        writableRoots: [],
        prompt: 'scout the ledger-core pages',
      })) {
        seen.push(event);
      }
    } catch (error) {
      outcome.error = error;
    }
    outcome.isFinished = true;
  })();
  return { seen, outcome, finished };
};

const calledCommands = (): ReadonlyArray<string> =>
  storySpies.tauriInvoke.mock.calls.map((call) => String(call[0]));

beforeEach(() => {
  vi.useFakeTimers();
  resetStorySpies();
  stubStoryInvoke({
    turn_spawn: () => RUN_ID,
    turn_cancel: () => undefined,
    turn_release: () => undefined,
  });
});

afterEach(() => {
  vi.useRealTimers();
  listeners.length = 0;
});

describe('a provider process that stays alive after its result', () => {
  it('ends the turn after the grace period and stops the process', async () => {
    const turn = startTurn();
    await vi.advanceTimersByTimeAsync(0);
    emitLine(initLine('session-1'));
    emitLine(textLine('Scouting done.\n<<handoff kind=planner reason="plan the fix">>\n'));
    emitLine(textLine('<<step-done id="agent-harborline-scout">>'));
    emitLine(resultLine(12755));
    await vi.advanceTimersByTimeAsync(TURN_END_MS.grace - 1);
    expect(turn.outcome.isFinished).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(calledCommands()).toContain('turn_cancel');
    emit({
      runId: RUN_ID,
      type: 'reaped',
      stopped: [{ pid: 4242, name: 'notify-relay', port: 4100 }],
    });
    emitEnd();
    await turn.finished;

    expect(turn.outcome.error).toBeNull();
    expect(turn.seen.map((event) => event.kind)).toEqual([
      'provider_session_init',
      'assistant_text',
      'assistant_text',
      'usage',
      'done',
      'processes_stopped',
    ]);
    expect(calledCommands()).toContain('turn_release');
  });

  it('ends the turn even when the process never reports its end', async () => {
    const turn = startTurn();
    await vi.advanceTimersByTimeAsync(0);
    emitLine(initLine('session-1'));
    emitLine(textLine('All done.'));
    emitLine(resultLine(9));
    await vi.advanceTimersByTimeAsync(TURN_END_MS.grace + TURN_END_MS.force);
    await turn.finished;

    expect(turn.outcome.error).toBeNull();
    expect(turn.seen.at(-1)?.kind).toBe('done');
    expect(calledCommands()).toContain('turn_release');
  });

  it('keeps reading when the process starts another turn after the result', async () => {
    const turn = startTurn();
    await vi.advanceTimersByTimeAsync(0);
    emitLine(initLine('session-1'));
    emitLine(resultLine(0));
    await vi.advanceTimersByTimeAsync(5);
    emitLine(initLine('session-1'));
    emitLine(textLine('The background search was stopped.'));
    await vi.advanceTimersByTimeAsync(TURN_END_MS.grace * 2);
    expect(calledCommands()).not.toContain('turn_cancel');
    emitLine(resultLine(287));
    emitEnd();
    await turn.finished;

    expect(turn.seen.map((event) => event.kind)).toEqual([
      'provider_session_init',
      'usage',
      'done',
      'provider_session_init',
      'assistant_text',
      'usage',
      'done',
    ]);
    expect(calledCommands()).not.toContain('turn_cancel');
  });

  it('does not stop a process that exits on its own', async () => {
    const turn = startTurn();
    await vi.advanceTimersByTimeAsync(0);
    emitLine(initLine('session-1'));
    emitLine(textLine('Short answer.'));
    emitLine(resultLine(9));
    emitEnd();
    await turn.finished;
    await vi.advanceTimersByTimeAsync(TURN_END_MS.grace * 2);

    expect(calledCommands()).not.toContain('turn_cancel');
    expect(calledCommands()).toContain('turn_release');
  });
});
