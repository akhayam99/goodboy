import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SplitHandle, cn } from '@goodboy/ui';
import {
  browserToolsDockPref,
  type BrowserToolsPlace,
  type BrowserToolsSurface,
} from '../../browserToolsDockPref';
import { consoleCounts } from '../../consoleCounts';
import type { ConsoleEntries } from '../../hooks/useConsoleEntries';
import type { BrowserPaneModel, BrowserToolsTab } from '../../types';
import { BrowserConsole } from './BrowserConsole';
import { ErrorsTab } from './ErrorsTab';
import { NetworkTab } from './NetworkTab';
import { toolsDockBoundsOf } from './toolsDockBoundsOf';

type Props = {
  readonly surface: BrowserToolsSurface;
  readonly isOpen: boolean;
  readonly model: BrowserPaneModel;
  readonly title: string;
  readonly log: ConsoleEntries;
  readonly tab: BrowserToolsTab;
  readonly onTab: (params: TabParams) => void;
  readonly onClose: () => void;
  readonly children: ReactNode;
};

type TabParams = {
  readonly next: BrowserToolsTab;
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
  isOpen,
  model,
  title,
  log,
  tab,
  onTab,
  onClose,
  children,
}: Props) => {
  const counts = consoleCounts({ entries: log.entries });
  const isErrorsTabEmpty = tab === 'errors' && counts.errors === 0;
  const shownTab = isErrorsTabEmpty ? 'console' : tab;
  const stage = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState<BrowserToolsPlace>(() =>
    browserToolsDockPref.read({ surface }),
  );
  const [room, setRoom] = useState<Room | null>(null);
  const isRight = place.side === 'right';
  const bounds = toolsDockBoundsOf({ side: place.side, room });
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

  return (
    <div
      ref={stage}
      data-browser-stage=""
      className={cn('flex min-h-0 min-w-0 flex-1', isOpen && isRight ? 'flex-row' : 'flex-col')}
    >
      {children}
      {isOpen ? (
        <section
          aria-label="Console"
          data-tools-side={place.side}
          style={isRight ? { width: size } : { height: size }}
          className="relative flex min-h-0 min-w-0 shrink-0 flex-col bg-drawer"
        >
          <div
            className={cn('absolute z-10 flex', isRight ? 'inset-y-0 left-0' : 'inset-x-0 top-0')}
          >
            <SplitHandle
              side={place.side}
              value={size}
              min={bounds.min}
              max={bounds.max}
              ariaLabel={RESIZE_LABEL[place.side]}
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
              side={place.side}
              isToolsInHead={isToolsInHead}
              onTab={onTab}
              onSide={moveSide}
              onClose={onClose}
            />
          ) : null}
          {shownTab === 'network' ? (
            <NetworkTab
              model={model}
              counts={counts}
              log={log}
              side={place.side}
              isToolsInHead={isToolsInHead}
              onTab={onTab}
              onSide={moveSide}
              onClose={onClose}
            />
          ) : null}
          {shownTab === 'console' ? (
            <BrowserConsole
              model={model}
              counts={counts}
              title={title}
              log={log}
              side={place.side}
              isToolsInHead={isToolsInHead}
              onTab={onTab}
              onSide={moveSide}
              onClose={onClose}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
};
