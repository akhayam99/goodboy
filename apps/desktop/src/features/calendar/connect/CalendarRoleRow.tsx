import type { CalendarInfo, CalendarRole } from '@goodboy/types';
import { SegmentedTabs, StatusDot } from '@goodboy/ui';
import { calendarRoleOptionsOf } from './calendarRoleOptionsOf';

type Props = {
  readonly calendar: CalendarInfo;
  readonly role: CalendarRole;
  readonly isDisabled?: boolean;
  readonly onChange: (role: CalendarRole) => void;
};

export const CalendarRoleRow = ({ calendar, role, isDisabled = false, onChange }: Props) => {
  const options = calendarRoleOptionsOf({ title: calendar.title, role }).map((option) => ({
    ...option,
    disabled: isDisabled,
  }));
  return (
    <div data-calendar-row={calendar.id} className="flex min-h-12 min-w-0 items-center gap-3">
      <StatusDot tone={role === 'hide' ? 'neutral' : 'info'} role="presentation" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-row text-foreground">{calendar.title}</span>
        {calendar.account === null ? null : (
          <span className="truncate text-meta text-faint-foreground">{calendar.account}</span>
        )}
      </span>
      <SegmentedTabs
        size="xs"
        ariaLabel={`${calendar.title} shows`}
        options={options}
        value={role}
        onChange={onChange}
      />
    </div>
  );
};
