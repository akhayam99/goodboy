import type { ReactNode } from 'react';
import { SectionHeader, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';

type Concept = 'decisions' | 'sessionSummary' | 'explore';

type Props = {
  readonly concept: Concept;
  readonly sectionId: string;
  readonly title: string;
  readonly description: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
};

export const ContextSection = ({
  concept,
  sectionId,
  title,
  description,
  actions,
  children,
}: Props) => {
  const Icon = CONCEPT_ICONS[concept];
  const tint = tintClasses(CONCEPT_TONE[concept]);

  return (
    <section id={sectionId} aria-label={title} className="flex flex-col gap-4">
      <SectionHeader
        headingLevel={2}
        label={title}
        hint={description}
        icon={<Icon size={13} aria-hidden className={tint.icon} />}
        action={actions}
      />
      {children}
    </section>
  );
};
