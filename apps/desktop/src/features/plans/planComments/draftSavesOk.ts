import type { ArtifactId } from '@goodboy/types';
import { PENDING_DRAFT_SAVES } from './PENDING_DRAFT_SAVES';
import { heldDraftStore } from './heldDraftStore';

type Params = Readonly<{ artifactId: ArtifactId | null }>;

export const draftSavesOk = async ({ artifactId }: Params): Promise<boolean> => {
  if (PENDING_DRAFT_SAVES.size > 0) {
    await Promise.allSettled([...PENDING_DRAFT_SAVES]);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
  return artifactId === null || !heldDraftStore.hasFor({ artifactId });
};
