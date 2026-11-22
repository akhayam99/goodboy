import { Button, SectionLabel } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { openLens } from '../../openLens';
import { OverviewRecentRows } from './OverviewRecentRows';

type Props = {
  readonly session: Session;
};

export const OverviewLog = ({ session }: Props) => (
  <section
    aria-label={NAMES.activitySection}
    data-overview-log=""
    data-overview-section="activity"
    className="flex flex-col gap-1"
  >
    <span className="flex h-7 min-w-0 items-center justify-between gap-2">
      <SectionLabel label={NAMES.activitySection} headingLevel={2} />
      <Button
        size="sm"
        variant="quiet"
        role="link"
        onClick={() => openLens({ sessionId: session.id, lens: 'activity' })}
      >
        {NAMES.openActivity}
      </Button>
    </span>
    <OverviewRecentRows session={session} />
  </section>
);
