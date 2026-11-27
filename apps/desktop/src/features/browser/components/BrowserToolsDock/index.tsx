import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SplitHandle, cn } from '@goodboy/ui';
import {
  browserToolsDockPref,
  type BrowserToolsPlace,
  type BrowserToolsSide,
  type BrowserToolsSurface,
} from '../../browserToolsDockPref';
import { consoleCounts } from '../../consoleCounts';
import type { BrowserTools } from '../../hooks/useBrowserTools';
import type { ConsoleEntries } from '../../hooks/useConsoleEntries';
import { NARROW_ROW_PX } from '../../narrowRowPx';
import type { BrowserPaneModel } from '../../types';
import { BrowserConsole } from './BrowserConsole';
import { ErrorsTab } from './ErrorsTab';
import { NetworkTab } from './NetworkTab';
import { toolsDockBoundsOf } from './toolsDockBoundsOf';

type Props = {
  readonly surface: BrowserToolsSurface;
  readonly tools: BrowserTools;
  readonly hasTab: boolean;
  readonly model: BrowserPaneModel;
  readonly title: string;
  readonly log: ConsoleEntries;
  readonly children: ReactNode;
};

type Room = {
  readonly width: number;
  readonly height: number;
};

type SizeParams = {
  readonly size: number;
};

const TOOLS_IN_HEAD_MIN_WIDTH = 640;

const RESIZE_LABEL = {
  bottom: 'Resize the tools height',
  right: 'Resize the tools width',
} as const;

export const BrowserToolsDock = ({
  surface,
  tools,
  hasTab,
  model,
  title,
  log,
  children,
}: Props) => {
  const isOpen = tools.isOpen && hasTab;
  const tab = tools.tab;
  const onTab = tools.setTab;
  const counts = consoleCounts({ entries: log.entries });
  const isErrorsTabEmpty = tab === 'errors' && counts.errors === 0;
  const shownTab = isErrorsTabEmpty ? 'console' : tab;
  const stage = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState<BrowserToolsPlace>(() =>
    browserToolsDockPref.read({ surface }),
  );
  const [room, setRoom] = useState<Room | null>(null);
  const isNarrow = room !== null && room.width > 0 && room.width < NARROW_ROW_PX;
  const side: BrowserToolsSide = isNarrow ? 'bottom' : place.side;
  const isRight = side === 'right';
  const bounds = toolsDockBoundsOf({ side, room });
  const wanted = isRight ? place.width : place.height;
  const size = Math.min(bounds.max, Math.max(bounds.min, wanted));
  const isToolsInHead = !isRight && (room === null || room.width >= TOOLS_IN_HEAD_MIN_WIDTH);

  useEffect(() => {
    const node = stage.current;
    if (node === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect !== undefined) {
        setRoom({ width: rect.width, height: rect.height });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isErrorsTabEmpty) {
      return;
    }
    onTab({ next: 'console' });
  }, [isErrorsTabEmpty, onTab]);

  const placeWith = ({ size: next }: SizeParams): BrowserToolsPlace =>
    isRight ? { ...place, width: next } : { ...place, height: next };

  const resize = ({ size: next }: SizeParams): void => setPlace(placeWith({ size: next }));

  const commit = ({ size: next }: SizeParams): void => {
    const nextPlace = placeWith({ size: next });
    setPlace(nextPlace);
    browserToolsDockPref.write({ surface, place: nextPlace });
  };

  const moveSide = (): void => {
    const nextPlace: BrowserToolsPlace = { ...place, side: isRight ? 'bottom' : 'right' };
    setPlace(nextPlace);
    browserToolsDockPref.write({ surface, place: nextPlace });
  };

  const onSide = isNarrow ? undefined : moveSide;

  return (
    <div
      ref={stage}
      data-browser-stage=""
      className={cn('flex min-h-0 min-w-0 flex-1', isOpen && isRight ? 'flex-row' : 'flex-col')}
    >
      {children}
      {isOpen ? (
        <section
          ref={tools.dockRef}
          aria-label="Console"
          data-tools-side={side}
          style={isRight ? { width: size } : { height: size }}
          onFocus={tools.focusWatch.onFocus}
          onBlur={tools.focusWatch.onBlur}
          className="relative flex min-h-0 min-w-0 shrink-0 flex-col bg-drawer"
        >
          <div
            className={cn('absolute z-10 flex', isRight ? 'inset-y-0 left-0' : 'inset-x-0 top-0')}
          >
            <SplitHandle
              side={side}
              value={size}
              min={bounds.min}
              max={bounds.max}
              ariaLabel={RESIZE_LABEL[side]}
              onChange={(next) => resize({ size: next })}
              onCommit={(next) => commit({ size: next })}
            />
          </div>
          {shownTab === 'errors' ? (
            <ErrorsTab
              model={model}
              title={title}
              log={log}
              counts={counts}
              side={side}
              isToolsInHead={isToolsInHead}
              onTab={onTab}
              onSide={onSide}
            />
          ) : null}
          {shownTab === 'network' ? (
            <NetworkTab
              model={model}
              counts={counts}
              log={log}
              side={side}
              isToolsInHead={isToolsInHead}
              onTab={onTab}
              onSide={onSide}
            />
          ) : null}
          {shownTab === 'console' ? (
            <BrowserConsole
              model={model}
              counts={counts}
              title={title}
              log={log}
              side={side}
              isToolsInHead={isToolsInHead}
              onTab={onTab}
              onSide={onSide}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
};
