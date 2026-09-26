import { Fragment, useRef, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../cn';
import type { TrailSegmentModel } from './types';
import { TrailCrumb } from './TrailCrumb';
import { TrailFold } from './TrailFold';
import { useTrailCompaction } from './useTrailCompaction';

type Props = {
  readonly segments: ReadonlyArray<TrailSegmentModel>;
  readonly lead?: ReactNode;
  readonly className?: string;
};

export const Trail = ({ segments, lead, className }: Props) => {
  const navRef = useRef<HTMLElement>(null);
  const leadRef = useRef<HTMLSpanElement>(null);
  const { states, delays, enteringIds } = useTrailCompaction({ segments, navRef, leadRef });
  const folded = segments.filter((_, index) => states[index] === 'folded');
  let visibleIndex = 0;

  return (
    <nav
      ref={navRef}
      aria-label="Breadcrumb"
      data-slot="trail"
      className={cn('flex h-6 min-w-0 flex-1 items-center gap-1.5 overflow-hidden', className)}
    >
      {lead != null ? (
        <span ref={leadRef} className="flex shrink-0 items-center">
          {lead}
        </span>
      ) : null}
      {segments.map((segment, index) => {
        const state = states[index] ?? 'full';
        if (state === 'folded') {
          return null;
        }
        const isCurrent = index === segments.length - 1;
        const isIconOnly = state === 'icon';
        const delay = delays[index] ?? 0;
        const delayStyle = delay > 0 ? { transitionDelay: `${delay}ms` } : undefined;
        const hasSeparator = visibleIndex > 0;
        visibleIndex += 1;
        return (
          <Fragment key={segment.id}>
            <span
              data-trail-segment={segment.id}
              data-trail-state={state}
              className={cn(
                'flex min-w-0 items-center gap-1.5',
                isCurrent ? 'flex-1' : isIconOnly ? 'shrink-0' : 'shrink',
                enteringIds.has(segment.id) && 'motion-safe:animate-trail-crumb-in',
              )}
            >
              {hasSeparator ? (
                <ChevronRight size={12} aria-hidden className="shrink-0 text-faint-foreground" />
              ) : null}
              {segment.render != null ? (
                segment.render({ isIconOnly })
              ) : (
                <TrailCrumb
                  segment={segment}
                  isCurrent={isCurrent}
                  isIconOnly={isIconOnly}
                  {...(delayStyle !== undefined && { delayStyle })}
                />
              )}
            </span>
            {index === 0 && folded.length > 0 ? <TrailFold segments={folded} /> : null}
          </Fragment>
        );
      })}
    </nav>
  );
};
