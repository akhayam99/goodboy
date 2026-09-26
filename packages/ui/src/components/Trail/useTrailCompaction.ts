import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { compactTrail, type TrailSegmentState } from './compactTrail';
import type { TrailSegmentModel } from './types';

const ICON_WIDTH = 22;
const SWITCHER_ICON_WIDTH = 40;
const SEPARATOR_WIDTH = 24;
const ELLIPSIS_WIDTH = 22;
const CHARACTER_WIDTH = 6.5;
const CASCADE_MS = 40;

type Params = {
  readonly segments: ReadonlyArray<TrailSegmentModel>;
  readonly navRef: RefObject<HTMLElement | null>;
  readonly leadRef: RefObject<HTMLElement | null>;
};

type Compaction = {
  readonly states: ReadonlyArray<TrailSegmentState>;
  readonly delays: ReadonlyArray<number>;
  readonly enteringIds: ReadonlySet<string>;
};

const estimateFullWidth = (segment: TrailSegmentModel): number =>
  ICON_WIDTH + segment.label.length * CHARACTER_WIDTH + 12;

export const useTrailCompaction = ({ segments, navRef, leadRef }: Params): Compaction => {
  const [available, setAvailable] = useState<number | null>(null);
  const [leadWidth, setLeadWidth] = useState(0);
  const [measured, setMeasured] = useState<ReadonlyMap<string, number>>(new Map());
  const previousStates = useRef<ReadonlyMap<string, TrailSegmentState>>(new Map());
  const seenIds = useRef<ReadonlySet<string> | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (nav == null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const read = () => {
      const width = nav.clientWidth;
      setAvailable(width > 0 ? width : null);
      setLeadWidth(leadRef.current?.getBoundingClientRect().width ?? 0);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [navRef, leadRef]);

  const keyOf = (segment: TrailSegmentModel) => `${segment.id}:${segment.label}`;
  const fullWidths = segments.map(
    (segment) => measured.get(keyOf(segment)) ?? estimateFullWidth(segment),
  );
  const states = compactTrail({
    fullWidths,
    iconWidths: segments.map((segment) =>
      segment.menu != null ? SWITCHER_ICON_WIDTH : ICON_WIDTH,
    ),
    pinned: segments.map((segment) => segment.isPinned === true),
    separatorWidth: SEPARATOR_WIDTH,
    ellipsisWidth: ELLIPSIS_WIDTH,
    leadWidth,
    available,
  });

  let cascade = 0;
  const delays = segments.map((segment, index) => {
    const before = previousStates.current.get(segment.id);
    if (before === undefined || before === states[index]) {
      return 0;
    }
    const delay = cascade * CASCADE_MS;
    cascade += 1;
    return delay;
  });

  const enteringIds = new Set(
    seenIds.current === null
      ? []
      : segments.flatMap((segment) =>
          seenIds.current?.has(segment.id) === true ? [] : [segment.id],
        ),
  );

  useLayoutEffect(() => {
    previousStates.current = new Map(
      segments.map((segment, index) => [segment.id, states[index] ?? 'full']),
    );
    seenIds.current = new Set(segments.map((segment) => segment.id));
    const nav = navRef.current;
    if (nav == null) {
      return;
    }
    const nodes = new Map(
      Array.from(nav.querySelectorAll<HTMLElement>('[data-trail-segment]')).map((node) => [
        node.getAttribute('data-trail-segment') ?? '',
        node,
      ]),
    );
    const next = new Map(measured);
    let hasChanged = false;
    segments.forEach((segment, index) => {
      if (states[index] !== 'full') {
        return;
      }
      const crumb = nodes.get(segment.id)?.lastElementChild ?? null;
      const width = crumb instanceof HTMLElement ? crumb.scrollWidth : 0;
      if (width <= 0 || next.get(keyOf(segment)) === width) {
        return;
      }
      next.set(keyOf(segment), width);
      hasChanged = true;
    });
    if (hasChanged) {
      setMeasured(next);
    }
  });

  return { states, delays, enteringIds };
};
