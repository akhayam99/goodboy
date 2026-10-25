import { useAnnouncementStore } from '../../shared/lib/announcer';

export const AnnouncementRegion = () => {
  const message = useAnnouncementStore((state) => state.message);
  const sequence = useAnnouncementStore((state) => state.sequence);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      <span key={sequence}>{message}</span>
    </div>
  );
};
