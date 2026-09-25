import type { MountId } from '@goodboy/types';
import type { RunnableScript, SessionScriptGroup } from './buildSessionScripts';

export type ResolvedScriptTarget = {
  readonly group: SessionScriptGroup;
  readonly script: RunnableScript;
};

type Params = {
  readonly groups: ReadonlyArray<SessionScriptGroup>;
  readonly scriptKey: string;
  readonly mountId: MountId | null;
};

type FindParams = {
  readonly group: SessionScriptGroup;
  readonly scriptKey: string;
};

const findIn = ({ group, scriptKey }: FindParams): ResolvedScriptTarget | null => {
  const script = group.scripts.find((candidate) => candidate.key === scriptKey) ?? null;
  return script === null ? null : { group, script };
};

export const resolveScriptTarget = ({
  groups,
  scriptKey,
  mountId,
}: Params): ResolvedScriptTarget | null => {
  const preferred =
    mountId === null ? undefined : groups.find((group) => group.mountId === mountId);
  if (preferred !== undefined) {
    const hit = findIn({ group: preferred, scriptKey });
    if (hit !== null) {
      return hit;
    }
  }
  for (const group of groups) {
    const hit = findIn({ group, scriptKey });
    if (hit !== null) {
      return hit;
    }
  }
  return null;
};
