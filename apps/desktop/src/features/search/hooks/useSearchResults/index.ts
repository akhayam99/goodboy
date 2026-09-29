import { useEffect, useRef, useState } from 'react';
import type { SearchHit, SearchQuery } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const SEARCH_DEBOUNCE_MS = 120;

export type SearchResults = {
  readonly hits: ReadonlyArray<SearchHit>;
  readonly isLoading: boolean;
  readonly hasFailed: boolean;
};

type Params = {
  readonly query: SearchQuery;
};

const EMPTY: ReadonlyArray<SearchHit> = [];

export const useSearchResults = ({ query }: Params): SearchResults => {
  const runSearch = useAppStore((state) => state.runSearch);
  const [results, setResults] = useState<SearchResults>({
    hits: EMPTY,
    isLoading: true,
    hasFailed: false,
  });
  const latest = useRef(0);
  const key = JSON.stringify(query);

  useEffect(() => {
    const request = latest.current + 1;
    latest.current = request;
    setResults((previous) => ({ ...previous, isLoading: true }));
    const timer = window.setTimeout(() => {
      runSearch({ query })
        .then((hits) => {
          if (latest.current === request) {
            setResults({ hits, isLoading: false, hasFailed: false });
          }
        })
        .catch(() => {
          if (latest.current === request) {
            setResults({ hits: EMPTY, isLoading: false, hasFailed: true });
          }
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [key, runSearch]);

  return results;
};
