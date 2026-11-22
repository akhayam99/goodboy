import { isRecord } from '@goodboy/types/helpers';
import type { SessionFace } from './types';

type Params = {
  readonly raw: string | null;
};

export const storedFaceOf = ({ raw }: Params): SessionFace => {
  if (raw === null) {
    return 'overview';
  }
  let value: unknown = null;
  try {
    value = JSON.parse(raw);
  } catch {
    value = null;
  }
  return isRecord(value) && value.face === 'desk' ? 'desk' : 'overview';
};
