import { useMemo, useState } from 'react';
import type { CalendarInfo, CalendarSource, CalendarSourceRef } from '@goodboy/types';
import { Band, Button, ICON_SIZE, InlineConfirm } from '@goodboy/ui';
import { Unlink } from '@goodboy/ui/icons';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { useAppStore } from '../../../../store';
import { calendarRoleOf } from '../../../../store/slices/calendar/calendarRoleOf';
import { CalendarRoleList } from '../../../calendar/connect/CalendarRoleList';
import { disconnectCalendarSource } from '../../../calendar/connect/disconnectCalendarSource';
import { useCalendarList } from '../../../calendar/connect/hooks/useCalendarList';
import { AccountRow } from '../IntegrationDetail/AccountRow';

type Props = {
  readonly source: CalendarSource;
};

type CountParams = {
  readonly calendars: ReadonlyArray<CalendarInfo>;
  readonly isLoading: boolean;
};

const countLineOf = ({ calendars, isLoading }: CountParams): string | null => {
  if (isLoading && calendars.length === 0) {
    return null;
  }
  return calendars.length === 1 ? '1 calendar' : `${calendars.length} calendars`;
};

export const ConnectedCalendarSource = ({ source }: Props) => {
  const roles = useAppStore((state) => state.calendarRoles);
  const setCalendarRole = useAppStore((state) => state.setCalendarRole);
  const sources = useMemo<ReadonlyArray<CalendarSourceRef>>(
    () => [{ id: source.id, kind: source.kind }],
    [source.id, source.kind],
  );
  const listing = useCalendarList({ sources });
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = async (): Promise<void> => {
    setIsRemoving(true);
    setError(null);
    const outcome = await disconnectCalendarSource({ source });
    setIsRemoving(false);
    if (outcome.kind === 'failed') {
      setError(outcome.message);
    }
  };

  const facts = joinFacts({
    facts: [
      source.kind === 'ics' ? source.host : null,
      countLineOf({ calendars: listing.calendars, isLoading: listing.isLoading }),
      'read only',
    ],
  });

  return (
    <div data-calendar-source={source.id} className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-2">
        <Band>
          <AccountRow
            label={source.kind === 'ics' ? 'Calendar link' : 'This Mac'}
            primary={source.label}
            secondary={facts}
            action={
              isConfirming ? null : (
                <Button size="sm" variant="quiet" onClick={() => setIsConfirming(true)}>
                  Disconnect calendars
                </Button>
              )
            }
          />
        </Band>
        {isConfirming ? (
          <InlineConfirm
            role="danger"
            icon={<Unlink size={ICON_SIZE.control} aria-hidden />}
            title={`Disconnect ${source.label}?`}
            description={
              source.kind === 'ics'
                ? 'Its calendars leave Goodboy and the link is taken off the Keychain. Paste the link again to bring them back.'
                : 'Its calendars leave Goodboy. The calendars stay on this Mac.'
            }
            confirmLabel="Disconnect calendars"
            isBusy={isRemoving}
            note={error}
            onConfirm={disconnect}
            onCancel={() => {
              setIsConfirming(false);
              setError(null);
            }}
          />
        ) : null}
      </div>
      <CalendarRoleList
        label="What each calendar shows"
        calendars={listing.calendars}
        failure={listing.error ?? listing.failures[0]?.message ?? null}
        isLoading={listing.isLoading}
        roleOf={({ calendar }) =>
          calendarRoleOf({ roles, sourceId: source.id, calendarId: calendar.id })
        }
        onChange={({ calendar, role }) =>
          void setCalendarRole({ entry: { sourceId: source.id, calendarId: calendar.id, role } })
        }
        onRetry={listing.reload}
      />
    </div>
  );
};
