import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button, PageColumn } from '@goodboy/ui';
import { NAMES } from '../../../../shared/names';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly onBack: () => void;
  readonly children: ReactNode;
};

export const TaskFullPage = ({ onBack, children }: Props) => (
  <div className="flex h-full min-h-0 flex-col">
    <div className="flex h-10 shrink-0 items-center px-4">
      <Button variant="ghost" size="sm" aria-label={`Back to ${NAMES.tasks}`} onClick={onBack}>
        <ChevronLeft size={ICON_SIZE.row} aria-hidden />
        Back
      </Button>
    </div>
    <PageColumn width="measure" className="flex min-h-0 flex-1 flex-col px-0 @max-[720px]:px-0">
      {children}
    </PageColumn>
  </div>
);
