import { useEffect, useState } from 'react';
import { CalendarStudio } from '../../../../../../features/calendar/components/CalendarStudio';
import { useAppStore } from '../../../../../../store';
import { useSceneClicks } from '../../audit/useSceneClicks';
import { PageSheet } from '../../PageSheet';
import { seedBoardScene, WORKSPACE_ID } from '../../BoardScene';
import { installCalendarScene, type CalendarSceneVariant } from './calendarSceneSeed';

type Props = {
  readonly variant: CalendarSceneVariant;
};

const NOOP = () => undefined;

const CLICK_MS = 300;

type Click = {
  readonly labels: ReadonlyArray<string>;
  readonly selector: string;
};

const CLICKS: Readonly<Record<CalendarSceneVariant, Click>> = {
  day: { labels: [], selector: 'button' },
  open: { labels: ['Northwind sync'], selector: '[data-list-grid-row]' },
  week: { labels: ['Week'], selector: 'button' },
  empty: { labels: [], selector: 'button' },
  busy: { labels: [], selector: 'button' },
  quiet: { labels: [], selector: 'button' },
};

export const CalendarScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedBoardScene();
    installCalendarScene({ variant });
    useAppStore.getState().openStudio({ studio: { kind: 'calendar' } });
    setIsReady(true);
  }, [variant]);

  useSceneClicks({
    isReady,
    labels: CLICKS[variant].labels,
    selector: CLICKS[variant].selector,
    match: 'contains',
    intervalMs: CLICK_MS,
  });

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <PageSheet>
        <CalendarStudio workspaceId={WORKSPACE_ID} onClose={NOOP} />
      </PageSheet>
    </main>
  );
};
