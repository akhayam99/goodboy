import { BASE_SCENES } from './base';
import { buildSceneRegistry } from './buildSceneRegistry';

export const MOCK_SCENES = buildSceneRegistry({
  modules: {
    './base.ts': { BASE_SCENES },
    ...import.meta.glob<Readonly<Record<string, unknown>>>(
      ['../scenes/u*/*.tsx', '!../scenes/u*/*.test.tsx'],
      { eager: true },
    ),
  },
});
