import { useAttentionSync } from '../../../shared/hooks/useAttentionSync';
import { CallChipBridge } from '../../calendar/chip/CallChipBridge';
import { useAwayAlerts } from '../hooks/useAwayAlerts';

export const AwayAlertsBridge = () => {
  useAttentionSync();
  useAwayAlerts();
  return <CallChipBridge />;
};
