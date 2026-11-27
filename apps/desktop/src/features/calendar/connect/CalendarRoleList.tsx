import type { CalendarInfo, CalendarRole } from '@goodboy/types';
import { Button, EmptyLine, Notice } from '@goodboy/ui';
import { CalendarRoleRow } from './CalendarRoleRow';
import { ConnectSection } from './ConnectSection';

type RoleParams = {
  readonly calendar: CalendarInfo;
};

type ChangeParams = RoleParams & {
  readonly role: CalendarRole;
};

type Props = {
  readonly label: string;
  readonly calendars: ReadonlyArray<CalendarInfo>;
  readonly failure: string | null;
  readonly isLoading: boolean;
  readonly roleOf: (params: RoleParams) => CalendarRole;
  readonly onChange: (params: ChangeParams) => void;
  readonly onRetry: () => void;
};

const READING = 'Reading your calendars';
const NONE = 'No calendars here yet';

export const CalendarRoleList = ({
  label,
  calendars,
  failure,
  isLoading,
  roleOf,
  onChange,
  onRetry,
}: Props) => (
  <ConnectSection label={label}>
    {failure === null ? null : (
      <Notice
        tone="danger"
        placement="inline"
        role="alert"
        title="Couldn't read these calendars."
        body={failure}
        actions={
          <Button
            size="sm"
            variant="secondary"
            isBusy={isLoading}
            busyLabel="Reading"
            onClick={onRetry}
          >
            Retry
          </Button>
        }
      />
    )}
    {calendars.length === 0 && failure === null ? (
      <EmptyLine>{isLoading ? READING : NONE}</EmptyLine>
    ) : null}
    {calendars.length > 0 ? (
      <div className="flex min-w-0 flex-col">
        {calendars.map((calendar) => (
          <CalendarRoleRow
            key={`${calendar.sourceId}:${calendar.id}`}
            calendar={calendar}
            role={roleOf({ calendar })}
            onChange={(role) => onChange({ calendar, role })}
          />
        ))}
      </div>
    ) : null}
  </ConnectSection>
);
