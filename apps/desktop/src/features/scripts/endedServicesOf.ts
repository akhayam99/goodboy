import type { SessionId } from '@goodboy/types';
import type { EndedWork } from '../../store/slices/ended-work/state';
import type { RunnableScript, SessionScriptGroup } from './buildSessionScripts';
import { isService } from './classifyScript';

type Params = {
  readonly ended: EndedWork | null;
  readonly sessionId: SessionId;
  readonly groups: ReadonlyArray<SessionScriptGroup>;
};

export type EndedService = {
  readonly group: SessionScriptGroup;
  readonly script: RunnableScript;
};

type InsideParams = {
  readonly cwd: string;
  readonly root: string;
};

const isUnderRoot = ({ cwd, root }: InsideParams): boolean => {
  const base = root.replace(/[\\/]+$/, '');
  return cwd === base || cwd.startsWith(`${base}/`);
};

export const endedServicesOf = ({
  ended,
  sessionId,
  groups,
}: Params): ReadonlyArray<EndedService> => {
  if (ended === null) {
    return [];
  }
  return ended.scripts
    .filter((entry) => entry.sessionId === sessionId)
    .flatMap((entry) => {
      for (const group of groups) {
        if (!group.isReady || !isUnderRoot({ cwd: entry.cwd, root: group.worktreePath })) {
          continue;
        }
        const script = group.scripts.find(
          (candidate) => candidate.key === entry.scriptId && isService({ script: candidate }),
        );
        if (script !== undefined) {
          return [{ group, script }];
        }
      }
      return [];
    });
};
