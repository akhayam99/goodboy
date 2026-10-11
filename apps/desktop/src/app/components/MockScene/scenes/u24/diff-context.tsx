import { DiffContextScene } from './DiffContextScene';

export const U24_DIFF_CONTEXT_SCENES = {
  'diff-gaps': () => <DiffContextScene state="gaps" />,
  'diff-gaps-expanded': () => <DiffContextScene state="expanded" />,
  'diff-gaps-toolarge': () => <DiffContextScene state="toolarge" />,
};
