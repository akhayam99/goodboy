import { useEffect, useRef, useState } from 'react';
import { GROUP_VISITS_KEY } from '../hints/groupVisitsKey';
import { readGroupVisits } from '../hints/readGroupVisits';
import { writeGroupVisits } from '../hints/writeGroupVisits';

type Params = {
  readonly chapterId: string;
};

const initial = (): ReadonlyArray<string> => readGroupVisits({ fallback: [] });

export const useGroupVisits = ({ chapterId }: Params): ReadonlyArray<string> => {
  const [visitedIds, setVisitedIds] = useState<ReadonlyArray<string>>(initial);
  const latest = useRef(visitedIds);

  useEffect(() => {
    const stored = readGroupVisits({ fallback: latest.current });
    const next = stored.includes(chapterId) ? stored : [...stored, chapterId];
    if (next !== stored) {
      writeGroupVisits({ visitedIds: next });
    }
    latest.current = next;
    setVisitedIds(next);
  }, [chapterId]);

  useEffect(() => {
    const listener = new AbortController();
    window.addEventListener(
      'storage',
      (event) => {
        if (event.key !== null && event.key !== GROUP_VISITS_KEY) {
          return;
        }
        const next = readGroupVisits({ fallback: latest.current });
        latest.current = next;
        setVisitedIds(next);
      },
      { signal: listener.signal },
    );
    return () => listener.abort();
  }, []);

  return visitedIds;
};
