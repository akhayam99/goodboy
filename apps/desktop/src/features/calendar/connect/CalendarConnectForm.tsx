import { useState } from 'react';
import type { CalendarRole, CalendarSourceKind } from '@goodboy/types';
import { Button, ChoiceCards, EmptyLine, FormActions, type ChoiceCardOption } from '@goodboy/ui';
import { AccessRefusedNotice } from './AccessRefusedNotice';
import { CalendarLinkFields } from './CalendarLinkFields';
import { CalendarReadsList } from './CalendarReadsList';
import { CALENDAR_CONNECT_COPY } from './calendarConnectCopy';
import { calendarLinkErrorOf } from './calendarLinkErrorOf';
import { ConnectSection } from './ConnectSection';
import { connectCalendarLink } from './connectCalendarLink';
import { connectMacCalendars } from './connectMacCalendars';
import { MacCalendarsPreview } from './MacCalendarsPreview';
import { useCalendarAccess } from './hooks/useCalendarAccess';

type Props = {
  readonly isMacOffered: boolean;
  readonly onConnected?: () => void;
  readonly onCancel?: () => void;
};

const RECOMMENDED = <span className="text-meta text-faint-foreground">Recommended</span>;

const MAC_OPTION: ChoiceCardOption<CalendarSourceKind> = {
  value: 'eventkit',
  label: CALENDAR_CONNECT_COPY.eventkit.name,
  hint: CALENDAR_CONNECT_COPY.eventkit.hint,
  badge: RECOMMENDED,
};

const LINK_OPTION: ChoiceCardOption<CalendarSourceKind> = {
  value: 'ics',
  label: CALENDAR_CONNECT_COPY.ics.name,
  hint: CALENDAR_CONNECT_COPY.ics.hint,
};

const WAITING_FOR_ACCESS = 'Your calendars show here once macOS allows access.';

export const CalendarConnectForm = ({ isMacOffered, onConnected, onCancel }: Props) => {
  const { access, setAccess } = useCalendarAccess({ isMac: isMacOffered });
  const isMacShown = isMacOffered && access !== 'unsupported';
  const [picked, setPicked] = useState<CalendarSourceKind>('eventkit');
  const kind: CalendarSourceKind = isMacShown ? picked : 'ics';
  const [roles, setRoles] = useState<Readonly<Record<string, CalendarRole>>>({});
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const options = isMacShown ? [MAC_OPTION, LINK_OPTION] : [LINK_OPTION];

  const connectMac = async (): Promise<void> => {
    const outcome = await connectMacCalendars({ roles, nowMs: Date.now() });
    if (outcome.kind === 'refused') {
      setAccess(outcome.access);
      return;
    }
    if (outcome.kind === 'failed') {
      setError(outcome.message);
      return;
    }
    onConnected?.();
  };

  const connectLink = async (): Promise<void> => {
    const invalid = calendarLinkErrorOf({ url });
    setLinkError(invalid);
    if (invalid !== null) {
      return;
    }
    const outcome = await connectCalendarLink({ label, url, nowMs: Date.now() });
    if (outcome.kind === 'failed') {
      setError(outcome.message);
      return;
    }
    onConnected?.();
  };

  const connect = async (): Promise<void> => {
    setIsBusy(true);
    setError(null);
    try {
      await (kind === 'eventkit' ? connectMac() : connectLink());
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <form
      aria-label="Connect a calendar"
      className="flex min-w-0 flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void connect();
      }}
    >
      <ConnectSection label="Source">
        <ChoiceCards
          ariaLabel="Source"
          className="sm:grid-cols-2"
          isHintWrapped
          options={options}
          value={kind}
          onChange={(next) => {
            setPicked(next);
            setError(null);
          }}
        />
      </ConnectSection>
      <CalendarReadsList kind={kind} />
      {kind === 'eventkit' && access === 'granted' ? (
        <MacCalendarsPreview
          roles={roles}
          onRoleChange={({ calendarId, role }) =>
            setRoles((current) => ({ ...current, [calendarId]: role }))
          }
        />
      ) : null}
      {kind === 'eventkit' && access !== 'granted' ? (
        <ConnectSection label="Calendars">
          {access === 'denied' || access === 'restricted' ? (
            <AccessRefusedNotice access={access} />
          ) : (
            <EmptyLine>{WAITING_FOR_ACCESS}</EmptyLine>
          )}
        </ConnectSection>
      ) : null}
      {kind === 'ics' ? (
        <CalendarLinkFields
          url={url}
          label={label}
          error={linkError}
          isDisabled={isBusy}
          onUrlChange={(next) => {
            setUrl(next);
            setLinkError(null);
          }}
          onLabelChange={setLabel}
        />
      ) : null}
      <FormActions
        leading={
          <span className="text-meta text-faint-foreground">
            {CALENDAR_CONNECT_COPY[kind].actionHint}
          </span>
        }
        error={error}
      >
        {onCancel === undefined ? null : (
          <Button type="button" variant="quiet" disabled={isBusy} onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" isBusy={isBusy} busyLabel="Connecting">
          {error === null ? 'Connect calendars' : 'Retry'}
        </Button>
      </FormActions>
    </form>
  );
};
