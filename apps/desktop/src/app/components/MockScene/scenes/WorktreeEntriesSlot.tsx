import { useLayoutEffect, useRef } from 'react';
import { worktreeLevelSlot } from '../../../../features/branch/worktreeLevelSlot';

export const WorktreeEntriesSlot = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const host = ref.current;
    if (host === null) {
      return;
    }
    worktreeLevelSlot.attach({ host });
    return () => worktreeLevelSlot.detach({ host });
  }, []);
  return <div ref={ref} data-slot="worktree-level-entries" />;
};
