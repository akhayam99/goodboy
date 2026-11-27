import { useAutoBoardWatch } from '../../features/auto/hooks/useAutoBoardWatch';
import { useAttentionTargets } from '../../features/session/hooks/useAttentionTargets';
import { useReminderTriggers } from '../../features/calendar/reminders/hooks/useReminderTriggers';
import { useNeedsYouAnnouncement } from '../hooks/useNeedsYouAnnouncement';

export const NeedsYouAnnouncementBridge = () => {
  useNeedsYouAnnouncement();
  useReminderTriggers({});
  useAutoBoardWatch();
  useAttentionTargets();
  return null;
};
