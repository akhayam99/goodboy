// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Rolldown } from 'vite';
import { demoChunks } from './demoChunks';

const BOOT = 'boot';

type FakeModule = {
  readonly isEntry?: boolean;
  readonly importers?: ReadonlyArray<string>;
};

type GraphParams = {
  readonly modules: Readonly<Record<string, FakeModule>>;
};

const graphOf = ({ modules }: GraphParams) => ({
  getModuleInfo: (moduleId: string) => {
    const found = modules[moduleId];
    if (found === undefined) {
      return null;
    }
    return {
      id: moduleId,
      isEntry: found.isEntry === true,
      importers: [...(found.importers ?? [])],
    } as unknown as Rolldown.ModuleInfo;
  },
});

type ChunkParams = {
  readonly modules: Readonly<Record<string, FakeModule>>;
  readonly moduleId: string;
};

const SPLIT = demoChunks();

const chunkOf = ({ modules, moduleId }: ChunkParams): unknown => {
  const name = SPLIT.groups?.[0]?.name;
  if (typeof name !== 'function') {
    throw new Error('demoChunks names its boot group with a function');
  }
  return name(moduleId, graphOf({ modules }));
};

const MODULES: Readonly<Record<string, FakeModule>> = {
  main: { isEntry: true },
  store: { importers: ['main'] },
  format: { importers: ['store', 'scene'] },
  scene: { importers: [] },
  sceneOnly: { importers: ['scene'] },
  loopA: { importers: ['loopB', 'main'] },
  loopB: { importers: ['loopA'] },
};

describe('demoChunks', () => {
  it('puts the entry and every module it imports statically into the boot chunk', () => {
    expect(chunkOf({ modules: MODULES, moduleId: 'main' })).toBe(BOOT);
    expect(chunkOf({ modules: MODULES, moduleId: 'store' })).toBe(BOOT);
    expect(chunkOf({ modules: MODULES, moduleId: 'format' })).toBe(BOOT);
  });

  it('leaves modules only a lazy chunk reaches out of the boot chunk', () => {
    expect(chunkOf({ modules: MODULES, moduleId: 'scene' })).toBeNull();
    expect(chunkOf({ modules: MODULES, moduleId: 'sceneOnly' })).toBeNull();
  });

  it('ends on an import cycle', () => {
    expect(chunkOf({ modules: MODULES, moduleId: 'loopA' })).toBe(BOOT);
    expect(chunkOf({ modules: MODULES, moduleId: 'loopB' })).toBe(BOOT);
  });

  it('leaves a module the graph does not know out of the boot chunk', () => {
    expect(chunkOf({ modules: MODULES, moduleId: 'missing' })).toBeNull();
  });

  it('gathers small modules that lazy chunks share after the boot chunk', () => {
    const shared = SPLIT.groups?.[1];
    expect(shared?.name).toBe('shared');
    expect(shared?.minShareCount).toBe(2);
    expect(shared?.maxModuleSize).toBeGreaterThan(0);
  });
});
