import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FileDiff } from '@goodboy/types';
import type { FileSides } from '../../../worktree/worktree';
import { contextGaps, type ContextExpansion } from '../../lib/contextGaps';

export type FileSidesLoader = (file: FileDiff) => Promise<FileSides>;
export type ExpandContextParams = {
  readonly index: number;
  readonly direction: 'up' | 'down' | 'all';
};

type Params = { readonly file: FileDiff; readonly load: FileSidesLoader | null };

type State = {
  readonly sides: FileSides | null;
  readonly expansions: ReadonlyMap<number, ContextExpansion>;
  readonly pending: ReadonlySet<number>;
  readonly errors: ReadonlyMap<number, ExpandContextParams['direction']>;
};

type UpdateParams = { readonly state: State };

type Request = {
  readonly file: FileDiff;
  readonly load: FileSidesLoader | null;
  isActive: boolean;
  promise: Promise<FileSides> | null;
  state: State;
};

export const useFileSides = ({ file, load }: Params) => {
  const [, render] = useState(0);
  const current = useRef<Request | null>(null);
  if (
    current.current === null ||
    current.current.file.hunks !== file.hunks ||
    current.current.file.path !== file.path ||
    current.current.load !== load
  ) {
    current.current = {
      file,
      load,
      isActive: true,
      promise: null,
      state: { sides: null, expansions: new Map(), pending: new Set(), errors: new Map() },
    };
  }
  const request = current.current;
  useEffect(() => {
    request.isActive = true;
    return () => {
      request.isActive = false;
    };
  }, [request]);
  const update = useCallback(
    ({ state }: UpdateParams) => {
      if (current.current !== request || !request.isActive) {
        return;
      }
      request.state = state;
      render((value) => value + 1);
    },
    [request],
  );
  const expand = useCallback(
    async ({ index, direction }: ExpandContextParams): Promise<void> => {
      if (request.load === null || !request.isActive) {
        return;
      }
      const pending = new Set(request.state.pending).add(index);
      const errors = new Map(request.state.errors);
      errors.delete(index);
      update({ state: { ...request.state, pending, errors } });
      try {
        request.promise ??= request.load(request.file);
        const sides = await request.promise;
        if (current.current !== request || !request.isActive) {
          return;
        }
        const gap = contextGaps({
          hunks: request.file.hunks,
          sides,
          expansions: request.state.expansions,
        })[index];
        const revealCount = gap?.revealCount ?? 0;
        const expansions = new Map(request.state.expansions);
        const previous = expansions.get(index) ?? { above: 0, below: 0, isAll: false };
        if (!sides.isTooLarge) {
          expansions.set(index, {
            above: previous.above + (direction === 'up' ? revealCount : 0),
            below: previous.below + (direction === 'down' ? revealCount : 0),
            isAll: previous.isAll || direction === 'all',
          });
        }
        const remaining = new Set(request.state.pending);
        remaining.delete(index);
        update({ state: { ...request.state, sides, expansions, pending: remaining } });
      } catch {
        if (current.current !== request || !request.isActive) {
          return;
        }
        request.promise = null;
        const remaining = new Set(request.state.pending);
        remaining.delete(index);
        update({
          state: {
            ...request.state,
            pending: remaining,
            errors: new Map(request.state.errors).set(index, direction),
          },
        });
      }
    },
    [request, update],
  );
  const expandAll = useCallback(async (): Promise<boolean> => {
    await expand({ index: request.file.hunks.length, direction: 'all' });
    if (
      current.current !== request ||
      !request.isActive ||
      request.state.sides === null ||
      request.state.sides.isTooLarge
    ) {
      return false;
    }
    const expansions = new Map(request.state.expansions);
    for (let index = 0; index <= request.file.hunks.length; index += 1) {
      expansions.set(index, { above: 0, below: 0, isAll: true });
    }
    update({ state: { ...request.state, expansions } });
    return true;
  }, [expand, request, update]);
  const { sides, expansions, pending, errors } = request.state;
  const gaps = useMemo(
    () => (load === null ? [] : contextGaps({ hunks: file.hunks, sides, expansions })),
    [expansions, file.hunks, load, sides],
  );
  return { gaps, sides, pending, errors, expand, expandAll };
};
