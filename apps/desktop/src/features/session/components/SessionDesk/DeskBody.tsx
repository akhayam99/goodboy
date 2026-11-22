import { useState } from 'react';
import type { Session } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { useOverviewModel } from '../SessionOverviewPane/useOverviewModel';
import { DeskColumn } from './DeskColumn';
import { DeskStatusRow } from './DeskStatusRow';
import { DeskToolStatus } from './DeskToolStatus';
import { useIsDeskNarrow } from './useIsDeskNarrow';

type Props = {
  readonly session: Session;
};

export const DeskBody = ({ session }: Props) => {
  const model = useOverviewModel({ session });
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const isNarrow = useIsDeskNarrow({ element: frame });
  return (
    <div
      ref={setFrame}
      data-session-desk=""
      data-desk-narrow={isNarrow ? '' : undefined}
      className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 px-4 pb-3"
    >
      {isNarrow ? (
        <>
          <DeskStatusRow session={session} model={model} />
          <DeskToolStatus sessionId={session.id} />
        </>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 gap-3">
          <aside aria-label={NAMES.desk} className="flex min-h-0 w-75 shrink-0 flex-col">
            <DeskColumn session={session} model={model} isInPopover={false} />
          </aside>
          <DeskToolStatus sessionId={session.id} />
        </div>
      )}
    </div>
  );
};
