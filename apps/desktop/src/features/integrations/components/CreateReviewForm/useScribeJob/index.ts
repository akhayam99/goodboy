import type { ExtractedScribeText } from '@goodboy/core';
import type { MountId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { scribeKeyOf } from '../../../../../store/slices/scribe/scribeKeyOf';

type Params = {
  readonly mountId: MountId | null;
};

export type ScribeJob = {
  readonly key: string | null;
  readonly status: 'none' | 'writing' | 'ready' | 'creating' | 'created' | 'failed';
  readonly output: ExtractedScribeText | null;
  readonly error: string | null;
  readonly updatedAt: number;
};

const NO_JOB: ScribeJob = {
  key: null,
  status: 'none',
  output: null,
  error: null,
  updatedAt: 0,
};

export const useScribeJob = ({ mountId }: Params): ScribeJob => {
  const key = mountId === null ? null : scribeKeyOf({ mountId, kind: 'pr' });
  const work = useAppStore((state) => (key === null ? null : (state.scribeWork[key] ?? null)));
  if (key === null || work === null) {
    return { ...NO_JOB, key };
  }
  return {
    key,
    status: work.status,
    output: work.output,
    error: work.error,
    updatedAt: work.updatedAt,
  };
};
