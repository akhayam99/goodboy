import type { ProviderRunId } from '../ids';

const isProviderRunId = (value: string): value is ProviderRunId => value !== '';

let counter = 0;

export const nextProviderRunId = (): ProviderRunId => {
  counter += 1;
  const id = `run-${counter}`;
  if (!isProviderRunId(id)) {
    throw new Error('empty run id');
  }
  return id;
};
