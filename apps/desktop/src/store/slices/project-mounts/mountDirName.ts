import type { MountId } from '@goodboy/types';
import { sanitizeSlug } from './sanitizeSlug';

const MAX_DIR_NAME_LENGTH = 48;

type Params = {
  readonly sessionSlug: string;
  readonly mountId: MountId;
};

export const mountDirName = ({ sessionSlug, mountId }: Params): string => {
  const id = sanitizeSlug(mountId);
  const budget = MAX_DIR_NAME_LENGTH - id.length - 1;
  const head = budget <= 0 ? '' : sanitizeSlug(sessionSlug).slice(0, budget).replace(/-+$/g, '');
  if (head === '') {
    return id;
  }
  if (id === '') {
    return head;
  }
  return `${head}-${id}`;
};
