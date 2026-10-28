import { useCallback, useEffect, useRef, useState } from 'react';
import { worktreeDepsCheck, type WorktreeDepsCheck } from '../../lib/worktreeDepsCheck';
import { depsFindingOf, type DepsFinding } from '../../utils/depsFinding';

type Params = {
  readonly worktreePath: string | null;
};

export type WorktreeDeps = {
  readonly check: WorktreeDepsCheck | null;
  readonly finding: DepsFinding | null;
  readonly recheck: () => void;
};

export const useWorktreeDeps = ({ worktreePath }: Params): WorktreeDeps => {
  const [check, setCheck] = useState<WorktreeDepsCheck | null>(null);
  const latest = useRef(0);

  const run = useCallback((): void => {
    latest.current += 1;
    const ticket = latest.current;
    if (worktreePath === null) {
      setCheck(null);
      return;
    }
    void worktreeDepsCheck({ worktreePath }).then(
      (next) => {
        if (latest.current === ticket) {
          setCheck(next);
        }
      },
      () => {
        if (latest.current === ticket) {
          setCheck(null);
        }
      },
    );
  }, [worktreePath]);

  useEffect(() => {
    setCheck(null);
    run();
    return () => {
      latest.current += 1;
    };
  }, [run]);

  return { check, finding: depsFindingOf({ check }), recheck: run };
};
