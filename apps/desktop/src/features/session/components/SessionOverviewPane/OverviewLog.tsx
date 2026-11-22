import { useLayoutEffect, useRef, useState } from 'react';
import { Button, SectionLabel, appScrollIntoView } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { LOG_LANDING } from '../../central/log/logLanding';
import { LogPane } from '../../central/log/LogPane';
import { OverviewRecentRows } from './OverviewRecentRows';

type Props = {
  readonly session: Session;
};

export const OverviewLog = ({ session }: Props) => {
  const sessionId = session.id;
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  useLayoutEffect(() => {
    const land = () => {
      if (!LOG_LANDING.take({ sessionId })) {
        return;
      }
      setIsOpen(true);
      appScrollIntoView({ element: sectionRef.current, block: 'start' });
    };
    land();
    return LOG_LANDING.subscribe({ listener: land });
  }, [sessionId]);
  return (
    <section
      ref={sectionRef}
      aria-label={NAMES.activitySection}
      data-overview-log=""
      data-overview-section="activity"
      className="flex flex-col gap-1"
    >
      <span className="flex h-7 min-w-0 items-center justify-between gap-2">
        <SectionLabel label={NAMES.activitySection} headingLevel={2} />
        {isOpen ? null : (
          <Button size="sm" variant="quiet" role="link" onClick={() => setIsOpen(true)}>
            {NAMES.openActivity}
          </Button>
        )}
      </span>
      {isOpen ? <LogPane session={session} /> : <OverviewRecentRows session={session} />}
    </section>
  );
};
