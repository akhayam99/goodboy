import { CONTROLS } from './controlSelector';
import type { BlockParams } from './demoHintTypes';

const DEMO_ANCHOR = '[data-demo-anchor]';

export const isOtherControl = ({ target }: BlockParams): boolean =>
  target.closest(CONTROLS) !== null && target.closest(DEMO_ANCHOR) === null;
