import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { PageColumn } from '@goodboy/ui';
import { NAMES } from '../../../../shared/names';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly onBack: () => void;
  readonly children: ReactNode;
};

export const TaskFullPage = ({ onBack, children }: Props) => (
  <div className="flex h-full min-h-0 flex-col">
    <PageColumn width="measure" className="flex min-h-0 flex-1 flex-col px-0 @max-[720px]:px-0">
      <div className="flex h-10 shrink-0 items-center">
        <button
          type="button"
          aria-label={`Back to ${NAMES.tasks}`}
          onClick={onBack}
          className="flex min-h-7 items-center gap-1 rounded-md text-label text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft size={ICON_SIZE.row} aria-hidden />
          {NAMES.tasks}
        </button>
      </div>
      {children}
    </PageColumn>
  </div>
);
