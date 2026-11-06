import { useAttentionSync } from '../../../shared/hooks/useAttentionSync';
import { useAutoBoardWatch } from '../../auto/useAutoBoardWatch';
import { useAwayAlerts } from '../hooks/useAwayAlerts';

export const AwayAlertsBridge = () => {
  useAttentionSync();
  useAutoBoardWatch();
  useAwayAlerts();
  return null;
};
