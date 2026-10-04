import { useEffect } from 'react';
import { useAppStore } from '../../store/store';
import { useToast } from '../../shared/components/Toast';
import { useShortcut } from '../../shared/keyboard/useShortcut';

export const UndoToastBridge = () => {
  const { showToast } = useToast();
  useShortcut('app.undo', () => void useAppStore.getState().undoLastOperation({}));
  useEffect(() => {
    const flush = () => {
      const { undoNotices, clearUndoNotices } = useAppStore.getState();
      if (undoNotices.length === 0) {
        return;
      }
      clearUndoNotices({ ids: undoNotices.map((notice) => notice.id) });
      for (const notice of undoNotices) {
        showToast(notice.toast);
      }
    };
    const unsubscribe = useAppStore.subscribe(flush);
    flush();
    return unsubscribe;
  }, [showToast]);
  return null;
};
