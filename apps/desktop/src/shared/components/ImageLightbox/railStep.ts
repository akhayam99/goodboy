type StepParams = {
  readonly key: string;
};

type NextParams = {
  readonly key: string;
  readonly ids: ReadonlyArray<string>;
  readonly activeIndex: number;
};

const railStepOf = ({ key }: StepParams): -1 | 0 | 1 => {
  if (key === 'ArrowUp' || key === 'ArrowLeft') {
    return -1;
  }
  if (key === 'ArrowDown' || key === 'ArrowRight') {
    return 1;
  }
  return 0;
};

export const railTargetOf = ({ key, ids, activeIndex }: NextParams): string | null => {
  const step = railStepOf({ key });
  if (step === 0 || ids.length < 2) {
    return null;
  }
  return ids[(activeIndex + step + ids.length) % ids.length] ?? null;
};
