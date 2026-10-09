import type { ComponentType } from 'react';

type SceneMap = Readonly<Record<string, ComponentType>>;
type Modules = Readonly<Record<string, Readonly<Record<string, unknown>>>>;
type Params = {
  readonly modules: Modules;
};

const isSceneMap = (value: unknown): value is SceneMap =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((scene) => typeof scene === 'function');

export const buildSceneRegistry = ({ modules }: Params): SceneMap => {
  const scenes: Record<string, ComponentType> = {};
  const owners = new Map<string, string>();
  for (const [path, exports] of Object.entries(modules)) {
    const maps = Object.entries(exports)
      .filter(([name]) => name.endsWith('_SCENES'))
      .map(([, value]) => value)
      .filter(isSceneMap);
    for (const map of maps) {
      for (const [id, Scene] of Object.entries(map)) {
        const owner = owners.get(id);
        if (owner !== undefined) {
          throw new Error(`Duplicate scene "${id}" in ${owner} and ${path}`);
        }
        scenes[id] = Scene;
        owners.set(id, path);
      }
    }
  }
  return scenes;
};
