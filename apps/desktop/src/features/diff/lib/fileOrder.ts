import type { FileDiff } from '@goodboy/types';
import type { ViewedState } from './reviewedFiles';

type StepParams = {
  readonly order: ReadonlyArray<string>;
  readonly from: string | null;
  readonly delta: 1 | -1;
  readonly accepts: (path: string) => boolean;
};

export const stepPath = ({ order, from, delta, accepts }: StepParams): string | null => {
  const start = from === null ? -1 : order.indexOf(from);
  if (start < 0 && delta === -1) {
    return order.find(accepts) ?? null;
  }
  for (let index = start + delta; index >= 0 && index < order.length; index += delta) {
    const path = order[index];
    if (path !== undefined && accepts(path)) {
      return path;
    }
  }
  return null;
};

type UnviewedParams = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly from: string | null;
  readonly stateOf: (file: FileDiff) => ViewedState;
  readonly wrap: boolean;
};

export const nextUnviewedPath = ({ files, from, stateOf, wrap }: UnviewedParams): string | null => {
  const start = from === null ? -1 : files.findIndex((file) => file.path === from);
  const pending = (file: FileDiff): boolean => file.path !== from && stateOf(file) !== 'viewed';
  const after = files.slice(start + 1).find(pending);
  if (after !== undefined || !wrap) {
    return after?.path ?? null;
  }
  return files.slice(0, Math.max(start, 0)).find(pending)?.path ?? null;
};
