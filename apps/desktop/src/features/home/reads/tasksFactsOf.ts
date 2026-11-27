import type { InboxProvider } from '../../inbox/types';

export type TaskSource = {
  readonly provider: InboxProvider;
  readonly newCount: number;
};

type Params = {
  readonly newKeys: ReadonlyArray<string>;
  readonly connected: ReadonlyArray<InboxProvider>;
};

export type TasksFacts = {
  readonly newCount: number;
  readonly sources: ReadonlyArray<TaskSource>;
};

export const tasksFactsOf = ({ newKeys, connected }: Params): TasksFacts => ({
  newCount: newKeys.length,
  sources: connected.map((provider) => ({
    provider,
    newCount: newKeys.filter((key) => key.startsWith(`${provider}:`)).length,
  })),
});
