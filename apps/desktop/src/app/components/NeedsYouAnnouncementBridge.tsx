import { useNeedsYouAnnouncement } from '../hooks/useNeedsYouAnnouncement';

export const NeedsYouAnnouncementBridge = () => {
  useNeedsYouAnnouncement();
  return null;
};
