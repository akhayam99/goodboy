// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParseDiffRequest, ParseDiffResponse } from './parseDiffProtocol';

const PATCH = [
  'diff --git a/ledger.ts b/ledger.ts',
  'index 1111111..2222222 100644',
  '--- a/ledger.ts',
  '+++ b/ledger.ts',
  '@@ -1 +1 @@',
  '-before',
  '+after',
  '',
].join('\n');

type FakeWorkerHandle = {
  onmessage: ((event: MessageEvent<ParseDiffResponse>) => void) | null;
  onerror: (() => void) | null;
  readonly posted: ParseDiffRequest[];
};

const loadFresh = async () => {
  vi.resetModules();
  return (await import('./parseDiffAsync')).parseDiffAsync;
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseDiffAsync', () => {
  it('parses on the main thread when there is no worker', async () => {
    vi.stubGlobal('Worker', undefined);
    const parseDiffAsync = await loadFresh();

    const files = await parseDiffAsync({ raw: PATCH });

    expect(files.map((file) => [file.path, file.additions, file.deletions])).toEqual([
      ['ledger.ts', 1, 1],
    ]);
  });

  it('hands the text to the worker and resolves with its answer', async () => {
    const handles: FakeWorkerHandle[] = [];
    vi.stubGlobal(
      'Worker',
      class {
        onmessage: FakeWorkerHandle['onmessage'] = null;
        onerror: FakeWorkerHandle['onerror'] = null;
        readonly posted: ParseDiffRequest[] = [];
        constructor() {
          handles.push(this);
        }
        postMessage(request: ParseDiffRequest) {
          this.posted.push(request);
        }
        terminate() {}
      },
    );
    const parseDiffAsync = await loadFresh();

    const pending = parseDiffAsync({ raw: PATCH });
    const worker = handles[0];
    expect(worker?.posted).toEqual([{ id: 0, raw: PATCH }]);
    worker?.onmessage?.(
      new MessageEvent<ParseDiffResponse>('message', {
        data: {
          id: 0,
          files: [
            {
              path: 'from-worker.ts',
              status: 'modified',
              additions: 0,
              deletions: 0,
              binary: false,
              hunks: [],
            },
          ],
        },
      }),
    );

    expect((await pending).map((file) => file.path)).toEqual(['from-worker.ts']);
  });

  it('parses on the main thread what the worker could not, and after it breaks', async () => {
    const handles: FakeWorkerHandle[] = [];
    vi.stubGlobal(
      'Worker',
      class {
        onmessage: FakeWorkerHandle['onmessage'] = null;
        onerror: FakeWorkerHandle['onerror'] = null;
        readonly posted: ParseDiffRequest[] = [];
        constructor() {
          handles.push(this);
        }
        postMessage(request: ParseDiffRequest) {
          this.posted.push(request);
        }
        terminate() {}
      },
    );
    const parseDiffAsync = await loadFresh();

    const refused = parseDiffAsync({ raw: PATCH });
    handles[0]?.onmessage?.(
      new MessageEvent<ParseDiffResponse>('message', { data: { id: 0, files: null } }),
    );
    expect((await refused).map((file) => file.path)).toEqual(['ledger.ts']);

    const lost = parseDiffAsync({ raw: PATCH });
    handles[0]?.onerror?.();
    expect((await lost).map((file) => file.path)).toEqual(['ledger.ts']);

    const after = await parseDiffAsync({ raw: PATCH });
    expect(after.map((file) => file.path)).toEqual(['ledger.ts']);
    expect(handles[0]?.posted).toHaveLength(2);
  });

  it('rejects a missing text and never posts it to the worker', async () => {
    const handles: FakeWorkerHandle[] = [];
    vi.stubGlobal(
      'Worker',
      class {
        onmessage: FakeWorkerHandle['onmessage'] = null;
        onerror: FakeWorkerHandle['onerror'] = null;
        readonly posted: ParseDiffRequest[] = [];
        constructor() {
          handles.push(this);
        }
        postMessage(request: ParseDiffRequest) {
          this.posted.push(request);
        }
        terminate() {}
      },
    );
    const parseDiffAsync = await loadFresh();
    const missing: unknown = JSON.parse('null');
    const raw = typeof missing === 'string' ? missing : Reflect.get({}, 'raw');

    await expect(parseDiffAsync({ raw })).rejects.toThrow('The diff text is missing');
    expect(handles).toHaveLength(0);
  });

  it('ignores a null reply from the worker without throwing', async () => {
    const handles: FakeWorkerHandle[] = [];
    vi.stubGlobal(
      'Worker',
      class {
        onmessage: FakeWorkerHandle['onmessage'] = null;
        onerror: FakeWorkerHandle['onerror'] = null;
        readonly posted: ParseDiffRequest[] = [];
        constructor() {
          handles.push(this);
        }
        postMessage(request: ParseDiffRequest) {
          this.posted.push(request);
        }
        terminate() {}
      },
    );
    const parseDiffAsync = await loadFresh();

    const pending = parseDiffAsync({ raw: PATCH });
    const handler = handles[0]?.onmessage;

    const nothing = new MessageEvent<ParseDiffResponse>('message', {
      data: Reflect.get({}, 'reply'),
    });

    expect(() => handler?.(nothing)).not.toThrow();
    handler?.(new MessageEvent<ParseDiffResponse>('message', { data: { id: 0, files: null } }));

    expect((await pending).map((file) => file.path)).toEqual(['ledger.ts']);
  });
});
