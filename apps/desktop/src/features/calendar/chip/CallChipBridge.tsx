import { CallChipViewSync } from './CallChipViewSync';
import { useCallChipBridge } from './hooks/useCallChipBridge';

export const CallChipBridge = () => {
  const { isChipShown, onShowFailed } = useCallChipBridge();
  return isChipShown ? <CallChipViewSync onShowFailed={onShowFailed} /> : null;
};
