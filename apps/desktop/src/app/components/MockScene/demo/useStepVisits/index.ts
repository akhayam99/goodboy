import { useCallback, useEffect, useRef, useState } from 'react';
import { readStepVisits } from '../hints/readStepVisits';
import { writeStepVisits } from '../hints/writeStepVisits';
import type { StepVisits } from '../hints/stepVisitsTypes';

type Params = {
  readonly chapterId: string;
  readonly beatIndex: number;
};

export type StepVisitControls = {
  readonly visits: StepVisits;
  readonly clear: () => void;
};

const initial = (): StepVisits => readStepVisits({ fallback: {} });

export const useStepVisits = ({ chapterId, beatIndex }: Params): StepVisitControls => {
  const [visits, setVisits] = useState<StepVisits>(initial);
  const latest = useRef(visits);

  useEffect(() => {
    const stored = readStepVisits({ fallback: latest.current });
    const seen = stored[chapterId] ?? [];
    if (seen.includes(beatIndex)) {
      latest.current = stored;
      setVisits(stored);
      return;
    }
    const next = { ...stored, [chapterId]: [...seen, beatIndex] };
    writeStepVisits({ visits: next });
    latest.current = next;
    setVisits(next);
  }, [chapterId, beatIndex]);

  const clear = useCallback(() => {
    writeStepVisits({ visits: {} });
    latest.current = {};
    setVisits({});
  }, []);

  return { visits, clear };
};
