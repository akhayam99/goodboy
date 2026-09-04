import type { InboxRecord, InboxState } from './types';

type InboxAgeSectionKey = 'today' | 'yesterday' | 'this-week' | 'older';

type InboxAgeSection = {
  readonly key: InboxAgeSectionKey;
  readonly label: string;
  readonly records: ReadonlyArray<InboxRecord>;
};

type Params = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly now?: number;
};

type Boundaries = {
  readonly today: number;
  readonly yesterday: number;
  readonly week: number;
};

const SECTION_ORDER = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this-week', label: 'This week' },
  { key: 'older', label: 'Older' },
] satisfies ReadonlyArray<{ readonly key: InboxAgeSectionKey; readonly label: string }>;

const STATE_PRIORITY = {
  alert: 0,
  active: 1,
  open: 2,
  done: 3,
} satisfies Record<InboxState, number>;

type StartOfDayParams = {
  readonly date: Date;
};

const startOfDay = ({ date }: StartOfDayParams): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

type BoundariesParams = {
  readonly now: number;
};

const ageBoundaries = ({ now }: BoundariesParams): Boundaries => {
  const date = new Date(now);
  const today = startOfDay({ date });
  const dayOfWeekFromMonday = (date.getDay() + 6) % 7;
  return {
    today,
    yesterday: new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1).getTime(),
    week: new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() - dayOfWeekFromMonday,
    ).getTime(),
  };
};

type SectionKeyParams = {
  readonly record: InboxRecord;
  readonly boundaries: Boundaries;
};

const sectionKeyForRecord = ({ record, boundaries }: SectionKeyParams): InboxAgeSectionKey => {
  const updatedAt = Date.parse(record.updatedAt);
  if (Number.isNaN(updatedAt)) {
    return 'older';
  }
  if (updatedAt >= boundaries.today) {
    return 'today';
  }
  if (updatedAt >= boundaries.yesterday) {
    return 'yesterday';
  }
  if (updatedAt >= boundaries.week) {
    return 'this-week';
  }
  return 'older';
};

export const groupRecordsByAge = ({
  records,
  now = Date.now(),
}: Params): ReadonlyArray<InboxAgeSection> => {
  const boundaries = ageBoundaries({ now });
  return SECTION_ORDER.map(({ key, label }) => ({
    key,
    label,
    records: records
      .filter((record) => sectionKeyForRecord({ record, boundaries }) === key)
      .sort((left, right) => {
        const stateDifference = STATE_PRIORITY[left.state] - STATE_PRIORITY[right.state];
        if (stateDifference !== 0) {
          return stateDifference;
        }
        return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      }),
  })).filter((section) => section.records.length > 0);
};
