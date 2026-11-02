// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type HighlightModule = typeof import('.');

const loadHighlight = async (): Promise<HighlightModule> => import('.');

class SilentWorker {
  static instances: Array<SilentWorker> = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly posted: Array<unknown> = [];
  isTerminated = false;

  constructor() {
    SilentWorker.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.isTerminated = true;
  }
}

class ThrowingWorker {
  constructor() {
    throw new Error('worker blocked');
  }
}

beforeEach(() => {
  vi.resetModules();
  SilentWorker.instances = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('highlightCode without a working worker', () => {
  it('resolves to plain text when the runtime has no Worker', async () => {
    vi.stubGlobal('Worker', undefined);
    const { highlightCode } = await loadHighlight();

    await expect(highlightCode('const ledger = 1;', 'typescript')).resolves.toBeNull();
  });

  it('resolves to plain text when the Worker cannot start', async () => {
    vi.stubGlobal('Worker', ThrowingWorker);
    const { highlightCode } = await loadHighlight();

    await expect(highlightCode('const notify = 2;', 'typescript')).resolves.toBeNull();
  });

  it('settles pending requests and stops posting once the worker errors', async () => {
    vi.stubGlobal('Worker', SilentWorker);
    const { highlightCode } = await loadHighlight();

    const pending = highlightCode('const payments = 3;', 'typescript');
    const worker = SilentWorker.instances[0];
    expect(worker?.posted.length).toBe(1);
    worker?.onerror?.(new Event('error'));

    await expect(pending).resolves.toBeNull();
    expect(worker?.isTerminated).toBe(true);
    await expect(highlightCode('const acme = 4;', 'typescript')).resolves.toBeNull();
    expect(worker?.posted.length).toBe(1);
  });
});
