import { useCallback, useEffect, useState } from 'react';

type Params = {
  readonly ids: ReadonlyArray<string>;
  readonly fallbackId: string;
};

type SelectParams = {
  readonly id: string;
  readonly isRedirect?: boolean;
};

type ChapterHash = {
  readonly chapterId: string;
  readonly selectChapter: (params: SelectParams) => void;
};

const readHash = ({ ids, fallbackId }: Params): string => {
  const wanted = window.location.hash.replace(/^#/, '');
  return ids.find((id) => id === wanted) ?? ids.find((id) => id === fallbackId) ?? ids[0] ?? '';
};

export const useChapterHash = ({ ids, fallbackId }: Params): ChapterHash => {
  const [chapterId, setChapterId] = useState(() => readHash({ ids, fallbackId }));

  useEffect(() => {
    const listener = new AbortController();
    const onHistory = () => setChapterId(readHash({ ids, fallbackId }));
    window.addEventListener('hashchange', onHistory, { signal: listener.signal });
    window.addEventListener('popstate', onHistory, { signal: listener.signal });
    return () => listener.abort();
  }, [ids, fallbackId]);

  const selectChapter = useCallback(({ id, isRedirect = false }: SelectParams) => {
    setChapterId(id);
    const url = `${window.location.pathname}${window.location.search}#${id}`;
    if (isRedirect || window.location.hash === `#${id}`) {
      window.history.replaceState(window.history.state, '', url);
      return;
    }
    window.history.pushState(null, '', url);
  }, []);

  return { chapterId, selectChapter };
};
