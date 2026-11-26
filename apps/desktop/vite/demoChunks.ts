import type { Rolldown } from 'vite';

const BOOT_CHUNK = 'boot';

const SHARED_CHUNK = 'shared';

const SMALL_MODULE_BYTES = 8000;

type ModuleGraph = {
  readonly getModuleInfo: (moduleId: string) => Rolldown.ModuleInfo | null;
};

type ReachParams = {
  readonly moduleId: string;
  readonly graph: ModuleGraph;
  readonly seen: Map<string, boolean>;
};

type WalkParams = {
  readonly moduleId: string;
  readonly graph: ModuleGraph;
  readonly seen: ReadonlyMap<string, boolean>;
};

const reachesEntry = ({ moduleId, graph, seen }: WalkParams): boolean => {
  const visited = new Set<string>([moduleId]);
  const pending = [moduleId];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) {
      return false;
    }
    if (seen.get(current) === true) {
      return true;
    }
    const info = graph.getModuleInfo(current);
    if (info == null) {
      continue;
    }
    if (info.isEntry) {
      return true;
    }
    const fresh = info.importers.filter((importer) => !visited.has(importer));
    fresh.forEach((importer) => visited.add(importer));
    pending.push(...fresh);
  }
  return false;
};

const isLoadedAtBoot = ({ moduleId, graph, seen }: ReachParams): boolean => {
  const isBootModule = seen.get(moduleId);
  if (isBootModule !== undefined) {
    return isBootModule;
  }
  const isReached = reachesEntry({ moduleId, graph, seen });
  seen.set(moduleId, isReached);
  return isReached;
};

export const demoChunks = (): Rolldown.CodeSplittingOptions => {
  const seen = new Map<string, boolean>();
  return {
    groups: [
      {
        name: (moduleId, graph) => (isLoadedAtBoot({ moduleId, graph, seen }) ? BOOT_CHUNK : null),
      },
      {
        name: SHARED_CHUNK,
        minShareCount: 2,
        maxModuleSize: SMALL_MODULE_BYTES,
      },
    ],
  };
};
