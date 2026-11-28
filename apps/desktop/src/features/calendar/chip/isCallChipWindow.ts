import { currentWindowLabel } from '../../workspace/window';

const CALL_CHIP_LABEL = 'call-chip';

export const isCallChipWindow = (): boolean => currentWindowLabel() === CALL_CHIP_LABEL;
