import { demoRuns } from './demoRunRegistry';

type Params = {
  readonly ms: number;
};

export const waitDemoMs = ({ ms }: Params): Promise<boolean> => {
  const generation = demoRuns.generation();
  return new Promise((resolve) => {
    setTimeout(() => resolve(demoRuns.isCurrent({ generation })), ms);
  });
};
