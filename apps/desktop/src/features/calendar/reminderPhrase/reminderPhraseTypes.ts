export type Clock = {
  readonly hour: number;
  readonly minute: number;
};

export type Span = {
  readonly start: number;
  readonly length: number;
};

export type DayWord = 'today' | 'tonight' | 'tomorrow' | 'weekday';

export type ClockMatch = Span & {
  readonly clock: Clock;
};

export type DayMatch = Span & {
  readonly word: DayWord;
  readonly weekday: number;
  readonly isNext: boolean;
};

export type AfterUnit = 'minutes' | 'hours' | 'days';

export type AfterMatch = Span & {
  readonly unit: AfterUnit;
  readonly amount: number;
};
