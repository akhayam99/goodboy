import { useState } from 'react';

export const useHistoryExpanded = () => {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggleExpanded = (sha: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(sha)) {
        next.delete(sha);
        return next;
      }
      next.add(sha);
      return next;
    });
  return { expanded, toggleExpanded };
};
