import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { usePointerDrag } from '../../../../shared/hooks/usePointerDrag';

export type HistoryDropTarget =
  | { readonly mode: 'slot'; readonly anchor: string | null; readonly y: number }
  | { readonly mode: 'into'; readonly sha: string }
  | { readonly mode: 'noop' };

export type HistoryDragState = {
  readonly sha: string;
  readonly x: number;
  readonly y: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly width: number;
  readonly target: HistoryDropTarget | null;
};

type ShaCheck = (sha: string) => boolean;

type Params = {
  readonly listRef: RefObject<HTMLElement | null>;
  readonly isEnabled: boolean;
  readonly canDrag: ShaCheck;
  readonly isAnchor: ShaCheck;
  readonly canDropInto: (pair: { readonly sha: string; readonly target: string }) => boolean;
  readonly isNoopSlot: (slot: { readonly sha: string; readonly anchor: string | null }) => boolean;
  readonly onMove: (slot: { readonly sha: string; readonly anchor: string | null }) => void;
  readonly onCombine: (pair: { readonly sha: string; readonly target: string }) => void;
  readonly onPickUp?: (sha: string) => void;
  readonly onCancel?: () => void;
};

type RowBox = {
  readonly sha: string;
  readonly top: number;
  readonly bottom: number;
};

const INTO_BAND = 0.25;

const rowBoxes = ({ list }: { readonly list: HTMLElement }): ReadonlyArray<RowBox> =>
  [...list.querySelectorAll<HTMLElement>('[data-history-row]')].map((row) => {
    const rect = row.getBoundingClientRect();
    return { sha: row.dataset.historyRow ?? '', top: rect.top, bottom: rect.bottom };
  });

type HitParams = {
  readonly rows: ReadonlyArray<RowBox>;
  readonly sha: string;
  readonly y: number;
  readonly listTop: number;
  readonly params: Params;
};

export const hitHistoryDrop = ({
  rows,
  sha,
  y,
  listTop,
  params,
}: HitParams): HistoryDropTarget | null => {
  const others = rows.filter((row) => row.sha !== sha);
  const first = others[0];
  const last = others[others.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  const anchorFrom = (index: number): string | null =>
    rows.slice(index).find((row) => row.sha !== sha && params.isAnchor(row.sha))?.sha ?? null;
  const slot = (anchor: string | null, at: number): HistoryDropTarget =>
    params.isNoopSlot({ sha, anchor })
      ? { mode: 'noop' }
      : { mode: 'slot', anchor, y: at - listTop };
  if (y < first.top) {
    return slot(anchorFrom(0), first.top);
  }
  if (y > last.bottom) {
    return slot(null, last.bottom);
  }
  for (const row of others) {
    if (y < row.top || y > row.bottom) {
      continue;
    }
    const index = rows.indexOf(row);
    const height = Math.max(row.bottom - row.top, 1);
    const relative = (y - row.top) / height;
    if (
      relative > INTO_BAND &&
      relative < 1 - INTO_BAND &&
      params.canDropInto({ sha, target: row.sha })
    ) {
      return { mode: 'into', sha: row.sha };
    }
    return relative <= 0.5
      ? slot(anchorFrom(index), row.top)
      : slot(anchorFrom(index + 1), row.bottom);
  }
  const next = others.find((row) => row.top > y);
  return next === undefined
    ? slot(null, last.bottom)
    : slot(anchorFrom(rows.indexOf(next)), next.top);
};

type Pending = {
  readonly sha: string;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly width: number;
};

export const useHistoryDrag = (params: Params) => {
  const latest = useRef(params);
  latest.current = params;
  const dragRef = useRef<HistoryDragState | null>(null);
  const [drag, setDrag] = useState<HistoryDragState | null>(null);

  const update = useCallback((next: HistoryDragState | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const finish = useCallback(
    ({ shouldCommit }: { readonly shouldCommit: boolean }) => {
      const current = dragRef.current;
      update(null);
      if (current === null) {
        return;
      }
      const target = current.target;
      if (!shouldCommit || target === null || target.mode === 'noop') {
        latest.current.onCancel?.();
        return;
      }
      if (target.mode === 'into') {
        latest.current.onCombine({ sha: current.sha, target: target.sha });
        return;
      }
      latest.current.onMove({ sha: current.sha, anchor: target.anchor });
    },
    [update],
  );

  const engine = usePointerDrag<Pending>({
    onStart: ({ payload }) => latest.current.onPickUp?.(payload.sha),
    onMove: ({ payload, x, y }) => {
      const list = latest.current.listRef.current;
      if (list === null) {
        return;
      }
      update({
        sha: payload.sha,
        x,
        y,
        offsetX: payload.offsetX,
        offsetY: payload.offsetY,
        width: payload.width,
        target: hitHistoryDrop({
          rows: rowBoxes({ list }),
          sha: payload.sha,
          y,
          listTop: list.getBoundingClientRect().top,
          params: latest.current,
        }),
      });
    },
    onRelease: () => finish({ shouldCommit: true }),
    onCancel: () => finish({ shouldCommit: false }),
  });

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, sha: string) => {
      const current = latest.current;
      if (!current.isEnabled || !current.canDrag(sha)) {
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      engine.onPointerDown({
        event,
        payload: {
          sha,
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top,
          width: rect.width,
        },
      });
    },
    [engine],
  );

  return { drag, onPointerDown };
};
