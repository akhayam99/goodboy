type Params = {
  readonly now: number;
};

export type SnoozeTimes = Readonly<{
  inAnHour: number;
  tomorrowMorning: number;
}>;

const HOUR_MS = 3_600_000;
const MORNING_HOUR = 9;

export const snoozeTimesOf = ({ now }: Params): SnoozeTimes => {
  const today = new Date(now);
  return {
    inAnHour: now + HOUR_MS,
    tomorrowMorning: new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
      MORNING_HOUR,
    ).getTime(),
  };
};
