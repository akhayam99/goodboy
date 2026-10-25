import type { ReactNode } from 'react';
import { PageColumn, tintClasses } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioTrail } from '../../../../shared/components/StudioShell/StudioTrail';

type Props = {
  readonly identifier: string;
  readonly onBack: () => void;
  readonly children: ReactNode;
};

export const TaskFullPage = ({ identifier, onBack, children }: Props) => (
  <div className="flex h-full min-h-0 flex-col">
    <StudioTrail
      segments={[
        {
          id: 'tasks',
          label: NAMES.tasks,
          icon: CONCEPT_ICONS.inbox,
          iconClassName: tintClasses(CONCEPT_TONE.inbox).icon,
          onSelect: onBack,
        },
        { id: 'task', label: identifier, icon: CONCEPT_ICONS.inbox },
      ]}
    />
    <PageColumn width="measure" className="flex min-h-0 flex-1 flex-col px-0 @max-[720px]:px-0">
      {children}
    </PageColumn>
  </div>
);
