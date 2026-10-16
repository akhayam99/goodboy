import { useCallback, useState } from 'react';

export const useArtifactParts = () => {
  const [openPartsIds, setOpenPartsIds] = useState<ReadonlySet<string>>(new Set());

  const toggleParts = useCallback((rowId: string) => {
    setOpenPartsIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
        return next;
      }
      next.add(rowId);
      return next;
    });
  }, []);

  return { openPartsIds, toggleParts };
};
