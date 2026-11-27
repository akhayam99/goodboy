import type { CalendarRole } from '@goodboy/types';
import type { SegmentedTabOption } from '@goodboy/ui';

type Params = {
  readonly title: string;
  readonly role: CalendarRole;
};

const SHOW: SegmentedTabOption<CalendarRole> = { value: 'show', label: 'Show' };
const BUSY: SegmentedTabOption<CalendarRole> = { value: 'busy', label: 'Busy only' };
const FOCUS: SegmentedTabOption<CalendarRole> = { value: 'focus', label: 'Focus' };
const HIDE: SegmentedTabOption<CalendarRole> = { value: 'hide', label: 'Hide' };

const FOCUS_NAME = 'focus';

export const calendarRoleOptionsOf = ({
  title,
  role,
}: Params): ReadonlyArray<SegmentedTabOption<CalendarRole>> => {
  const isFocusOffered = role === 'focus' || title.trim().toLowerCase().includes(FOCUS_NAME);
  if (isFocusOffered) {
    return [SHOW, BUSY, FOCUS, HIDE];
  }
  return [SHOW, BUSY, HIDE];
};
