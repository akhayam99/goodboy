import { isSessionExternalTaskProvider, type SessionExternalTaskProvider } from '@goodboy/types';

type Params = {
  readonly detail: unknown;
};

export type LinkDetail = {
  readonly query: string;
  readonly source: SessionExternalTaskProvider | null;
};

export const linkDetailOf = ({ detail }: Params): LinkDetail => {
  if (typeof detail !== 'object' || detail === null) {
    return { query: '', source: null };
  }
  const query = 'query' in detail && typeof detail.query === 'string' ? detail.query : '';
  const source =
    'source' in detail && isSessionExternalTaskProvider(detail.source) ? detail.source : null;
  return { query, source };
};
