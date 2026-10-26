import { useCallback, useEffect, useRef, useState } from 'react';
import { readStepVisits } from '../hints/readStepVisits';
import { writeStepVisits } from '../hints/writeStepVisits';
import type { StepVisits } from '../hints/stepVisitsTypes';

type Params = {
  readonly chapterId: string;
  readonly beatIndex: number;
};

type RestartParams = Params;

export type StepVisitControls = {
  readonly visits: StepVisits;
  readonly restart: (params: RestartParams) => void;
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

  const restart = useCallback(
    ({ chapterId: restartId, beatIndex: restartIndex }: RestartParams) => {
      const next = { [restartId]: [restartIndex] };
      writeStepVisits({ visits: next });
      latest.current = next;
      setVisits(next);
    },
    [],
  );

  return { visits, restart };
};
