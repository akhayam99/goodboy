import { useAttentionSync } from '../../../shared/hooks/useAttentionSync';
import { useAutoBoardWatch } from '../../auto/useAutoBoardWatch';
import { useAttentionTargets } from '../../session/useAttentionTargets';
import { useAwayAlerts } from '../hooks/useAwayAlerts';

export const AwayAlertsBridge = () => {
  useAttentionSync();
  useAutoBoardWatch();
  useAttentionTargets();
  useAwayAlerts();
  return null;
};
