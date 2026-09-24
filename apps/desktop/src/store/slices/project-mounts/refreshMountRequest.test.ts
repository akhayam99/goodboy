import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from '../../slice-types';
import { refreshMountRequest, type MountRequestAdapter } from './refreshMountRequest';

const h = vi.hoisted(() => ({ revision: 1 }));

vi.mock('./mountRequests', () => ({
  mountRevision: () => h.revision,
  observeMountRequestTransition: vi.fn(),
  requestIdentityEquals: () => false,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

type Entry = {
  readonly loading: boolean;
  readonly value: string;
  readonly error: string | null;
};

type Context = {
  readonly ok: true;
};

type Box = { entry: Entry | undefined };

type Harness = {
  readonly state: Box;
  readonly set: SetFn;
  readonly get: GetFn;
};

const harness = (): Harness => {
  const state: Box = { entry: undefined };
  const store = {} as AppStore;
  return {
    state,
    get: () => store,
    set: (update) => {
      if (typeof update === 'function') {
        update(store);
      }
    },
  };
};

type Load = MountRequestAdapter<Entry, Context>['load'];

const adapterFor = ({
  state,
  load,
}: {
  readonly state: Box;
  readonly load: Load;
}): MountRequestAdapter<Entry, Context> => ({
  read: () => state.entry,
  apply: ({ entry }) => {
    state.entry = entry;
    return {};
  },
  resolveContext: () => ({ ok: true }),
  pendingEntry: ({ existing }) => ({
    loading: true,
    value: existing?.value ?? '',
    error: null,
  }),
  load,
  failedEntry: ({ current, error }) => ({ ...current, loading: false, error }),
});

const settleWith =
  ({ value }: { readonly value: string }): Load =>
  async () => ({
    kind: 'settle',
    next: (current) => (current === undefined ? null : { ...current, loading: false, value }),
  });

const MOUNT = { id: 'mount-1' as MountId, revision: 1 };
const SESSION = 'session-1' as SessionId;

describe('refreshMountRequest', () => {
  beforeEach(() => {
    h.revision = 1;
  });

  it('writes nothing when the mount revision changes mid-fetch', async () => {
    const { state, set, get } = harness();
    let resolveFetch: () => void = () => undefined;
    const fetched = new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });
    const adapter = adapterFor({
      state,
      load: async (params) => {
        await fetched;
        return settleWith({ value: 'new' })(params);
      },
    });
    const run = refreshMountRequest({ set, get, sessionId: SESSION, mount: MOUNT, adapter });
    expect(state.entry?.loading).toBe(true);
    h.revision = 2;
    resolveFetch();
    await run;
    expect(state.entry).toEqual({ loading: true, value: '', error: null });
  });

  it('settles the entry when the revision still matches', async () => {
    const { state, set, get } = harness();
    const adapter = adapterFor({ state, load: settleWith({ value: 'new' }) });
    await refreshMountRequest({ set, get, sessionId: SESSION, mount: MOUNT, adapter });
    expect(state.entry).toEqual({ loading: false, value: 'new', error: null });
  });

  it('clears the error on a silent failure and reports it otherwise', async () => {
    const failing: Load = async () => {
      throw new Error('rate limited');
    };
    const silent = harness();
    await refreshMountRequest({
      set: silent.set,
      get: silent.get,
      sessionId: SESSION,
      mount: MOUNT,
      opts: { silent: true },
      adapter: adapterFor({ state: silent.state, load: failing }),
    });
    expect(silent.state.entry).toEqual({ loading: false, value: '', error: null });
    const loud = harness();
    await refreshMountRequest({
      set: loud.set,
      get: loud.get,
      sessionId: SESSION,
      mount: MOUNT,
      adapter: adapterFor({ state: loud.state, load: failing }),
    });
    expect(loud.state.entry?.error).toContain('rate limited');
  });

  it('skips a refresh already loading unless forced', async () => {
    const { state, set, get } = harness();
    state.entry = { loading: true, value: 'old', error: null };
    const load = vi.fn<Load>(async () => ({ kind: 'stale' }));
    const adapter = adapterFor({ state, load });
    await refreshMountRequest({ set, get, sessionId: SESSION, mount: MOUNT, adapter });
    expect(load).not.toHaveBeenCalled();
    await refreshMountRequest({
      set,
      get,
      sessionId: SESSION,
      mount: MOUNT,
      opts: { force: true },
      adapter,
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retries a failed load up to the requested count', async () => {
    const { state, set, get } = harness();
    const load = vi
      .fn<Load>()
      .mockRejectedValueOnce(new Error('flaky'))
      .mockImplementationOnce(settleWith({ value: 'ok' }));
    await refreshMountRequest({
      set,
      get,
      sessionId: SESSION,
      mount: MOUNT,
      opts: { retries: 1 },
      adapter: adapterFor({ state, load }),
    });
    expect(load).toHaveBeenCalledTimes(2);
    expect(state.entry?.value).toBe('ok');
  });
});
