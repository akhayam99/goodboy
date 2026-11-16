import type { InboxProvider } from '../../../../inbox/types';
import { integrationLabel } from '../../../../../shared/utils/integrationLabel';
import { START_KIND_COPY } from '../../../startKind/startKindCopy';

type ProvidersParams = {
  readonly providers: ReadonlyArray<InboxProvider>;
};

type ProviderParams = {
  readonly provider: InboxProvider | 'all';
};

type QueryParams = {
  readonly query: string;
};

const LIST = new Intl.ListFormat('en', { type: 'conjunction' });

export const TASK_PICKER_COPY = {
  sources: 'Task sources',
  list: 'Tasks',
  all: 'All',
  loading: 'Loading tasks',
  retry: 'Retry',
  failed: ({ providers }: ProvidersParams) =>
    `Couldn't load ${LIST.format(providers.map((provider) => integrationLabel({ provider })))} tasks`,
  sourceFailed: "Didn't load",
  empty: ({ provider }: ProviderParams) =>
    provider === 'all'
      ? START_KIND_COPY.noTasks
      : `No open ${integrationLabel({ provider })} tasks`,
  noMatch: ({ query }: QueryParams) => `No task matches "${query}"`,
} as const;
