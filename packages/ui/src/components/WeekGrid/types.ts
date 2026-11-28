export type WeekGridBlock = {
  readonly key: string;
  readonly title: string;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly color: string;
  readonly isQuiet?: boolean;
  readonly ariaLabel: string;
};

export type WeekGridDay = {
  readonly key: string;
  readonly label: string;
  readonly isToday: boolean;
  readonly blocks: ReadonlyArray<WeekGridBlock>;
};
