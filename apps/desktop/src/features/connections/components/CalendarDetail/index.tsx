import { useEffect, useState } from 'react';
import { Button, FormPage, ICON_SIZE, PaneShell, tintClasses } from '@goodboy/ui';
import { Plus } from '@goodboy/ui/icons';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioTrail } from '../../../../shared/components/StudioShell/StudioTrail';
import { currentPlatform } from '../../../../shared/platform';
import { NAMES } from '../../../../shared/utils/names';
import { useAppStore } from '../../../../store';
import { CalendarConnectForm } from '../../../calendar/connect/CalendarConnectForm';
import { ConnectedCalendarSource } from '../../../calendar/connect/ConnectedCalendarSource';
import { calendarConnectionStateOf } from '../../model/calendarConnectionStateOf';
import { StateWord } from '../ConnectionsIndex/StateWord';
import { AccountRow } from '../IntegrationDetail/AccountRow';
import { KeychainLine } from '../IntegrationDetail/KeychainLine';

type Props = {
  readonly onUp: () => void;
};

const TITLE = 'Calendar';
const CalendarGlyph = CONCEPT_ICONS.calendar;

export const CalendarDetail = ({ onUp }: Props) => {
  const sources = useAppStore((state) => state.calendarSources);
  const failedCount = useAppStore((state) => state.calendarDay?.failedSources.length ?? 0);
  const loadCalendarSources = useAppStore((state) => state.loadCalendarSources);
  const [isAdding, setIsAdding] = useState(false);
  const isMac = currentPlatform() === 'darwin';
  const hasMacSource = sources.some((source) => source.kind === 'eventkit');
  const hasLink = sources.some((source) => source.kind === 'ics');
  const state = calendarConnectionStateOf({ sourceCount: sources.length, failedCount });

  useEffect(() => {
    void loadCalendarSources();
  }, [loadCalendarSources]);

  return (
    <>
      <StudioTrail
        segments={[
          {
            id: 'connections',
            label: NAMES.connections,
            icon: CONCEPT_ICONS.connections,
            iconClassName: tintClasses(CONCEPT_TONE.connections).icon,
            onSelect: onUp,
          },
          { id: 'calendar', label: TITLE, icon: CalendarGlyph },
        ]}
      />
      <PaneShell
        page="connections"
        scroll="self"
        title={
          <span className="inline-flex min-w-0 items-center gap-2">
            <CalendarGlyph size={ICON_SIZE.control} aria-hidden className="shrink-0" />
            {TITLE}
          </span>
        }
        badge={<StateWord state={state} />}
      >
        <FormPage>
          {sources.length === 0 ? <CalendarConnectForm isMacOffered={isMac} /> : null}
          {sources.map((source) => (
            <ConnectedCalendarSource
              key={source.id}
              source={source}
              renderAccount={({ label, primary, secondary, action }) => (
                <AccountRow label={label} primary={primary} secondary={secondary} action={action} />
              )}
            />
          ))}
          {sources.length > 0 && isAdding ? (
            <CalendarConnectForm
              isMacOffered={isMac && !hasMacSource}
              onConnected={() => setIsAdding(false)}
              onCancel={() => setIsAdding(false)}
            />
          ) : null}
          {sources.length > 0 && !isAdding ? (
            <div className="flex">
              <Button variant="ghost" onClick={() => setIsAdding(true)}>
                <Plus size={ICON_SIZE.control} aria-hidden />
                Connect another calendar
              </Button>
            </div>
          ) : null}
          {hasLink ? <KeychainLine /> : null}
        </FormPage>
      </PaneShell>
    </>
  );
};
