import { useCallback, useState } from 'react';

const NO_PENDING_REMOVALS: ReadonlySet<number> = new Set();

type NumberParams = {
  readonly number: number;
};

type PendingRemovals = {
  readonly pending: ReadonlySet<number>;
  readonly mark: (params: NumberParams) => void;
  readonly unmark: (params: NumberParams) => void;
  readonly clear: () => void;
};

export const usePendingRemovals = (): PendingRemovals => {
  const [pending, setPending] = useState<ReadonlySet<number>>(NO_PENDING_REMOVALS);
  const mark = useCallback(
    ({ number }: NumberParams) => setPending((current) => new Set(current).add(number)),
    [],
  );
  const unmark = useCallback(
    ({ number }: NumberParams) =>
      setPending((current) => {
        const next = new Set(current);
        next.delete(number);
        return next;
      }),
    [],
  );
  const clear = useCallback(() => setPending(NO_PENDING_REMOVALS), []);
  return { pending, mark, unmark, clear };
};
