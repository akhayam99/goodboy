import { CONTROLS } from './controlSelector';
import type { BlockParams } from './demoHintTypes';

export const isAnyControl = ({ target }: BlockParams): boolean => target.closest(CONTROLS) !== null;
