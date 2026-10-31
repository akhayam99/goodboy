import type { ReactNode } from 'react';
import { SectionLabel } from '@goodboy/ui';
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
    className="flex min-w-0 flex-col gap-2"
  >
    <SectionLabel
      headingLevel={2}
      label={section.title}
      count={<span data-live-section-count="">{section.groups.length}</span>}
    />
    {children}
  </div>
);
