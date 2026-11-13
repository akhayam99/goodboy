export type PerfCount = {
  readonly name: string;
  readonly detail?: string | undefined;
  readonly amount?: number | undefined;
};

export type PerfSeam = {
  counter: ((count: PerfCount) => void) | null;
};

export const perfSeam: PerfSeam = { counter: null };
