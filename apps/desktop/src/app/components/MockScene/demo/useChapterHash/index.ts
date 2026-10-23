import { useCallback, useEffect, useState } from 'react';
import type { DemoChapter } from '../demoChapters';

type Params = {
  readonly chapters: ReadonlyArray<DemoChapter>;
  readonly fallbackId: string;
};

type SelectParams = {
  readonly id: string;
};

type ChapterHash = {
  readonly chapterId: string;
  readonly selectChapter: (params: SelectParams) => void;
};

const readHash = ({ chapters, fallbackId }: Params): string => {
  const wanted = window.location.hash.replace(/^#/, '');
  const match =
    chapters.find((chapter) => chapter.id === wanted) ??
    chapters.find((chapter) => chapter.id === fallbackId);
  return match?.id ?? chapters[0]?.id ?? '';
};

export const useChapterHash = ({ chapters, fallbackId }: Params): ChapterHash => {
  const [chapterId, setChapterId] = useState(() => readHash({ chapters, fallbackId }));

  useEffect(() => {
    const onHashChange = () => setChapterId(readHash({ chapters, fallbackId }));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [chapters, fallbackId]);

  const selectChapter = useCallback(({ id }: SelectParams) => {
    setChapterId(id);
    const url = `${window.location.pathname}${window.location.search}#${id}`;
    window.history.replaceState(window.history.state, '', url);
  }, []);

  return { chapterId, selectChapter };
};
