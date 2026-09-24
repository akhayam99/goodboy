import { upsertMountPullRequestLink } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import type {
  MountId,
  MountPullRequestIdentity,
  MountPullRequestLink,
  ProjectId,
  SessionId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from '../../slice-types';
import {
  mountRevision,
  observeMountRequestTransition,
  requestIdentityEquals,
} from './mountRequests';

export type RefreshRequestOptions = {
  readonly force?: boolean;
  readonly silent?: boolean;
  readonly retries?: number;
};

export type RefreshOutcome<TEntry> =
  | { readonly kind: 'stale' }
  | {
      readonly kind: 'settle';
      readonly next: (current: TEntry | undefined) => TEntry | null;
      readonly after?: () => Promise<void>;
    };

type CurrentParams = {
  readonly isCurrent: () => boolean;
};

type EntryParams<TEntry, TContext> = {
  readonly existing: TEntry | undefined;
  readonly context: TContext;
};

type LoadingEntry = {
  readonly loading: boolean;
};

export type MountRequestAdapter<TEntry extends LoadingEntry, TContext> = {
  readonly read: (state: AppStore) => TEntry | undefined;
  readonly apply: (params: {
    readonly state: AppStore;
    readonly entry: TEntry;
  }) => Partial<AppStore>;
  readonly resolveContext: (params: CurrentParams) => Promise<TContext | null> | TContext;
  readonly pendingEntry: (params: EntryParams<TEntry, TContext>) => TEntry;
  readonly load: (
    params: EntryParams<TEntry, TContext> & CurrentParams,
  ) => Promise<RefreshOutcome<TEntry>>;
  readonly failedEntry: (params: {
    readonly current: TEntry;
    readonly error: string | null;
  }) => TEntry;
};

type MountRef = {
  readonly id: MountId;
  readonly revision: number;
};

type RefreshParams<TEntry extends LoadingEntry, TContext> = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mount: MountRef;
  readonly opts?: RefreshRequestOptions;
  readonly adapter: MountRequestAdapter<TEntry, TContext>;
};

export const refreshMountRequest = async <TEntry extends LoadingEntry, TContext>({
  set,
  get,
  sessionId,
  mount,
  opts,
  adapter,
}: RefreshParams<TEntry, TContext>): Promise<void> => {
  const existing = adapter.read(get());
  if (opts?.force !== true && existing?.loading === true) {
    return;
  }
  const isCurrent = (): boolean =>
    mountRevision({ state: get(), sessionId, mountId: mount.id }) === mount.revision;
  const resolved = adapter.resolveContext({ isCurrent });
  const context = resolved instanceof Promise ? await resolved : resolved;
  if (context === null) {
    return;
  }
  set((state) => adapter.apply({ state, entry: adapter.pendingEntry({ existing, context }) }));
  const maxAttempts = (opts?.retries ?? 0) + 1;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const outcome = await adapter.load({ existing, context, isCurrent });
      if (outcome.kind === 'stale' || !isCurrent()) {
        return;
      }
      set((state) => {
        const next = outcome.next(adapter.read(state));
        return next === null ? state : adapter.apply({ state, entry: next });
      });
      if (outcome.after !== undefined) {
        await outcome.after();
      }
      return;
    } catch (error) {
      lastError = error;
    }
  }
  if (!isCurrent()) {
    return;
  }
  set((state) => {
    const current = adapter.read(state);
    if (current === undefined) {
      return state;
    }
    return adapter.apply({
      state,
      entry: adapter.failedEntry({
        current,
        error: opts?.silent === true ? null : formatError(lastError),
      }),
    });
  });
};

type ItemParams<TItem> = {
  readonly item: TItem;
};

type SyncLinksParams<TItem> = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly storedLinks: ReadonlyArray<MountPullRequestLink>;
  readonly items: ReadonlyArray<TItem>;
  readonly identity: (params: ItemParams<TItem>) => MountPullRequestIdentity;
  readonly toLink: (
    params: ItemParams<TItem> & { readonly previous: MountPullRequestLink | null },
  ) => MountPullRequestLink;
  readonly describe: (params: ItemParams<TItem>) => {
    readonly title: string;
    readonly url: string;
  };
};

export const syncRequestLinks = async <TItem>({
  get,
  sessionId,
  projectId,
  storedLinks,
  items,
  identity,
  toLink,
  describe,
}: SyncLinksParams<TItem>): Promise<ReadonlyArray<MountPullRequestLink>> => {
  const nextLinks = [...storedLinks];
  for (const item of items) {
    const wanted = identity({ item });
    const previous =
      storedLinks.find((link) => requestIdentityEquals({ identity: wanted, candidate: link })) ??
      null;
    const link = toLink({ item, previous });
    await upsertMountPullRequestLink({ db: tauriDatabase, sessionId, link });
    const index = nextLinks.findIndex((candidate) =>
      requestIdentityEquals({ identity: link, candidate }),
    );
    if (index >= 0) {
      nextLinks.splice(index, 1, link);
    }
    if (index < 0) {
      nextLinks.push(link);
    }
    await observeMountRequestTransition({
      get,
      sessionId,
      projectId,
      previous,
      next: link,
      ...describe({ item }),
    });
  }
  return nextLinks;
};

type MergeParams<TItem> = {
  readonly fetched: ReadonlyArray<TItem>;
  readonly links: ReadonlyArray<MountPullRequestLink>;
  readonly fromLink: (params: { readonly link: MountPullRequestLink }) => TItem | null;
  readonly key: (params: ItemParams<TItem>) => string | number;
};

export const mergeLinkedRequests = <TItem>({
  fetched,
  links,
  fromLink,
  key,
}: MergeParams<TItem>): ReadonlyArray<TItem> => {
  const merged: Array<TItem> = [...fetched];
  for (const link of links) {
    const request = fromLink({ link });
    if (request === null) {
      continue;
    }
    const requestKey = key({ item: request });
    if (!merged.some((candidate) => key({ item: candidate }) === requestKey)) {
      merged.push(request);
    }
  }
  return merged;
};
