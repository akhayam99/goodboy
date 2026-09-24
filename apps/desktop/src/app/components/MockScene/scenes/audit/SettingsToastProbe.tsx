import { useEffect, useRef } from 'react';
import { useToast } from '../../../Toast';
import { sceneParam } from './sceneParams';

export const SettingsToastProbe = () => {
  const { previewNotification } = useToast();
  const hasFired = useRef(false);
  useEffect(() => {
    if (hasFired.current || sceneParam({ key: 'toast' }) !== '1') {
      return;
    }
    hasFired.current = true;
    previewNotification({
      severity: 'warning',
      title: "Couldn't remove 1 archived worktree",
      message: 'Removed 3. The others stay on disk.',
      persist: true,
    });
  }, [previewNotification]);
  return null;
};
