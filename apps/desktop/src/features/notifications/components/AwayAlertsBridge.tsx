import { useAttentionSync } from '../../../shared/hooks/useAttentionSync';
import { useAwayAlerts } from '../hooks/useAwayAlerts';

export const AwayAlertsBridge = () => {
  useAttentionSync();
  useAwayAlerts();
  return null;
};
