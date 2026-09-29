import { MAX_SLUG_LENGTH, slugify } from '@goodboy/core';
import type { MountId } from '@goodboy/types';

type Params = {
  readonly sessionSlug: string;
  readonly mountId: MountId;
};

const slugifyOrEmpty = (input: string): string => slugify({ input, fallback: '' });

export const mountDirName = ({ sessionSlug, mountId }: Params): string => {
  const id = slugifyOrEmpty(mountId);
  const budget = MAX_SLUG_LENGTH - id.length - 1;
  const head = budget <= 0 ? '' : slugifyOrEmpty(sessionSlug).slice(0, budget).replace(/-+$/g, '');
  if (head === '') {
    return id;
  }
  if (id === '') {
    return head;
  }
  return `${head}-${id}`;
};
