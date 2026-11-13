import { perfSeam, type PerfCount } from './perfSeam';

type Params = PerfCount;

export const countPerf = ({ name, detail, amount }: Params): void => {
  const counter = perfSeam.counter;
  if (counter === null) {
    return;
  }
  counter({ name, detail, amount });
};
