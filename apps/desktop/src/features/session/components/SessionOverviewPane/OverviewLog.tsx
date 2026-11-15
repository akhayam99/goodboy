import { useLayoutEffect, useRef } from 'react';
import { SectionHeader, appScrollIntoView } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { LOG_LANDING } from '../../central/log/logLanding';
import { LogPane } from '../../central/log/LogPane';

type Props = {
  readonly session: Session;
};

export const OverviewLog = ({ session }: Props) => {
  const sessionId = session.id;
  const sectionRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const land = () => {
      if (!LOG_LANDING.take({ sessionId })) {
        return;
      }
      appScrollIntoView({ element: sectionRef.current, block: 'start' });
    };
    land();
    return LOG_LANDING.subscribe({ listener: land });
  }, [sessionId]);
  return (
    <div ref={sectionRef} data-overview-log="" className="flex flex-col gap-2">
      <SectionHeader label="Log" headingLevel={2} />
      <LogPane session={session} hasRowActions={false} />
    </div>
  );
};
