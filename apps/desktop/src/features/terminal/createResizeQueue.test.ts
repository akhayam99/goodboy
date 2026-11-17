import { describe, expect, it, vi } from 'vitest';
import { createResizeQueue } from './createResizeQueue';

type Size = {
  readonly cols: number;
  readonly rows: number;
};

type Held = {
  readonly size: Size;
  readonly settle: (isOk: boolean) => void;
};

const CELL_PX = 7.8;

const heldSends = () => {
  const held: Held[] = [];
  const send = vi.fn(
    (size: Size) =>
      new Promise<void>((resolve, reject) => {
        held.push({
          size,
          settle: (isOk) => {
            if (isOk) {
              resolve();
              return;
            }
            reject(new Error('terminal gone'));
          },
        });
      }),
  );
  return { held, send };
};

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('createResizeQueue', () => {
  it('skips a size the terminal already has', async () => {
    const send = vi.fn(async () => undefined);
    const queue = createResizeQueue({ send });

    queue.push({ cols: 80, rows: 24 });
    await settle();
    queue.push({ cols: 80, rows: 24 });
    await settle();

    expect(send).toHaveBeenCalledOnce();
  });

  it('drops a measure that a newer one replaced while a resize was in flight', async () => {
    const { held, send } = heldSends();
    const queue = createResizeQueue({ send });

    queue.push({ cols: 80, rows: 24 });
    queue.push({ cols: 90, rows: 24 });
    queue.push({ cols: 100, rows: 24 });
    held[0]?.settle(true);
    await settle();
    held[1]?.settle(true);
    await settle();

    expect(send.mock.calls.map(([size]) => size)).toEqual([
      { cols: 80, rows: 24 },
      { cols: 100, rows: 24 },
    ]);
  });

  it('sends the size again after a failed resize', async () => {
    const { held, send } = heldSends();
    const queue = createResizeQueue({ send });

    queue.push({ cols: 80, rows: 24 });
    held[0]?.settle(false);
    await settle();
    queue.push({ cols: 80, rows: 24 });
    await settle();

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('sends one resize per cell a slow drag crosses, and fewer while the host is busy', async () => {
    const frames = Array.from({ length: 60 }, (_, index) => 720 - index * 5);
    const quick = vi.fn(async () => undefined);
    const quickQueue = createResizeQueue({ send: quick });
    for (const width of frames) {
      quickQueue.push({ cols: Math.floor(width / CELL_PX), rows: 40 });
      await settle();
    }
    const { held, send: busy } = heldSends();
    const busyQueue = createResizeQueue({ send: busy });
    for (const [index, width] of frames.entries()) {
      busyQueue.push({ cols: Math.floor(width / CELL_PX), rows: 40 });
      if (index % 2 === 1) {
        held.at(-1)?.settle(true);
        await settle();
      }
    }

    expect(quick).toHaveBeenCalledTimes(39);
    expect(busy).toHaveBeenCalledTimes(31);
    expect(busy.mock.calls.at(-1)?.[0]).toEqual({
      cols: Math.floor((frames.at(-1) ?? 0) / CELL_PX),
      rows: 40,
    });
  });
});
