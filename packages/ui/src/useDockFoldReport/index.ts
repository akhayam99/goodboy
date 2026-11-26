import { useEffect, useRef } from 'react';
import type { DockGridColumnBox } from '../dockGridColumnBox';

export type DockFolded = {
  readonly key: string;
  readonly into: string;
};

export type DockFold = {
  readonly opened: string;
  readonly folds: ReadonlyArray<DockFolded>;
};

type Params = {
  readonly scope?: string;
  readonly keys: ReadonlyArray<string>;
  readonly columns: ReadonlyArray<DockGridColumnBox>;
  readonly chosen?: ReadonlyArray<string>;
  readonly onFold: ((fold: DockFold) => void) | undefined;
};

type Memory = {
  readonly scope: string | undefined;
  readonly keys: ReadonlyArray<string>;
  readonly folded: ReadonlySet<string>;
};

export const useDockFoldReport = ({ scope, keys, columns, chosen = [], onFold }: Params): void => {
  const memory = useRef<Memory | null>(null);
  const folds = columns
    .flatMap((column) => column.panes)
    .flatMap((pane) =>
      (pane.tabs ?? [])
        .filter((tab) => tab !== pane.key && !chosen.includes(tab))
        .map((key) => ({ key, into: pane.key })),
    );
  const latest = useRef({ scope, keys, folds, onFold });
  latest.current = { scope, keys, folds, onFold };
  const keyList = keys.join('/');
  const foldList = folds.map((fold) => `${fold.key}>${fold.into}`).join('/');
  useEffect(() => {
    const { scope: scopeNow, keys: now, folds: current, onFold: report } = latest.current;
    const previous = memory.current;
    memory.current = {
      scope: scopeNow,
      keys: now,
      folded: new Set(current.map((fold) => fold.key)),
    };
    if (previous === null || previous.scope !== scopeNow || report === undefined) {
      return;
    }
    const opened = now.filter((key) => !previous.keys.includes(key));
    const [first] = opened;
    const isOnlyAdded = opened.length === 1 && previous.keys.every((key) => now.includes(key));
    const fresh = current.filter((fold) => !previous.folded.has(fold.key));
    if (isOnlyAdded && first !== undefined && fresh.length > 0) {
      report({ opened: first, folds: fresh });
    }
  }, [scope, keyList, foldList]);
};
