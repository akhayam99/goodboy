import { R4ColumnScene } from './R4ColumnScene';
import { R4ReposMixScene } from './R4ReposMixScene';
import { R4SwitcherScene } from './R4SwitcherScene';

export const U25_R4_WORKSPACE_SCENES = {
  'r4-column-dark': () => <R4ColumnScene theme="dark" />,
  'r4-column-light': () => <R4ColumnScene theme="light" />,
  'r4-workspace-switcher': R4SwitcherScene,
  'r4-repos-mix': R4ReposMixScene,
};
