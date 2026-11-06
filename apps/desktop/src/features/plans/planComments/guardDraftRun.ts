import type { ArtifactId } from '@goodboy/types';
import { draftSavesOk } from './draftSavesOk';

type Params = Readonly<{
  artifactId: ArtifactId;
  confirmedCount: number;
  countDrafts: () => number;
}>;

type DraftRunGuard = 'ok' | 'blocked' | 'changed';

export const guardDraftRun = async ({
  artifactId,
  confirmedCount,
  countDrafts,
}: Params): Promise<DraftRunGuard> => {
  if (!(await draftSavesOk({ artifactId }))) {
    return 'blocked';
  }
  return countDrafts() > confirmedCount ? 'changed' : 'ok';
};
