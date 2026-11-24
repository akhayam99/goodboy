import { StatusDot } from '@goodboy/ui';

export const UnseenReleaseDot = () => (
  <span data-unseen-release="" className="pointer-events-none absolute right-0.5 top-0.5 flex">
    <StatusDot tone="unread" size="sm" className="ring-2 ring-chrome" />
  </span>
);
