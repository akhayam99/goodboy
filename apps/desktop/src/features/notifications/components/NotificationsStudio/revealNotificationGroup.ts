import { appScrollIntoView } from '@goodboy/ui';

type Params = {
  readonly key: string;
};

export const revealNotificationGroup = ({ key }: Params): void => {
  requestAnimationFrame(() => {
    const row = document.querySelector(`[data-notification-key="${CSS.escape(key)}"]`);
    appScrollIntoView({ element: row, block: 'nearest' });
  });
};
