import { countPerf } from '../../../shared/lib/countPerf';
import { PERF_COUNT_NAMES } from '../../../shared/lib/perfCountNames';
import type { StageRead, StageReads } from './recordStageReads';

type ReadParams = {
  readonly read: StageRead;
  readonly next: unknown;
};

const subCompareCountOf = ({ read, next }: ReadParams): number => {
  if (read.subKeys === null || typeof next !== 'object' || next === null) {
    return -1;
  }
  for (let index = 0; index < read.subKeys.length; index++) {
    const subKey = read.subKeys[index];
    if (subKey === undefined || !Object.is(Reflect.get(next, subKey), read.subValues[index])) {
      return -1;
    }
  }
  return read.subKeys.length;
};

type Params = {
  readonly reads: StageReads;
  readonly state: object;
};

export const areStageReadsCurrent = ({ reads, state }: Params): boolean => {
  let compared = 0;
  let isCurrent = true;
  for (const read of reads) {
    const next: unknown = Reflect.get(state, read.key);
    compared += 1;
    if (Object.is(next, read.value)) {
      continue;
    }
    const subCompared = subCompareCountOf({ read, next });
    if (subCompared < 0) {
      isCurrent = false;
      break;
    }
    compared += subCompared;
    read.value = next;
  }
  countPerf({ name: PERF_COUNT_NAMES.stageReadsCompared, amount: compared });
  return isCurrent;
};
