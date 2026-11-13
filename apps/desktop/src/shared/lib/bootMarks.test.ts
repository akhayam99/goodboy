// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOOT_MARK_NAMES } from './bootMarkNames';
import { formatBootReport } from './formatBootReport';

const invokeCommand = vi.fn(async (..._args: ReadonlyArray<unknown>) => undefined);

vi.mock('./invokeCommand', () => ({
  invokeCommand: (...args: ReadonlyArray<unknown>) => invokeCommand(...args),
}));

type BootMarksModule = typeof import('./bootMarks');

type PerfSeamModule = typeof import('./perfSeam');

let markBoot: BootMarksModule['markBoot'];
let perfSeam: PerfSeamModule['perfSeam'];

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  performance.clearMarks();
  invokeCommand.mockClear();
  vi.resetModules();
  ({ markBoot } = await import('./bootMarks'));
  ({ perfSeam } = await import('./perfSeam'));
});

afterEach(() => {
  perfSeam.counter = null;
  vi.useRealTimers();
});

describe('formatBootReport', () => {
  it('writes one name=ms token for each mark, rounded', () => {
    expect(
      formatBootReport({
        marks: [
          { name: 'script', ms: 12.4 },
          { name: 'ready', ms: 840.6 },
        ],
      }),
    ).toBe('script=12,ready=841');
  });

  it('never writes a negative number', () => {
    expect(formatBootReport({ marks: [{ name: 'script', ms: -3 }] })).toBe('script=0');
  });

  it('names only marks the host accepts', () => {
    expect(BOOT_MARK_NAMES).toContain('splash');
    expect(BOOT_MARK_NAMES.every((name) => /^[a-z-]+$/.test(name))).toBe(true);
  });
});

describe('markBoot', () => {
  it('keeps the first time a mark was taken', () => {
    markBoot({ name: 'ready' });
    const first = performance.getEntriesByName('launch.ready')[0];

    markBoot({ name: 'ready' });

    expect(performance.getEntriesByName('launch.ready')).toEqual([first]);
  });

  it('counts a mark through the seam only when one is installed', () => {
    const counted: Array<string | undefined> = [];
    perfSeam.counter = ({ name, detail }) => {
      if (name === 'boot-mark') {
        counted.push(detail);
      }
    };

    markBoot({ name: 'migrating' });

    expect(counted).toEqual(['migrating']);
  });

  it('sends one line when the splash is gone and the board has sessions', () => {
    markBoot({ name: 'script' });
    markBoot({ name: 'board' });
    expect(invokeCommand).not.toHaveBeenCalled();

    markBoot({ name: 'splash' });

    expect(invokeCommand).toHaveBeenCalledTimes(1);
    expect(invokeCommand.mock.calls[0]?.[0]).toBe('boot_breadcrumb');
    expect(invokeCommand.mock.calls[0]?.[1]).toMatchObject({ phase: 'marks' });
    expect(invokeCommand.mock.calls[0]?.[1]).toMatchObject({
      detail: expect.stringMatching(/^script=\d+,board=\d+,splash=\d+$/),
    });
    markBoot({ name: 'board' });
    vi.advanceTimersByTime(20_000);
    expect(invokeCommand).toHaveBeenCalledTimes(1);
  });

  it('sends the line without the board when it never shows sessions', () => {
    markBoot({ name: 'splash' });
    expect(invokeCommand).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);

    expect(invokeCommand).toHaveBeenCalledTimes(1);
    expect(invokeCommand.mock.calls[0]?.[1]).toMatchObject({
      detail: expect.stringMatching(/^splash=\d+$/),
    });
  });
});
