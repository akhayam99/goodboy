import type { ComponentType } from 'react';
import { AutoChildReturnedScene } from './AutoChildReturnedScene';

export const U37_AUTO_CHILD_RETURNED_SCENES: Readonly<Record<string, ComponentType>> = {
  'auto-child-returned': () => <AutoChildReturnedScene state="returned" />,
  'auto-child-returned-today': () => <AutoChildReturnedScene state="today" />,
  'auto-child-returned-decided': () => <AutoChildReturnedScene state="decided" />,
  'auto-child-returned-asks': () => <AutoChildReturnedScene state="asks" />,
  'auto-child-decided': () => <AutoChildReturnedScene state="released" />,
  'auto-asks-you': () => <AutoChildReturnedScene state="proposed" />,
};
