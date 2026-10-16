import { GridScene } from './c01/GridScene';

export const U25_C01_GRID_SCENES = {
  'c01-grid-list': () => <GridScene state="list" />,
  'c01-grid-groups': () => <GridScene state="groups" />,
  'c01-grid-dots': () => <GridScene state="dots" />,
  'c01-grid-type': () => <GridScene state="type" />,
};
