import type { TelemetryRecord } from '@goodboy/types';

export const sumSessionCost = (records: readonly TelemetryRecord[]): number => {
  let sum = 0;
  for (const record of records) {
    sum += record.estimatedCostUsd;
  }
  return sum;
};
