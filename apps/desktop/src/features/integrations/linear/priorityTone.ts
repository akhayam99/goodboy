const PRIORITY_TONES: Readonly<Record<number, string>> = {
  1: 'bg-danger',
  2: 'bg-warning',
  3: 'bg-info',
  4: 'bg-idle',
};

type Params = {
  readonly priority: number | null | undefined;
};

type PriorityMark = {
  readonly tone: string;
  readonly shape: 'dot' | 'dash';
};

const NO_PRIORITY: PriorityMark = { tone: 'bg-idle', shape: 'dash' };

export const priorityTone = ({ priority }: Params): PriorityMark => {
  if (priority == null) {
    return NO_PRIORITY;
  }
  const tone = PRIORITY_TONES[priority];
  if (tone === undefined) {
    return NO_PRIORITY;
  }
  return { tone, shape: 'dot' };
};
