import { useContext, type ReactNode } from 'react';
import { cn } from '../../cn';
import { PANE_RHYTHM } from '../../paneRhythm';
import { HeaderRevealContext } from '../../useHeaderReveal/headerRevealContext';
import { PageColumn, type PageColumnWidth } from '../PageColumn';
import { RevealRegion } from '../RevealRegion';
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
  const trail = useContext(PageTrailContext);
  const isOuterUnderTrail = useContext(UnderTrailContext);
  const hasTrail = trail != null;
  const pinned =
    !hasTrail && lead == null ? null : (
      <div
        data-slot="reveal-pinned"
        className={cn('sticky-surface', !hasTrail && 'has-[[data-slot=pane-lead]:empty]:hidden')}
      >
        <PageColumn
          width={width}
          className={cn(
            'flex flex-col gap-3',
            !isOuterUnderTrail && (hasTrail ? PANE_RHYTHM.pinnedInset : PANE_RHYTHM.headerInset),
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
        <RevealRegion
          resetKey={resetKey}
          pinned={pinned}
          header={
            <PageColumn width={width}>
              <UnderTrailContext.Provider value={isOuterUnderTrail || hasTrail}>
                {header}
              </UnderTrailContext.Provider>
              {banner === null ? null : (
                <div className="pb-3 has-[[data-slot=pane-banner]:empty]:hidden">{banner}</div>
              )}
            </PageColumn>
          }
        >
          {isSelfScroll ? (
            <div
              data-slot="pane-body"
              className="flex min-h-0 min-w-0 flex-1 flex-col pt-[var(--reveal-inset,0px)]"
            >
              <div data-slot="pane-fill" className="flex min-h-0 min-w-0 flex-1 flex-col">
                {children}
              </div>
            </div>
          ) : (
            <ScrollFade className="min-h-0 flex-1" fadeSize={24} isUnderPinned>
              <PageColumn width={width} className="pb-5">
                <div data-slot="pane-body" className={cn(PANE_RHYTHM.stack, animationClassName)}>
                  {children}
                </div>
              </PageColumn>
            </ScrollFade>
          )}
        </RevealRegion>
        {dockBlock}
      </div>
    </HeaderRevealContext.Provider>
  );
};
