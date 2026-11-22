import { useState } from 'react';
import { DockLane, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { useOverviewModel } from '../SessionOverviewPane/useOverviewModel';
import { DeskColumn } from './DeskColumn';
import { DeskStatusRow } from './DeskStatusRow';
import { DeskToolStatus } from './DeskToolStatus';
import { useIsDeskNarrow } from './useIsDeskNarrow';
import { useIsDeskShown } from './useIsDeskShown';

type Props = {
  readonly session: Session;
};

export const DeskBody = ({ session }: Props) => {
  const model = useOverviewModel({ session });
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const isNarrow = useIsDeskNarrow({ element: frame });
  const isShown = useIsDeskShown({ sessionId: session.id });
  return (
    <div
      ref={setFrame}
      data-session-desk=""
      data-desk-narrow={isNarrow ? '' : undefined}
      className={cn(
        'flex h-full min-h-0 w-full min-w-0 gap-3 px-4 pb-3',
        isNarrow ? 'flex-col' : 'flex-row',
      )}
    >
      {isNarrow ? (
        <>
          <DeskStatusRow session={session} model={model} />
          <DeskToolStatus sessionId={session.id} />
        </>
      ) : (
        <>
          <aside aria-label={NAMES.desk} className="flex min-h-0 w-75 shrink-0 flex-col">
            <DeskColumn session={session} model={model} isInPopover={false} />
          </aside>
          <DeskToolStatus sessionId={session.id} />
        </>
      )}
      {isShown ? <DockLane /> : <div className="min-h-0 min-w-0 flex-1" />}
    </div>
  );
};
