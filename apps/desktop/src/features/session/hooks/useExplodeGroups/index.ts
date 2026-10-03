import { useCallback, useState } from 'react';

const NO_IDS: ReadonlySet<string> = new Set();

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const without = ({ ids, id }: { readonly ids: ReadonlySet<string>; readonly id: string }) => {
  if (!ids.has(id)) {
    return ids;
  }
  const next = new Set(ids);
  next.delete(id);
  return next;
};

const withId = ({ ids, id }: { readonly ids: ReadonlySet<string>; readonly id: string }) =>
  ids.has(id) ? ids : new Set(ids).add(id);

type IdParams = {
  readonly id: string;
};

export type ExplodeGroups = {
  readonly expandedIds: ReadonlySet<string>;
  readonly leavingIds: ReadonlySet<string>;
  readonly fullIds: ReadonlySet<string>;
  readonly set: (params: { readonly id: string; readonly isExpanded: boolean }) => void;
  readonly showAll: (params: IdParams) => void;
  readonly settle: (params: IdParams) => void;
};

export const useExplodeGroups = (): ExplodeGroups => {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(NO_IDS);
  const [leavingIds, setLeavingIds] = useState<ReadonlySet<string>>(NO_IDS);
  const [fullIds, setFullIds] = useState<ReadonlySet<string>>(NO_IDS);

  const fold = useCallback(({ id }: IdParams) => {
    setLeavingIds((current) => without({ ids: current, id }));
    setExpandedIds((current) => without({ ids: current, id }));
    setFullIds((current) => without({ ids: current, id }));
  }, []);

  const set = useCallback(
    ({ id, isExpanded }: { readonly id: string; readonly isExpanded: boolean }) => {
      if (isExpanded) {
        setLeavingIds((current) => without({ ids: current, id }));
        setExpandedIds((current) => withId({ ids: current, id }));
        return;
      }
      if (prefersReducedMotion()) {
        fold({ id });
        return;
      }
      setLeavingIds((current) => withId({ ids: current, id }));
    },
    [fold],
  );

  const showAll = useCallback(({ id }: IdParams) => {
    setFullIds((current) => withId({ ids: current, id }));
  }, []);

  return { expandedIds, leavingIds, fullIds, set, showAll, settle: fold };
};
