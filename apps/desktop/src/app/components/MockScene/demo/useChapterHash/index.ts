import { useCallback, useEffect, useState } from 'react';
import type { DemoChapter } from '../demoChapters';

type Params = {
  readonly chapters: ReadonlyArray<DemoChapter>;
};

type SelectParams = {
  readonly id: string;
};

type ChapterHash = {
  readonly chapterId: string;
  readonly selectChapter: (params: SelectParams) => void;
};

type ReadParams = {
  readonly chapters: ReadonlyArray<DemoChapter>;
};

const readHash = ({ chapters }: ReadParams): string => {
  const wanted = window.location.hash.replace(/^#/, '');
  const match = chapters.find((chapter) => chapter.id === wanted);
  if (match !== undefined) {
    return match.id;
  }
  return chapters[0]?.id ?? '';
};

export const useChapterHash = ({ chapters }: Params): ChapterHash => {
  const [chapterId, setChapterId] = useState(() => readHash({ chapters }));

  useEffect(() => {
    const onHashChange = () => setChapterId(readHash({ chapters }));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [chapters]);

  const selectChapter = useCallback(({ id }: SelectParams) => {
    setChapterId(id);
    const url = `${window.location.pathname}${window.location.search}#${id}`;
    window.history.replaceState(window.history.state, '', url);
  }, []);

  return { chapterId, selectChapter };
};
