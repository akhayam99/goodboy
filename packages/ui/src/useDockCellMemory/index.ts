import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { DockGridColumnBox } from '../dockGridColumnBox';
import type { DockGridSpec } from '../dockGridSpec';
import type { DockTabs } from '../dockTabsContext';

type Params = {
  readonly spec: DockGridSpec;
  readonly columns: ReadonlyArray<DockGridColumnBox>;
};

type DockCellMemory = {
  readonly regainFocus: MutableRefObject<string | null>;
  readonly liveKeys: MutableRefObject<ReadonlySet<string>>;
  readonly headed: ReadonlySet<string>;
  readonly kept: Readonly<Record<string, string>>;
  readonly claim: DockTabs['claim'];
  readonly takeFocus: DockTabs['takeFocus'];
};

export const useDockCellMemory = ({ spec, columns }: Params): DockCellMemory => {
  const regainFocus = useRef<string | null>(null);
  const liveKeys = useRef<ReadonlySet<string>>(new Set());
  liveKeys.current = new Set(
    spec.columns.flatMap((column) =>
      column.flatMap((cell) => [
        cell.key,
        ...(cell.tabs?.members.map((member) => member.key) ?? []),
      ]),
    ),
  );
  const [headed, setHeaded] = useState<ReadonlySet<string>>(() => new Set());
  const claim = useCallback<DockTabs['claim']>(({ paneKey }) => {
    setHeaded((previous) => new Set([...previous, paneKey]));
    return () =>
      setHeaded((previous) => new Set([...previous].filter((candidate) => candidate !== paneKey)));
  }, []);
  const takeFocus = useCallback<DockTabs['takeFocus']>(({ paneKey }) => {
    const isOwed = regainFocus.current === paneKey;
    if (isOwed) {
      regainFocus.current = null;
    }
    return isOwed;
  }, []);
  const [kept, setKept] = useState<Readonly<Record<string, string>>>({});
  const focus = spec.focus;
  const focusedCell =
    columns.flatMap((column) => column.panes).find((pane) => (pane.tabs ?? []).includes(focus))
      ?.key ?? null;
  const cellKeys = columns.flatMap((column) => column.panes.map((pane) => pane.key)).join('/');
  useEffect(() => {
    if (focusedCell === null) {
      return;
    }
    setKept((previous) =>
      previous[focusedCell] === focus ? previous : { ...previous, [focusedCell]: focus },
    );
  }, [focusedCell, focus]);
  useEffect(() => {
    const open = new Set(cellKeys.split('/'));
    setKept((previous) => {
      const stale = Object.keys(previous).filter((key) => !open.has(key));
      return stale.length === 0
        ? previous
        : Object.fromEntries(Object.entries(previous).filter(([key]) => open.has(key)));
    });
  }, [cellKeys]);
  return { regainFocus, liveKeys, headed, kept, claim, takeFocus };
};
