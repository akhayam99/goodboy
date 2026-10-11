import { useEffect, useState, type ComponentType } from 'react';
import { studioRailFoldKey } from '@goodboy/ui';
import { InboxScene } from '../InboxScene';
import { NotificationsScene } from '../audit/NotificationsScene';

const TasksFolded = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    localStorage.setItem(studioRailFoldKey({ surface: 'inbox' }), '1');
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return <InboxScene isDrawerClosed />;
};

export const U24_RAILS_SCENES: Readonly<Record<string, ComponentType>> = {
  'tasks-rail': () => <InboxScene isDrawerClosed />,
  'tasks-rail-open': () => <InboxScene />,
  'tasks-rail-folded': TasksFolded,
  'notifications-rail': () => <NotificationsScene openLabels={['Open all']} />,
};
