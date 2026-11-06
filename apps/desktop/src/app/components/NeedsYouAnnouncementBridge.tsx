import { useAutoBoardWatch } from '../../features/auto/hooks/useAutoBoardWatch';
import { useAttentionTargets } from '../../features/session/hooks/useAttentionTargets';
import { useNeedsYouAnnouncement } from '../hooks/useNeedsYouAnnouncement';

export const NeedsYouAnnouncementBridge = () => {
  useNeedsYouAnnouncement();
  useAutoBoardWatch();
  useAttentionTargets();
  return null;
};
