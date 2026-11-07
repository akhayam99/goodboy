import { useContext, useRef, type ReactNode } from 'react';
import { cn } from '../../cn';
import { PANE_RHYTHM } from '../../paneRhythm';
import { useHeaderReveal } from '../../useHeaderReveal';
import { ClaimedScrollerContext } from '../../useHeaderReveal/claimedScrollerContext';
import { HeaderRevealContext } from '../../useHeaderReveal/headerRevealContext';
import { PageColumn, type PageColumnWidth } from '../PageColumn';
import { ScrollFade } from '../ScrollFade';
import { PageTrailContext } from './pageTrailContext';
import { UnderTrailContext } from './underTrailContext';

type Props = {
  readonly width: PageColumnWidth;
  readonly header: ReactNode;
  readonly banner: ReactNode;
  readonly lead: ReactNode;
  readonly dockBlock: ReactNode;
  readonly isSelfScroll: boolean;
  readonly resetKey: string | null;
  readonly animationClassName: string;
  readonly children: ReactNode;
};

export const RevealPane = ({
  width,
  header,
  banner,
  lead,
  dockBlock,
  isSelfScroll,
  resetKey,
  animationClassName,
  children,
}: Props) => {
  const regionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const reveal = useHeaderReveal({ regionRef, headerRef, bodyRef, resetKey });
  const trail = useContext(PageTrailContext);
  const isOuterUnderTrail = useContext(UnderTrailContext);
  const hasTrail = trail != null;
  const pinned =
    !hasTrail && lead == null ? null : (
      <div
        data-slot="reveal-pinned"
        className={cn('shrink-0', !hasTrail && 'has-[[data-slot=pane-lead]:empty]:hidden')}
      >
        <PageColumn
          width={width}
          className={cn(
            'flex flex-col gap-3',
            !isOuterUnderTrail && PANE_RHYTHM.headerInset,
            animationClassName,
          )}
        >
          {hasTrail ? (
            <div data-slot="page-trail" className="flex h-6 min-w-0 items-center">
              {trail}
            </div>
          ) : null}
          {lead == null ? null : (
            <div data-slot="pane-lead" className="flex min-w-0 flex-col gap-3 empty:hidden">
              {lead}
            </div>
          )}
        </PageColumn>
      </div>
    );

  return (
    <HeaderRevealContext.Provider value={null}>
      <div className="@container flex h-full min-h-0 min-w-0 flex-1 flex-col">
        {pinned}
        <div
          ref={regionRef}
          data-slot="reveal-region"
          className="group/reveal relative flex min-h-0 min-w-0 flex-1 flex-col overflow-clip"
        >
          <div
            ref={headerRef}
            data-slot="reveal-header"
            className={cn(
              'absolute inset-x-0 top-0 z-20 bg-background',
              'motion-safe:transition-transform motion-safe:duration-(--reveal-duration) motion-safe:ease-(--reveal-ease)',
              'group-data-[reveal-header=hidden]/reveal:-translate-y-full',
            )}
          >
            <PageColumn width={width}>
              {header}
              {banner === null ? null : (
                <div className="pb-3 has-[[data-slot=pane-banner]:empty]:hidden">{banner}</div>
              )}
            </PageColumn>
          </div>
          <HeaderRevealContext.Provider value={reveal}>
            <ClaimedScrollerContext.Provider value={false}>
              <div
                ref={bodyRef}
                data-slot="pane-body"
                className={cn(
                  'flex min-h-0 min-w-0 flex-1 flex-col pt-[var(--reveal-pad,0px)]',
                  'group-data-[reveal=slide]/reveal:h-[calc(100%+var(--reveal-extend,0px))] group-data-[reveal=slide]/reveal:flex-none',
                  'group-data-[reveal=slide]/reveal:translate-y-[calc(var(--reveal-shift,0px)*-1)]',
                  'motion-safe:duration-(--reveal-duration) motion-safe:ease-(--reveal-ease) group-data-[reveal=slide]/reveal:motion-safe:transition-transform',
                )}
              >
                {isSelfScroll ? (
                  children
                ) : (
                  <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
                    <PageColumn width={width} className="pb-5">
                      <div className={cn(PANE_RHYTHM.stack, animationClassName)}>{children}</div>
                    </PageColumn>
                  </ScrollFade>
                )}
              </div>
            </ClaimedScrollerContext.Provider>
          </HeaderRevealContext.Provider>
        </div>
        {dockBlock}
      </div>
    </HeaderRevealContext.Provider>
  );
};
