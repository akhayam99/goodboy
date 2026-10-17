import { useEffect, useState } from 'react';
import { studioRailFoldKey } from '@goodboy/ui';
import { NotificationsScene } from '../audit/NotificationsScene';

const FOLD_KEY = studioRailFoldKey({ surface: 'notifications' });

type Props = Record<never, never>;

export const NotificationsFoldedScene = ({}: Props) => {
  const [isFolded, setIsFolded] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(FOLD_KEY, '1');
    } catch {
      return;
    }
    setIsFolded(true);
    return () => {
      try {
        localStorage.removeItem(FOLD_KEY);
      } catch {
        return;
      }
    };
  }, []);
  return isFolded ? <NotificationsScene openLabels={['Open all']} /> : null;
};
