import { useEffect, useRef } from 'react';
import { ScrollFade, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '../../../../../shared/components/paneRhythm';
import { AgentsSection } from './AgentsSection';
import { findScrollParent } from './findScrollParent';
import { LegendSection } from './LegendSection';
import { OverviewSection } from './OverviewSection';
import { SessionsSection } from './SessionsSection';
import { StageBoardSection } from './StageBoardSection';
import { TipsSection } from './TipsSection';
import { TokensSection } from './TokensSection';
import { ToolsSection } from './ToolsSection';
import { TurnsSection } from './TurnsSection';

type Section =
  | 'overview'
  | 'board'
  | 'session'
  | 'turn'
  | 'tools'
  | 'tokens'
  | 'agents'
  | 'tips'
  | 'legenda';

type Props = {
  readonly onJump: (s: Section) => void;
  readonly onVisible: (s: Section) => void;
  readonly registerScrollTo: (fn: (id: Section) => void) => void;
};

export const GuideContent = ({ onJump, onVisible, registerScrollTo }: Props) => {
  const anchorsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    registerScrollTo((id) =>
      anchorsRef.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }, [registerScrollTo]);

  useEffect(() => {
    const els = Object.values(anchorsRef.current).filter((el): el is HTMLDivElement => el != null);
    if (els.length === 0) {
      return;
    }
    const root = findScrollParent({ element: els[0]! });
    const observer = new IntersectionObserver(
      (records) => {
        const top = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = top?.target.getAttribute('data-guide-section');
        if (id) {
          onVisibleRef.current(id as Section);
        }
      },
      { root, rootMargin: '0px 0px -65% 0px', threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const anchor = (id: Section) => (el: HTMLDivElement | null) => {
    if (el) {
      el.dataset.guideSection = id;
      el.style.scrollMarginTop = '2.5rem';
    }
    anchorsRef.current[id] = el;
  };

  return (
    <ScrollFade className="h-full w-full" viewportClassName={PANE_RHYTHM.body}>
      <div className={cn('flex flex-col gap-12', PANE_RHYTHM.column, PANE_RHYTHM.measure.reading)}>
        <div ref={anchor('overview')}>
          <OverviewSection onJump={onJump} />
        </div>
        <div ref={anchor('board')}>
          <StageBoardSection />
        </div>
        <div ref={anchor('session')}>
          <SessionsSection />
        </div>
        <div ref={anchor('turn')}>
          <TurnsSection />
        </div>
        <div ref={anchor('tools')}>
          <ToolsSection />
        </div>
        <div ref={anchor('tokens')}>
          <TokensSection />
        </div>
        <div ref={anchor('agents')}>
          <AgentsSection />
        </div>
        <div ref={anchor('tips')}>
          <TipsSection />
        </div>
        <div ref={anchor('legenda')}>
          <LegendSection />
        </div>
      </div>
    </ScrollFade>
  );
};
