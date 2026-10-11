import { useCallback, useEffect, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { ReviewBases } from '../types';

type Params = {
  readonly load: (() => Promise<ReviewBases>) | null;
  readonly onDefault: (branch: string) => void;
};

type Result = {
  readonly branches: ReadonlyArray<string>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly retry: () => void;
};

export const useCreateReviewBases = ({ load, onDefault }: Params): Result => {
  const [branches, setBranches] = useState<ReadonlyArray<string>>([]);
  const [isLoading, setIsLoading] = useState(load !== null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    const mine = generation.current;
    if (load === null) {
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    load().then(
      ({ defaultBranch, branches: list }) => {
        if (generation.current !== mine) {
          return;
        }
        setBranches(list);
        setIsLoading(false);
        if (defaultBranch !== null) {
          onDefault(defaultBranch);
        }
      },
      (failure: unknown) => {
        if (generation.current !== mine) {
          return;
        }
        setBranches([]);
        setError(formatError(failure));
        setIsLoading(false);
      },
    );
    return () => {
      generation.current += 1;
    };
  }, [load, onDefault, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return { branches, isLoading, error, retry };
};
