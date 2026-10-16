import type { ComponentType } from 'react';
import { InboxScene } from '../InboxScene';
import { NotificationsScene } from '../audit/NotificationsScene';

export const U24_RAILS_SCENES: Readonly<Record<string, ComponentType>> = {
  'tasks-rail': () => <InboxScene isDrawerClosed />,
  'tasks-rail-open': () => <InboxScene />,
  'tasks-rail-folded': () => <InboxScene isDrawerClosed />,
  'notifications-rail': () => <NotificationsScene openLabels={['Open all']} />,
};
