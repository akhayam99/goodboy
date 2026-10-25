import type { ProviderRunId } from '@goodboy/types';

type Params = {
  readonly history: ReadonlyArray<ProviderRunId>;
  readonly routing: Readonly<Record<string, { readonly provider: string }>>;
  readonly provider: string;
};

export const movedProviderOf = ({ history, routing, provider }: Params): boolean => {
  const previousRunId = history.at(-2);
  if (previousRunId === undefined) {
    return false;
  }
  const previous = routing[previousRunId]?.provider;
  return previous !== undefined && previous !== provider;
};
