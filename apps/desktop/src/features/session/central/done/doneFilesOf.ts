import type { ProviderRunId, TurnFile, TurnFileSet } from '@goodboy/types';
import type { DoneFiles } from './doneTypes';

type ByAgentParams = {
  readonly sets: ReadonlyArray<TurnFileSet>;
  readonly runIdsByAgentId: ReadonlyMap<string, ReadonlyArray<ProviderRunId>>;
};

type MergeParams = {
  readonly agentIds: ReadonlyArray<string>;
  readonly byAgentId: ReadonlyMap<string, DoneFiles>;
};

export const doneFilesByAgentOf = ({
  sets,
  runIdsByAgentId,
}: ByAgentParams): ReadonlyMap<string, DoneFiles> => {
  const byAgent = new Map<string, DoneFiles>();
  for (const [agentId, runIds] of runIdsByAgentId) {
    const mine = sets.filter((set) => runIds.includes(set.runId));
    if (mine.length === 0) {
      continue;
    }
    const own = new Map<string, TurnFile>();
    const hidden = new Set<string>();
    for (const set of mine) {
      for (const file of set.own) {
        own.set(file.path, file);
      }
      for (const path of set.fromBase) {
        hidden.add(path);
      }
    }
    byAgent.set(agentId, {
      own: Array.from(own.values()),
      fromBase: Array.from(hidden).filter((path) => !own.has(path)),
    });
  }
  return byAgent;
};

export const doneFilesOf = ({ agentIds, byAgentId }: MergeParams): DoneFiles | null => {
  const found = agentIds.flatMap((id) => {
    const files = byAgentId.get(id);
    return files === undefined ? [] : [files];
  });
  if (found.length === 0) {
    return null;
  }
  const own = new Map<string, TurnFile>();
  const hidden = new Set<string>();
  for (const files of found) {
    for (const file of files.own) {
      own.set(file.path, file);
    }
    for (const path of files.fromBase) {
      hidden.add(path);
    }
  }
  const merged: DoneFiles = {
    own: Array.from(own.values()),
    fromBase: Array.from(hidden).filter((path) => !own.has(path)),
  };
  return merged.own.length === 0 && merged.fromBase.length === 0 ? null : merged;
};
