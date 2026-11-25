import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SplitHandle, cn } from '@goodboy/ui';
import {
  browserToolsDockPref,
  type BrowserToolsPlace,
  type BrowserToolsSurface,
} from '../../browserToolsDockPref';
import type { ConsoleEntries } from '../../hooks/useConsoleEntries';
import type { BrowserPaneModel } from '../../types';
import { BrowserConsole } from './BrowserConsole';
import { toolsDockBoundsOf } from './toolsDockBoundsOf';

type Props = {
  readonly surface: BrowserToolsSurface;
  readonly isOpen: boolean;
  readonly model: BrowserPaneModel;
  readonly title: string;
  readonly log: ConsoleEntries;
  readonly onClose: () => void;
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
  isOpen,
  model,
  title,
  log,
  onClose,
  children,
}: Props) => {
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
          className={cn(
            'relative flex min-h-0 min-w-0 shrink-0 flex-col border-border-soft bg-background',
            isRight ? 'border-l' : 'border-t',
          )}
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
          <BrowserConsole
            model={model}
            title={title}
            log={log}
            side={place.side}
            isToolsInHead={isToolsInHead}
            onSide={moveSide}
            onClose={onClose}
          />
        </section>
      ) : null}
    </div>
  );
};
