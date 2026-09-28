import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { IconButton, useEscapeLayer } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import type { ViewFind } from '../../../store/slices/search-index/state';
import { captureLocation } from '../../../store/slices/navigation/captureLocation';
import { locationKey } from '../../../store/slices/navigation/locationKey';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { findMatchRanges } from './findMatchRanges';
import { pickTargetIndex } from './pickTargetIndex';
import { clearFindHighlights, paintFindHighlights } from './findHighlights';

const POLL_MS = 150;
const SETTLE_MS = 3_000;
const ROOTS = '[data-find-root]';

type Resolved = {
  readonly ranges: ReadonlyArray<Range>;
  readonly base: number;
};

type QueryParams = {
  readonly query: string;
};

const collectRanges = ({ query }: QueryParams): ReadonlyArray<Range> => {
  const roots = [...document.querySelectorAll(ROOTS)];
  const scopes = roots.length > 0 ? roots : [document.body];
  return scopes.flatMap((root) => findMatchRanges({ root, query }));
};

const reducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type RangeParams = {
  readonly range: Range;
};

const revealRange = ({ range }: RangeParams): void => {
  const element = range.startContainer.parentElement;
  if (element === null || typeof element.scrollIntoView !== 'function') {
    return;
  }
  element.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
};

type WrapParams = {
  readonly index: number;
  readonly total: number;
};

const wrap = ({ index, total }: WrapParams): number => ((index % total) + total) % total;

const livePlaceKey = (): string => locationKey(captureLocation({ state: useAppStore.getState() }));

type Props = {
  readonly viewFind: ViewFind;
};

export const FindSession = ({ viewFind }: Props) => {
  const stepViewFind = useAppStore((state) => state.stepViewFind);
  const stopViewFind = useAppStore((state) => state.stopViewFind);
  const placeKey = useAppStore((state) => locationKey(captureLocation({ state })));
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const anchorKey = useRef<string | null>(null);
  const { query, target, startedAt, steps } = viewFind;

  useEscapeLayer(stopViewFind);

  useEffect(() => {
    let isCancelled = false;
    let lastCount = -1;
    const tick = (): void => {
      if (isCancelled) {
        return;
      }
      const ranges = collectRanges({ query });
      const isSettled = ranges.length > 0 && ranges.length === lastCount;
      const isLate = Date.now() - startedAt > SETTLE_MS;
      lastCount = ranges.length;
      if (!isSettled && !isLate) {
        window.setTimeout(tick, POLL_MS);
        return;
      }
      anchorKey.current = livePlaceKey();
      setResolved({ ranges, base: pickTargetIndex({ ranges, target }) });
    };
    tick();
    return () => {
      isCancelled = true;
      clearFindHighlights();
    };
  }, [query, target, startedAt]);

  useEffect(() => {
    if (anchorKey.current !== null && anchorKey.current !== placeKey) {
      stopViewFind();
    }
  }, [placeKey, stopViewFind]);

  const total = resolved?.ranges.length ?? 0;
  const current = total === 0 ? -1 : wrap({ index: (resolved?.base ?? 0) + steps, total });

  useEffect(() => {
    const range = current < 0 ? undefined : resolved?.ranges[current];
    if (resolved === null || range === undefined) {
      clearFindHighlights();
      return;
    }
    paintFindHighlights({ ranges: resolved.ranges, current: range });
    revealRange({ range });
  }, [resolved, current]);

  if (resolved === null) {
    return null;
  }

  const summary = total === 0 ? 'No match in this view' : `${current + 1} of ${total}`;

  return (
    <div
      data-find-skip
      data-testid="find-in-view"
      role="status"
      aria-live="polite"
      className="fixed right-4 top-12 z-popover flex items-center gap-2 rounded-lg border border-border bg-floating py-1 pl-3 pr-1 shadow-lg motion-safe:animate-popover-in"
    >
      <span className="max-w-48 truncate text-label text-foreground">“{query}”</span>
      <span className="text-meta text-faint-foreground">{summary}</span>
      <IconButton
        icon={ChevronUp}
        label="Previous match"
        tooltip={`Previous match (${shortcutGlyphs('find.previous')})`}
        variant="ghost"
        disabled={total < 2}
        onClick={() => stepViewFind({ delta: -1 })}
      />
      <IconButton
        icon={ChevronDown}
        label="Next match"
        tooltip={`Next match (${shortcutGlyphs('find.next')})`}
        variant="ghost"
        disabled={total < 2}
        onClick={() => stepViewFind({ delta: 1 })}
      />
      <IconButton icon={X} label="Stop finding" variant="ghost" onClick={stopViewFind} />
    </div>
  );
};
