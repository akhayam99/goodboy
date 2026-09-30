import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EXPLODE_OUT_MS,
  EXPLODE_OUT_STAGGER_MS,
  EXPLODE_SETTLE_MS,
} from '../../timeline/explodeTiming';

const NO_IDS: ReadonlySet<string> = new Set();

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const without = ({ ids, id }: { readonly ids: ReadonlySet<string>; readonly id: string }) => {
  const next = new Set(ids);
  next.delete(id);
  return next;
};

const withId = ({ ids, id }: { readonly ids: ReadonlySet<string>; readonly id: string }) =>
  new Set(ids).add(id);

export type ExplodeGroups = {
  readonly expandedIds: ReadonlySet<string>;
  readonly leavingIds: ReadonlySet<string>;
  readonly toggle: (params: { readonly id: string; readonly total: number }) => void;
  readonly set: (params: {
    readonly id: string;
    readonly isExpanded: boolean;
    readonly total: number;
  }) => void;
};

export const useExplodeGroups = (): ExplodeGroups => {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(NO_IDS);
  const [leavingIds, setLeavingIds] = useState<ReadonlySet<string>>(NO_IDS);
  const timers = useRef(new Map<string, number>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) {
        window.clearTimeout(timer);
      }
      pending.clear();
    };
  }, []);

  const clearTimer = useCallback(({ id }: { readonly id: string }) => {
    const timer = timers.current.get(id);
    if (timer === undefined) {
      return;
    }
    window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const expand = useCallback(
    ({ id }: { readonly id: string }) => {
      clearTimer({ id });
      setLeavingIds((current) => without({ ids: current, id }));
      setExpandedIds((current) => withId({ ids: current, id }));
    },
    [clearTimer],
  );

  const collapse = useCallback(
    ({ id, total }: { readonly id: string; readonly total: number }) => {
      clearTimer({ id });
      const finish = () => {
        timers.current.delete(id);
        setLeavingIds((current) => without({ ids: current, id }));
        setExpandedIds((current) => without({ ids: current, id }));
      };
      if (prefersReducedMotion()) {
        finish();
        return;
      }
      setLeavingIds((current) => withId({ ids: current, id }));
      timers.current.set(
        id,
        window.setTimeout(
          finish,
          EXPLODE_OUT_MS + total * EXPLODE_OUT_STAGGER_MS + EXPLODE_SETTLE_MS,
        ),
      );
    },
    [clearTimer],
  );

  const set = useCallback(
    ({
      id,
      isExpanded,
      total,
    }: {
      readonly id: string;
      readonly isExpanded: boolean;
      readonly total: number;
    }) => {
      if (isExpanded) {
        expand({ id });
        return;
      }
      collapse({ id, total });
    },
    [collapse, expand],
  );

  const toggle = useCallback(
    ({ id, total }: { readonly id: string; readonly total: number }) => {
      const isOpen = expandedIds.has(id) && !leavingIds.has(id);
      set({ id, isExpanded: !isOpen, total });
    },
    [expandedIds, leavingIds, set],
  );

  return { expandedIds, leavingIds, toggle, set };
};
