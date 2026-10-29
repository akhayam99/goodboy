import type { BlockParams } from './demoHintTypes';

const CONTROLS =
  'button, a[href], input, textarea, select, [role="tab"], [role="radio"], [role="checkbox"], [role="menuitem"], [role="treeitem"]';
const DEMO_ANCHOR = '[data-demo-anchor]';

export const isOtherControl = ({ target }: BlockParams): boolean =>
  target.closest(CONTROLS) !== null && target.closest(DEMO_ANCHOR) === null;
