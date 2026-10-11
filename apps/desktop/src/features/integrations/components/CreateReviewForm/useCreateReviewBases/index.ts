import { useEffect, useState } from 'react';
import type { ReviewBases } from '../types';

type Params = {
  readonly load: (() => Promise<ReviewBases>) | null;
  readonly onDefault: (branch: string) => void;
};

type Result = {
  readonly branches: ReadonlyArray<string>;
  readonly isLoading: boolean;
};

export const useCreateReviewBases = ({ load, onDefault }: Params): Result => {
  const [branches, setBranches] = useState<ReadonlyArray<string>>([]);
  const [isLoading, setIsLoading] = useState(load !== null);

  useEffect(() => {
    if (load === null) {
      setIsLoading(false);
      return;
    }
    let isCancelled = false;
    setIsLoading(true);
    void load().then(({ defaultBranch, branches: list }) => {
      if (isCancelled) {
        return;
      }
      setBranches(list);
      setIsLoading(false);
      if (defaultBranch !== null) {
        onDefault(defaultBranch);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [load, onDefault]);

  return { branches, isLoading };
};
