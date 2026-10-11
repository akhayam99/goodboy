// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners = vi.hoisted(() => new Map<string, (event: { payload: unknown }) => void>());

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    listeners.set(name, handler);
    return () => undefined;
  }),
}));

import { terminalOutputBus } from './outputBus';

type EmitParams = {
  readonly terminalId: string;
  readonly text: string;
  readonly offset: number;
};

const emit = ({ terminalId, text, offset }: EmitParams): void => {
  listeners.get('terminal-output')?.({
    payload: { sessionId: terminalId, data: btoa(text), offset },
  });
};

beforeEach(() => {
  terminalOutputBus.forget({ terminalId: 'bus-1' });
});

describe('terminal output bus', () => {
  it('keeps the last 256KB of a terminal and the offset of its first byte', async () => {
    await terminalOutputBus.register();
    const block = 'x'.repeat(1024);
    for (let index = 0; index < 1024; index++) {
      emit({ terminalId: 'bus-1', text: block, offset: index * 1024 });
    }

    const tail = terminalOutputBus.tailOf({ terminalId: 'bus-1' });

    expect(tail?.bytes.length).toBe(262_144);
    expect(tail?.offset).toBe(1_048_576 - 262_144);
  });

  it('delivers only to subscribers of that terminal and stops after unsubscribe', async () => {
    await terminalOutputBus.register();
    const mine = vi.fn();
    const other = vi.fn();
    const stop = terminalOutputBus.subscribe({
      terminalId: 'bus-1',
      subscriber: { onOutput: mine },
    });
    terminalOutputBus.subscribe({ terminalId: 'bus-2', subscriber: { onOutput: other } });

    emit({ terminalId: 'bus-1', text: 'hi', offset: 0 });
    stop();
    emit({ terminalId: 'bus-1', text: 'again', offset: 2 });

    expect(mine).toHaveBeenCalledTimes(1);
    expect(mine.mock.calls[0]?.[0]).toMatchObject({ offset: 0 });
    expect(other).not.toHaveBeenCalled();
  });

  it('registers its listeners once however often it is asked', async () => {
    await terminalOutputBus.register();
    await terminalOutputBus.register();

    expect(listeners.size).toBe(2);
  });
});
