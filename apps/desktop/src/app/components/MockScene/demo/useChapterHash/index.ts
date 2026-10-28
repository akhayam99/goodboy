import { useCallback, useEffect, useState } from 'react';

type Params = {
  readonly ids: ReadonlyArray<string>;
  readonly fallbackId: string;
};

type SelectParams = {
  readonly id: string;
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
    const onHashChange = () => setChapterId(readHash({ ids, fallbackId }));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [ids, fallbackId]);

  const selectChapter = useCallback(({ id }: SelectParams) => {
    setChapterId(id);
    const url = `${window.location.pathname}${window.location.search}#${id}`;
    window.history.replaceState(window.history.state, '', url);
  }, []);

  return { chapterId, selectChapter };
};
