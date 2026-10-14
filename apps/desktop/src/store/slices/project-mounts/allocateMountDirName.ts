import { isMountDirTaken } from './isMountDirTaken';
import { mountDirName } from './mountDirName';
import { seededRandom } from './seededRandom';

const SHORT_DRAWS = 8;
const LONG_LENGTH = 12;

type TakenParams = {
  readonly dirName: string;
};

type Params = {
  readonly mountId: string;
  readonly repoPath: string;
  readonly parentDir: string;
  readonly random?: () => number;
  readonly isTaken?: (params: TakenParams) => Promise<boolean>;
};

export const allocateMountDirName = async ({
  mountId,
  repoPath,
  parentDir,
  random = seededRandom({ seed: mountId }),
  isTaken = ({ dirName }) => isMountDirTaken({ repoPath, parentDir, dirName }),
}: Params): Promise<string> => {
  for (let draw = 0; draw < SHORT_DRAWS; draw += 1) {
    const dirName = mountDirName({ mountId, random });
    const isDrawTaken = await isTaken({ dirName });
    if (isDrawTaken === false) {
      return dirName;
    }
  }
  return mountDirName({ mountId, random, length: LONG_LENGTH });
};
