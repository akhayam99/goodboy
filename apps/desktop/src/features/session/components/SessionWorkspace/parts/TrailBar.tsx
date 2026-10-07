import type { ReactNode } from 'react';
import type { Session } from '@goodboy/types';
import { PageColumn } from '@goodboy/ui';
import { SessionCrumbs } from '../../SessionTrail/SessionCrumbs';

type Props = {
  readonly session: Session;
  readonly end?: ReactNode;
};

export const TrailBar = ({ session, end }: Props) => (
  <div data-slot="trail-bar" className="flex h-10 shrink-0 items-start pb-1 pt-3">
    <PageColumn width="column" className="flex h-6 min-w-0 items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center">
        <SessionCrumbs session={session} />
      </div>
      {end === undefined ? null : (
        <div data-slot="trail-end" className="flex h-6 shrink-0 items-center">
          {end}
        </div>
      )}
    </PageColumn>
  </div>
);
