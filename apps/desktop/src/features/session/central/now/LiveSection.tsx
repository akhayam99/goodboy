import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';
import type { LiveSection as LiveSectionModel } from './liveSectionsOf';

type Props = {
  readonly section: LiveSectionModel;
  readonly children: ReactNode;
};

export const LiveSection = ({ section, children }: Props) => (
  <div
    role="group"
    aria-label={section.title}
    data-live-section={section.id}
    className="flex min-w-0 flex-col gap-1"
  >
    <span className="flex min-w-0 items-center gap-2">
      <Eyebrow label={section.title} muted />
      <span data-live-section-count="" className="text-ui tabular-nums text-faint-foreground">
        {section.groups.length}
      </span>
    </span>
    {children}
  </div>
);
