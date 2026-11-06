import { PENDING_DRAFT_SAVES } from './PENDING_DRAFT_SAVES';

export const draftSavesOk = async (): Promise<boolean> => {
  if (PENDING_DRAFT_SAVES.size === 0) {
    return true;
  }
  const outcomes = await Promise.allSettled([...PENDING_DRAFT_SAVES]);
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  return !outcomes.some((outcome) => outcome.status === 'rejected');
};
