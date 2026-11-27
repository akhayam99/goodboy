import { Button, EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { openDestination } from '../../../../shared/navigation/openDestination';

const openConnections = (): void => openDestination({ id: 'connections' });

export const CalendarEmpty = () => (
  <EmptyState
    size="section"
    headingLevel={2}
    icon={CONCEPT_ICONS.calendar}
    title="Connect a calendar"
    description="See your meetings next to your agents. Goodboy only reads your calendar."
    action={
      <Button variant="secondary" size="sm" onClick={openConnections}>
        Connect calendars
      </Button>
    }
  />
);
